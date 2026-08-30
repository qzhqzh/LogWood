export interface AwesomeDesignFeed {
  name: string
  scope: string
  url: string
}

export const AWESOME_INTERFACE_FEEDS: readonly AwesomeDesignFeed[] = [
  {
    name: 'BOARDUI',
    scope: 'AGENT + DASHBOARD SYSTEM · FREE / PRO',
    url: 'https://www.boardui.com/',
  },
  {
    name: 'WATERMELON UI',
    scope: 'PRODUCTION REGISTRY · MIT',
    url: 'https://ui.watermelon.sh/',
  },
  {
    name: 'HEROUI PRO',
    scope: 'DESIGN + CODE + AGENT · PRO',
    url: 'https://heroui.pro/',
  },
  {
    name: 'SHADCN/UI',
    scope: 'ACCESSIBLE PRIMITIVES · MIT',
    url: 'https://ui.shadcn.com/',
  },
  {
    name: 'BEAUTIFUL UI',
    scope: 'AI-NATIVE PRIMITIVES · MIT',
    url: 'https://www.beautifului.dev/',
  },
] as const

export const AWESOME_MOTION_FEEDS: readonly AwesomeDesignFeed[] = [
  {
    name: 'BEUI',
    scope: 'MOTION COMPONENTS · MIT',
    url: 'https://beui.dev/',
  },
  {
    name: 'FLUID FUNCTIONALISM',
    scope: 'FUNCTIONAL MOTION · LICENSE CHECK',
    url: 'https://www.fluidfunctionalism.com/',
  },
  {
    name: 'TRANSITIONS',
    scope: 'MICRO-TRANSITIONS · FREE / PRO',
    url: 'https://transitions.dev/',
  },
  {
    name: 'RARE UI',
    scope: 'DISTINCTIVE MOTION · MIT',
    url: 'https://www.rareui.com/',
  },
  {
    name: 'THREEUI',
    scope: 'WEBGL + SHADERS · MIT CORE / PRO',
    url: 'https://threeui.com/',
  },
] as const

export const AWESOME_DESIGN_FEEDS: readonly AwesomeDesignFeed[] = [
  ...AWESOME_INTERFACE_FEEDS,
  ...AWESOME_MOTION_FEEDS,
]
