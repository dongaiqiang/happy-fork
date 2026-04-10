# HelloVibe 干净机器安装与手机 App 联调手册

## 1. 适用范围

- 目标：在一台没有历史残留的干净机器上，验证 HelloVibe CLI 的安装、登录、后台服务、手机 App 绑定和基础使用链路。
- 当前主口径：
  - npm 包名：`hellovibe`
  - CLI 主命令：`hellovibe`
  - 环境变量前缀：`HELLOVIBE_`
- 当前注意事项：
  - 主线品牌迁移已经完成，但 npm registry 上是否已发布 `hellovibe` 需要以实际发布状态为准。
  - 如果 `npm install -g hellovibe@latest` 仍不可用，就先用本地打包的 `.tgz` 做安装验收。

## 2. 验收目标

- 验证安装命令可以把 `hellovibe` 命令暴露到系统 PATH。
- 验证 `hellovibe --help`、`hellovibe auth help`、`hellovibe daemon status` 等默认帮助已经切到新品牌口径。
- 验证手机 App 可以创建或恢复账号，并成功绑定这台电脑。
- 验证绑定后 App 可以看到机器在线状态，并从手机端发起新会话或查看会话。

## 3. 测试前准备

### 3.1 干净机器要求

- Node.js 20 或更高版本
- npm 可用
- 能联网访问后端服务
- 如果后续还要测 Claude 链路，机器上还需要对应本地依赖
- 如果本轮只测安装、登录、绑定和发起会话，先不要求完整 AI 工具链

### 3.2 手机侧准备

- 安装 HelloVibe App
- iPhone 或 Android 任意一台即可
- 首次扫码绑定时要允许相机权限

### 3.3 最小环境变量

- 建议显式设置服务地址，不要依赖默认值。

- 正式环境：

```bash
export HELLOVIBE_SERVER_URL="https://api.easycode-ai.xyz"
export HELLOVIBE_WEBAPP_URL="https://app.hellovibe.com"
```

- 局域网联调：

```bash
export HELLOVIBE_SERVER_URL="http://192.168.10.114:3005"
export HELLOVIBE_WEBAPP_URL="http://192.168.10.114:8083"
```

- 如果希望隔离测试数据，也建议补上：

```bash
export HELLOVIBE_HOME_DIR="$HOME/.hellovibe-test"
```

- 说明：
  - `HELLOVIBE_SERVER_URL` 和 `HELLOVIBE_WEBAPP_URL` 决定 CLI 连哪套服务
  - 如果不设置，当前 CLI 会回退到本地开发地址
  - `HELLOVIBE_HOME_DIR` 用于隔离本轮测试数据
  - 如果不设置，当前默认目录仍是 `~/.happy`
  - 正式环境和局域网联调二选一即可
  - CLI、daemon、手机 App 三端必须指向同一套地址

## 4. 两种安装方式

### 4.1 方式 A：npm 已发布时的正式安装

如果 npm registry 上已经存在 `hellovibe`，直接在干净机器执行：

```bash
npm uninstall -g hellovibe happy-coder || true
npm install -g hellovibe@latest
```

安装完成后先做基础检查：

```bash
which hellovibe
which happy || true
hellovibe --version
hellovibe --help
hellovibe auth help
hellovibe daemon --help
```

预期：

- `hellovibe` 命令可执行
- `happy` 如仍存在，属于兼容别名，不再作为主口径
- 帮助文案默认显示 `hellovibe`

### 4.2 方式 B：npm 尚未发布时的 tgz 安装

如果 `npm install -g hellovibe@latest` 还不可用，就先在主线仓库打包，再把打包产物传到干净机器。

#### 第一步：在主线仓库打包

主线仓库路径：

- [hellovibe-main](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main)

在仓库根目录执行：

```bash
cd <主线仓库根目录>
yarn install
yarn workspace hellovibe build
cd packages/happy-cli
yarn build
npm pack
```

预期会得到类似下面的文件：

```bash
hellovibe-0.14.0-0.tgz
```

#### 第二步：把 tgz 传到干净机器

把 `hellovibe-*.tgz` 复制到干净机器，比如：

```bash
~/Downloads/hellovibe-0.14.0-0.tgz
```

#### 第三步：在干净机器安装 tgz

```bash
npm uninstall -g hellovibe happy-coder || true
cd ~/Downloads
npm install -g ./hellovibe-0.14.0-0.tgz
```

#### 第四步：安装后基础检查

```bash
which hellovibe
which happy || true
hellovibe --version
hellovibe --help
hellovibe auth help
hellovibe daemon --help
```

预期与正式安装一致：

- `hellovibe` 成功暴露
- 帮助信息使用新口径
- `happy` 只作为兼容层存在

