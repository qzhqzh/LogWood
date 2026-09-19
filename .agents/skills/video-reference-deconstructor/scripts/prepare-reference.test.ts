import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildShots,
  parseFraction,
  parseSceneTimes,
  prepareReference,
  probeVideo,
} from './prepare-reference'

const temporaryDirectories: string[] = []
const hasVideoTools =
  spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0 &&
  spawnSync('ffprobe', ['-version'], { stdio: 'ignore' }).status === 0

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'video-reference-deconstructor-'))
  temporaryDirectories.push(directory)
  return directory
}

function createSyntheticVideo(filePath: string): void {
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=red:s=160x90:d=1:r=10',
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:s=160x90:d=1:r=10',
      '-filter_complex',
      '[0:v][1:v]concat=n=2:v=1:a=0',
      '-pix_fmt',
      'yuv420p',
      '-y',
      filePath,
    ],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(result.stderr)
}

describe('video reference parsing', () => {
  it('parses frame-rate fractions without inventing invalid values', () => {
    expect(parseFraction('30000/1001')).toBeCloseTo(29.97, 2)
    expect(parseFraction('24')).toBe(24)
    expect(parseFraction('0/0')).toBeNull()
    expect(parseFraction(undefined)).toBeNull()
  })

  it('extracts scene timestamps from ffmpeg showinfo', () => {
    expect(parseSceneTimes('n:1 pts:10 pts_time:1.250 pos:4\nn:2 pts_time:2')).toEqual([1.25, 2])
  })

  it('builds continuous shots while suppressing cuts that are too close', () => {
    const shots = buildShots(3, [0.2, 1, 1.05, 2.5, 10], 0.5, 10)
    expect(shots).toHaveLength(3)
    expect(shots.map((shot) => [shot.startSec, shot.endSec])).toEqual([
      [0, 1],
      [1, 2.5],
      [2.5, 3],
    ])
    expect(shots[0]?.samples.map((sample) => sample.label)).toEqual(['start', 'middle', 'end'])
  })

  it('fails explicitly instead of silently truncating excessive shot counts', () => {
    expect(() => buildShots(4, [1, 2, 3], 0.2, 2)).toThrow('Detected 4 shots')
  })
})

describe.skipIf(!hasVideoTools)('video reference preparation', () => {
  it('probes, detects a hard cut, extracts evidence, and refuses overwrite', async () => {
    const root = await temporaryDirectory()
    const inputPath = path.join(root, 'reference.mp4')
    const outputPath = path.join(root, 'run')
    createSyntheticVideo(inputPath)

    const probe = await probeVideo(inputPath)
    expect(probe).toMatchObject({ width: 160, height: 90, aspectRatio: '16:9', audioStreams: 0 })
    expect(probe.durationSec).toBeCloseTo(2, 1)

    const result = await prepareReference({
      inputPath,
      outputPath,
      sceneThreshold: 0.1,
      minShotSeconds: 0.25,
      maxShots: 10,
      now: new Date('2026-08-31T00:00:00.000Z'),
    })
    expect(result.shotCount).toBe(2)

    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8')) as {
      createdAt: string
      source: { path: string; sha256: string }
      shots: Array<{ evidenceFrames: Array<{ path: string; sha256: string }> }>
    }
    const shotbook = JSON.parse(await readFile(result.shotbookPath, 'utf8')) as {
      status: string
      shots: unknown[]
    }
    expect(manifest.createdAt).toBe('2026-08-31T00:00:00.000Z')
    expect(manifest.source.path).toBe('reference.mp4')
    expect(manifest.source.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(manifest.shots).toHaveLength(2)
    expect(manifest.shots.flatMap((shot) => shot.evidenceFrames)).toHaveLength(6)
    expect(manifest.shots.flatMap((shot) => shot.evidenceFrames).every((frame) => /^[a-f0-9]{64}$/.test(frame.sha256))).toBe(true)
    expect(await readdir(path.join(outputPath, 'frames'))).toHaveLength(6)
    expect(shotbook.status).toBe('template')
    expect(shotbook.shots).toHaveLength(2)

    await expect(prepareReference({ inputPath, outputPath })).rejects.toThrow('Output directory is not empty')
  })
})
