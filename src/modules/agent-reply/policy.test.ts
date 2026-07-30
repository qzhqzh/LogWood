import { describe, expect, it } from 'vitest'
import {
  AgentReplyAttitude,
  AgentReplyStrategy,
} from '@prisma/client'
import { recommendReplyRoute } from './policy'

describe('agent-reply/policy', () => {
  it('routes an ordinary technical question to one low-cost member', () => {
    expect(recommendReplyRoute('这个 API 的数据库事务边界怎么处理？')).toEqual({
      attitude: AgentReplyAttitude.curious,
      strategy: AgentReplyStrategy.technical,
      priority: 5,
      selectedAgentIds: ['qwen_worker'],
    })
  })

  it('escalates a substantive hostile technical challenge to the council', () => {
    const route = recommendReplyRoute(
      '这套架构根本不懂数据库性能，事务和缓存的论证全是胡说，'
      + '至少先解释并发写入、失败重试和幂等性，再来谈这个 API 能不能上线。'
      + '现在的结论完全没有压测证据，也没有说明版本和部署条件。',
    )
    expect(route.strategy).toBe(AgentReplyStrategy.council)
    expect(route.selectedAgentIds).toEqual([
      'qwen_worker',
      'deepseek_reasoner',
    ])
  })

  it('ignores spam without selecting any model', () => {
    const route = recommendReplyRoute(
      '加微刷单返利 https://a.example https://b.example https://c.example',
    )
    expect(route.strategy).toBe(AgentReplyStrategy.ignore)
    expect(route.selectedAgentIds).toEqual([])
  })
})
