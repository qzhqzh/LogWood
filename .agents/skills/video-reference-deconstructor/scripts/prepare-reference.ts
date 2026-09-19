import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface VideoProbe {
  durationSec: number
  width: number
  height: number
  aspectRatio: string
  frameRate: number | null
  videoCodec: string
  container: string
  audioStreams: number
}

export interface ShotBoundary {
  id: string
  startSec: number
  endSec: number
  durationSec: number
  timecode: string
  samples: Array<{ label: 'start' | 'middle' | 'end'; timeSec: number }>
}

export interface PrepareOptions {
  inputPath: string
  outputPath: string
  sceneThreshold?: number
  minShotSeconds?: number
  maxShots?: number
  now?: Date
}

interface ToolResult {
  stdout: string
  stderr: string
}

interface FfprobePayload {
  streams?: Array<{
    codec_type?: string
    codec_name?: string
    width?: number
    height?: number
    avg_frame_rate?: string
    r_frame_rate?: string
  }>
  format?: {
    duration?: string
    format_name?: string
  }
}

const DEFAULT_SCENE_THRESHOLD = 0.32
const DEFAULT_MIN_SHOT_SECONDS = 0.5
const DEFAULT_MAX_SHOTS = 80

function roundSeconds(value: number): number {
  return Number(value.toFixed(3))
}

function gcd(left: number, right: number): number {
  let a = Math.abs(Math.round(left))
  let b = Math.abs(Math.round(right))
  while (b !== 0) [a, b] = [b, a % b]
  return a || 1
}

function aspectRatio(width: number, height: number): string {
  const divisor = gcd(width, height)
  return `${width / divisor}:${height / divisor}`
}

export function parseFraction(value: string | undefined): number | null {
  if (!value) return null
  const [rawNumerator, rawDenominator] = value.split('/')
  const numerator = Number(rawNumerator)
  const denominator = rawDenominator === undefined ? 1 : Number(rawDenominator)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null
  const result = numerator / denominator
  return result > 0 ? result : null
}

function runTool(command: string, args: string[]): Promise<ToolResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', (error) => reject(new Error(`${command} could not start: ${error.message}`)))
    child.on('close', (code) => {
      const result = {
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }
      if (code === 0) resolve(result)
      else reject(new Error(`${command} exited with code ${code}: ${result.stderr.trim()}`))
    })
  })
}

export async function probeVideo(inputPath: string): Promise<VideoProbe> {
  const { stdout } = await runTool('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,format_name:stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate',
    '-of',
    'json',
    inputPath,
  ])
  const payload = JSON.parse(stdout) as FfprobePayload
  const streams = payload.streams ?? []
  const video = streams.find((stream) => stream.codec_type === 'video')
  const durationSec = Number(payload.format?.duration)
  const width = Number(video?.width)
  const height = Number(video?.height)

  if (!video || !Number.isFinite(durationSec) || durationSec <= 0 || width <= 0 || height <= 0) {
    throw new Error('The input does not contain a readable video stream with positive duration and dimensions.')
  }

  return {
    durationSec: roundSeconds(durationSec),
    width,
    height,
    aspectRatio: aspectRatio(width, height),
    frameRate: parseFraction(video.avg_frame_rate) ?? parseFraction(video.r_frame_rate),
    videoCodec: video.codec_name ?? 'unknown',
    container: payload.format?.format_name ?? 'unknown',
    audioStreams: streams.filter((stream) => stream.codec_type === 'audio').length,
  }
}

export function parseSceneTimes(stderr: string): number[] {
  const matches = stderr.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g)
  return [...matches]
    .map((match) => roundSeconds(Number(match[1])))
    .filter((value) => Number.isFinite(value))
}

export async function detectSceneTimes(inputPath: string, threshold: number): Promise<number[]> {
  const filter = `select='gt(scene,${threshold})',showinfo`
  const { stderr } = await runTool('ffmpeg', [
    '-hide_banner',
    '-nostdin',
    '-i',
    inputPath,
    '-filter:v',
    filter,
    '-an',
    '-f',
    'null',
    '-',
  ])
  return parseSceneTimes(stderr)
}

function frameSamples(startSec: number, endSec: number): ShotBoundary['samples'] {
  const duration = endSec - startSec
  if (duration <= 0.12) {
    return [{ label: 'middle', timeSec: roundSeconds((startSec + endSec) / 2) }]
  }

  const inset = Math.min(0.12, duration * 0.1)
  const candidates: ShotBoundary['samples'] = [
    { label: 'start', timeSec: roundSeconds(startSec + inset) },
    { label: 'middle', timeSec: roundSeconds((startSec + endSec) / 2) },
    { label: 'end', timeSec: roundSeconds(endSec - inset) },
  ]
  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex((other) => Math.abs(other.timeSec - candidate.timeSec) < 0.02) === index,
  )
}

