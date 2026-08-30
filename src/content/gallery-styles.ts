export const GALLERY_FAMILIES = [
  { id: 'painterly', label: 'PAINT', title: '绘画媒介' },
  { id: 'movement', label: 'MOVEMENT', title: '艺术运动' },
  { id: 'print', label: 'PRINT', title: '版画与工艺' },
  { id: 'illustration', label: 'ILLUSTRATION', title: '插画语言' },
  { id: 'digital', label: 'DIGITAL', title: '数字媒介' },
  { id: 'lens', label: 'LENS', title: '摄影与未来视觉' },
] as const

export type GalleryFamily = (typeof GALLERY_FAMILIES)[number]['id']

export interface GalleryStyle {
  slug: string
  title: string
  titleZh: string
  family: GalleryFamily
  imageUrl: string
  medium: string
  effect: string
  promptFragment: string
  cues: [string, string, string]
}

export const GALLERY_SUBJECT =
  'A lone adult traveler seen from behind, wearing a long vermilion-red coat, standing on a wet stone path inside a moonlit glass botanical observatory; centered lower-third composition, round moon above, dense plants and glass arches, no other people.'

export const GALLERY_PROVENANCE = {
  provider: 'OpenAI',
  model: 'Codex built-in image generation',
  modelVersion: 'not exposed',
  generatedAt: '2026-08-27',
  source: 'Generated for LogWood',
  status: 'SYNTHETIC SEED · UNVERIFIED',
  rights: 'RIGHTS REVIEW PENDING',
} as const

export function galleryPromptFor(style: GalleryStyle) {
  return `${GALLERY_SUBJECT}\n\nVisual style: ${style.promptFragment}\n\nConstraints: preserve the subject placement, camera angle, moon position and major greenhouse geometry; no text, logo, signature or watermark; original imagery.`
}

