---
name: LogWood / 空心树洞
description: A verifiable prompt vault rendered as an executable character field.
colors:
  field-black: "#020603"
  canvas-black: "#000000"
  workbench-panel: "#010402"
  phosphor-strong: "#dcffdc"
  phosphor-body: "#a9dbaa"
  phosphor-muted: "#8bb98e"
  phosphor-soft: "#6f9673"
  panel-deep: "#061008"
  panel-low: "#030a05"
  signal-green: "#baffb7"
  phase-one-mint: "#baf9b6"
  evidence-amber: "#ffc857"
  glitch-cyan: "#52efff"
  glitch-amber: "#ffbd36"
  paper: "#f3f0e7"
  paper-ink: "#182017"
  paper-accent: "#326b3b"
typography:
  display:
    fontFamily: "'DejaVu Sans Mono', 'WenQuanYi Zen Hei Mono', 'Noto Sans Mono CJK SC', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(6rem, 13.4vw, 14rem)"
    fontWeight: 700
    lineHeight: 0.84
    letterSpacing: "0.055em"
  headline:
    fontFamily: "'DejaVu Sans Mono', 'WenQuanYi Zen Hei Mono', 'Noto Sans Mono CJK SC', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(3.8rem, 9vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.82
    letterSpacing: "0.035em"
  title:
    fontFamily: "'DejaVu Sans Mono', 'WenQuanYi Zen Hei Mono', 'Noto Sans Mono CJK SC', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(1.15rem, 2vw, 1.6rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'DejaVu Sans Mono', 'WenQuanYi Zen Hei Mono', 'Noto Sans Mono CJK SC', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(0.625rem, 0.8vw, 0.875rem)"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "'DejaVu Sans Mono', 'WenQuanYi Zen Hei Mono', 'Noto Sans Mono CJK SC', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(0.5rem, 0.65vw, 0.6875rem)"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  square: "0"
  control: "1px"
  media: "2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-default:
    backgroundColor: "transparent"
    textColor: "{colors.phosphor-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  button-active:
    backgroundColor: "{colors.signal-green}"
    textColor: "{colors.canvas-black}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  field:
    backgroundColor: "{colors.panel-low}"
    textColor: "{colors.phosphor-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  prompt-cell:
    backgroundColor: "{colors.panel-deep}"
    textColor: "{colors.phosphor-body}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "12px"
  effect-stage:
    backgroundColor: "{colors.canvas-black}"
    textColor: "{colors.phosphor-body}"
    rounded: "{rounded.square}"
    padding: "0"
---

# Design System: LogWood / 空心树洞

## Overview

**Creative North Star: “The Executable Character Field / 可运行字符场”**

LogWood 的公开产品是一座可检查的提示词工作台：近黑字符场、荧光绿文本、硬边框和紧凑索引让内容像一份能直接运行的操作记录，而不是营销首页。首页首屏只完成一件事：以完整字符场建立 `PROMPT` 主题并给出 `ENTER`。进入工作台后再同时回答“有哪些提示词、它产生了什么、当前测试正文是什么”。视觉密度来自真实文本、效果和来源，不来自虚构仪表盘。

效果预览是工作台主角。宽屏把真实效果或本次模型输出置于中央，Prompt 菜单在左、测试编辑器在右；移动端先给 Output，再通过模式栏进入菜单和编辑器。无效果时展示可执行正文和明确的文本回退，绝不生成伪结果。操作界面提供 Dark Terminal 与 Paper Terminal 两套同构皮肤；作者 About 仍保留更安静的暖纸阅读面。

**Key Characteristics:**

- 单色字符场为主，琥珀色只提示证据、风险或待审状态。
- 硬线、网格和字符标记表达结构；没有玻璃、渐变字、漂浮卡片或装饰阴影。
- Prompt、真实 effect/当前输出和可编辑测试副本在工作台同屏；来源、AI 归属和人工验证保留在公开记录。
- 控件文字明确，状态不只依靠颜色，键盘焦点始终可见。

## Colors

默认主题是近黑底上的柔和磷光绿；可选的 Paper Terminal 把同一语义映射为米白纸面、深墨绿正文和低饱和绿色操作。Home、Workbench 与 Gallery 都必须响应主题切换，选择保存在 `logwood-theme`；大面积区域只使用中性色，信号色保持稀缺，作品图片本身不随主题染色。

### Primary

- **Signal Green** (`#baffb7`): 选中项、主操作、焦点和确认状态；在单屏内不做大面积铺色。
- **Phase-one Mint** (`#baf9b6`): Dark Terminal 中 Home 标题、Workbench 选中行和主运行操作的高亮变体。

### Secondary