function formatClock(seconds: number): string {
  const milliseconds = Math.round(seconds * 1000)
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000)
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000)
  const remainder = milliseconds % 1000
  return [hours, minutes, wholeSeconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':') + `.${String(remainder).padStart(3, '0')}`
}

export function buildShots(
  durationSec: number,
  rawCuts: number[],
  minShotSeconds = DEFAULT_MIN_SHOT_SECONDS,
  maxShots = DEFAULT_MAX_SHOTS,
): ShotBoundary[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('durationSec must be positive.')
  if (!Number.isFinite(minShotSeconds) || minShotSeconds <= 0) throw new Error('minShotSeconds must be positive.')
  if (!Number.isInteger(maxShots) || maxShots < 1) throw new Error('maxShots must be a positive integer.')

  const cuts = [...new Set(rawCuts.map(roundSeconds))]
    .filter((cut) => cut > 0 && cut < durationSec)
    .sort((left, right) => left - right)
  const boundaries = [0]
  for (const cut of cuts) {
    if (cut - boundaries[boundaries.length - 1]! >= minShotSeconds) boundaries.push(cut)
  }
  boundaries.push(durationSec)

  const shots = boundaries.slice(0, -1).map((startSec, index) => {
    const endSec = boundaries[index + 1]!
    return {
      id: `shot-${String(index + 1).padStart(3, '0')}`,
      startSec: roundSeconds(startSec),
      endSec: roundSeconds(endSec),
      durationSec: roundSeconds(endSec - startSec),
      timecode: `${formatClock(startSec)}–${formatClock(endSec)}`,
      samples: frameSamples(startSec, endSec),
    }
  })

  if (shots.length > maxShots) {
    throw new Error(
      `Detected ${shots.length} shots, above --max-shots ${maxShots}. Raise --scene-threshold, trim the input, or explicitly increase the limit.`,
    )
  }
  return shots
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

function portableSourcePath(inputPath: string): string {
  const relative = path.relative(process.cwd(), inputPath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : path.basename(inputPath)
}

async function extractFrame(inputPath: string, timeSec: number, outputPath: string): Promise<void> {
  await runTool('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-i',
    inputPath,
    '-ss',
    timeSec.toFixed(3),
    '-map',
    '0:v:0',
    '-frames:v',
    '1',
    '-q:v',
    '2',
    '-an',
    '-sn',
    '-dn',
    '-n',
    outputPath,
  ])
}

function shotbookTemplate(
  shots: Array<ShotBoundary & { evidenceFrames: Array<{ path: string; timeSec: number }> }>,
): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    status: 'template',
    referenceManifest: 'reference-manifest.json',
    rights: {
      ownershipOrPermission: null,
      redactions: [],
      protectedElementsNotToReproduce: [],
    },
    intent: null,
    target: {
      model: null,
      mode: null,
      aspectRatio: null,
      durationLimitSec: null,
      referenceInputs: [],
    },
    global: {
      anchors: [],
      creativeGrammar: [],
      uncertainties: [],
    },
    shots: shots.map((shot) => ({
      id: shot.id,
      sourceTime: {
        startSec: shot.startSec,
        endSec: shot.endSec,
        durationSec: shot.durationSec,
        timecode: shot.timecode,
      },
      evidenceFrames: shot.evidenceFrames,
      observations: {
        subject: [],
        action: [],
        environment: [],
        camera: [],
        lightColorMaterial: [],
        rhythmAudio: [],
      },
      inferences: [],
      continuity: {
        incomingAnchors: [],
        outgoingAnchors: [],
        intendedChanges: [],
        risks: [],
      },
      generationUnit: {
        intent: null,
        startFrame: null,
        subjectEnvironmentMotion: null,
        cameraMotion: null,
        endFrame: null,
        transitionIntent: null,
        neutralPromptBrief: null,
      },
    })),
  }
}

