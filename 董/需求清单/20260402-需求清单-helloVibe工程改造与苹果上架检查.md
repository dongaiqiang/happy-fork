# 20260402 需求清单：helloVibe 工程改造与苹果上架检查

## 1. 文档目的

这份文档单独处理一个很重要的收口问题：

1. 如何把当前工程从现有的 `happy / happy-coder / easycode` 状态，系统性收敛为 `helloVibe`
2. 如果后续要把 helloVibe 作为苹果 App 上架，当前代码、配置、材料、审核点需要注意什么

这份文档不是宣传定位稿，也不是页面文案稿。

它更像一份后续真正执行品牌改造与苹果上架前的总检查单。

---

## 2. 需求复述

当前要梳理的是两条主线：

### 2.1 主线一：程序如何修改成 helloVibe

也就是：

1. 当前工程里有哪些名字、配置、图标、链接、命令、文案还不是 helloVibe
2. 这些东西哪些必须改，哪些可以分阶段改
3. 如果要提交到代码仓库，应该先形成怎样的一份改动清单

### 2.2 主线二：苹果上架 helloVibe 时需要注意什么

也就是：

1. App Store Connect 里需要准备什么
2. 当前 Expo / iOS 配置里有哪些地方必须和苹果后台保持一致
3. 当前权限、订阅、隐私、账号、法律文档、审核说明里有哪些可能卡审核的点

---

## 3. 当前现状判断

从仓库当前状态看，品牌并没有统一成一个名字，而是至少同时存在三套痕迹：

1. `Happy / Happy Coder`
2. `happy-coder / happy`
3. `easycode`

这意味着后续不是简单改一个标题，而是一次完整的品牌收口。

当前已经能看到的具体混用包括：

1. App 配置里名称是 `easycode`，但 `slug` 和 `scheme` 仍然是 `happy`
2. CLI 包名还是 `happy-coder`，命令还是 `happy`
3. 桌面端 Tauri 配置里仍然是 `Happy`
4. App Store 文案文件仍然是 `Happy Coder`
5. 隐私政策、Terms、README、翻译文本里仍有大量 `Happy` / `Happy Coder`
6. iOS 深链域名和网站域名仍然是 `happy.engineering`

所以这件事本质上要拆成：

1. 用户可见品牌改造
2. 工程标识改造
3. 发布体系改造
4. 苹果审核材料改造

---

## 4. 当前已经识别到的关键落点

下面这些文件，已经可以确定是后续改造 helloVibe 时最关键的一批入口。

### 4.1 移动端与上架配置

1. `packages/happy-app/app.config.js`
2. `packages/happy-app/eas.json`
3. `packages/happy-app/Stores.md`
4. `packages/happy-app/google-services.json`
5. `packages/happy-app/PRIVACY.md`
6. `packages/happy-app/TERMS.md`

### 4.2 桌面端配置

1. `packages/happy-app/src-tauri/tauri.conf.json`
2. `packages/happy-app/src-tauri/tauri.dev.conf.json`
3. `packages/happy-app/src-tauri/tauri.preview.conf.json`

### 4.3 CLI / 仓库 / 包管理

1. `package.json`
2. `packages/happy-cli/package.json`
3. 代码中所有对 `happy` 命令、`happy-coder` 包名、`HAPPY_*` 环境变量、`happy.engineering` 域名的引用

### 4.4 用户可见文案

1. `packages/happy-app/sources/text/_default.ts`
2. `packages/happy-app/sources/text/translations/*`
3. `packages/happy-app/README.md`
4. `packages/happy-app/CHANGELOG.md`
5. `packages/happy-app/docs/marketing/README-creators.md`

### 4.5 现有上架与打包经验文档

1. `董/20260324-happy-iOS打包与TestFlight上架手册.md`

这个文件不是最终配置来源，但对后续苹果流程有直接参考价值。

---

## 5. 主线一：如何把当前工程改为 helloVibe

## 5.1 目标定义

这里的“改为 helloVibe”，建议分三个层面理解：

