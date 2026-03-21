# Happy Coder 本地开发环境搭建日志 (2026-03-03)

## 目标
实现 Happy Coder 项目 (Server + Web + CLI + Daemon) 的本地完整运行，并跑通 CLI 认证与数据同步流程。

## 产出文件
在项目根目录下创建了以下辅助脚本，用于一键管理服务：

| 脚本 | 功能 | 依赖操作 |
| :--- | :--- | :--- |
| `00-cleanup.sh` | **环境重置**：清理端口 (3005, 8083, 9090)、杀进程、删 `/tmp/pglite` 数据库 | - |
| `01-start-server.sh` | **启动 Server**：自动执行 migrate 并监听 3005 端口 | 需先执行 00 |
| `02-start-web.sh` | **启动 Web App**：监听 8083 端口，提供 Web 控制台 | 需 Server 运行中 |
| `03-auth-cli.sh` | **CLI 认证**：发起 Web 登录请求，连接本地 Server | 需 Web 已登录 |
| `04-start-daemon.sh` | **启动 Daemon**：后台运行服务，处理同步和 MCP 请求 | 需 CLI 已认证 |

## 遇到的问题与解决方案

### 1. Playwright 环境缺失
- **现象**：MCP Server 报错 `Executable doesn't exist`，无法启动浏览器进行自动化测试。
- **原因**：Playwright MCP 使用独立的缓存路径，无法读取项目 `node_modules` 安装的浏览器。
- **解决**：改用手动流程。通过脚本启动 Web 端，手动在浏览器完成配置和点击“接受连接”。

### 2. happy-cli 构建失败 (TypeScript 错误)
- **现象**：执行 `yarn workspace happy-coder build` 时报错 `Type instantiation is excessively deep`。
- **原因**：Zod schema 定义过于复杂，导致 TS 类型推断溢出。
- **解决**：
  - 修改 `packages/happy-cli/src/claude/utils/startHappyServer.ts`
  - 修改 `packages/happy-cli/src/codex/codexMcpClient.ts`
  - 在报错行上方添加 `// @ts-ignore` 绕过检查。

### 3. CLI 启动报错 (Entrypoint missing)
- **现象**：运行 `happy` 或 `daemon start` 报错 `Entrypoint .../dist/index.mjs does not exist`。
- **原因**：构建过程中 `shx rm -rf dist` 删除了目录，但 `pkgroll` 构建因报错未完成，或产物路径不正确。
- **解决**：修复 TS 错误后重新完整构建 (`yarn workspace happy-coder build`)，生成了正确的 `dist/index.mjs`。

### 4. CLI 报错 500 (Token 不匹配)
- **现象**：`happy` 命令报错 `Request failed with status code 500`。Server 日志显示 `Record not found`。
- **原因**：执行 `00-cleanup.sh` 重置了数据库，但 CLI 本地缓存 (`~/.happy`) 仍保留旧的 Token。CLI 带着旧 Token 请求新数据库，找不到用户记录。
- **解决**：彻底清理环境，包括删除 `~/.happy` 目录，然后重新走一遍认证流程。

### 5. CLI 报错 401 Unauthorized (Persistent)
- **现象**：
  - Web 端已登录，Server URL 配置正确，CLI 认证流程已跑通。
  - `happy` 命令依然报错 401。
- **根本原因**：
  - `happy-cli` 源码中 `src/configuration.ts` 默认将 `serverUrl` 指向官方生产环境 (`https://api.cluster-fluster.com`)。
  - 虽然通过 `04-start-daemon.sh` 设置了环境变量 `HAPPY_SERVER_URL`，但 Daemon 子进程启动时环境变量未正确透传。
  - 即使修改了本地配置文件 `settings.json`，由于本地安装的 CLI 版本 (`0.14.0-0`) 与系统全局安装的 CLI 版本 (`0.13.0`) 不匹配，Daemon 会自动重启并回退到全局版本，导致配置失效。
- **最终解决**：
  1. **卸载全局版本**：`npm uninstall -g happy-coder`，防止 Daemon 自动降级。
  2. **修改源码**：直接修改 `packages/happy-cli/src/configuration.ts`，将默认 `serverUrl` 改为 `http://localhost:3005`。
  3. **重新构建**：执行 `yarn workspace happy-coder build`。
  4. **重启 Daemon**：确保运行的是最新的本地构建版本。

## 正确启动流程 (从零开始)

如果要彻底重置环境并从头运行，请按以下顺序执行：

```bash
# 1. 清理所有服务和数据
./00-cleanup.sh

# 2. 【关键】清除 CLI 本地旧凭证 (防止 500 错误)
rm -rf ~/.happy

# 3. 启动 Server (保持终端运行)
./01-start-server.sh

# 4. 启动 Web (新终端)
./02-start-web.sh
# -> 浏览器打开 http://localhost:8083/server 设置 URL 为 http://localhost:3005
# -> 浏览器打开 http://localhost:8083/restore/manual 输入 Key 登录

# 5. CLI 认证 (新终端)
./03-auth-cli.sh
# -> 浏览器弹出，点击 "Accept Connection"

# 6. 启动 Daemon (新终端)
./04-start-daemon.sh

# 7. 验证
happy
# -> 应该能正常进入交互模式
```

## 明日工作计划 (2026-03-04)

### 1. 功能深度测试
- **CLI 交互测试**：
  - 测试文件读写能力 (如 `happy run "create file"`)。
  - 测试 git 操作集成 (如 `happy commit`)。
- **Web 端同步测试**：
  - 验证 CLI 操作历史是否实时同步到 Web App。
  - 测试在 Web App 创建 Session 并同步回 CLI。

### 2. 多端联调 (可选)
- 配置 `ngrok` 或局域网访问，尝试让移动端 App 连接本地 Server。
- 验证手机控制电脑执行命令的流程。

### 3. MCP Server 集成
- 配置 Claude Desktop 连接本地 Happy MCP Server。
- 验证通过 Claude 界面直接操作本地文件系统。

### 4. 代码优化
- 彻底解决 `happy-cli` 的 TypeScript 类型错误 (寻找比 `@ts-ignore` 更好的解法)。
- 优化启动脚本，尝试合并为一个 `start-all.sh`（需解决后台进程管理问题）。