## 5. 电脑侧完整操作步骤

以下步骤适用于正式安装和 tgz 安装两种方式。

### 5.1 设置环境变量

在当前终端先执行：

- 正式环境：

```bash
export HELLOVIBE_SERVER_URL="https://api.easycode-ai.xyz"
export HELLOVIBE_WEBAPP_URL="https://app.hellovibe.com"
export HELLOVIBE_HOME_DIR="$HOME/.hellovibe-test"
```

- 局域网联调：

```bash
export HELLOVIBE_SERVER_URL="http://192.168.10.114:3005"
export HELLOVIBE_WEBAPP_URL="http://192.168.10.114:8083"
export HELLOVIBE_HOME_DIR="$HOME/.hellovibe-test"
```

说明：

- 前两个变量用于指向正式环境，或改成局域网联调环境
- `HELLOVIBE_HOME_DIR` 用于隔离本轮测试数据
- 如果不设置 `HELLOVIBE_HOME_DIR`，当前默认仍会落到 `~/.happy`

### 5.2 登录

执行：

```bash
hellovibe auth login
```

如果终端先让你选择登录方式：

- 本手册默认选择移动端登录
- 目标是让终端展示二维码
- 同时打印 `hellovibe://terminal?...`
- 手机 App 可以扫码，也可以手动粘贴这个 URL 完成绑定

预期：

- 终端会显示 HelloVibe 的移动端登录说明
- 会展示一个二维码
- 会打印一个可手动输入的认证 URL，格式类似：

```text
hellovibe://terminal?...
```

- 如果改选 Web Authentication，CLI 会尝试打开浏览器完成网页登录
- 那条路径可以用于登录
- 但它不等于本手册这里的“手机 App 扫码绑定电脑”链路

### 5.3 启动后台服务

登录完成后执行：

```bash
hellovibe daemon start
hellovibe daemon status
```

前提：

- 必须先完成 `hellovibe auth login`
- 如果未登录就直接执行 `hellovibe daemon start`，CLI 会提示先登录，再重新启动 daemon

预期：

- daemon 可以启动
- `hellovibe daemon status` 能看到当前状态
- 机器在手机 App 中会逐步变成在线

### 5.4 可选：连接 AI Vendor

如果本轮还要验证 Claude / Codex / Gemini 供应商连接，可以执行：

```bash
hellovibe connect claude
hellovibe connect codex
hellovibe connect gemini
hellovibe connect status
```

说明：

- 这些命令已经是主口径
- 手机 App 中有对应入口，但当前实际引导仍会让用户在终端执行这些命令

## 6. 手机 App 操作手册

### 6.1 首次打开 App

- 打开 HelloVibe App
- 先确认右上角或设置里的服务地址，和电脑端保持一致
- 如果电脑端走正式环境，App 也应指向 `https://api.easycode-ai.xyz`
- 如果电脑端走局域网联调，App 也应指向 `http://192.168.10.114:3005`
- 如果是第一次使用，点“开始使用”
- 如果已有账号，点“使用已有账号”

### 6.2 创建账号

适合完全新用户：

- 在 App 首页点“开始使用”
- App 会向服务端申请登录凭证
- 成功后自动进入已登录状态

适用场景：

- 新测试账号
- 不需要沿用旧手机或旧浏览器里的账号

### 6.3 恢复已有账号

适合已有账号或需要把旧账号迁移到新手机：

- 在 App 首页点“使用已有账号”
- 进入恢复页面后，App 会展示账号恢复二维码
- 可以用已经登录的另一端去扫描，完成账号恢复
- 也可以走“使用密钥恢复”的备用方案

### 6.4 绑定这台电脑

电脑端先执行：

```bash
hellovibe auth login
```

这时终端会展示二维码和认证 URL。

手机端操作：

- 在主界面看到空状态时，点“打开相机”
- 对准电脑终端里的二维码进行扫描
- 如果扫码不方便，点“手动输入 URL”
- 把终端打印出来的 `hellovibe://terminal?...` 粘贴进去
- 确认绑定

预期：

- App 提示“终端连接成功”
- 这台 Mac 会出现在机器列表里

### 6.5 查看机器状态

绑定成功后，在 App 里进入机器详情页，重点看：

- 机器是否在线
- daemon 是否存活
- 当前 CLI 版本
- 是否可以启动新会话

如果机器离线，先回到电脑执行：

```bash
hellovibe daemon status
```

必要时再执行：

```bash
hellovibe daemon start
```

### 6.6 从手机发起新会话

当前实现里，手机端有两种发起新会话的路径，建议分开理解：

#### 路径 A：完整新会话

