# HV-001-2026-04-10-Trae-Main-干净机器安装与手机App联调手册修订说明

- 工单号：`HV-001` / `HV-001-TRAE-MAIN-04`
- 工作目录：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`
- 执行角色：`Trae-主线执行位`

## 结果概述

- 已完成 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/HelloVibe 干净机器安装与手机 App 联调手册.md` 的主线修订。
- 手册最终采用的主口径为：
  - npm 包名：`hellovibe`
  - CLI 主命令：`hellovibe`
  - 环境变量前缀：`HELLOVIBE_`
- 手册已补齐正式环境与局域网联调两套地址写法，并把电脑端、手机端和新会话路径按当前实现拆开说明。

## 修订章节与实现依据

### 1. 环境变量与地址章节

- 手册修订点：
  - 增加 `HELLOVIBE_SERVER_URL`
  - 增加 `HELLOVIBE_WEBAPP_URL`
  - 增加 `HELLOVIBE_HOME_DIR`
  - 增加正式环境与局域网联调两套地址
  - 明确默认 home 目录仍为 `~/.happy`
- 实现依据：
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/configuration.ts`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/serverConfig.ts`

### 2. tgz 替代安装章节

- 手册修订点：
  - 明确打包目录在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`
  - 明确打包命令顺序为：
    - `yarn install`
    - `yarn workspace hellovibe build`
    - `cd /Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli`
    - `yarn build`
    - `npm pack`
  - 明确产物文件名为 `hellovibe-0.14.0-0.tgz`
  - 明确干净机器安装命令与安装后验证方式
- 实现依据：
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/package.json`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/package.json`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/README.md`

### 3. auth / daemon 章节

- 手册修订点：
  - 明确 `hellovibe auth login` 默认按移动端登录理解
  - 明确移动端登录会展示二维码与 `hellovibe://terminal?...`
  - 明确 Web Authentication 可能打开浏览器，但不等于手机扫码绑定电脑链路
  - 明确 `hellovibe daemon start` 依赖先登录
  - 安装后检查命令改为 `hellovibe daemon --help`
- 实现依据：
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/ui/auth.ts`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/index.ts`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/commands/auth.ts`

### 4. 手机 App 操作章节

- 手册修订点：
  - 明确未登录首页按钮文案
  - 明确恢复账号页展示恢复二维码和备用密钥恢复入口
  - 明确扫码绑定入口在空状态页，通过“打开相机”或“手动输入 URL”进入
  - 明确服务地址入口需要与电脑端环境一致
  - 明确机器详情页负责查看在线状态、daemon 状态与 CLI 版本
- 实现依据：
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/index.tsx`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/restore/index.tsx`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/restore/manual.tsx`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/EmptyMainScreen.tsx`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/server.tsx`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/machine/[id].tsx`

### 5. 新会话路径章节

- 手册修订点：
  - 明确“完整新会话路径”在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/new/index.tsx` 对应的 `/new` 页面
  - 明确该路径负责机器、工作目录、权限模式、提示词输入，以及在可用时选择模型
  - 明确“机器详情页快捷新会话路径”只负责按目录快速启动
  - 不再把模型或权限模式选择写在机器详情页流程里
- 实现依据：
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/HomeHeader.tsx`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/new/index.tsx`
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/machine/[id].tsx`

### 6. 对外协作章节

- 手册修订点：
  - 增加评审建议与送审话术
  - 增加可直接发微信 / 飞书的短消息
  - 增加主线仓库路径和建议新会话测试目录路径
- 作用：
  - 让测试位、联调位和总管位能直接拿手册继续工作，不需要二次口头解释

## 最终采用口径

- 当前对外主口径固定为 `hellovibe` / `hellovibe` / `HELLOVIBE_`。
- `happy` / `happy-mcp` 和 `HAPPY_*` 当前仍只作为兼容层，不再写成手册默认主路径。