- **Evidence Amber** (`#ffc857`): 来源不完整、待人工复核和证据提示，不用于普通装饰。

### Neutral

- **Field Black** (`#020603`): 默认画布。
- **Canvas Black / Workbench Panel** (`#000000` / `#010402`): Dark Terminal 的 Home、Workbench 与媒体舞台。
- **Panel Deep / Low** (`#061008` / `#030a05`): 以微弱层次区分索引、正文和证据区。
- **Phosphor Strong / Body / Muted / Soft** (`#dcffdc` / `#a9dbaa` / `#8bb98e` / `#6f9673`): 标题、正文、辅助信息和最弱元数据。
- **Paper / Paper Ink** (`#f3f0e7` / `#142218`): Paper Terminal 的画布与强文字；About 在此基础上保留作者衬线层。

**The Truth Before Color Rule.** 所有发布、来源、AI 归属和错误状态必须同时有文字；颜色只能加强，不能代替含义。

**The Amber Is Evidence Rule.** 琥珀色只表示需要注意的证据或人工判断，不创建虚构评分和装饰 KPI。

## Typography

**Display / Body / Label Font:** `DejaVu Sans Mono`, `WenQuanYi Zen Hei Mono`, `Noto Sans Mono CJK SC`, `ui-monospace` fallback。

**Author Display Font:** 自托管 `LogWood Author Serif`，仅限 About 的姓名、箴言和章节标题。

**Character:** 主界面像一份清晰、克制的终端档案；中文等宽回退必须可读，字符艺术只能辅助分区。作者衬线体提供个人温度，但不进入筛选、表单或证据数据。

### Hierarchy

- **Display** (700, desktop 96–224px / mobile 52–80px, 0.84): 首页唯一主张；居中占据主要字符场，移动端保持完整不截断。
- **Headline** (800, fluid 61–96px, 0.82): `/skills` 的 `PROMPT` 索引标题。
- **Title** (700, fluid 18–26px, 1.2): 页面与提示词标题。
- **Body / Control** (400–700, 10–14px, 1.4–1.7): 紧凑工作台的控件、正文、描述和证据；长正文限制在约 72ch。
- **Metadata / Label** (700, 8–11px, 0.08em): section 名、筛选、状态和终端式紧凑元数据。

首页与 Prompt 索引页以全大写 `PROMPT` 作为唯一英文显示标题，首页副标题固定为 `PROMPTS, PROVEN.`。标题进入时执行一次 960ms 信号锁定：青/琥珀通道、多段横向切片与故障线在一次序列中短促失步。随后在 2.6–8.6 秒窗口内独立随机抽样下一次触发，并在 split / burst / drop 三种错位强度中随机切换；页面隐藏时暂停，标题正文始终可见，辅助通道由伪元素承载。

**The Characters Must Read Rule.** 不用 ASCII 图形替代标题、按钮文字、来源或状态；辅助字符对读屏器默认隐藏。

## Layout

主容器最大宽度 `98rem`；全站导航例外，必须无左右 gutter 贴合视口。导航品牌为 `KongXin`，公开入口统一使用 `PROMPT / GALLERY / AWESOME / COMMUNITY / ABOUT`，移动端只将 `COMMUNITY` 缩短为 `COMM.`，链接行可横向滚动。首页 Enter 字符场占满首个 `100svh`，不露出后续分区。工作台宽屏为约 `15% / 64% / 21%` 三栏，中央效果/输出区获得最大宽度；左栏条目高 `44px`、缩略图 `32px`，以 `ALL / IMAGE / TEXT / MANAGED` 筛选输出类型。`78rem` 以下使用 `12rem / 1fr / 17rem`，分栏之间只有 1px 硬线；`62rem` 以下切换为 `OUTPUT / PROMPTS / EDIT` 单面板模式并默认 `OUTPUT`。`46rem` 以下缩短导航文案，但不隐藏一级入口。

提示库采用三列平铺，到窄屏退为单列。对比页承载 2–3 条 Prompt；宽度不足时只允许对比表内部横向滚动，页面本身不溢出。间距基于 4px，常用段落间距 8/16/24/32px。所有主要按钮、输入和 disclosure 至少 40px，提交与关键动作以 44px 为目标。

**The Centered Effect Rule.** 有真实效果时，中央舞台优先获得宽度与首屏注意力；无图时正文回退占据同一位置。

## Elevation & Depth

系统是平面的，不用投影抬升容器。深度主要由背景色微差、1px 边框、字符规则线和内容密度产生；Home 仅允许标题的低透明度磷光晕和 `ENTER` 的浅内描边，不能扩散为卡片阴影。灯箱可以使用遮罩建立检查平面，但内容容器本身仍不漂浮。

