#!/usr/bin/env bun

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvConfig } from '@next/env'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '../../../..')
loadEnvConfig(repositoryRoot)

const command = process.argv[2]
const inputPath = process.argv[3]
const endpoint = process.env.LOGWOOD_MCP_URL || 'http://127.0.0.1:10000/api/mcp'
const apiKey = process.env.LOGWOOD_MCP_API_KEY
const agentId = process.env.LOGWOOD_MCP_AGENT_ID || 'codex'

function usage(): never {
  throw new Error([
    'Usage:',
    '  logwood-article-mcp.ts check',
    '  logwood-article-mcp.ts topic <input.json>',
    '  logwood-article-mcp.ts topic-update <input.json>',
    '  logwood-article-mcp.ts draft <input.json>',
    '  logwood-article-mcp.ts publish <input.json>',
  ].join('\n'))
}

async function readJsonInput() {
  if (!inputPath) usage()
  return JSON.parse(await readFile(resolve(process.cwd(), inputPath), 'utf8')) as Record<string, unknown>
}

function textResult(result: Awaited<ReturnType<Client['callTool']>>) {
  const text = result.content
    .filter((item): item is Extract<typeof item, { type: 'text' }> => item.type === 'text')
    .map((item) => item.text)
    .join('\n')
  if (result.isError) throw new Error(text || 'ERR_LOGWOOD_MCP_TOOL')
  return text || JSON.stringify(result, null, 2)
}

if (!apiKey) throw new Error('LOGWOOD_MCP_API_KEY is not configured')
if (!command) usage()

const client = new Client({ name: 'logwood-article-publisher', version: '1.0.0' })
const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-LogWood-Agent-Id': agentId,
    },
  },
})

try {
  await client.connect(transport)

  if (command === 'check') {
    const listed = await client.listTools()
    for (const required of ['logwood_article_publish', 'logwood_article_confirm_publish']) {
      if (!listed.tools.some((tool) => tool.name === required)) {
        throw new Error(`ERR_LOGWOOD_MCP_TOOL_MISSING:${required}`)
      }
    }
    console.log(textResult(await client.callTool({
      name: 'logwood_capabilities_get',
      arguments: {},
    })))
  } else if (command === 'topic') {
    const input = await readJsonInput()
    const suppliedTags = Array.isArray(input.tags)
      ? input.tags.filter((tag): tag is string => typeof tag === 'string')
      : []
    const tags = [...new Set([
      ...suppliedTags.filter((tag) => tag !== 'visibility:private'),
      'article-topic',
    ])]
    console.log(textResult(await client.callTool({
      name: 'logwood_inspiration_record',
      arguments: { ...input, tags, visibility: 'private' },
    })))
  } else if (command === 'topic-update') {
    const input = await readJsonInput()
    console.log(textResult(await client.callTool({
      name: 'logwood_inspiration_update',
      arguments: { ...input, visibility: 'private' },
    })))
  } else if (command === 'draft') {
    const input = await readJsonInput()
    console.log(textResult(await client.callTool({
      name: 'logwood_article_publish',
      arguments: { ...input, status: 'draft' },
    })))
  } else if (command === 'publish') {
    const input = await readJsonInput()
    if (input.confirmation !== 'CONFIRM_PUBLISH_CURRENT_VERSION') {
      throw new Error('ERR_ARTICLE_PUBLICATION_CONFIRMATION_REQUIRED')
    }
    console.log(textResult(await client.callTool({
      name: 'logwood_article_confirm_publish',
      arguments: input,
    })))
  } else {
    usage()
  }
} finally {
  await client.close()
}
