# HV-001-2026-04-10-Trae-Main-npm包名命令名与环境变量品牌迁移工作日志

- 工单号：`HV-001` / `HV-001-TRAE-MAIN-03`
- 工作目录：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`
- 执行角色：`Trae-主线执行位`

## 本轮目标

- 在主线目录内将 npm 包名主口径从 `happy-coder` 收口为 `hellovibe`。
- 将 CLI 主命令从 `happy` 收口为 `hellovibe`，旧命令仅保留兼容入口。
- 将环境变量前缀主路径从 `HAPPY_` 收口为 `HELLOVIBE_`，旧前缀仅保留 fallback。
- 同步收口 README、帮助输出、doctor、脚本、应用内升级文案、测试与桥接逻辑，并产出可验证交付。

## 实施过程

### 1. 包名与入口收口

- 将 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/package.json` 中根脚本 `cli` 切到 `yarn workspace hellovibe cli`。
- 将 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/package.json` 的包名改为 `hellovibe`。
- 在同一文件内将 bin 主入口收口为：
  - `hellovibe`
  - `hellovibe-mcp`
- 同时保留兼容命令：
  - `happy`
  - `happy-mcp`
- 将 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/package-lock.json` 中 workspace 链接与对外包名同步到 `hellovibe`。

### 2. CLI 主命令与帮助输出收口

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/index.ts` 中将主帮助、daemon、notify、version、错误建议全部切到 `hellovibe` 主口径。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/commands/auth.ts` 中将 `happy auth ...` 全部收口为 `hellovibe auth ...`。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/commands/connect.ts` 中将 `happy connect ...` 全部收口为 `hellovibe connect ...`。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/ui/auth.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/claude/runClaude.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/codex/runCodex.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/gemini/runGemini.ts` 中同步收口登录失败、缺本机配置等用户提示。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/utils/serverConnectionErrors.ts` 中将离线重连与 401 提示改为 `hellovibe auth`。

### 3. 环境变量前缀桥接

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/configuration.ts` 中新增品牌 env 读取桥接，主顺序改为 `HELLOVIBE_* -> HAPPY_*`。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/ui/logger.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/ui/doctor.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/controlClient.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/utils/createSessionMetadata.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/claude/sdk/utils.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/codex/happyMcpStdioBridge.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/run.ts` 中完成新旧双前缀桥接。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/bin/happy-dev.mjs`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/scripts/env-wrapper.cjs`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/scripts/claude_version_utils.cjs` 中补齐脚本层 `HELLOVIBE_*` 主路径，同时保留 `HAPPY_*` 兼容。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/serverConfig.ts` 中新增 `EXPO_PUBLIC_HELLOVIBE_SERVER_URL` 优先级，高于 `EXPO_PUBLIC_HAPPY_SERVER_URL`。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-agent/src/config.ts` 中新增 `HELLOVIBE_SERVER_URL`、`HELLOVIBE_HOME_DIR` 主路径，旧前缀作为 fallback。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/connectRoutes.ts` 中将 Web App 地址改为 `HELLOVIBE_WEBAPP_URL` 优先。

### 4. README、安装与应用内升级口径收口

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/README.md`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/README.md`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/README.md`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-agent/README.md` 中将安装命令、主命令与品牌说明切到 `hellovibe`。
- 将 README 中对兼容层的表述收口为“兼容命令别名仍保留”，不再把 `happy-coder` 继续写成当前主安装口径。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/scripts/unpack-tools.cjs`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/scripts/link-dev.cjs`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/CONTRIBUTING.md`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/CONTRIBUTING.md` 中同步收口安装后引导与开发文档口径。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/EmptyMainScreen.tsx`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/session/[id]/info.tsx`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/_default.ts` 及多语言翻译文件中，把 app 内展示的安装命令、状态检查命令、升级命令收口为 `hellovibe`。

## 本轮实际修改文件

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/package.json`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/package-lock.json`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/README.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/package.json`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/README.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/CONTRIBUTING.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/bin/happy-dev.mjs`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/scripts/env-wrapper.cjs`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/scripts/unpack-tools.cjs`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/scripts/link-dev.cjs`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/scripts/claude_version_utils.cjs`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/scripts/claude_version_utils.test.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/configuration.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/index.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/index.test.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/commands/auth.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/commands/connect.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/ui/auth.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/ui/doctor.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/ui/logger.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/claude/claudeLocal.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/claude/sdk/utils.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/claude/runClaude.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/codex/happyMcpStdioBridge.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/codex/runCodex.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/gemini/runGemini.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/utils/createSessionMetadata.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/utils/serverConnectionErrors.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/utils/serverConnectionErrors.test.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/controlClient.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/run.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/daemon.integration.test.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/README.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/CONTRIBUTING.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/EmptyMainScreen.tsx`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/session/[id]/info.tsx`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/serverConfig.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/serverConfig.test.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/_default.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/en.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/ca.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/es.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/it.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/ja.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/pl.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/pt.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/ru.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/zh-Hans.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/translations/zh-Hant.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-agent/README.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-agent/src/config.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-agent/src/config.test.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/connectRoutes.ts`

## 当前结论

- npm 包名主口径已切为 `hellovibe`。
- CLI 主命令主口径已切为 `hellovibe`，`happy` / `happy-mcp` 仅作为兼容命令别名保留。
- 环境变量主路径已切为 `HELLOVIBE_*`，`HAPPY_*` 作为兼容 fallback 保留。
- App 内升级文案、README、doctor、脚本与关键测试已完成一轮同步收口，并已进入可验证交付状态。