**The No Theater Rule.** 禁止玻璃、大片霓虹 glow、大阴影、3D 倾斜、自动滚动字符雨和装饰性统计墙。完整 Entry 首屏可以放大真实主题、微弱扫描质感与入口，但不能塞入营销解释、假指标或下一段内容。

## Shapes

几何以方形为默认：结构和卡片为 `0`，普通控件 `1px`，媒体裁切最多 `2px`。边框均为 1px 语义绿色；不用药丸按钮，除非内容本身是极短的二元状态。中央效果使用 `object-contain`，不得为了填满舞台裁掉真实效果；左侧索引缩略图允许 `object-cover` 以维持扫描密度。

## Components

### Navigation

- 普通长页使用粘性暗色/纸面栏；Home 与 Workbench 把导航作为固定视口框架的一行。`KongXin` 品牌、五个英文入口 `PROMPT / GALLERY / AWESOME / COMMUNITY / ABOUT` 与 `PAPER / DARK` 主题操作始终可达。
- 当前项使用薄描边与高亮文字；左侧 Prompt 选中行才使用 Signal Green 反相块。hover 和 focus 同时改变边框与文字。
- 移动端使用短标签和横向可滚动链接行，不折成不可发现的汉堡菜单。

### Prompt Index / Cards

- 每项显示真实标题、类别和最少必要元数据；选中项反相。
- 公共访客的 Prompt 主库只渲染 `published Skill`，历史 Target 单独放进明确的兼容区。管理员在同一左栏额外看到自己 `visibility:private` 的 Candidate draft；它们必须标记 `DRAFT`，且不进入公开列表或 sitemap。
- 预览只使用该 Skill 的真实 `effectImageUrl`；没有时显示文本结果标识。

### Effect Stage

- 真实效果在舞台中央完整显示，`object-contain`，下方可接正文摘要与复制动作。
- 无图文本 Prompt 显示可执行正文；无图图片 Prompt 显示可运行的空舞台；文档、视频与特殊用途显示 `MANAGED ONLY` 和正文，不绘制假缩略图。
- 移动端先于索引出现；加载失败保留可读回退。

### Evidence Inspector

- 使用 definition list 或分行单元展示版本、来源、更新时间、Review/Evaluation 数量和 AI 归属。
- 缺失数据明确写“未记录”，不以 0、假标签或推断值掩盖。

### Compare Picker / Table

- 选择器允许 2–3 条，整行 label 是点击目标；达到上限时禁用未选项并保留解释。
- 对比页按效果、正文、证据、来源和 AI 归属逐行对齐；URL 持有 ids，可分享、刷新和回退。
- 不计算没有真实协议支撑的综合分。

### Buttons and Fields

- 1px 边框、方角、44px 关键命中区；主动作使用绿底黑字，次动作透明底。
- focus-visible 使用 2px Signal Green outline；错误、成功、复制完成通过文字和 `aria-live` 告知。
- disabled 保留可读标签，并通过 opacity 与 cursor 同时表现。

### Prompt Glitch Title

- 只用于首页和 `/skills` 的 `PROMPT` 主标题，不能复制到卡片、状态或普通页面标题。
- 两个色彩通道分别使用 info blue 与 Evidence Amber，通过 `clip-path`、1–6px 位移和短暂透明度完成一次性故障。
- 每次总时长 960ms；首次后由客户端在 2.6–8.6 秒之间独立抽样下一次触发，并随机切换 split / burst / drop 错位强度，不使用固定循环。页面隐藏时清除计时器；`prefers-reduced-motion` 下移除全部辅助层和动画。

### Prompt Workbench

- 左栏使用 44px 行、32px 缩略图和 `ALL / IMAGE / TEXT / MANAGED` 输出筛选。访客只看公开 Skill；管理员还可在同一栏查看自己的私有 Candidate，并以 `DRAFT` 区分。选择已有记录只把正文复制到本地编辑状态，不修改数据库。
- 中央先展示该 Prompt 已保存的真实效果；编辑后明确说明旧效果仍对应已发布正文。文本结果原样展示，CPA 生图结果以 `object-contain` 居中且不裁切。模型 run 结果只存在当前会话中，不自动持久化。
- 右栏提供 12000 字符以内的编辑器、与 Prompt 输出能力匹配的服务器允许模型和显式 `[ RUN ]`（移动端 `RUN TEST`）。图像类默认选择 CPA，文本类默认选择 DeepSeek；只有管理员可调用，结果标记 `TEST ONLY · NOT SAVED`。文本与图片可运行；document、video 和 other 只显示 `MANAGED ONLY`，不提供模型或运行入口。
- 管理员可从剪贴板或文件选取图片，先建立本地未保存预览；只有显式 `Save` 才写入。对已有 Skill，保存只局部更新 effect 字段；新 capture 的 Prompt 可以为空，但只能保存为私有 Candidate，并在补齐字段、通过验证前禁止晋升发布。
- 私有 Candidate 媒体写入 `data/private-uploads/candidates`；浏览器只能由 owner/admin 经 `/api/candidates/:id/preview` 读取，响应必须带 `Cache-Control: private, no-store`。服务层拒绝私有记录引用 `/uploads/*` 或外链 preview，并在 visibility 变更时把 tags 纳入条件更新，避免并发竞态。
- 移动端以三个 44px 模式按钮切换区域，默认显示 Output，页面不得横向溢出。

