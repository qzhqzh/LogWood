# Skill Hub：托管与外部目录

日常操作与可复制命令见 [Skill Hub 使用指南](./SKILL_HUB_USAGE.md)；本文记录数据、权限、版本及部署边界。

`/awesome/skills` 同时展示**可下载的本站托管 Skill 包**和**仅供研究的外部 Skill 目录**。前者支持网页提交文件夹、管理员审核、不可变版本与 ZIP 下载；后者沿用已有 Candidate 元数据管理，不会因为有 GitHub 链接就宣称本站持有其文件或再分发权。两者都不会在服务端安装或执行 Skill。`/skills` 与 `/skills/manage` 管的是可执行 Prompt，仍是第三套独立记录。

## 本站托管的 Skill 包

1. 登录后打开 `/awesome/skills/hub`，选择一个文件夹；根目录必须有 UTF-8 的 `SKILL.md`，YAML frontmatter 的 `name` 必须与文件夹名称一致，且包含 `description`。可带 `scripts/`、`references/`、`assets/`；确认有再分发权并检查敏感信息后提交。
2. 新 Skill 从 `1.0.0` 开始，后续修改自动增加补丁版本。内容未变化则跳过；同一 Skill 同时只能有一个待审核版本。普通投稿和管理员投稿都进入待审队列，不自动公开。仅管理员在同一页面检查 `SKILL.md`、文件清单与待审 ZIP 后批准或退回；旧的已发布版本始终保留。
3. 已通过审核的包公开展示并提供 ZIP 下载，可按版本下载。下载头返回 ZIP 文件的 SHA-256，CLI 会校验后再保存；下载**不会解压、安装或执行**。审核结果、原文件与文件列表留在数据库中，数据库备份需要覆盖新增的 `agent_skill_*` 表。
4. 最多 80 个文件、单文件 3 MB、总文件 8 MB；拒绝绝对路径、上级路径和重复路径。网页及 CLI 会跳过隐藏文件（例如 `.git`、`.env`），服务端拒绝主动提交的隐藏文件；请确认实际打包的文件清单。上传的文件视为不受信任，审核不等于安全认证。本站目前不运行自动恶意代码扫描，也不自动抓取 GitHub 第三方仓库。

### 命令行推送和单向同步

在 Hub 页面创建有 90 天有效期的发布凭证（页面只显示一次）。可从页面下载独立的 `skillhub.mjs`，也可在本仓库使用 `scripts/skillhub.mjs`；需要 Node.js 20+。不要把凭证写进仓库或命令行历史。以下在下载脚本的目录运行，`read -rs` 后输入凭证并按回车：

```sh
export LOGWOOD_SKILLHUB_URL=https://你的站点
read -rs LOGWOOD_SKILLHUB_TOKEN
export LOGWOOD_SKILLHUB_TOKEN
node skillhub.mjs sync ./my-skill --dry-run
node skillhub.mjs sync ./my-skill --confirm-rights
node skillhub.mjs sync ./skills --all --confirm-rights
node skillhub.mjs push ./my-skill --confirm-rights
node skillhub.mjs download my-skill-xxxx --output ./my-skill.zip
```

`sync` 是**本地 → 本站**，比较文件内容指纹，只提交新增或变化的 Skill；`push` 总是尝试提交，但服务端仍会去重。`download` 校验 ZIP 后按 `wx` 模式保存，不覆盖已有文件。凭证只有发布权限，不能自行批准版本；网页上可随时撤销。HTTPS 是默认要求，在可信局域网用 HTTP 测试时需显式设置 `LOGWOOD_SKILLHUB_ALLOW_INSECURE_HTTP=1`，该模式会让凭证明文传输，不适合公网。

新增了 Prisma 表，需要由已有的 schema-sync 部署流程在**数据库备份后**同步结构；本次代码工作不会自动执行生产迁移或部署。上线前应验证账号登录、提交、审核、下载和数据库备份。

约定参考 [Agent Skills 格式规范](https://agentskills.io/specification)、[ClawHub 的发布/同步语义](https://github.com/openclaw/clawhub/blob/main/docs/cli.md)及[自托管 SkillHub 的版本化实践](https://github.com/iflytek/skillhub)。本站没有复刻 ClawHub 的协议兼容、自动扫描、GitHub 导入或自动安装能力。

## 仅供研究的外部目录

管理员在 `/awesome/skills/manage` 收录、编辑、按成熟度筛选、标记归档并导出 JSON；这部分没有托管 ZIP，不可通过本站下载或同步。

- 目录记录保存在 `Candidate`（`awesome` + `catalog:skill` 标签）；结构化审计资料按 `awesome-skill.v1` 放在 `rawContent`。创建时默认收录状态，`slug` 创建后不变，旧链接和评分保留。
- 手工更改是以数据库记录为准的。`src/content/awesome-skills.ts` 和 `scripts/sync-awesome-skills.ts` 用于首次导入及补全缺失的种子字段；同步不会覆盖已填写的档案和分类标签。新建条目不会自动反写静态种子。
- “归档”将状态改为 `dropped`，公开目录继续可查并显示 `ARCHIVED`；不删除条目或兴趣评分。受损的结构化数据仍列在管理和导出结果中，但管理表单拒绝覆盖，需要先修复原始记录。
- 管理接口仅允许已登录管理员；写入有格式检查和冲突保护。`?export=1` 导出包含原始资料的 `logwood.skill-catalog.export.v1` JSON，供整理或备份；没有自动导入或执行第三方 Skill 的能力。生产环境还需按既有数据库备份策略保存记录，导出不是自动备份。
