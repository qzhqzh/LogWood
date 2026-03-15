# LogWood 项目样式指南 (Style Guide)

本文档归纳了 LogWood 项目核心的样式特点和复用规范，后续所有页面的新增或重构样式均应遵循此规范。更新组件后，请同步维护本文档。

## 1. 核心视觉主题 (Dark Neon / Cyberpunk)

项目整体采用**暗黑为主，高亮点缀（青/紫/粉渐变霓虹）**的赛博风格。背景以极深色纯色为主，卡片通过透明度、渐变和边框发光来区分层级。

*   **背景底色**: `#0a0a0f`（页面主背景）
*   **卡片/模块背景**:
    *   主卡片层：`bg-[#0f1018]` 或 `rgba(18, 18, 26, 0.9)`
    *   次卡片/内输入框层：`bg-[#12121a]` 或 `rgba(10, 10, 15, 0.8)`
*   **点缀色 (Accent)**:
    *   主发光色：Cyan / 青色（`cyan-400` / `cyan-500`）
    *   辅点缀色：Purple / 粉色（`purple-500` / `pink-500`）
    *   警告/成功：`red-300` / `emerald-300`
    *   评分提示：`yellow-400` / `yellow-500`
*   **全局文本颜色**:
    *   **标题/高对比度**: `text-white`
    *   **主正文内容**: `text-gray-300` (切忌使用 text-gray-700/900，在暗黑模式下无法阅读)
    *   **次要文本/时间**: `text-gray-400` 或 `text-gray-500`
    *   **高亮行动点 (Hover 等)**: `text-cyan-400` 甚至 `text-cyan-300`

## 2. 全局复用 Class (定义于 \`globals.css\`)

直接在普通的 HTML 元素中写这些 Class 可以快速获得特定的主题样式：

*   **\`.cyber-card\`**: 提供磨砂玻璃（backdrop-blur）、暗色渐变与 \`cyan-500/20\` 弱边框的主大容器卡片（带有 hover 发光效果）。
*   **\`.cyber-input\`**: 输入框标配，带暗黑底色、青色发光获得焦点时的投影。
*   **\`.cyber-button\`**: 通用的主要行动按钮操作，带有炫酷的内部扫光动画与 hover 增强发光效果。
*   **\`.gradient-text\`**: 文字呈霓虹渐变（青 -> 粉 -> 青），常用于大标题。
*   **\`.grid-bg\`**: 大页面背景上的暗纹网格理理效果。
*   **\`.neon-glow\`**: 为任意文字或图标附加全局荧光投影效果。

## 3. 常见 Tailwind 工具类套用规范

若场景不适合上述全局类，或是在做一些微小组件（如：内联面板、评论列表），可使用 Tailwind 等效类：

### 卡片与描边 (Cards & Borders)
*   **基础面板**: \`rounded-xl border border-cyan-500/15 bg-[#0f1018] p-4\`
*   **内嵌面板/次级面板**: \`rounded-lg border border-cyan-500/30 bg-[#12121a] p-3\`
*   **分割线**: 避免用 \`border-gray-200\`，应使用 \`border-cyan-500/10\`。

### 头像与图标模块 (Avatars & Badges)
*   **默认头像框**: 不要是单调的 \`bg-gray-200\`，应使用带发光的内嵌体。
    *推荐用法*: \`w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-500/30 flex items-center justify-center text-sm\`

### 交互标签与分类按钮 (Chips & Toggles)
*   **未激活**: \`bg-gray-800 text-gray-500 hover:text-cyan-300\`
*   **已激活**: \`bg-cyan-500/20 text-cyan-300 border border-cyan-500/30\`

## 4. 样式维护说明

*   在任何新增或翻新的 React 组件时，**优先用第 2 节的全局 Class 类（如 \`.cyber-button\`, \`.cyber-input\`）**。
*   如果遇到特殊容器，遵循第 3 节的调色板（始终使用 `cyan/purple` 的透明色进行 border 或 bg，绝对禁止使用纯白色底色对应的 `gray-100` 或 `gray-800 text-gray-900` 搭配）。
*   如遇高度重复的新视觉范式，请将其提取到 \`globals.css\`，并同步说明到本 \`STYLE_GUIDE.md\` 文件中。

## 5. 标签系统视觉规范 (Tag Pool)

标签池采用三类语义色，统一用于：标签管理页、评测对象编辑页、标签选择器与已选标签展示。

*   **正向标签 (good)**:
    *   标题/强调：`text-emerald-300`
    *   标签样式：`border-emerald-400/30 bg-emerald-500/10 text-emerald-200`
*   **负向标签 (bad)**:
    *   标题/强调：`text-rose-300`
    *   标签样式：`border-rose-400/30 bg-rose-500/10 text-rose-200`
*   **中性标签 (neutral)**:
    *   标题/强调：`text-violet-300`
    *   标签样式：`border-violet-400/30 bg-violet-500/10 text-violet-200`
    *   说明：中性标签使用 violet 体系，避免与正向(emerald)和负向(rose)冲突。

标签快速创建的枚举文案统一为：**正向 / 负向 / 中性**，禁止再出现“好 / 不好”等非标准文案。

## 6. 默认执行规则

从现在起，`docs/STYLE_GUIDE.md` 为样式默认规范源：

*   新增页面或组件样式时，默认先对齐本文件，再做局部扩展。
*   若实现与本文档不一致，以“先更新本文档，再提交样式改动”为准。
*   在 PR 自检时需确认：颜色语义、组件层级、交互态是否与本文档一致。