export async function prepareReference(options: PrepareOptions): Promise<{
  manifestPath: string
  shotbookPath: string
  shotCount: number
}> {
  const inputPath = path.resolve(options.inputPath)
  const outputPath = path.resolve(options.outputPath)
  const sceneThreshold = options.sceneThreshold ?? DEFAULT_SCENE_THRESHOLD
  const minShotSeconds = options.minShotSeconds ?? DEFAULT_MIN_SHOT_SECONDS
  const maxShots = options.maxShots ?? DEFAULT_MAX_SHOTS

  if (!Number.isFinite(sceneThreshold) || sceneThreshold <= 0 || sceneThreshold > 1) {
    throw new Error('--scene-threshold must be greater than 0 and at most 1.')
  }
  const inputStats = await stat(inputPath)
  if (!inputStats.isFile()) throw new Error('--input must point to a file.')

  await mkdir(outputPath, { recursive: true })
  const existing = await readdir(outputPath)
  if (existing.length > 0) {
    throw new Error(`Output directory is not empty: ${outputPath}. Use a new run directory.`)
  }

  const framesPath = path.join(outputPath, 'frames')
  await mkdir(framesPath)
  const probe = await probeVideo(inputPath)
  const detectedCuts = await detectSceneTimes(inputPath, sceneThreshold)
  const shots = buildShots(probe.durationSec, detectedCuts, minShotSeconds, maxShots)
  const preparedShots: Array<ShotBoundary & {
    evidenceFrames: Array<{ label: string; timeSec: number; path: string; sha256: string }>
  }> = []

  for (const shot of shots) {
    const evidenceFrames = []
    for (const sample of shot.samples) {
      const fileName = `${shot.id}-${sample.label}.jpg`
      const filePath = path.join(framesPath, fileName)
      await extractFrame(inputPath, sample.timeSec, filePath)
      evidenceFrames.push({
        label: sample.label,
        timeSec: sample.timeSec,
        path: path.posix.join('frames', fileName),
        sha256: await sha256File(filePath),
      })
    }
    preparedShots.push({ ...shot, evidenceFrames })
  }

  const manifestPath = path.join(outputPath, 'reference-manifest.json')
  const shotbookPath = path.join(outputPath, 'shotbook.json')
  const manifest = {
    schemaVersion: '1.0.0',
    createdAt: (options.now ?? new Date()).toISOString(),
    source: {
      path: portableSourcePath(inputPath),
      fileName: path.basename(inputPath),
      sha256: await sha256File(inputPath),
      sizeBytes: inputStats.size,
      ...probe,
    },
    detection: {
      method: 'ffmpeg-scene-score',
      sceneThreshold,
      minShotSeconds,
      maxShots,
      detectedCutTimesSec: detectedCuts,
      note: 'Cut times are heuristic candidates and require visual review.',
    },
    shots: preparedShots,
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await writeFile(shotbookPath, `${JSON.stringify(shotbookTemplate(preparedShots), null, 2)}\n`, 'utf8')
  return { manifestPath, shotbookPath, shotCount: preparedShots.length }
}

function parseArguments(tokens: string[]): { command?: string; values: Map<string, string> } {
  const [command, ...rest] = tokens
  const values = new Map<string, string>()
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index]
    const value = rest[index + 1]
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`Expected --key value, received: ${rest.slice(index).join(' ')}`)
    }
    if (values.has(key.slice(2))) throw new Error(`Duplicate argument: ${key}`)
    values.set(key.slice(2), value)
  }
  return { command, values }
}

function required(values: Map<string, string>, key: string): string {
  const value = values.get(key)
  if (!value) throw new Error(`Missing --${key}`)
  return value
}

function numeric(values: Map<string, string>, key: string, fallback: number): number {
  const raw = values.get(key)
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`--${key} must be numeric.`)
  return value
}

function usage(): string {
  return `Video Reference Deconstructor\n\n` +
    `Commands:\n` +
    `  probe --input FILE\n` +
    `  prepare --input FILE --out DIR [--scene-threshold 0.32] [--min-shot-seconds 0.5] [--max-shots 80]\n`
}

async function main(): Promise<void> {
  const { command, values } = parseArguments(process.argv.slice(2))
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(usage())
    return
  }
  if (command === 'probe') {
    process.stdout.write(`${JSON.stringify(await probeVideo(required(values, 'input')), null, 2)}\n`)
    return
  }
  if (command === 'prepare') {
    const result = await prepareReference({
      inputPath: required(values, 'input'),
      outputPath: required(values, 'out'),
      sceneThreshold: numeric(values, 'scene-threshold', DEFAULT_SCENE_THRESHOLD),
      minShotSeconds: numeric(values, 'min-shot-seconds', DEFAULT_MIN_SHOT_SECONDS),
      maxShots: numeric(values, 'max-shots', DEFAULT_MAX_SHOTS),
    })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }
  throw new Error(`Unknown command: ${command}\n\n${usage()}`)
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
