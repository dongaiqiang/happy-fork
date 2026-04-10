# HV-001-2026-04-10-Trae-Main-npm包名命令名与环境变量品牌迁移结论

## 结论摘要

- 本轮已按派单要求在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main` 内完成 npm 包名、CLI 主命令名、环境变量前缀的主线品牌迁移收口。
- 当前主口径已明确为：
  - npm 包名：`hellovibe`
  - CLI 主命令：`hellovibe`
  - 环境变量前缀：`HELLOVIBE_`

## 已完成收口

### 1. npm 包名

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/package.json` 已将包名改为 `hellovibe`。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/package.json` 根脚本已切到 `yarn workspace hellovibe cli`。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/package-lock.json` 中本地 link 名称已同步到 `hellovibe`。
- README 与 App 内升级指令已统一为 `npm install -g hellovibe@latest` / `npm install -g hellovibe` 主口径。

### 2. CLI 主命令

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/index.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/commands/auth.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/commands/connect.ts` 已将默认帮助、错误提示、下一步引导收口为 `hellovibe`。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/ui/doctor.ts` 的默认诊断与引导口径已切到 `hellovibe doctor`。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/EmptyMainScreen.tsx` 与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/text/*` 中展示给用户的启动命令已切到 `hellovibe`。

### 3. 环境变量前缀

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/configuration.ts` 已实现 `HELLOVIBE_*` 优先、`HAPPY_*` fallback。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/serverConfig.ts` 已实现 `EXPO_PUBLIC_HELLOVIBE_SERVER_URL` 优先、`EXPO_PUBLIC_HAPPY_SERVER_URL` fallback。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-agent/src/config.ts` 已实现 `HELLOVIBE_SERVER_URL`、`HELLOVIBE_HOME_DIR` 主路径。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/connectRoutes.ts` 已实现 `HELLOVIBE_WEBAPP_URL` 主路径。

## 兼容层说明

- 命令兼容层：保留 `happy`、`happy-mcp` 作为升级兼容命令别名。
- 环境变量兼容层：保留 `HAPPY_*` 作为 fallback，不再作为默认文案与主验证口径。
- 存储目录兼容层：默认本地数据目录仍保持 `~/.happy` 系列，不在本轮强行迁移，避免打断既有安装。

## 当前边界

- 本轮未重命名内部目录名 `packages/happy-cli`、`packages/happy-app`、`packages/happy-server`、`packages/happy-agent`；这些属于仓库工程结构名，不是本轮要求的默认用户口径。
- 本轮未移除兼容命令与兼容 env fallback；它们当前仍用于平滑升级。
- 本轮没有跨目录改写 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main` 与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-claude`。

## 评审结论

- 结论：通过，可作为主线品牌迁移收口版本提交并回报。
- 建议：
  - 依赖方同步时，以 `hellovibe` / `HELLOVIBE_` 为唯一主口径。
  - 若外部仍需保留 `happy-coder` npm 安装兼容，应在发布侧单独维护，不应继续回写到主线默认文案。
