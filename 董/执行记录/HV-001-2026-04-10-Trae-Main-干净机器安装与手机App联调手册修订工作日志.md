# HV-001-2026-04-10-Trae-Main-干净机器安装与手机App联调手册修订工作日志

- 工单号：`HV-001` / `HV-001-TRAE-MAIN-04`
- 工作目录：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`
- 执行角色：`Trae-主线执行位`

## 本轮目标

- 将 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/HelloVibe 干净机器安装与手机 App 联调手册.md` 修订到与当前主线实现一致。
- 统一手册主口径为 `hellovibe` / `hellovibe` / `HELLOVIBE_`。
- 明确 tgz 替代安装、电脑侧 auth / daemon 流程、手机 App 登录与绑定流程。
- 拆开“完整新会话路径”和“机器详情页快捷新会话路径”。

## 实施过程

### 1. 重新核对手册与当前实现

- 重新核对 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/package.json`，确认当前 npm 包名为 `hellovibe`，workspace 名可直接使用 `hellovibe`，tgz 产物名应为 `hellovibe-0.14.0-0.tgz`。
- 重新核对 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/configuration.ts`，确认：
  - `HELLOVIBE_SERVER_URL` / `HELLOVIBE_WEBAPP_URL` 是主路径
  - `HELLOVIBE_HOME_DIR` 可覆盖数据目录
  - 默认 home 目录当前仍落在 `~/.happy`
- 重新核对 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/ui/auth.ts` 与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/index.ts`，确认：
  - 移动端登录路径会显示二维码与 `hellovibe://terminal?...`
  - Web 登录路径会尝试拉起浏览器
  - `hellovibe daemon start` 依赖先完成登录

### 2. 修订联调手册正文

- 更新 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/HelloVibe 干净机器安装与手机 App 联调手册.md` 的环境变量章节：
  - 正式环境地址
  - 局域网联调地址
  - `HELLOVIBE_HOME_DIR`
  - 三端必须指向同一套地址的说明
- 更新安装章节：
  - 安装后检查命令改为 `hellovibe daemon --help`
  - tgz 打包步骤写清楚仓库根目录、`yarn workspace hellovibe build`、`cd packages/happy-cli`、`yarn build`、`npm pack`
- 更新登录与 daemon 章节：
  - 明确默认按移动端登录理解
  - 补充 Web Authentication 与手机扫码绑定不是同一路径
  - 补充未登录时直接执行 daemon 会失败
- 更新手机 App 章节：
  - 明确未登录首页、恢复账号页、机器详情页、新会话页各自职责
  - 把“完整新会话路径”和“机器详情页快捷启动路径”拆开写

### 3. 补齐对外协作口径

- 在手册内补充评审建议与送审话术，便于直接发给 CLI 责任人、App 责任人和总管位复核。
- 在手册内补充“可直接发微信 / 飞书的短消息”，写清：
  - 手册绝对路径
  - 主线仓库路径
  - 建议新会话测试目录路径
  - 正式环境与局域网联调地址
  - 测试同学需要重点反馈的问题

### 4. 做一轮命令与页面核对

- 运行 CLI 帮助命令，确认 `auth` 与 `daemon` 帮助已切到 `hellovibe` 主口径。
- 运行 `npm pack --dry-run`，确认 tgz 产物名确实为 `hellovibe-0.14.0-0.tgz`。
- 结合 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/index.tsx`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/EmptyMainScreen.tsx`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/machine/[id].tsx`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/new/index.tsx` 做页面职责核对。

## 本轮实际修改文件

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/HelloVibe 干净机器安装与手机 App 联调手册.md`

## 本轮新增交付文件

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/执行记录/HV-001-2026-04-10-Trae-Main-干净机器安装与手机App联调手册修订工作日志.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/执行记录/HV-001-2026-04-10-Trae-Main-干净机器安装与手机App联调手册修订说明.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/测试结果/HV-001-2026-04-10-Trae-Main-干净机器安装与手机App联调手册修订验证结果.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/执行记录/HV-001-2026-04-10-Trae-Main-干净机器安装与手机App联调手册修订派单回报.md`

## 当前结论

- 手册最终主口径已统一为 `hellovibe` / `hellovibe` / `HELLOVIBE_`。
- tgz 替代安装、移动端登录、daemon 依赖关系、App 页面职责与新会话路径均已按当前实现修订。
- 当前手册已可作为干净机器安装、手机 App 联调与测试位复验的统一入口文档继续使用。
