# 20260402 需求清单：helloVibe 苹果上架逐项检查表

## 1. 文档目的

这份文档只做一件事：

把“helloVibe 上架苹果 App Store / TestFlight 前需要逐项确认什么”整理成一份可以直接照着执行的检查表。

它不是宣传文案稿，也不是工程文件级改造清单。

它更偏上架执行视角，回答四个问题：

1. 苹果后台要先准备什么
2. 当前工程里哪些配置必须和苹果后台保持一致
3. 哪些审核点最容易卡住
4. 提交 TestFlight 和正式审核前，最后要逐项确认什么

---

## 2. 使用方式

建议把这份文档当成 helloVibe 上架前的逐项核对表。

最适合的使用顺序是：

1. 先配合《helloVibe 工程改造与苹果上架检查》看全局范围
2. 再配合《helloVibe 工程改造文件级清单》处理代码与配置改动
3. 真正开始提审前，再按这份文档从头到尾逐项打勾

如果后面要拆执行批次，建议分成四轮：

1. 先完成苹果后台与品牌身份建立
2. 再完成 App 配置与材料一致性
3. 再完成 TestFlight 试投与审核敏感点修补
4. 最后进入正式提审

### 2.1 开始改仓库前，先做苹果命名预检查

如果只问“在开始改代码前，第一步最值得先做什么”，我的建议是：

先去苹果侧确认 `helloVibe` 这个名字能不能用。

建议先查四件事：

1. 公开 App Store 里是否已经有 `helloVibe`
2. `Hello Vibe` 这种带空格写法是否已经存在相近产品
3. App Store Connect 新建 App 时，这个名字是否能通过
4. 是否需要准备 2 到 3 个备选名

为什么这一步要放在最前面：

1. App 名称一旦被占用，后面的 `Stores.md`、图标文案、截图文案都可能返工
2. 苹果显示名和用户认知是第一层品牌，不应该等代码改完才发现不能用
3. App 名、Bundle ID、`ascAppId`、商店文案应该是一套一起定下来的东西

要特别注意两点：

1. 名称可用，不代表 Bundle ID 也可用
2. `helloVibe`、`Hello Vibe`、`HelloVibe` 这几种写法，苹果侧要一起看，不要只看一种

如果 `helloVibe` 可用，后面可以继续定：

1. 正式 App 名
2. Bundle ID
3. SKU
4. scheme
5. 域名策略

如果 `helloVibe` 不可用，就应该先在品牌层做一次小调整，再开始真正改仓库。

当前这一步已经可以直接记一组最新定稿值：

1. App 名称：`HelloVibe`
2. production Bundle ID：`com.hellovibe.app`
3. development Bundle ID：`com.hellovibe.app.dev`
4. preview Bundle ID：`com.hellovibe.app.preview`
5. URL Scheme：`hellovibe`
6. 通用域名：`app.hellovibe.com`
7. API 域名：`api.hellovibe.com`

这意味着苹果侧第一轮身份信息已经可以基本收口。

这里还要补一个部署层判断：

1. `app.hellovibe.com` 作为正式 Web / Universal Link 域名
2. `api.hellovibe.com` 作为正式 API 域名
3. 旧域名是否保留过渡，作为部署层决策单独处理

原因是苹果提审时，下面这些内容最好都尽量保持同一品牌体系：

1. App 名
2. Bundle ID
3. URL Scheme
4. 支持 URL
5. Marketing URL
6. Universal Link 域名
7. App 内错误提示里的服务端地址

---

## 3. 当前已知现状

从当前仓库已经看到的情况，helloVibe 上架前至少有下面这些不一致：

1. `app.config.js` 里的 App 名还是 `easycode`
2. `slug`、`scheme`、Universal Link 域名仍然是 `happy`
3. `eas.json` 里 `submit.production.ios.ascAppId` 仍绑定旧应用坑位
4. `Stores.md` 还是 `Happy Coder`
5. `PRIVACY.md` 和 `TERMS.md` 仍是旧品牌
6. 权限声明已经比较多，审核时会被重点看
7. 当前已有 GitHub 连接能力，未来如果属于第三方登录，需要关注 Sign in with Apple 风险
8. 如果未来启用订阅、套餐、账号删除，苹果审核会进一步看账号闭环是否完整

因此，helloVibe 现在还不适合直接拿去提审。

正确做法是先统一品牌、配置、法律文本、审核材料，再进入 TestFlight 和正式提审。

---

## 4. 第一轮：先建立苹果侧正式身份

这一轮不一定先改代码，但必须先把苹果后台身份想清楚。

### 4.1 App Store Connect 应用坑位

需要逐项确认：

1. App 名是否确定为 `HelloVibe`
2. 这个名字在 App Store Connect 里是否可用
3. 主语言是中文还是英文优先
4. SKU 是否已经确定
5. 后续是否只保留一个正式 App，还是保留 dev / preview / production 三套