### Gallery / Living Contact Sheet

- Gallery 是 Prompt 的图像优先研究层，不是独立社区流。固定同一场景后只改变视觉语言，让媒介差异可以被观察和比较。
- 宽屏首屏使用窄风格家族索引、居中主作品、右侧配方/来源 Inspector 与底部接触印样；作品使用 `object-contain`，保持原色，不加遮罩、渐变或文字覆盖。
- 风格家族为 `PAINT / MOVEMENT / PRINT / ILLUSTRATION / DIGITAL / LENS`。下方 Style Atlas 展示当前筛选结果，允许选择 2–4 项进入同题材对比平面。
- 每项必须显示风格名称、中文说明、媒介、观察效果、关键视觉线索和可复制 recipe。来源区至少记录 provider、生成方式、日期、权利状态与验证状态。
- `SYNTHETIC SEED · UNVERIFIED` 只代表用于建立研究坐标的合成种子，不得作为稳定复现、人工验证或客户交付案例。后续真实验证通过现有 Prompt/Candidate/VisualAsset 门禁进入公开记录。
- `62rem` 以下按索引、主作品、接触印样、Inspector 纵向重排；`46rem` 以下图谱两列、对比面横向滚动，页面本身不得横向溢出。

### Awesome / Project + Skill Radar

- 顶栏只保留一个 `AWESOME`，站内二级字符栏固定为 `PROJECTS / SKILLS / FEEDS`；当前项使用 Signal Green 反相，不再新增一级导航。
- Projects 保存可投入方向和最小交付；Skills 保存 Agent `SKILL.md` 能力包的来源、兼容性、权限、成熟度与首次试用边界；Feeds 保存官方规范、上游仓库和精选目录。
- Skill 生命周期显示为 `COLLECTED → AUDITED → TRIED → PROVEN`。这只是本站调查成熟度，不等于上游质量、许可安全或执行结果。
- 宽屏保留窄筛选栏与高密度单行索引，一次只展开一项；详情显示 `WHY IT MATTERS / FIRST LOOK / AUDIT NOTE`，动作限于 `SOURCE REPO / READ SKILL`，绑定公开 Prompt 时才出现 `VIEW PROMPT`。
- Skill Index 不出现 `RUN`、安装或自动调用。权限标签必须显式区分 `READ-ONLY / FILESYSTEM / NETWORK / SHELL / CREDENTIALS`，许可证不明确时显示 `REVIEW` 或 `RESTRICTED`。
- Project 与 Skill 可以共享 1–5 兴趣信号，但两类 Candidate 用 `catalog:project` 与 `catalog:skill` 隔离；移动端筛选折叠，索引保持整页无横向溢出。

## Do's and Don'ts

### Do:

- **Do** 让 Prompt、真实效果和证据形成完整阅读链。
- **Do** 区分“已保存效果”“当前模型结果”“编辑后未重新运行”三种状态。
- **Do** 在移动端优先展示效果，并保持页面 `scrollWidth === innerWidth`。
- **Do** 用真实来源、版本、归属和人工审核状态填充界面。
- **Do** 为键盘焦点、失败回退、reduced-motion 和 40–44px 命中区保留明确实现。
- **Do** 让 Paper Terminal 覆盖所有操作界面，同时让 About 的衬线暖纸面只承担作者叙事和来源检查。

### Don't:

- **Don't** 复制参考图里的头骨、虚构模型名、评分、日期或指标。
- **Don't** 用伪效果图、随机 ASCII 动画或装饰仪表盘冒充内容。
- **Don't** 在输入变化时自动消耗模型请求；测试必须由用户明确触发。
- **Don't** 把 Candidate draft、Target 或 App 混进公开 Prompt 主库；管理员私有 `DRAFT` 视图不改变这条公开边界。
- **Don't** 通过物理删除来实现内容下架；公开状态与历史数据必须分离。
- **Don't** 把 AI 输出直接公开，或省略 provider、model、agent 和人工门禁信息。