- 在首页右上角点 `+`
- 进入“启动新会话”页
- 依次选择机器、工作目录
- 选择权限模式
- 输入任务或提示词
- 如当前配置允许，也可在这里选择模型
- 发起新会话

这条路径适合做完整验收，因为它覆盖的配置项最全。

#### 路径 B：机器详情页快捷启动

- 进入某一台在线机器的详情页
- 在“在目录中启动新会话”区域输入或选择目录
- 直接启动会话

说明：

- 机器详情页这条快捷路径，重点是按目录快速启动
- 当前不是在这个页面里选择模型或权限模式
- 模型 / 权限模式的完整选择，主要在右上角 `+` 进入的新会话页完成

预期：

- App 能创建新会话
- 会话会出现在列表中
- 电脑侧对应工作目录会启动新的 agent / 会话进程

### 6.7 在手机查看和管理会话

App 侧可做的基础操作包括：

- 查看最近会话
- 打开单个会话详情
- 查看消息流和状态变化
- 在机器页继续发起新的会话

如果要验证最小闭环，建议至少确认下面三点：

- 能看到会话被创建
- 能看到会话状态刷新
- 能区分机器在线和离线

## 7. 建议的完整验收顺序

建议按下面顺序执行，最省时间：

1. 在干净机器安装 `hellovibe`
2. 运行 `hellovibe --help`，确认主命令已切换
3. 设置 `HELLOVIBE_SERVER_URL`、`HELLOVIBE_WEBAPP_URL`，必要时设置 `HELLOVIBE_HOME_DIR`
4. 执行 `hellovibe auth login`
5. 用手机 App 创建或恢复账号
6. 用手机 App 扫码绑定这台电脑
7. 执行 `hellovibe daemon start`
8. 执行 `hellovibe daemon status`，必要时执行 `hellovibe doctor`
9. 在手机 App 确认机器在线
10. 在 App 中发起一个新会话
11. 需要时再验证 `hellovibe connect claude` 等供应商连接命令

## 8. 验收通过标准

满足以下条件，即可判定安装与手机联调链路通过：

- 安装后主命令是 `hellovibe`
- 默认帮助和引导文案是 `hellovibe`
- 环境变量按 `HELLOVIBE_*` 主口径使用
- 手机 App 能登录或恢复账号
- 手机 App 能通过扫码或手动 URL 绑定电脑
- 电脑端 daemon 可启动并被 App 识别为在线
- App 可以发起至少一个新会话

## 9. 常见问题

### 9.1 `npm install -g hellovibe@latest` 失败

原因通常有两类：

- npm 上还没有正式发布该包
- 当前网络或 npm registry 不可达

处理：

- 先改用 `.tgz` 安装验收
- 等正式发布后再回归正式安装命令

### 9.2 App 扫码后提示未登录

说明手机 App 当前还没有账号状态。

处理：

- 先在 App 首页完成“开始使用”或“使用已有账号”
- 再重新扫描电脑终端二维码

### 9.3 App 看不到机器在线

优先检查电脑侧：

```bash
hellovibe daemon status
hellovibe doctor
```

还要确认：

- `HELLOVIBE_SERVER_URL` 是否指向你当前要用的那套环境
- 正式环境时应是 `https://api.easycode-ai.xyz`
- 局域网联调时应是 `http://192.168.10.114:3005`
- 电脑网络是否正常
- 手机和电脑是否登录到了同一账号

### 9.4 旧命令 `happy` 还能不能用

- 可以，当前仍保留兼容
- 但所有新文档、培训和对外说明都应统一写 `hellovibe`

### 9.5 一部手机能不能同时连两台电脑

- 可以
- 当前机器模型本身支持同一个账号下存在多台机器
- 所以同一部手机、同一个 HelloVibe 账号，可以分别绑定两台不同电脑
- 绑定完成后，App 的机器列表里会同时看到这两台机器，并可分别查看在线状态、分别发起会话

补充说明：

- 如果你说的“两个终端”其实是同一台电脑里开的两个 Terminal 窗口，那通常不算两台机器
- 原因是同一台电脑默认共用同一份本地 settings，CLI 登录后通常只会生成并复用一个 `machineId`
- 所以这种情况下，App 里一般仍只会显示成一台机器，而不是两台机器
- 想验证多机绑定，建议直接用两台不同电脑分别执行一次 `hellovibe auth login`

## 10. 对外发给测试同学的最小口径

如果只发一段最小说明，建议直接发下面这版：

- 安装：
  - `npm install -g hellovibe@latest`
  - 如果 npm 包暂时不可用，就改成 `npm install -g ./hellovibe-0.14.0-0.tgz`
