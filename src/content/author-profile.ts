export const AUTHOR_PROFILE = {
  name: '秦',
  motto: '造器，筑界，观心。',
  opening: [
    '我做工具、网站和系统。',
    '也写 AI、游戏、心理，',
    '和个人知识的札记。',
  ],
  reflection: [
    '我喜欢清晰的结构，',
    '也喜欢有余味的东西。',
  ],
  signal: '信号太多，意义太少。',
  now: [
    '把零散灵感整理为可运行、可追溯的东西。',
    '连接后端、AI、Agent 与人工判断。',
    '在工具之外，继续理解游戏规则和心智秩序。',
  ],
  projects: [
    {
      title: 'AI 报告系统',
      description: '让后端、工具和模型之间有更清晰的协作记录。',
      tags: ['AI', 'Backend', 'Agent'],
    },
    {
      title: '记忆卡片系统',
      description: '把知识拆成可复用、可抽取、可关联的上下文单元。',
      tags: ['Memory', 'Knowledge', 'Context'],
    },
    {
      title: '游戏服务器网络',
      description: '关于家宽、WireGuard、旁路由和朋友联机的一些实践。',
      tags: ['Homelab', 'Network', 'Game'],
    },
    {
      title: '个人站实验',
      description: '一次关于风格、表达和自我定位的实验，如今汇入空心树洞。',
      tags: ['Web', 'Design', 'Personal'],
    },
  ],
  values: [
    '清晰胜过复杂。',
    '长期胜过热闹。',
    '系统要能解释自己。',
    '审美不是装饰，是判断。',
  ],
  likes: [
    '黑白网页。',
    '能留下余味的游戏。',
    '心理学与记忆。',
    '简单但有气质的网站。',
  ],
} as const

export const AUTHOR_TRACE = {
  source: 'personal_site/灵感.md',
  narrative: '保留作者身份、核心短句、AI / Game / Mind 与 Now / Projects / Values / Notes / Links / Contact。',
  excluded: '不迁移 Astro、React 19、Three/R3F、Motion、Lenis、独立主题脚本与空占位页。',
} as const
