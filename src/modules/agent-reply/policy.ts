import {
  AgentReplyAttitude,
  AgentReplyStrategy,
} from '@prisma/client'

export interface ReplyRoute {
  attitude: AgentReplyAttitude
  strategy: AgentReplyStrategy
  priority: number
  selectedAgentIds: string[]
  policyReason?: string
}

const SPAM_PATTERN = /(https?:\/\/\S+.*){3,}|(.)\2{8,}|加微|刷单|返利|代开发票/i
const UNSAFE_PATTERN = /人肉|开盒|住址|身份证|弄死|杀了|自杀|炸掉/i
const ABUSIVE_PATTERN = /傻逼|蠢货|脑残|废物|垃圾玩意|狗屁|弱智/i
const HOSTILE_PATTERN = /胡说|扯淡|放屁|可笑|烂透|什么玩意|根本不懂|别装|洗地|打脸/i
const TECHNICAL_PATTERN = /api|sdk|bug|代码|架构|性能|安全|漏洞|数据库|协议|模型|token|提示词|部署|仓库|github|测试|版本|延迟|成本/i
const FRIENDLY_PATTERN = /谢谢|赞同|有用|不错|受教|学到了|支持|喜欢/i
const PII_PATTERN = /(?:\b1[3-9]\d{9}\b)|(?:\b\d{17}[\dXx]\b)|(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/
const LINK_PATTERN = /(?:https?:\/\/|www\.)\S+/i

export function assessGeneratedReply(content: string): {
  safe: boolean
  reason?: string
} {
  const normalized = content.trim()
  if (!normalized) return { safe: false, reason: 'MODEL_OUTPUT_EMPTY' }
  if (UNSAFE_PATTERN.test(normalized)) {
    return { safe: false, reason: 'MODEL_OUTPUT_UNSAFE' }
  }
  if (ABUSIVE_PATTERN.test(normalized) || SPAM_PATTERN.test(normalized)) {
    return { safe: false, reason: 'MODEL_OUTPUT_ABUSIVE' }
  }
  if (PII_PATTERN.test(normalized)) {
    return { safe: false, reason: 'MODEL_OUTPUT_PII' }
  }
  if (LINK_PATTERN.test(normalized)) {
    return { safe: false, reason: 'MODEL_OUTPUT_LINK' }
  }
  return { safe: true }
}

export function recommendReplyRoute(content: string): ReplyRoute {
  const normalized = content.trim()
  const technical = TECHNICAL_PATTERN.test(normalized)
  const substantive = normalized.length >= 100

  if (SPAM_PATTERN.test(normalized)) {
    return {
      attitude: AgentReplyAttitude.spam,
      strategy: AgentReplyStrategy.ignore,
      priority: 0,
      selectedAgentIds: [],
      policyReason: 'POLICY_SPAM',
    }
  }

  if (UNSAFE_PATTERN.test(normalized)) {
    return {
      attitude: AgentReplyAttitude.abusive,
      strategy: AgentReplyStrategy.escalate,
      priority: 10,
      selectedAgentIds: [],
      policyReason: 'POLICY_UNSAFE',
    }
  }

  if (ABUSIVE_PATTERN.test(normalized) || HOSTILE_PATTERN.test(normalized)) {
    if (technical || substantive) {
      return {
        attitude: AgentReplyAttitude.hostile,
        strategy: AgentReplyStrategy.council,
        priority: 9,
        selectedAgentIds: ['qwen_worker', 'deepseek_reasoner'],
      }
    }
    return {
      attitude: AgentReplyAttitude.hostile,
      strategy: AgentReplyStrategy.sharp,
      priority: 8,
      selectedAgentIds: ['deepseek_reasoner'],
    }
  }

  if (technical) {
    return {
      attitude: normalized.includes('?') || normalized.includes('？')
        ? AgentReplyAttitude.curious
        : AgentReplyAttitude.skeptical,
      strategy: AgentReplyStrategy.technical,
      priority: 5,
      selectedAgentIds: ['qwen_worker'],
    }
  }

  if (FRIENDLY_PATTERN.test(normalized)) {
    return {
      attitude: AgentReplyAttitude.friendly,
      strategy: AgentReplyStrategy.friendly,
      priority: 2,
      selectedAgentIds: ['qwen_worker'],
    }
  }

  return {
    attitude: normalized.includes('?') || normalized.includes('？')
      ? AgentReplyAttitude.curious
      : AgentReplyAttitude.unknown,
    strategy: AgentReplyStrategy.friendly,
    priority: 3,
    selectedAgentIds: ['qwen_worker'],
  }
}
