export const AWESOME_PROJECT_SCHEMA = 'awesome-project.v1'

export const AWESOME_DIRECTIONS = [
  { id: 'prompt-quality', label: 'PROMPT QUALITY' },
  { id: 'visual-production', label: 'VISUAL PRODUCTION' },
  { id: 'model-infra', label: 'MODEL INFRA' },
  { id: 'design-systems', label: 'DESIGN SYSTEMS' },
  { id: 'presentation', label: 'PRESENTATION' },
] as const

export type AwesomeDirection = (typeof AWESOME_DIRECTIONS)[number]['id']

export interface AwesomeProjectDossier {
  schema: typeof AWESOME_PROJECT_SCHEMA
  upstreamName: string
  direction: AwesomeDirection
  license: string
  effort: string
  posture: 'BUILD' | 'INTEGRATE' | 'STUDY'
  whyItMatters: string
  buildProposal: string
  firstMilestone: string
  researchNote: string
}

export interface AwesomeProjectSeed {
  title: string
  slug: string
  summary: string
  websiteUrl: string
  sourceUrl: string
  sortOrder: number
  dossier: AwesomeProjectDossier
}

export const AWESOME_PROJECTS: AwesomeProjectSeed[] = [
  {
    title: 'Prompt Regression Lab',
    slug: 'awesome-prompt-regression-lab',
    summary: '把“这个 Prompt 好像更好”变成可重复的模型 × 用例 × 断言对照实验。',
    websiteUrl: 'https://www.promptfoo.dev/',
    sourceUrl: 'https://github.com/promptfoo/promptfoo',
    sortOrder: 10,
    dossier: {
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: 'promptfoo',
      direction: 'prompt-quality',
      license: 'MIT',
      effort: '3–5 DAYS',
      posture: 'INTEGRATE',
      whyItMatters: '当前工作台能运行 Prompt，但还不能稳定回答“哪一版、在哪个模型、对哪些样例更好”。',
      buildProposal: '把已验证 Prompt 一键生成本地 eval case，比较 DeepSeek、CPA 文本模型和后续图像评分器，并把结果写回版本链。',
      firstMilestone: '选择 3 个文本 Prompt、2 个模型、10 条固定样例，生成一张可追溯回归矩阵。',
      researchNote: '上游提供本地运行、模型对比、断言、CI 和结果导出；自定义脚本按受信代码处理。',
    },
  },
  {
    title: 'Prompt Evidence Ledger',
    slug: 'awesome-prompt-evidence-ledger',
    summary: '让每次运行都能回到 Prompt 版本、模型参数、输出、人工判断和发布决策。',
    websiteUrl: 'https://langfuse.com/',
    sourceUrl: 'https://github.com/langfuse/langfuse',
    sortOrder: 20,
    dossier: {
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: 'Langfuse',
      direction: 'prompt-quality',
      license: 'MIT CORE / EE EXCEPTIONS',
      effort: '5–8 DAYS',
      posture: 'STUDY',
      whyItMatters: 'LogWood 已有 attribution 与版本链，但模型运行、人工选择和最终发布之间仍缺一张连续证据图。',
      buildProposal: '借鉴 trace、dataset、experiment 的数据语义，先在本站做轻量运行谱系，不直接搬入整个平台。',
      firstMilestone: '从一次 Workbench RUN 追到 Prompt 版本、模型、输出资产、人工评分和最终 Candidate。',
      researchNote: '上游覆盖可观测性、Prompt 管理、数据集和评估；核心 MIT，ee 目录另有条款。',
    },
  },
  {
    title: 'Style Recipe Engine',
    slug: 'awesome-style-recipe-engine',
    summary: '把画廊里的“风格印象”推进为可恢复、可复跑、可交付的节点配方。',
    websiteUrl: 'https://www.comfy.org/',
    sourceUrl: 'https://github.com/Comfy-Org/ComfyUI',
    sortOrder: 30,
    dossier: {
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: 'ComfyUI',
      direction: 'visual-production',
      license: 'GPL-3.0',
      effort: '7–12 DAYS',
      posture: 'INTEGRATE',
      whyItMatters: '客户出图真正需要的不是一张偶然好图，而是包含模型、seed、节点和后处理的稳定生成配方。',
      buildProposal: '让 Gallery 风格条目挂接只读 workflow JSON；由独立执行器运行，本站只保存来源、参数与结果，不加载不受信自定义节点。',
      firstMilestone: '为 3 种高频画风各固化 1 条工作流，并完成同题材三次复跑与差异记录。',
      researchNote: '上游支持图像、视频、音频、3D、文本节点图、局部重跑、API 和从媒体恢复 workflow/seed。',
    },
  },
  {
    title: 'Creative Canvas Bench',
    slug: 'awesome-creative-canvas-bench',
    summary: '研究从生成、局部修补、画布编排到素材归档的一体化专业创作流。',
    websiteUrl: 'https://invoke.ai/',
    sourceUrl: 'https://github.com/invoke-ai/InvokeAI',
    sortOrder: 40,
    dossier: {
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: 'InvokeAI',
      direction: 'visual-production',
      license: 'APACHE-2.0',
      effort: '5–8 DAYS',
      posture: 'STUDY',
      whyItMatters: '单张预览不足以支撑客户交付；局部修改、版本回退、素材复用和元数据召回才是稳定生产能力。',
      buildProposal: '提炼 Unified Canvas 与 Gallery 的交互，把本站的效果预览升级成“结果 → 局部修改 → 版本候选”闭环。',
      firstMilestone: '做一个不含模型执行的画布原型：导入结果、建立 3 个局部修改候选、保留参数与回退点。',
      researchNote: '上游提供本地 Web UI、统一画布、节点工作流、图库管理和图像元数据召回。',
    },
  },
  {
    title: 'Capability-aware Model Router',
    slug: 'awesome-capability-model-router',
    summary: '按文本、图片、视频和能力约束选模型，在运行前就阻止“不支持生图”的错误。',
    websiteUrl: 'https://www.litellm.ai/',
    sourceUrl: 'https://github.com/BerriAI/litellm',
    sortOrder: 50,
    dossier: {
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: 'LiteLLM',
      direction: 'model-infra',
      license: 'OSS / COMMERCIAL MODULES',
      effort: '3–5 DAYS',
      posture: 'STUDY',
      whyItMatters: '当前 DeepSeek 与 CPA 已经暴露模态差异；如果只按模型名选择，错误会在请求发出后才被发现。',
      buildProposal: '建立本站自己的 capability contract 与健康探测，借鉴统一 API、路由、成本和失败切换，不引入整套网关。',
      firstMilestone: '为现有 2 个 CPA 模型和 DeepSeek 输出能力卡，运行按钮按 output kind 只展示兼容模型。',
      researchNote: '上游以 OpenAI 兼容接口覆盖多供应商、图片/音频等端点，并提供路由、限额和日志能力；采用前需单独核对模块许可。',
    },
  },
  {
    title: 'Design-to-Code Style Lab',
    slug: 'awesome-design-to-code-style-lab',
    summary: '把网站风格从截图灵感变成 tokens、响应式结构和可交接的设计系统。',
    websiteUrl: 'https://penpot.app/',
    sourceUrl: 'https://github.com/penpot/penpot',
    sortOrder: 60,
    dossier: {
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: 'Penpot',
      direction: 'design-systems',
      license: 'MPL-2.0',
      effort: '5–8 DAYS',
      posture: 'STUDY',
      whyItMatters: '网站风格能力如果只保存在效果截图里，很难验证响应式、token 一致性，也难向客户稳定复用。',
      buildProposal: '研究 design-as-code、原生 design token 和 MCP 的边界，为 Gallery 新增可下载的“视觉系统标本”。',
      firstMilestone: '选 2 个本站风格，分别导出颜色、字体、间距、组件状态和桌面/移动验收页。',
      researchNote: '上游强调 design-as-code、原生 design tokens、MCP、开放 API 与插件系统。',
    },
  },
  {
    title: 'UI Style Specimen Lab',
    slug: 'awesome-ui-style-specimen-lab',
    summary: '让每种网站风格都有真实组件、边界状态和视觉回归，而不只是一张首页图。',
    websiteUrl: 'https://storybook.js.org/',
    sourceUrl: 'https://github.com/storybookjs/storybook',
    sortOrder: 70,
    dossier: {
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: 'Storybook',
      direction: 'design-systems',
      license: 'MIT',
      effort: '3–5 DAYS',
      posture: 'INTEGRATE',
      whyItMatters: '客户网站的风格稳定性取决于按钮、表单、内容密度和异常态，而不是 Hero 单点效果。',
      buildProposal: '为本站常用 UI 语汇建立隔离标本，并接入桌面/移动截图回归，形成“我能稳定处理哪些网站风格”的证据。',
      firstMilestone: '完成 terminal、paper 两套主题下 8 个核心组件的状态矩阵与截图基线。',
      researchNote: '上游专注隔离构建、文档与测试 UI 组件，支持多框架和扩展插件。',
    },
  },
  {
    title: 'AI Deck Studio',
    slug: 'awesome-ai-deck-studio',
    summary: '把结构化内容 Prompt 转成可编辑、可换主题、可导出 PPTX/PDF 的演示文稿。',
    websiteUrl: 'https://sli.dev/',
    sourceUrl: 'https://github.com/slidevjs/slidev',
    sortOrder: 80,
    dossier: {
      schema: AWESOME_PROJECT_SCHEMA,
      upstreamName: 'Slidev',
      direction: 'presentation',
      license: 'MIT',
      effort: '5–8 DAYS',
      posture: 'INTEGRATE',
      whyItMatters: 'PPT 类 Prompt 的结果不能只显示文本；需要一个可编辑中间格式和可靠导出链，才能成为真实案例。',
      buildProposal: '让模型只生成受限 Markdown/组件 schema，再交给 Slidev 渲染；主题、素材与导出由人确认。',
      firstMilestone: '从一个客户 brief 生成 6 页 deck，支持主题切换、人工修改并导出 PDF/PPTX。',
      researchNote: '上游以 Markdown 驱动，支持主题、组件、图表、演讲模式和 PDF/PNG/PPTX 导出。',
    },
  },
]

export function awesomeCandidateTags(project: AwesomeProjectSeed): string[] {
  return [
    'awesome',
    `direction:${project.dossier.direction}`,
    `upstream:${project.dossier.upstreamName.toLowerCase()}`,
  ]
}

export function awesomeDossierJson(project: AwesomeProjectSeed): string {
  return JSON.stringify(project.dossier)
}