1. 用户看到的名字改成 helloVibe
2. 发布平台识别到的应用标识改成 helloVibe 体系
3. 工程内部遗留的 happy / easycode 命名逐步清理

这三层不一定要一次做完，但必须明确先后顺序。

截至目前，已经可以直接按下面这组值作为当前定稿方向：

1. App 名称：`HelloVibe`
2. production Bundle ID：`com.hellovibe.app`
3. development Bundle ID：`com.hellovibe.app.dev`
4. preview Bundle ID：`com.hellovibe.app.preview`
5. URL Scheme：`hellovibe`
6. 通用域名：`app.hellovibe.com`
7. API 域名：`api.hellovibe.com`

这意味着后续第一批工程改造，不再只是“讨论可能值”，而是已经有了一组可直接落到配置里的主标识。

## 5.2 第一层：用户可见品牌统一

这是最应该优先做的。

至少需要统一下面这些内容：

1. App 名称
2. App 图标与启动图
3. 设置页 / 关于页里的产品名
4. 隐私政策标题
5. Terms 标题
6. App Store 名称、副标题、描述
7. 官网和支持页上的产品名

这部分的目标是：

1. 用户打开 App 看到的是 helloVibe
2. 商店里看到的是 helloVibe
3. 法律文档和介绍页里看到的也是 helloVibe

## 5.3 第二层：工程配置统一

这一层是最容易遗漏、但最影响发布的部分。

### A. `app.config.js`

当前已看到的关键点：

1. `name` 还是 `easycode`
2. `slug` 还是 `happy`
3. `scheme` 还是 `happy`
4. `bundleIdentifier` 还是 `com.easycode.app*`
5. `associatedDomains` 还是 `app.happy.engineering`
6. `updates.url` 和 `extra.eas.projectId` 仍绑定当前 Expo 项目

后续要确认：

1. helloVibe 已定使用 `com.hellovibe.app` / `com.hellovibe.app.dev` / `com.hellovibe.app.preview`
2. helloVibe 最终使用什么 Expo 项目
3. helloVibe 已定更换 URL Scheme 为 `hellovibe`
4. helloVibe 已定更换 Universal Link 域名为 `app.hellovibe.com`
5. API 域名已定为 `api.hellovibe.com`

### B. `eas.json`

当前已看到的关键点：

1. 生产提交通道里已有 `ascAppId`
2. build profile 仍沿用当前工程标识

后续要确认：

1. App Store Connect 新建 helloVibe 后，`ascAppId` 是否需要替换
2. 开发 / 预览 / 生产三套包继续保留
3. 三套包的名称、Bundle ID、渠道按 `com.hellovibe.app*` 体系收口

### C. Tauri 桌面端配置

当前已看到：

1. 桌面端 `productName` 还是 `Happy`
2. dev / preview 也还是 `Happy (dev)`、`Happy (preview)`
3. `identifier` 仍是 `com.slopus.happy*`

这意味着即使移动端叫 helloVibe，桌面端打包后仍可能显示成 Happy。

### D. CLI 与仓库层

当前已看到：

1. 根脚本仍引用 `happy-coder`
2. `packages/happy-cli/package.json` 的包名仍是 `happy-coder`
3. CLI 命令入口仍是 `happy` / `happy-mcp`
4. homepage / repository / bugs 仍指向 `happy-cli`

这里必须先做一个策略判断：

1. 先只改 App 品牌，不改 CLI 命令
2. 先改 npm 包名，但保留 `happy` 命令兼容一段时间
3. 包名和命令一起切到 helloVibe 体系

我建议分阶段：

1. 第一阶段先统一 App 和对外品牌
2. 第二阶段再处理 npm 包名与 CLI 命令迁移
3. 第三阶段再清理历史兼容名

### E. 用户可见文案与翻译

这里是工作量很大、但很容易低估的一块。

当前已看到：

1. 默认文案里有大量 `Happy`
2. 多语言翻译文件里也有大量 `Happy Coder`
3. 关于页文案明确写了 `Happy Coder`
4. App Store 文案文件仍把产品定义为 Claude Code companion

后续改造时，需要至少确认：