当前要特别注意：

1. 旧应用坑位可能已经占用了现有 `ascAppId`
2. 如果 helloVibe 要作为一个新品牌独立上架，通常应新建新的 App 档案，而不是沿用旧名字直接混提

### 4.2 Bundle ID 策略

需要逐项确认：

1. helloVibe 的正式 Bundle ID 是否定为 `com.hellovibe.app`
2. development / preview / production 是否使用三套 Bundle ID
3. development 是否定为 `com.hellovibe.app.dev`
4. preview 是否定为 `com.hellovibe.app.preview`
5. 如果不沿用旧值，证书、推送、Associated Domains、Apple 后台都要跟着调整

建议判断：

1. 当前已直接按 `com.hellovibe.app` / `com.hellovibe.app.dev` / `com.hellovibe.app.preview` 收口
2. 后续只需要按这三套值检查证书、推送、Associated Domains、Apple 后台是否同步

### 4.3 域名与深链策略

需要逐项确认：

1. Web / Universal Link 域名是否已按 `app.hellovibe.com` 收口
2. API 域名是否已按 `api.hellovibe.com` 收口
3. URL scheme 是否已按 `hellovibe` 收口
4. Universal Links 是否已在苹果后台和站点声明中同步

当前仓库已看到的风险：

1. `associatedDomains` 仍是 `app.happy.engineering`
2. Android intent filter 也仍是旧域名
3. 如果商店名称是 helloVibe，但拉起链路和跳转域名还是 happy，审核与用户认知都容易不一致

---

## 5. 第二轮：统一 App 基础配置

这一轮是最直接影响打包和提审的部分。

### 5.1 `packages/happy-app/app.config.js`

提审前必须确认：

1. `name` 是否已经改为 helloVibe 体系
2. `slug` 是否已经确定
3. `scheme` 是否已经确定
4. iOS `bundleIdentifier` 是否与苹果后台一致
5. Android `package` 是否与预期一致
6. `associatedDomains` 是否与正式域名一致
7. `updates.url` 是否仍指向正确 Expo 项目
8. `extra.eas.projectId` 是否仍指向正确项目

如果这一项不一致，会直接导致：

1. 打包目标不清
2. 提交到错误的苹果应用
3. 深链验证失败
4. 审核材料和 App 实际展示不一致

### 5.2 `packages/happy-app/eas.json`

提审前必须确认：

1. `submit.production.ios.ascAppId` 是否已替换为 helloVibe 对应应用
2. `production` profile 是否确实用于正式包
3. `development` / `preview` 的命名和渠道是否仍需要保留
4. Node 版本是否仍保持可构建状态

结合已有打包经验，还要额外确认：

1. EAS 登录账号是否是当前可控账号
2. Apple 开发者账号是否是当前可控账号
3. App-Specific Password 是否可用

### 5.3 Tauri 桌面端配置

如果 helloVibe 后续对外同时包含桌面端，也应同步确认：

1. `tauri.conf.json` 的 `productName` 是否改为 helloVibe
2. `identifier` 是否与品牌策略一致
3. `tauri.dev.conf.json`、`tauri.preview.conf.json` 是否同步

这不是苹果移动端提审的硬阻塞，但会影响整个品牌对外一致性。

---

## 6. 第三轮：统一商店材料与对外信息

这一轮会直接影响审核人员对产品的理解。

### 6.1 `packages/happy-app/Stores.md`

提审前必须确认：

1. App Name 已改为 helloVibe
2. Subtitle 已改成 helloVibe 当前定位
3. Keywords 不再只围绕 Claude Code companion
4. Description 已体现多设备 / 多环境 / 多工具工作方式
5. Promotional Text 与当前品牌口径一致
6. Privacy Policy URL、Terms URL、Support URL、Marketing URL 都已准备好

建议表达方向：

1. 先说 helloVibe 帮用户更轻松开始和继续 AI 编码工作
2. 再说支持 Mac、Windows、服务器环境
3. 再说支持 Claude Code、Codex、OpenCode 等 CLI 工具
4. 不要把产品只写成某一个工具的 companion

### 6.2 截图与预览素材

提审前必须确认：

1. 截图中的产品名已经是 helloVibe
2. 截图中的按钮、页面文案已统一新术语
3. 不再出现 `Happy`、`Happy Coder`、`easycode`
4. 如果有登录页、设备页、会话页截图，表达路径清晰
5. App 图标、通知图标、启动图都已完成替换

最容易忽略的问题：

1. 商店名字改了，但截图还是旧图
2. App 内 About 页还是旧名字
3. 截图里保留了旧域名或旧命令

### 6.3 支持页面与公开链接

提审前必须确认：

