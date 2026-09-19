# Skill Hub 使用指南

本站 Agent Skill Hub 入口是 `/awesome/skills/hub`；`/awesome/skills` 展示审核通过的文件包和独立的外部参考目录。这里的 `push` / `sync` 是向网站仓库上传文件包，**不是 `git push`，也不会把文件同步进网站的 Git 仓库**。

## 使用前

- 网站需先完成包含 `agent_skill_*` 表的数据库结构更新，并配置可用的登录方式。代码合并本身不会更新运行中的站点或数据库；外部投稿者使用网站配置的 GitHub 登录，审核仅限管理员。
- 准备一个自己有权再分发的 Skill 文件夹，根目录的 UTF-8 `SKILL.md` 必须含 YAML `name`、`description`，`name` 与文件夹名称一致。可包含 `scripts/`、`references/`、`assets/`。先检查其中的凭据和第三方许可。
- 限制：最多 80 个文件，单文件不超过 3 MB，整个包不超过 8 MB。网页与 CLI 会忽略隐藏文件和目录；请核对实际上传的文件清单。

## 在网页提交与下载

1. 登录并打开 `/awesome/skills/hub`，在“提交你的 Skill”处选择整个文件夹，填写可选的改动说明，确认发布权利，再提交。
2. 版本先进入“我的提交”中的待审状态。管理员在同页检查清单、`SKILL.md` 和待审 ZIP 后批准或退回；审核前其他人看不到和下载不了这个版本。
3. 批准后，所有人都能从页面下载 ZIP。旧版本仍可按版本下载；下载只是保存文件，不会自动安装或执行其中的脚本。

同一个 Skill 已有待审版本时，需要先等审核完成。内容没有变化会跳过；退回后必须修改文件内容才能再次提交。

## 命令行上传、同步与下载

在 Hub 页面“本地同步凭证”生成凭证，**只显示一次**。可以使用仓库内的 [`scripts/skillhub.mjs`](../scripts/skillhub.mjs)，其他电脑可从 Hub 页面下载同一个独立脚本；需要 Node.js 20+。下面的命令从本仓库根目录运行；如果脚本下载到了当前目录，改用 `node skillhub.mjs`。

```bash
export LOGWOOD_SKILLHUB_URL=https://你的站点
read -rs LOGWOOD_SKILLHUB_TOKEN
export LOGWOOD_SKILLHUB_TOKEN

# 先预览；--all 仅扫描指定目录的直属子文件夹中含 SKILL.md 的 Skill
node scripts/skillhub.mjs sync ./publishable-skills --all --dry-run

# 同步新增或变化的文件夹，进入审核队列
node scripts/skillhub.mjs sync ./publishable-skills --all --confirm-rights

# 单独提交一个 Skill；服务端仍会跳过重复内容
node scripts/skillhub.mjs push ./publishable-skills/my-skill --confirm-rights

# 从页面复制真实 slug，可固定下载版本；不覆盖已有目标文件
node scripts/skillhub.mjs download my-skill-xxxx --version 1.0.0 --output ./my-skill.zip

unset LOGWOOD_SKILLHUB_TOKEN
```

不要把凭证写入仓库、命令参数或命令历史。默认要求 HTTPS；可信局域网的临时 HTTP 测试需额外设置 `LOGWOOD_SKILLHUB_ALLOW_INSECURE_HTTP=1`，但凭证会明文传输，不能用于公网。CLI 会验证下载 ZIP 的 SHA-256，验证失败不会保存。

## 建议采用的同步约定

将受版本控制的本地 Skill 文件夹作为编辑来源，另建 `publishable-skills/` 只放有发布权的内容。每次先 `--dry-run`，确认后人工执行 `sync --all --confirm-rights`；站点负责保存不可变版本和审核后分发。**当前同步仅为本地 → 站点**，不会从站点自动覆盖本地文件，也不会替别人修改其名下的 Skill。不同投稿者可发布同名但各自拥有的包。

不要直接批量发布 `.agents/skills` 或从第三方仓库抓取后自动发布。未来如需自动化，可在专用仓库完成许可和文件检查后，用受保护的 CI 凭证执行同步；不建议在每次本地文件保存时自动投稿。更多数据边界、版本规则与部署要求见 [Skill Hub 技术说明](./SKILL_CATALOG.md)。