1. 是否所有语言都一起改
2. 还是先改中文 / 英文
3. 品牌名统一成 `helloVibe`
4. 产品定义统一成“氛围编程 + 多设备 / 多环境 / 多工具继续工作”

### F. 法律与公开页面

当前已看到：

1. `PRIVACY.md` 还是 `Privacy Policy for Happy Coder`
2. `TERMS.md` 里仍然是 `Happy`
3. `Stores.md` 里仍然是 `Happy Coder`

如果这些不改，苹果审核和用户认知都会出现明显不一致。

## 5.4 第三层：发布体系与外部资源统一

这一层属于品牌切换的外部依赖，需要单独列出。

至少包括：

1. 新的 App Store Connect App 档案
2. 新的 Bundle ID
3. 新的域名或是否继续沿用旧域名
4. 新的 Expo 项目或继续沿用旧 Expo 项目
5. 新的推送配置
6. 新的图标与截图资源
7. 如有订阅，新的 IAP 商品配置

## 5.5 建议的实施顺序

建议按下面顺序推进，而不是一口气混着改：

### 第一阶段：做品牌清单，不立刻大改代码

先列出：

1. 当前所有对外名字
2. 当前所有内部标识
3. 哪些必须同步改
4. 哪些可以兼容保留一段时间

### 第二阶段：先改用户可见品牌

优先改：

1. App 名称
2. App Store 文案
3. 关于页 / 设置页
4. 图标与启动图
5. 法律文档标题

### 第三阶段：再改发布标识

再处理：

1. Bundle ID
2. Scheme
3. Associated Domains
4. EAS 提交配置
5. 域名与深链

### 第四阶段：最后改 CLI 与仓库命名

最后处理：

1. npm 包名
2. CLI 命令名
3. 仓库地址
4. 兼容旧命令策略

## 5.6 提交到代码仓库前的检查单

后续真正提交代码前，建议至少逐项检查下面这些点：

1. 搜索仓库，确认核心对外名称是否仍残留 `Happy` / `Happy Coder` / `easycode`
2. `app.config.js` 的名称、Bundle ID、scheme、域名、项目 ID 是否一致
3. `eas.json` 的 `ascAppId` 是否对应 helloVibe 的苹果后台应用
4. Tauri 桌面端标题、名称、identifier 是否一起改
5. 法律文档标题、正文、URL 是否统一
6. App Store 文案是否已经从 `Claude Code companion` 改成 helloVibe 新定位
7. 图标、启动图、通知图标、favicon 是否统一
8. 如保留旧命令兼容，文档里是否写清楚
9. 如不保留旧命令兼容，升级路径是否写清楚
10. 提交前是否完成构建和打包验证

---

## 6. 主线二：苹果上架 helloVibe 需要注意什么

## 6.1 第一类：App Store Connect 基础信息

苹果上架最基础的内容，必须先确认：

1. App 名称是否可用且尽量简洁
2. 主语言用什么
3. Bundle ID 用什么
4. SKU 用什么
5. 类别怎么选
6. 是否先走 TestFlight 再正式审核

当前建议至少确认：

1. 名称是否直接用 `helloVibe`
2. Bundle ID 是否使用全新的 `com.xxx.hellovibe`
3. 还是继续沿用 `com.easycode.app` 体系做品牌切换

这一步是关键决策，因为它会影响：

1. App Store 新建坑位方式
2. 老包是否可升级
3. 老用户是否平滑迁移

## 6.2 第二类：商店文案与素材

苹果上架前必须准备一套完整的商店材料。

至少包括：

1. App 名称
2. 副标题
3. 关键词
4. App 描述
5. Promotional Text
6. 截图
7. App 图标
8. 隐私政策 URL
9. 支持 URL
10. 市场营销 URL

当前仓库里已经有一个旧的文案基线：

1. `packages/happy-app/Stores.md`

但它目前存在几个明显问题：

1. 名称还是 `Happy Coder`
2. 定位还是 “Claude Code on the go”
3. 文案仍然偏单工具 companion 模型
4. 与当前 helloVibe 的定位已经不一致