1. 隐私政策页面能公开访问
2. Terms 页面能公开访问
3. Support 页面能公开访问
4. Marketing 页面能公开访问
5. 页面上的品牌名与商店名一致

如果苹果审核点击进去看到旧品牌，会非常影响通过率。

---

## 7. 第四轮：权限与审核敏感点检查

这一轮是最容易被苹果审核重点看的部分。

### 7.1 权限声明是否真的用得到

当前仓库里已经能看到较多权限声明，包括：

1. 麦克风
2. 摄像头
3. 本地网络
4. Bonjour 服务发现
5. 通知
6. 位置
7. 日历

提审前必须逐项确认：

1. 这些权限当前版本是否真的会触发
2. 每个权限对应的用户价值是否能一句话说清
3. App 内是否确实存在对应功能入口
4. 权限文案是否能让审核人员理解用途

高风险情况：

1. 配置里声明了权限，但 App 内没有明确功能
2. 权限文案写得太泛
3. 实际产品核心是远程编码，但声明了和主流程关系不大的权限

### 7.2 本地网络与 Bonjour

这是当前项目比较敏感的一块。

提审前要确认：

1. 本地网络权限的用途是否明确
2. Bonjour 服务发现为什么需要
3. App 内有没有相应说明或引导
4. 如果当前版本并不依赖这项能力，是否应考虑暂时移除

苹果审核常见疑问就是：

1. 为什么一个 AI 编码 App 需要本地网络
2. 为什么需要发现局域网服务

如果回答不清，很容易被追问。

### 7.3 麦克风、摄像头、位置、日历

提审前要确认：

1. 这些权限当前版本是否真实可用
2. 是否能在产品说明里解释其用途
3. 是否会在首次审核版本里被实际使用

如果不能明确解释，建议尽量减少无关权限声明。

---

## 8. 第五轮：账号、登录、删除与苹果政策

这一轮和未来账号体系直接相关。

### 8.1 账号体系是否已形成闭环

提审前必须确认：

1. 用户能否清楚注册和登录
2. 忘记密码或验证码流程是否说得清
3. 用户退出登录后是否能重新进入
4. 用户如果不想用了，是否能删除账号

苹果近两年对账号删除要求很明确。

如果 App 支持创建账号，通常也要支持在 App 内发起账号删除。

### 8.2 账号删除能力

提审前必须确认：

1. App 内是否已有“删除账号”入口
2. 删除入口是否足够直达，而不是只让用户发邮件
3. 删除后是否有明确结果提示
4. 法律文档和隐私政策是否写清数据删除方式

如果这一点没有准备好，正式审核时很容易被打回。

### 8.3 第三方登录与 Sign in with Apple

当前项目里已经能看到 GitHub 连接能力。

提审前必须判断：

1. GitHub 连接到底只是工具接入，还是被苹果视为第三方登录
2. 如果 App 内允许用户用第三方账号登录产品主账号，是否需要补 Sign in with Apple
3. 如果只是连接开发工具，而不是登录 helloVibe 主账号，这一点在审核说明里能否讲清

这里不要模糊处理。

因为苹果审核对“第三方登录”与“外部服务连接”的区分，往往会要求产品方解释得非常明确。

---

## 9. 第六轮：订阅、付费与合规

这一轮取决于 helloVibe 是否会上付费能力。

### 9.1 是否有订阅或套餐

提审前必须确认：

1. 当前版本是否收费
2. 是否提供订阅或一次性付费
3. 是否已接入 RevenueCat
4. 商店内描述与 App 内文案是否一致

### 9.2 如果有数字内容订阅

提审前必须确认：

1. 是否需要走苹果 IAP
2. App 内是否出现绕过苹果支付的购买引导
3. Terms 是否包含订阅说明
4. 隐私政策是否提到订阅相关数据处理
5. 恢复购买、管理订阅、取消订阅入口是否明确

### 9.3 如果当前版本暂不收费

也要确认：

1. 商店文案里不要误导成已支持订阅
2. App 内不要出现尚未准备好的价格或套餐说明
3. Terms 里不要提前写一堆还没启用的付费条款

---

## 10. 第七轮：隐私、条款与数据说明

这一轮是上架必备基础。

### 10.1 `packages/happy-app/PRIVACY.md`

提审前必须确认：

1. 标题与品牌名已经统一成 helloVibe
2. 数据采集项与真实情况一致
3. 是否提到了 PostHog、RevenueCat、推送令牌等实际服务
4. 如果已有账号体系，是否写清账号数据、设备数据、日志数据的处理方式
5. 如果用户可删除账号，是否写清删除方式

### 10.2 `packages/happy-app/TERMS.md`

提审前必须确认：

1. 品牌名已经统一
2. 产品定义已经统一
3. 如果有账号、订阅、第三方工具接入，这些条款是否已覆盖
4. 支持联系邮箱、服务主体、适用范围是否明确