- 配置服务地址：
  - 正式环境：`HELLOVIBE_SERVER_URL=https://api.easycode-ai.xyz`
  - 正式环境：`HELLOVIBE_WEBAPP_URL=https://app.hellovibe.com`
  - 局域网联调：`HELLOVIBE_SERVER_URL=http://192.168.10.114:3005`
  - 局域网联调：`HELLOVIBE_WEBAPP_URL=http://192.168.10.114:8083`
- 电脑端执行：
  - `hellovibe auth login`
  - `hellovibe daemon start`
  - `hellovibe daemon status`
- 手机 App 侧：
  - 先登录或恢复账号
  - 再扫描电脑终端二维码完成绑定
  - 最后在机器页确认在线，并发起一个新会话

### 10.1 可直接发微信 / 飞书的短消息

如果你要直接发给测试同学，可复制下面这版：

- 文档：
  - [HelloVibe 干净机器安装与手机 App 联调手册](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/HelloVibe%20干净机器安装与手机%20App%20联调手册.md)
- 主线仓库路径：
  - [hellovibe-main](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main)
- 建议新会话测试目录：
  - [hellovibe-main](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main)
- 可直接转发的话术：

> 请按联调手册跑一遍“干净机器安装 + 手机 App 绑定 + 新会话”最小闭环。  
> 本次统一口径：npm 包名 `hellovibe`，CLI 主命令 `hellovibe`，环境变量前缀 `HELLOVIBE_`。  
> 电脑端先完成安装、配置服务地址、执行 `hellovibe auth login`、执行 `hellovibe daemon start`、执行 `hellovibe daemon status`。  
> 如果走正式环境，请使用 `https://api.easycode-ai.xyz` 和 `https://app.hellovibe.com`；如果走局域网联调，请使用 `http://192.168.10.114:3005` 和 `http://192.168.10.114:8083`。  
> 手机 App 侧先登录或恢复账号，再确认服务地址与电脑端一致，随后扫描电脑终端二维码完成绑定，并在机器页确认在线后发起一个新会话。  
> 发起新会话时，目录优先填写主线仓库路径。  
> 如果遇到问题，请重点反馈 4 类信息：安装命令是否可执行、登录/绑定是否能走通、机器是否显示在线、新会话是否成功发起。

## 11. 评审建议与送审话术

如果这份文档只是作者本人临时自测使用，可以不走正式评审。

如果这份文档要发给测试同学、总管，或者作为后续统一执行口径，建议至少做一轮轻量评审。

可以直接发给评审人的话术：

- 评审文档：
  - [HelloVibe 干净机器安装与手机 App 联调手册](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/HelloVibe%20干净机器安装与手机%20App%20联调手册.md)
- 建议转发语：

> 请帮忙评审这份“干净机器安装 + 手机 App 联调”手册。  
> 本次不是重评 HV-001 品牌迁移结果，而是确认这份手册能不能直接作为统一执行口径发给测试同学使用。  
> 请重点帮我看 5 件事：  
> 1. 安装命令和当前发布状态是否一致。  
> 2. CLI 登录、daemon、connect 命令是否准确。  
> 3. 手机 App 的创建账号、恢复账号、扫码绑定、查看机器、发起会话流程是否准确。  
> 4. 多机说明是否准确：同一手机/同一账号可以绑定多台不同电脑；同一台电脑多个 Terminal 窗口通常不算多台机器。  
> 5. 是否还有会让测试同学照着做时卡住的地方。

### 11.1 建议评审角色

- CLI 责任人
  - 重点确认安装命令、`hellovibe` 主命令、`HELLOVIBE_*` 环境变量是否准确
- App 责任人
  - 重点确认手机端按钮文案、扫码绑定流程、机器页和会话页操作路径是否与当前实现一致
- 主线负责人或总管
  - 重点确认文档口径是否与 HV-001 收口结论一致，是否适合作为统一外发说明

### 11.2 建议评审重点

- 安装命令是否与当前发布状态一致
- npm 未发布时的 `.tgz` 安装方案是否清楚
- 电脑端登录、daemon、vendor 连接命令是否可执行
- 手机 App 的创建账号、恢复账号、扫码绑定、发起会话步骤是否与当前页面一致
- 文档整体是否统一使用 `hellovibe / hellovibe / HELLOVIBE_` 主口径

### 11.3 轻量评审结论模板

可直接按下面格式收评审意见：

```text
评审人：
评审角色：
评审结论：通过 / 有修改意见
意见摘要：
1.
2.
3.
```

### 11.4 使用建议

- 内部个人自测：可直接使用
- 发给测试同学执行：建议至少过一轮 CLI + App 双侧核对
- 作为正式统一手册分发：建议补一轮主线负责人确认后再外发