所以后续上架前，必须单独重写一版 helloVibe 的商店文案。

## 6.3 第三类：权限与审核敏感点

这一类最容易卡审核。

从当前 `app.config.js` 可以看到，项目已经声明了较多权限和能力，包括：

1. 麦克风
2. 摄像头
3. 本地网络
4. Bonjour 服务发现
5. 通知
6. 位置
7. 日历

苹果审核会重点看两件事：

1. 这些权限是不是产品核心必须
2. 权限说明是不是和实际功能一致

因此上架前必须逐项判断：

### A. 麦克风

如果保留语音能力，权限说明要清晰、功能要真实可见。

### B. 摄像头

如果仅用于扫码或发图，需要在审核说明里说清楚。

### C. 本地网络与 Bonjour

这是比较敏感的一类权限。

如果 helloVibe 仍要发现局域网设备，就必须：

1. 权限文案写得足够明确
2. 产品里能清楚解释为什么要访问本地网络
3. 审核备注里说明真实使用场景

### D. 位置与日历

当前配置里已经声明了位置和日历权限文案。

这是一个高风险点，因为如果最终产品里并没有强主线依赖这些能力，苹果很可能会问：

1. 为什么需要位置
2. 为什么需要日历
3. 这些权限是不是超范围申请

所以这里要单独做决策：

1. 如果不是上架首发核心能力，建议在首发版移除
2. 如果必须保留，就要准备很清楚的产品说明和审核备注

## 6.4 第四类：账号、登录、删除账号

苹果现在对账号体系的要求比较严格。

如果 helloVibe 最终是一个正式账号产品，上架前至少要确认：

1. 用户如何注册
2. 用户如何登录
3. 用户如何注销 / 删除账号
4. 用户如何删除数据

需要特别注意：

1. 如果 App 里能注册账号，苹果通常也要求提供删除账号能力
2. 不能只让用户发邮件申请删除
3. 删除账号入口最好在 App 内可达

当前仓库里的隐私政策写了用户可以删除数据，但是否已有完整、可审核通过的“删除账号”产品流程，仍需单独核实。

## 6.5 第五类：第三方登录与 Sign in with Apple

当前项目里已经能看到 GitHub 连接能力。

这意味着上架前必须确认一件事：

1. GitHub 只是附加绑定能力
2. 还是会成为正式登录方式之一

如果未来 helloVibe 使用 GitHub、Google 或其他第三方账号作为主要登录方式，苹果通常会要求：

1. 提供 `Sign in with Apple`

所以这一条现在就要先记入风险清单。

## 6.6 第六类：订阅与内购

当前项目中已经能看到 RevenueCat 相关集成。

这表示如果后续 helloVibe 有套餐、订阅或 Pro 能力，上架时要特别注意：

1. App Store 内购项目是否已在后台创建
2. RevenueCat 的产品映射是否一致
3. 订阅介绍页是否清楚
4. 是否有恢复购买入口
5. 价格、时长、自动续费说明是否符合苹果要求

如果首发阶段还不做正式订阅，建议先明确：

1. 首发版先不上付费墙
2. 或者先隐藏未准备好的付费流程

## 6.7 第七类：隐私、法律与审核一致性

苹果很看重商店描述、权限说明、隐私问卷、App 内实际行为是否一致。

当前需要重点核实：

1. `PRIVACY.md` 是否已改成 helloVibe
2. `TERMS.md` 是否已改成 helloVibe
3. App 内关于页和商店描述是否一致
4. App Privacy 问卷是否与实际采集行为一致
5. PostHog、RevenueCat、Push Token、设备标识等数据使用说明是否完整

如果文档说一套、App 实际做一套、商店问卷又填另一套，会非常容易在审核阶段反复来回。

## 6.8 第八类：加密与出口合规

当前配置里：

1. `usesNonExemptEncryption` 被设置为 `false`
2. 但产品文档和文案里又明确强调端到端加密、零知识等能力

这意味着上架时需要特别注意：

1. 苹果后台的出口合规问题怎么回答
2. App 实际使用的加密能力与填写口径是否一致
3. 审核备注是否需要解释