### 10.3 App Privacy 表单

除了文档本身，还要确认苹果后台里的隐私表单。

提审前必须确认：

1. 收集了哪些数据
2. 哪些数据与身份关联
3. 哪些数据用于分析
4. 哪些数据用于推送或崩溃诊断
5. 苹果后台填写内容和隐私政策正文一致

很多团队不是卡在代码，而是卡在隐私表单和正文对不上。

---

## 11. 第八轮：打包、提交与 TestFlight

这一轮是正式执行阶段。

### 11.1 EAS Build

提交前必须确认：

1. 在 `packages/happy-app` 目录执行
2. `production` profile 能成功构建
3. 构建出来的包对应的是 helloVibe 目标配置
4. 构建日志里没有明显权限、证书、依赖报错

根据已有经验，还要注意：

1. Node 版本要保持在当前可构建版本
2. Expo 账号和 Apple 账号都必须是可控账号

### 11.2 EAS Submit

提交前必须确认：

1. 选中的 build 是最新的 helloVibe 包
2. `ascAppId` 没有指向旧 App
3. App-Specific Password 准备完成
4. 推送成功后能在 App Store Connect 看到对应构建

### 11.3 Missing Compliance

推到苹果后，通常要处理出口合规问题。

提审前要确认：

1. 是否会出现 Missing Compliance
2. 当前版本的加密能力如何回答
3. 苹果后台的回答与项目真实情况一致

已有历史经验里，这一步通常需要手动处理。

### 11.4 TestFlight 内测

提审前必须确认：

1. 内部测试组已创建
2. 测试成员可用
3. 构建版本已加入测试组
4. 手机端可通过 TestFlight 正常安装
5. 安装后的名字、图标、登录流、会话流、设置页都已验证

### 11.5 TestFlight 重点验收项

建议实际安装后至少验收：

1. App 桌面名称是否正确
2. 图标是否正确
3. 首次启动是否正常
4. 登录与注册入口文案是否清楚
5. 会话列表、设备列表、环境连接流程是否顺畅
6. 不会在关键页面出现旧品牌
7. 深链是否正常
8. 推送是否正常
9. 权限弹窗文案是否合理

---

## 12. 第九轮：正式提审前最后核对

到了这一轮，建议按下面顺序做最终检查。

### 12.1 品牌一致性

1. App 名
2. 图标
3. About 页
4. 商店名称
5. 商店描述
6. 隐私政策
7. Terms
8. 官网支持页

以上任一地方还出现 `Happy`、`Happy Coder`、`easycode`，都说明还没收口。

### 12.2 技术一致性

1. Bundle ID 与苹果后台一致
2. `ascAppId` 与目标应用一致
3. URL scheme 与深链域名一致
4. Universal Links 可验证
5. 推送配置可用

### 12.3 审核一致性

1. 权限说明和功能一致
2. 登录方式和政策要求一致
3. 是否需要 Sign in with Apple 已明确
4. 是否需要账号删除已明确
5. 是否有订阅与 IAP 已明确
6. 隐私表单和文档一致

### 12.4 实机一致性

1. TestFlight 安装通过
2. 关键主流程可走通
3. 关键报错提示清楚
4. 审核人员首次进入时不会迷路

---

## 13. 我最建议的实际执行顺序

如果后面真开始做，我最建议按这个顺序推进：

### 第 1 步

先新建 helloVibe 的苹果应用坑位，并定死：

1. App 名
2. Bundle ID
3. SKU
4. 主语言
5. 域名 / scheme 策略

### 第 2 步

把 `app.config.js`、`eas.json`、`Stores.md`、`PRIVACY.md`、`TERMS.md` 一次性统一掉。

### 第 3 步

把图标、截图、About 页、默认翻译和关键页面文案统一掉。

### 第 4 步

重新跑一轮 EAS Build 和 TestFlight，先验证：

1. 能安装
2. 名字对
3. 图标对
4. 关键流程对
5. 权限弹窗合理

### 第 5 步

最后再处理：

1. Sign in with Apple 风险
2. 账号删除闭环
3. 隐私表单
4. 正式审核备注

---

## 14. 当前结论

如果只问一句话：

helloVibe 现在距离苹果正式上架，还差的不是单个字段，而是一整套“品牌、配置、材料、审核口径”的统一。

从优先级看，最先要补的是：

1. 苹果后台正式身份
2. `app.config.js`
3. `eas.json`
4. `Stores.md`
5. `PRIVACY.md`
6. `TERMS.md`
7. 图标与截图
8. 权限与账号政策闭环

只要这几块没统一，就不建议直接提审。

如果这几块先统一，再跑一轮 TestFlight，helloVibe 的苹果上架路径就会清楚很多。
