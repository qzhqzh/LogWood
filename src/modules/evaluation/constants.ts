import {
  EvaluationProtocol,
  EvaluationReproducibility,
  EvaluationStatus,
  EvaluationVerdict,
} from '@prisma/client'

export interface EvaluationDimensionDefinition {
  key: string
  label: string
  description: string
}

export interface EvaluationProtocolDefinition {
  key: EvaluationProtocol
  label: string
  description: string
  dimensions: EvaluationDimensionDefinition[]
}

export const EVALUATION_PROTOCOL_VERSION = 2

export const EVALUATION_PROTOCOLS: Record<EvaluationProtocol, EvaluationProtocolDefinition> = {
  [EvaluationProtocol.skill]: {
    key: EvaluationProtocol.skill,
    label: 'Skill 评测',
    description: '验证一份 Prompt、Workflow 或 Skill 是否可复用、可复现，并明确失败边界。',
    dimensions: [
      { key: 'instruction_following', label: '指令遵循', description: '输出是否完整遵循指令和约束。' },
      { key: 'output_quality', label: '输出质量', description: '结果是否正确、完整并达到任务要求。' },
      { key: 'reproducibility', label: '可复现性', description: '相同条件下是否能稳定得到相近结果。' },
      { key: 'ease_of_use', label: '易上手程度', description: '输入准备、执行步骤和学习成本是否合理。' },
      { key: 'compatibility', label: '兼容性', description: '在不同模型、工具或环境中的适配情况。' },
      { key: 'cost_efficiency', label: '成本效率', description: '时间、Token、费用与产出之间是否划算。' },
      { key: 'adaptability', label: '可修改性', description: '是否容易针对相邻任务进行调整和扩展。' },
      { key: 'failure_boundaries', label: '失败边界', description: '限制是否明确，失败是否容易识别和处理。' },
    ],
  },
  [EvaluationProtocol.model]: {
    key: EvaluationProtocol.model,
    label: '模型评测',
    description: '在明确任务和版本下评估模型的完成能力、稳定性、成本与可控性。',
    dimensions: [
      { key: 'task_success', label: '任务完成率', description: '模型是否完成目标任务并通过结果检查。' },
      { key: 'reasoning_quality', label: '推理与生成质量', description: '分析是否可靠，输出是否准确和完整。' },
      { key: 'stability', label: '稳定性', description: '重复运行时结果波动和异常频率。' },
      { key: 'speed', label: '速度', description: '响应时间和完整任务耗时。' },
      { key: 'cost', label: '成本', description: '价格、Token 或资源消耗是否合理。' },
      { key: 'context_tools', label: '上下文与工具调用', description: '长上下文、检索和工具调用能力。' },
      { key: 'controllability', label: '可控性', description: '格式、边界、纠错和中断是否容易控制。' },
      { key: 'privacy_safety', label: '隐私与安全边界', description: '数据处理、权限和安全限制是否清晰。' },
    ],
  },
  [EvaluationProtocol.software]: {
    key: EvaluationProtocol.software,
    label: '软件 / 服务评测',
    description: '评估软件、编辑器、插件或在线服务在真实工作流中的价值与迁移成本。',
    dimensions: [
      { key: 'functional_value', label: '核心功能价值', description: '关键功能是否真正解决问题。' },
      { key: 'stability', label: '稳定性', description: '崩溃、错误、数据丢失和服务可用性。' },
      { key: 'learning_cost', label: '学习成本', description: '配置、使用和团队推广难度。' },
      { key: 'integration', label: '集成能力', description: '与现有工具链、API 和流程的兼容程度。' },
      { key: 'performance', label: '性能', description: '速度、资源消耗和大规模场景表现。' },
      { key: 'price_value', label: '价格与价值', description: '价格是否匹配实际收益。' },
      { key: 'privacy_control', label: '隐私与数据控制', description: '数据范围、权限、部署和导出能力。' },
      { key: 'migration_cost', label: '迁移与替代成本', description: '引入、退出和切换替代方案的成本。' },
    ],
  },
  [EvaluationProtocol.resource]: {
    key: EvaluationProtocol.resource,
    label: '资源评测',
    description: '评估仓库、网站、项目、论文、课程或其他资源是否值得投入时间和继续提炼。',
    dimensions: [
      { key: 'authority', label: '权威性', description: '作者、来源和论据是否可信。' },
      { key: 'freshness', label: '时效性', description: '信息是否仍适用于当前版本和环境。' },
      { key: 'depth', label: '深度', description: '是否超越表面介绍并提供实质信息。' },
      { key: 'usability', label: '可用性', description: '是否容易获取、理解和实际使用。' },
      { key: 'reproducibility', label: '可复现性', description: '示例、代码或结论是否能够复现。' },
      { key: 'time_value', label: '时间价值', description: '投入阅读、学习或试用的时间是否值得。' },
      { key: 'source_transparency', label: '来源透明度', description: '引用、许可、版本和利益关系是否清楚。' },
    ],
  },
}

export const EVALUATION_STATUSES = Object.values(EvaluationStatus)
export const EVALUATION_VERDICTS = Object.values(EvaluationVerdict)
export const EVALUATION_REPRODUCIBILITY = Object.values(EvaluationReproducibility)

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  [EvaluationStatus.draft]: '草稿',
  [EvaluationStatus.published]: '已发布',
  [EvaluationStatus.archived]: '已归档',
}

export const EVALUATION_VERDICT_LABELS: Record<EvaluationVerdict, string> = {
  [EvaluationVerdict.verified]: '已验证',
  [EvaluationVerdict.conditional]: '有条件推荐',
  [EvaluationVerdict.failed]: '未通过',
  [EvaluationVerdict.inconclusive]: '证据不足',
}

export const EVALUATION_REPRODUCIBILITY_LABELS: Record<EvaluationReproducibility, string> = {
  [EvaluationReproducibility.untested]: '未复现',
  [EvaluationReproducibility.single_run]: '单次运行',
  [EvaluationReproducibility.repeated]: '重复运行',
  [EvaluationReproducibility.reproduced]: '独立复现',
}

export function getEvaluationProtocol(protocol: EvaluationProtocol): EvaluationProtocolDefinition {
  return EVALUATION_PROTOCOLS[protocol]
}