不是说一定过不了，而是这块一定要口径一致。

## 6.9 第九类：域名、深链与关联域

当前已看到：

1. iOS `associatedDomains` 指向 `app.happy.engineering`
2. Android 也有对应 intent filter
3. `scheme` 还是 `happy`

如果 helloVibe 最终换品牌域名，这里必须一起检查：

1. 新域名是否已经备案和可用
2. AASA 文件是否正确
3. 深链 scheme 是否需要一起改
4. 官网链接、支持链接、隐私政策链接是否一起换

## 6.10 第十类：TestFlight 与提交流程

这部分当前已有经验基础。

结合现有文档，后续上架仍建议按下面流程走：

1. 在 `packages/happy-app` 下执行 EAS build
2. 在苹果后台先创建 helloVibe 的 App 档案
3. 更新 `eas.json` 中的 `ascAppId`
4. 提交到 TestFlight
5. 处理 Missing Compliance
6. 建内部测试组
7. 先做 TestFlight 验证，再送正式审核

---

## 7. 苹果上架前检查单

下面这部分可以直接作为后续人工检查清单使用。

### 7.1 品牌与标识检查

1. App 名称是否统一为 helloVibe
2. App 图标是否统一为 helloVibe
3. Bundle ID 是否已最终确定
4. Scheme 是否已最终确定
5. 域名是否已最终确定
6. App Store Connect 的 App 档案是否已创建

### 7.2 文案与材料检查

1. 名称是否唯一且可提交
2. 副标题是否符合 helloVibe 新定位
3. 描述是否已从旧的 Claude companion 口径改写
4. 截图是否是 helloVibe 新 UI
5. 隐私政策 URL 是否可公开访问
6. 支持 URL 是否可公开访问
7. 市场营销 URL 是否可公开访问

### 7.3 权限与审核检查

1. 麦克风是否真有必要
2. 摄像头是否真有必要
3. 本地网络是否真有必要
4. Bonjour 是否真有必要
5. 位置是否真有必要
6. 日历是否真有必要
7. 所有权限说明文案是否与真实功能一致

### 7.4 账号与合规检查

1. 注册流程是否真实可用
2. 登录流程是否真实可用
3. 删除账号流程是否真实可用
4. 删除数据流程是否真实可用
5. 如果有第三方登录，是否需要加 Sign in with Apple
6. 如果有订阅，内购配置是否已经完成

### 7.5 发布与提交流程检查

1. `app.config.js` 是否已更新
2. `eas.json` 是否已更新
3. `ascAppId` 是否正确
4. 生产包是否成功打出
5. TestFlight 是否能安装
6. Missing Compliance 是否已处理
7. 审核备注是否准备好

---

## 8. 建议的执行方式

这件事建议拆成两个阶段推进。

### 第一阶段：先做“盘点清单”

目标不是马上改代码，而是先盘清楚：

1. 什么必须改
2. 什么可以晚点改
3. 什么改了会影响升级与迁移
4. 什么会影响苹果审核

### 第二阶段：再做“分批落地”

建议按下面顺序做：

1. 先改品牌可见项
2. 再改上架配置项
3. 再改法律文档与商店材料
4. 最后再改 CLI / 包名 / 仓库兼容项

---

## 9. 当前结论

当前可以先明确几件事：

1. helloVibe 改造不是简单换标题，而是一次完整品牌收口
2. 当前仓库至少混有 `Happy`、`Happy Coder`、`easycode` 三套痕迹
3. 苹果上架最容易出问题的不是文案本身，而是权限、账号删除、订阅、隐私、加密口径和域名深链一致性
4. 在真正改代码前，先有这样一份总检查单是必要的

## 10. 下一步建议

如果继续往下走，最自然的下一步不是立刻全量改代码，而是继续拆出两份更细的执行清单：

1. `helloVibe 工程改造文件级清单`
2. `helloVibe 苹果上架逐项检查表`

前者更偏研发改动清单，后者更偏运营 / 提审 / 法务 / 配置检查单。