export const GALLERY_STYLES: GalleryStyle[] = [
  {
    slug: 'oil-impasto', title: 'OIL IMPASTO', titleZh: '厚涂油画', family: 'painterly',
    imageUrl: '/gallery/styles/oil-impasto.webp', medium: 'Oil paint / loaded brush',
    effect: '厚重颜料与刮擦笔触强化体积，灯光和湿地反射会呈现更强的物质感。',
    promptFragment: 'oil impasto, thick loaded brushstrokes, tactile paint ridges, deep ultramarine and viridian, dramatic warm lantern highlights',
    cues: ['厚涂纹理', '深色层次', '高光堆积'],
  },
  {
    slug: 'watercolor', title: 'WATERCOLOR', titleZh: '透明水彩', family: 'painterly',
    imageUrl: '/gallery/styles/watercolor.webp', medium: 'Watercolor / cold-press paper',
    effect: '透明叠色、湿画法晕染与纸张颗粒让夜景变得轻盈，边界自然溶解。',
    promptFragment: 'luminous watercolor, translucent washes, wet-on-wet blooms, granulating indigo, visible cold-press paper texture',
    cues: ['透明罩染', '水痕晕边', '纸张颗粒'],
  },
  {
    slug: 'gouache', title: 'GOUACHE', titleZh: '不透明水粉', family: 'painterly',
    imageUrl: '/gallery/styles/gouache.webp', medium: 'Gouache / matte pigment',
    effect: '不透明色块和哑光表面让形体更平整、明确，适合海报和编辑插图。',
    promptFragment: 'opaque gouache, matte shapes, confident flat brushwork, compact color blocks, hand-painted edges',
    cues: ['哑光色块', '平涂造型', '手绘边缘'],
  },
  {
    slug: 'ink-wash', title: 'INK WASH', titleZh: '水墨', family: 'painterly',
    imageUrl: '/gallery/styles/ink-wash.webp', medium: 'Ink / absorbent paper',
    effect: '墨色浓淡承担空间，留白和雾感弱化细节，朱红人物成为唯一视觉锚点。',
    promptFragment: 'East Asian ink wash, expressive black ink, restrained vermilion accent, mist, absorbent rice-paper texture, spare tonal range',
    cues: ['墨分五色', '雾化留白', '朱红点景'],
  },
  {
    slug: 'soft-pastel', title: 'SOFT PASTEL', titleZh: '软粉彩', family: 'painterly',
    imageUrl: '/gallery/styles/soft-pastel.webp', medium: 'Soft pastel / textured paper',
    effect: '粉质颗粒和柔软边缘降低锐度，光晕与深蓝层次更像触摸得到的夜色。',
    promptFragment: 'soft pastel, velvety pigment, powdery edges, layered midnight blues, soft light bloom on textured paper',
    cues: ['粉质颗粒', '柔化轮廓', '叠色夜蓝'],
  },
  {
    slug: 'charcoal', title: 'CHARCOAL', titleZh: '炭笔', family: 'painterly',
    imageUrl: '/gallery/styles/charcoal.webp', medium: 'Compressed charcoal / red chalk',
    effect: '大面积擦抹和高反差压缩色彩，画面更接近快速、戏剧性的光影研究。',
    promptFragment: 'charcoal drawing, compressed charcoal, kneaded highlights, broad smudges, strong chiaroscuro, restrained red-chalk coat accent',
    cues: ['擦抹肌理', '明暗归纳', '红粉笔点色'],
  },
  {
    slug: 'impressionism', title: 'IMPRESSIONISM', titleZh: '印象主义', family: 'movement',
    imageUrl: '/gallery/styles/impressionism.webp', medium: 'Broken-color painting',
    effect: '碎色和短笔触优先记录光的印象，细节退后，空气、反光和瞬间感被放大。',
    promptFragment: 'Impressionism, broken color, atmospheric moonlight, visible lively brushwork, optical wet reflections',
    cues: ['碎色笔触', '光色优先', '空气透视'],
  },
  {
    slug: 'pointillism', title: 'POINTILLISM', titleZh: '点彩', family: 'movement',
    imageUrl: '/gallery/styles/pointillism.webp', medium: 'Optical color dots',
    effect: '密集色点在观看距离中混合，轮廓变得规律，夜色呈现闪烁的光学颗粒。',
    promptFragment: 'Pointillism, disciplined optical dots, luminous complementary colors, structured depth, no blended brushstrokes',
    cues: ['光学混色', '规则色点', '互补色振动'],
  },
  {
    slug: 'expressionism', title: 'EXPRESSIONISM', titleZh: '表现主义', family: 'movement',
    imageUrl: '/gallery/styles/expressionism.webp', medium: 'Emotion-led painting',
    effect: '结构和色彩服从情绪而非写实，温室拱架被扭曲成紧张、强烈的心理空间。',
    promptFragment: 'Expressionism, emotionally distorted arches, urgent angular strokes, heightened indigo and vermilion, tense nocturnal atmosphere',
    cues: ['情绪变形', '急促笔触', '高强度配色'],
  },
  {
    slug: 'fauvism', title: 'FAUVISM', titleZh: '野兽派', family: 'movement',
    imageUrl: '/gallery/styles/fauvism.webp', medium: 'Saturated color planes',
    effect: '非自然高饱和配色和简化形体带来直接能量，色彩本身取代真实光影。',
    promptFragment: 'Fauvism, bold non-natural saturated color planes, simplified shapes, liberated brushwork, blue orange and acid green',
    cues: ['任性色彩', '形体简化', '平面张力'],
  },
  {
    slug: 'cubism', title: 'CUBISM', titleZh: '立体主义', family: 'movement',
    imageUrl: '/gallery/styles/cubism.webp', medium: 'Fragmented geometric painting',
    effect: '多视点和几何切面同时呈现空间，人物仍是中心，但现实透视被重新拆装。',
    promptFragment: 'Cubism, fractured multiple viewpoints, geometric glass planes, muted blue gray ochre palette, coherent central red figure',
    cues: ['多重视点', '几何切面', '透视重组'],
  },
  {
    slug: 'surrealism', title: 'SURREALISM', titleZh: '超现实主义', family: 'movement',
    imageUrl: '/gallery/styles/surrealism.webp', medium: 'Dream-logic painting',
    effect: '熟悉物体遵循梦境逻辑重新组合，尺度和重力异常，但细节仍保持可信。',
    promptFragment: 'Surrealism, dream logic, impossible greenhouse scale, floating botanical forms, uncanny moon, polished painterly detail',
    cues: ['梦境逻辑', '尺度错位', '可信异象'],
  },
  {
    slug: 'ukiyo-e', title: 'UKIYO-E', titleZh: '浮世绘语法', family: 'print',
    imageUrl: '/gallery/styles/ukiyo-e.webp', medium: 'Woodblock / mineral color',
    effect: '清晰轮廓、平涂矿物色和渐层夜空压平空间，构图更像经过精确切分的版面。',
    promptFragment: 'ukiyo-e-inspired woodblock grammar, flat mineral color, elegant contour, bokashi night gradient, original composition',
    cues: ['版木轮廓', '矿物平涂', '渐层夜空'],
  },
  {
    slug: 'woodcut', title: 'WOODCUT', titleZh: '木刻', family: 'print',
    imageUrl: '/gallery/styles/woodcut.webp', medium: 'Carved wood / spot color',
    effect: '木纹和粗砺白线直接形成明暗，少量朱红点色让人物从高反差背景中跳出。',
    promptFragment: 'expressive woodcut, black and warm paper, rough carved grain, energetic white cuts, vermilion spot color',
    cues: ['木纹刀痕', '黑白对冲', '局部套色'],
  },
  {
    slug: 'linocut', title: 'LINOCUT', titleZh: '麻胶版画', family: 'print',
    imageUrl: '/gallery/styles/linocut.webp', medium: 'Linoleum relief print',
    effect: '宽阔刀痕和高度归纳的植物节奏让构图更图形化，轮廓简洁而有重量。',
    promptFragment: 'linocut, broad high-contrast cuts, simplified botanical rhythm, limited black ivory and red palette',
    cues: ['宽刀留痕', '强轮廓', '三色归纳'],
  },
  {
    slug: 'risograph', title: 'RISOGRAPH', titleZh: '孔版速印', family: 'print',
    imageUrl: '/gallery/styles/risograph.webp', medium: 'Risograph / spot ink',
    effect: '有限专色、网点和轻微错版制造印刷活力，适合海报、刊物和独立出版物。',
    promptFragment: 'risograph print, indigo fluorescent coral and mint spot inks, halftone texture, deliberate registration drift',
    cues: ['专色叠印', '网点颗粒', '轻微错版'],
  },
  {
    slug: 'screenprint', title: 'SCREENPRINT', titleZh: '丝网印刷', family: 'print',
    imageUrl: '/gallery/styles/screenprint.webp', medium: 'Screenprint / translucent ink',
    effect: '清晰模板和半透明专色在重叠处产生新颜色，画面具有强烈的海报秩序。',
    promptFragment: 'screenprint, crisp stencil shapes, translucent cyan amber and scarlet overlaps, bold flat poster composition',
    cues: ['模板硬边', '透明叠色', '海报平面'],
  },
  {
    slug: 'paper-cut', title: 'PAPER CUT', titleZh: '纸雕', family: 'print',
    imageUrl: '/gallery/styles/paper-cut.webp', medium: 'Layered cut paper',
    effect: '多层纸片的切边和真实微阴影把二维场景变成浅浮雕，适合装置式视觉。',
    promptFragment: 'layered paper-cut diorama, physical colored paper, precise cut edges, cast micro-shadows, deep layered depth',
    cues: ['多层纸片', '物理切边', '浅浮雕阴影'],
  },
  {
    slug: 'art-nouveau', title: 'ART NOUVEAU', titleZh: '新艺术装饰', family: 'illustration',
    imageUrl: '/gallery/styles/art-nouveau.webp', medium: 'Decorative poster illustration',
    effect: '植物曲线、装饰边框和珠宝色调把建筑与自然统一成连续纹样。',
    promptFragment: 'Art Nouveau decorative illustration, sinuous botanical line, ornamental arches, muted jewel palette, flat poster elegance, original design',
    cues: ['植物曲线', '装饰框架', '珠宝色调'],
  },
  {
    slug: 'anime-cel', title: 'ANIME CEL', titleZh: '动画赛璐璐', family: 'illustration',
    imageUrl: '/gallery/styles/anime-cel.webp', medium: 'Cel animation / painted background',
    effect: '清晰线稿和分层阴影保证角色可读性，手绘背景承担气氛和空间深度。',
    promptFragment: 'anime cel illustration, clean expressive line, hand-painted cel shadows, cinematic painted background, mature nocturnal atmosphere, original character',
    cues: ['清晰线稿', '分层阴影', '手绘背景'],
  },
  {
    slug: 'comic-ink', title: 'COMIC INK', titleZh: '漫画墨线', family: 'illustration',
    imageUrl: '/gallery/styles/comic-ink.webp', medium: 'Brush ink / selective color',
    effect: '粗细变化的墨线和排线塑造明暗，少量色彩让叙事焦点更明确。',
    promptFragment: 'graphic novel comic ink, bold brush line, controlled crosshatching, selective vermilion and midnight-blue color, cinematic panel finish',
    cues: ['毛笔墨线', '交叉排线', '选择性色彩'],
  },
  {
    slug: 'storybook', title: 'STORYBOOK', titleZh: '绘本', family: 'illustration',
    imageUrl: '/gallery/styles/storybook.webp', medium: 'Hand-painted narrative illustration',
    effect: '温润形体和触感纸张让场景更具叙事亲和力，同时保留夜色的诗意。',
    promptFragment: 'sophisticated storybook illustration, warm hand-painted shapes, tactile paper, poetic nocturnal mood, nuanced light',
    cues: ['温润造型', '叙事氛围', '纸本触感'],
  },
  {
    slug: 'editorial-flat', title: 'EDITORIAL FLAT', titleZh: '编辑扁平插画', family: 'illustration',
    imageUrl: '/gallery/styles/editorial-flat.webp', medium: 'Geometric editorial illustration',
    effect: '几何归纳、克制配色和大块负空间帮助视觉快速表达观点，适合文章与品牌内容。',
    promptFragment: 'contemporary editorial flat illustration, decisive geometric shapes, restrained teal cream and vermilion palette, smart negative space, subtle grain',
    cues: ['几何归纳', '克制配色', '负空间'],
  },
  {
    slug: 'botanical-plate', title: 'BOTANICAL PLATE', titleZh: '植物图谱', family: 'illustration',
    imageUrl: '/gallery/styles/botanical-plate.webp', medium: 'Engraved scientific plate',
    effect: '精密排线与图谱式构图突出植物结构，人物作为比例参照，整体更具档案感。',
    promptFragment: 'vintage botanical plate illustration, precise engraved plants and greenhouse anatomy, archival paper, red figure as scale accent, no labels',
    cues: ['精密排线', '图谱构图', '档案纸色'],
  },
  {
    slug: 'pixel-art', title: 'PIXEL ART', titleZh: '像素艺术', family: 'digital',
    imageUrl: '/gallery/styles/pixel-art.webp', medium: 'Pixel clusters / limited palette',
    effect: '有限分辨率迫使细节被压缩成可读像素块，轮廓、光源和配色必须更明确。',
    promptFragment: 'crisp intentional pixel art, 16-bit-era pixel clusters, limited deep-blue palette, readable silhouette, no blur',
    cues: ['像素簇', '有限调色板', '轮廓优先'],
  },
  {
    slug: 'low-poly', title: 'LOW POLY', titleZh: '低多边形', family: 'digital',
    imageUrl: '/gallery/styles/low-poly.webp', medium: 'Faceted 3D geometry',
    effect: '削减多边形后，平面切面直接承担光影，复杂温室变得简洁、结构化。',
    promptFragment: 'low-poly 3D, faceted geometry, simplified plants and glass, elegant physically based moonlight, clean silhouette',
    cues: ['几何切面', '低面建模', '结构化光影'],
  },
  {
    slug: 'clay-3d', title: 'CLAY 3D', titleZh: '黏土定格', family: 'digital',
    imageUrl: '/gallery/styles/clay-3d.webp', medium: 'Plasticine / miniature set',
    effect: '指纹和手工塑形让数字场景带上真实材料的不完美，像一座定格动画微缩景观。',
    promptFragment: 'handcrafted clay 3D, plasticine materials, visible fingerprints, miniature stop-motion set lighting, tactile imperfections',
    cues: ['黏土指纹', '微缩布景', '定格灯光'],
  },
  {
    slug: 'isometric', title: 'ISOMETRIC', titleZh: '等距视角', family: 'digital',
    imageUrl: '/gallery/styles/isometric.webp', medium: 'Axonometric digital illustration',
    effect: '轴测视角同时展示空间结构与路径，适合把场景改造成信息清晰的建筑切片。',
    promptFragment: 'isometric architectural illustration, axonometric greenhouse cutaway, clear path and room topology, moonlit miniature world',
    cues: ['轴测投影', '空间切片', '路径可读'],
  },
  {
    slug: 'toon-3d', title: 'TOON 3D', titleZh: '卡通三维', family: 'digital',
    imageUrl: '/gallery/styles/toon-3d.webp', medium: 'Stylized sculpt / painterly PBR',
    effect: '雕塑化形体与可控材质结合，既保留三维光影，也保持插画式的清晰轮廓。',
    promptFragment: 'stylized toon 3D, clean sculpted forms, painterly PBR materials, cinematic animated-film quality, original visual language',
    cues: ['雕塑造型', '插画材质', '三维轮廓'],
  },
  {
    slug: 'cinematic-concept', title: 'CONCEPT ART', titleZh: '影视概念设计', family: 'digital',
    imageUrl: '/gallery/styles/cinematic-concept.webp', medium: 'Production environment concept',
    effect: '可信尺度、气氛透视和受控细节服务于场景设定，适合影视和游戏前期视觉开发。',
    promptFragment: 'cinematic environment concept art, production-quality worldbuilding, atmospheric depth, believable scale, controlled painterly detail',
    cues: ['世界观设定', '气氛纵深', '生产级细节'],
  },
  {
    slug: 'cinematic-photo', title: 'CINEMATIC PHOTO', titleZh: '电影感摄影', family: 'lens',
    imageUrl: '/gallery/styles/cinematic-photo.webp', medium: 'Full-frame night photography',
    effect: '真实镜头、实景灯光和湿地反射建立可信现场感，红衣人物成为稳定焦点。',
    promptFragment: 'photorealistic cinematic night photography, full-frame camera, 35mm lens, wet reflections, practical lanterns, natural texture',
    cues: ['真实镜头', '实景光源', '湿地反射'],
  },
  {
    slug: 'film-noir', title: 'FILM NOIR', titleZh: '黑色电影', family: 'lens',
    imageUrl: '/gallery/styles/film-noir.webp', medium: 'High-contrast monochrome photo',
    effect: '硬光、雾气和深黑阴影制造悬疑，手工点红让人物像从老胶片中被标记出来。',
    promptFragment: 'film noir photography, monochrome high contrast, hard shafts of light, fog, deep blacks, restrained hand-tinted red coat',
    cues: ['硬质明暗', '深黑阴影', '手工点色'],
  },
  {
    slug: 'analog-editorial', title: 'ANALOG EDITORIAL', titleZh: '模拟胶片编辑摄影', family: 'lens',
    imageUrl: '/gallery/styles/analog-editorial.webp', medium: '1970s color negative',
    effect: '胶片颗粒、晕光和不完美色偏让画面更像真实刊物拍摄，而不是过度洁净的数字图。',
    promptFragment: '1970s analog editorial photography, color negative, subtle grain, imperfect halation, muted cyan shadows, authentic lens character',
    cues: ['胶片颗粒', '高光晕染', '模拟色偏'],
  },
  {
    slug: 'cyberpunk', title: 'CYBERPUNK', titleZh: '赛博朋克', family: 'lens',
    imageUrl: '/gallery/styles/cyberpunk.webp', medium: 'Near-future visual photography',
    effect: '洋红与青色园艺灯改变真实空间的气质，未来感来自功能性光源而非装饰贴纸。',
    promptFragment: 'believable cyberpunk visual photography, magenta and cyan horticultural light, wet glass, restrained near-future technology, no signs',
    cues: ['功能霓虹', '湿玻璃', '近未来设施'],
  },
  {
    slug: 'retro-futurism', title: 'RETRO FUTURISM', titleZh: '复古未来主义', family: 'lens',
    imageUrl: '/gallery/styles/retro-futurism.webp', medium: '1960s analog future',
    effect: '太空时代曲线、搪瓷材质和乐观照明把未来想象还原成上世纪的设计语言。',
    promptFragment: 'optimistic 1960s retro-futurism, space-age greenhouse architecture, enamel surfaces, analog future, clean graphic lighting',
    cues: ['太空时代曲线', '搪瓷表面', '乐观未来'],
  },
  {
    slug: 'vaporwave', title: 'VAPORWAVE', titleZh: '蒸汽波梦境', family: 'lens',
    imageUrl: '/gallery/styles/vaporwave.webp', medium: 'Digital dream image',
    effect: '薰衣草、青色和桃粉把夜景推向人工梦境，古典结构与数字雾感形成时间错位。',
    promptFragment: 'refined vaporwave dream image, lavender cyan and peach nocturnal palette, surreal classical geometry, soft digital haze, no text',
    cues: ['粉紫调色', '古典错位', '数字雾感'],
  },
]
