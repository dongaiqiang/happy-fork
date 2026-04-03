# 20260402 需求清单：helloVibe 首批 P0 改造提交清单

## 1. 文档目的

这份文档只做一件事：

把 helloVibe 第一批最值得立即提交到代码仓库的 P0 改造，整理成一份真正可执行的提交清单。

它不是总检查单，也不是苹果提审总表。

它更偏“第一批代码提交怎么做”这个问题，回答四件事：

1. 第一批到底先改哪些文件
2. 每个文件要改成什么方向
3. 哪些值必须先定死再动手
4. 怎么拆提交顺序风险最低

---

## 2. 这份清单解决什么问题

前面几份文档已经把范围盘清楚了：

1. 《helloVibe 工程改造与苹果上架检查》负责讲全局范围
2. 《helloVibe 工程改造文件级清单》负责讲所有文件级落点
3. 《helloVibe 苹果上架逐项检查表》负责讲提审与 TestFlight 前的执行检查

但如果真正开始改仓库，最容易卡住的不是“有没有方向”，而是：

1. 第一批到底该先改什么
2. 什么必须一起改
3. 什么不要过早改

所以这份文档专门收口为：

helloVibe 第一批 P0 改造提交该怎么落地。

---

## 3. 先定死的六个前置决策

在真正开改前，建议先把下面六件事定死。

如果这六件事没定，第一批提交很容易改一半又回头返工。

### 3.0 当前已确认的信息

截至目前，这里已经可以直接按下面这组值作为当前定稿方向：

1. App 名称：`HelloVibe`
2. production Bundle ID：`com.hellovibe.app`
3. development Bundle ID：`com.hellovibe.app.dev`
4. preview Bundle ID：`com.hellovibe.app.preview`
5. URL Scheme：`hellovibe`
6. Web / Universal Link 域名：`app.hellovibe.com`
7. API 域名：`api.hellovibe.com`

这意味着第一批 P0 改造里，移动端、后端接入地址和苹果上架相关配置都可以围绕这 7 个值收口。

这里还要补一个落地说明：

1. `app.hellovibe.com` 现在直接作为正式 Web / Universal Link 域名
2. `api.hellovibe.com` 现在直接作为正式 API 域名
3. 旧域名是否保留过渡，作为部署层决策单独处理

短期过渡时，即使服务端暂时还挂在旧域名上，也建议目标配置和文档统一先按新域名收口，再由部署层决定是否做 301 / 反向代理 / 双域名并行。

### 3.1 正式 App 名

当前直接定为：

1. 正式显示名使用 `HelloVibe`
2. dev / preview 可对应使用 `HelloVibe (dev)`、`HelloVibe (preview)`

### 3.2 正式 Bundle ID

当前直接定为：

1. production：`com.hellovibe.app`
2. development：`com.hellovibe.app.dev`
3. preview：`com.hellovibe.app.preview`

### 3.3 URL Scheme 与域名

当前直接定为：

1. `scheme` 改为 `hellovibe`
2. Universal Link / Web 域名改为 `app.hellovibe.com`
3. API 域名定为 `api.hellovibe.com`
4. 旧域名是否保留过渡，作为部署层决策单独处理

### 3.4 Expo 项目策略

先定：

1. `updates.url` 是否沿用原 Expo 项目
2. `extra.eas.projectId` 是否沿用原项目
3. EAS Submit 是否指向新 App Store Connect 应用

### 3.5 首批版本的审核策略

先定：

1. 首批版本是否先只做品牌统一，不同时引入账号删除、订阅改造、登录体系大改
2. 首批版本是否尽量减少权限和审核敏感变更

我的建议是：

第一批 P0 提交先做“品牌、配置、商店、法律文本、基础翻译”统一，先不要把 CLI 命名迁移、目录重命名、深层历史债一起打进去。

---

## 4. 首批 P0 的目标边界

第一批提交的目标，不是把整个仓库彻底洗成 helloVibe。

第一批提交只要达成下面四个结果就够了：

1. App 打开后，用户看到的是 helloVibe
2. App Store 材料和 App 内品牌一致
3. 打包与提交配置能明确指向 helloVibe 对应目标
4. 不再出现最明显的 `Happy / Happy Coder / easycode` 对外残留

因此，这一批提交应聚焦用户可见层和上架硬阻塞层。

不要把下面这些混进第一批：

1. CLI 命令迁移
2. workspace 目录重命名
3. 大规模 grep 替换全部 `happy`
4. 内部共享包重命名
5. 深层兼容逻辑清理

---

## 5. 第一批必须进入提交的文件

下面这些文件，我认为最适合组成 helloVibe 的首批 P0 提交。

### 5.1 `packages/happy-app/app.config.js`

这是第一批里的头号文件。

必须收口的值包括：

1. `name`
2. `slug`
3. `scheme`
4. iOS `bundleIdentifier`
5. Android `package`
6. `associatedDomains`
7. Android `intentFilters`
8. `updates.url`
9. `extra.eas.projectId`

这一批里建议至少做到：

1. 明确正式显示名
2. 明确正式包标识
3. 明确 scheme 和域名策略
4. 明确 production 是提交给哪个品牌目标

### 5.2 `packages/happy-app/eas.json`

这是首批提交里第二个必须同步改的文件。

必须收口的值包括：

1. `submit.production.ios.ascAppId`
2. `build.production.env.APP_ENV`
3. dev / preview / production 的保留策略

这一批里建议至少做到：

1. production 确认对应 helloVibe 的苹果应用坑位
2. 保留开发和预览包时，命名逻辑和提交逻辑清楚
3. 不再让正式提交指向旧品牌应用

### 5.3 `packages/happy-app/Stores.md`

这是首批提交里最重要的对外材料文件。

必须重写的内容包括：

1. App Name
2. Subtitle
3. Keywords
4. Promotional Text
5. Full Description
6. Support / Privacy / Marketing URL

这一批里建议至少做到：

1. 完全去掉 `Happy Coder`
2. 不再把产品只写成某个单工具 companion
3. 统一成 helloVibe 当前定位

### 5.4 `packages/happy-app/PRIVACY.md`

这是首批提交里必须同步的法律文本。

这一批里建议至少做到：

1. 标题改成 helloVibe
2. 正文主体全部统一品牌名
3. 数据采集说明和当前真实实现保持一致
4. 如果现在还没有完整账号删除闭环，不要写得超过当前事实

### 5.5 `packages/happy-app/TERMS.md`

这份文件也应和 Privacy 同批统一。

这一批里建议至少做到：

1. 全量统一品牌名
2. About 段落改成 helloVibe 当前产品定义
3. 不要保留明显旧品牌主体

### 5.6 `packages/happy-app/sources/assets/images/*`

这一批建议一起替换：

1. `icon.png`
2. `icon-notification.png`
3. `icon-adaptive.png`
4. `icon-monochrome.png`
5. `favicon.png`
6. `splash-android-light.png`
7. `splash-android-dark.png`

这里要把“图标与启动图替换”明确记成一个独立的重要需求，而不只是顺手带过的素材调整。

原因很直接：

1. 现在这套主图标 / 通知图标 / 启动图仍然是旧品牌时期的抽象 `H` 视觉
2. 它和 helloVibe 当前品牌名称、定位、对外感知并不匹配
3. 如果文案改了但图标没改，首批提交的品牌切换仍然是不完整的
4. 用户在桌面、通知栏、启动页第一眼看到的仍会是旧视觉印象

所以这部分应按一个单独的 P0 品牌需求处理，而不是放到最后再说。

这一项建议再拆成下面 4 个可执行子任务：

1. 先定 helloVibe 的图标主视觉方向，不再沿用旧 `H` 视觉
2. 一次性导出完整资源，而不是只替换某一张图
3. 按平台逐项回填到 `app.config.js` 当前引用的文件名
4. 在真机或构建产物里检查桌面图标、通知图标、启动图是否全部生效

建议直接按下面这张替换清单执行：

1. `icon.png`
   - 用途：iOS / Expo 主图标
   - 要求：输出 helloVibe 正式主图标，不再保留旧抽象 `H`
2. `icon-notification.png`
   - 用途：通知图标
   - 要求：保证小尺寸下仍清晰可辨
3. `icon-adaptive.png`
   - 用途：Android 自适应图标前景
   - 要求：主体留足安全边距，避免被系统遮切
4. `icon-monochrome.png`
   - 用途：Android 单色图标
   - 要求：确保单色模式下仍可识别
5. `favicon.png`
   - 用途：Web favicon
   - 要求：与 App 主图标保持同一品牌识别
6. `splash-android-light.png`
   - 用途：Android 浅色启动图
   - 要求：与浅色背景搭配后视觉居中、对比清楚
7. `splash-android-dark.png`
   - 用途：Android 深色启动图
   - 要求：与深色背景搭配后视觉居中、对比清楚

验收时至少检查 5 件事：

1. 手机桌面看到的新图标已经是 helloVibe 视觉
2. Android 通知栏图标没有糊掉、没有被裁残
3. 浅色 / 深色启动图都不再出现旧视觉
4. Web favicon 与移动端图标是同一品牌体系
5. `app.config.js` 中相关资源路径仍然全部有效

给设计或导出资源时，建议直接附下面这组交付规格：

1. 所有正式交付文件统一导出为 `.png`
2. 主图标与 favicon 使用同一核心符号，不要出现两套品牌符号
3. 通知图标优先保证识别度，不追求复杂细节
4. Android 自适应图标的主体不要贴边，避免被系统圆角 / 蒙版裁切
5. 单色图标必须能在纯黑或纯白场景下独立成立
6. 启动图只保留一个主视觉中心，不堆副标题、小字、复杂背景纹理
7. 浅色 / 深色两套启动图只允许背景与前景反差变化，不要变成两种不同品牌风格

替换后建议按下面顺序做验证：

1. 先看 `app.config.js` 的资源引用是否仍指向这 7 个固定文件名
2. 重新生成 Expo 配置，确认没有资源路径报错
3. 在 iOS / Android 真机或模拟器检查桌面图标
4. 在 Android 实机检查通知栏图标和启动图
5. 在 Web 入口检查 favicon 是否已刷新

如果要直接转给设计，可以用下面这版简版需求说明：

1. 请为 `HelloVibe` 输出一套新的 App 图标与启动图，不再沿用当前旧抽象 `H` 视觉
2. 这套视觉需要同时覆盖主图标、通知图标、Android 自适应图标、单色图标、favicon、浅色启动图、深色启动图
3. 主图标、favicon、启动图中心符号要保持同一品牌识别，不要各做各的
4. 通知图标和单色图标优先保证小尺寸清晰可识别，不要依赖复杂细节
5. Android 自适应图标请预留安全边距，避免被系统蒙版裁切
6. 启动图请只保留品牌主视觉，不放副标题、口号、小字说明
7. 浅色版和深色版只做明暗适配，不要做成两种不同风格
8. 最终请按现有文件名直接交付 `.png` 文件，方便工程侧无痛替换

如果要更短一点，也可以只发这一句：

请基于 helloVibe 当前品牌，重新设计并导出一整套移动端图标与启动图资源，覆盖主图标、通知图标、自适应图标、单色图标、favicon、浅色/深色启动图；要求统一品牌识别、适合小尺寸显示，并可直接按现有文件名替换工程资源。

如果要直接连同附件清单一起转给设计，建议再附下面这张执行表：

1. `icon.png`
   - 用途：iOS / Expo 主图标
   - 交付要求：输出正式主图标版本，保证桌面第一眼识别就是 helloVibe
2. `icon-notification.png`
   - 用途：Android 通知图标
   - 交付要求：极小尺寸下依然清晰，不依赖细线、阴影、复杂渐变
3. `icon-adaptive.png`
   - 用途：Android 自适应图标前景
   - 交付要求：主体居中并预留安全边距，避免被系统蒙版裁切
4. `icon-monochrome.png`
   - 用途：Android 单色图标
   - 交付要求：纯黑或纯白场景下仍可独立识别
5. `favicon.png`
   - 用途：Web favicon
   - 交付要求：与主图标保持同一核心符号，不另起一套品牌识别
6. `splash-android-light.png`
   - 用途：Android 浅色启动图
   - 交付要求：浅色底上的品牌主视觉居中，不放副标题、小字、口号
7. `splash-android-dark.png`
   - 用途：Android 深色启动图
   - 交付要求：深色底上的品牌主视觉居中，与浅色版保持同一构图

转发给设计时，最好再补 3 句执行提醒：

1. 这 7 个文件建议一次性交付，不要先只出主图标
2. 文件名直接按上面固定名称输出，工程侧可以直接覆盖替换
3. 如果设计要探索多个方向，也优先保证最终落地方案仍满足小尺寸识别和多端统一

如果你是直接发给 Figma，也可以直接贴下面这段：

请基于 `HelloVibe` 当前品牌，设计一整套移动端图标与启动图资源，不再沿用旧抽象 `H` 视觉。需要同时覆盖 `icon.png`、`icon-notification.png`、`icon-adaptive.png`、`icon-monochrome.png`、`favicon.png`、`splash-android-light.png`、`splash-android-dark.png`。要求主图标、favicon、启动图中心符号保持同一品牌识别；通知图标和单色图标优先保证小尺寸清晰；Android 自适应图标预留安全边距；启动图只保留品牌主视觉，不放副标题、口号、小字。最终请按上述文件名直接导出 `.png`，方便工程侧直接替换。

如果你想直接给 Figma AI / Make，再用下面这版更像提示词：

为 `HelloVibe` 设计一套现代、简洁、友好的移动端品牌图标系统。品牌气质偏向“轻松开始你的第一个 vibe coding”，要体现智能、连接、流动感、开始感，但不要做成旧品牌抽象 `H` 的延续，也不要做得过于技术极客、复杂或难以小尺寸识别。请输出同一视觉体系下的 7 个资源：主图标、通知图标、Android 自适应图标前景、Android 单色图标、Web favicon、Android 浅色启动图、Android 深色启动图。要求几何形态清晰、中心符号统一、适合深浅两套背景、适合手机桌面和通知栏显示。启动图只保留单一品牌主视觉，不放任何副标题、口号或小字。最终资源需能按 `icon.png`、`icon-notification.png`、`icon-adaptive.png`、`icon-monochrome.png`、`favicon.png`、`splash-android-light.png`、`splash-android-dark.png` 直接导出为 `.png`。

如果你想让 Figma 一次多出几个方向，可以直接再补下面 3 版风格化提示词：

1. 偏科技感

请为 `HelloVibe` 设计一套更偏科技感的移动端品牌图标系统。整体要现代、克制、清爽，体现智能、连接、流动感与未来感，但不要赛博朋克、不要发光特效堆叠，也不要复杂到影响小尺寸识别。视觉符号要适合手机桌面、通知栏、启动图中心区域使用，能够同时适配浅色和深色背景。不要沿用旧抽象 `H` 视觉。请统一输出主图标、通知图标、自适应图标前景、单色图标、favicon、浅色启动图、深色启动图，最终按工程现有文件名导出 `.png`。

2. 偏温和感

请为 `HelloVibe` 设计一套更偏温和、友好、轻松上手的移动端品牌图标系统。整体要简洁、干净、有亲和力，体现“轻松开始你的第一个 vibe coding”，可以带一点柔和流动感和陪伴感，但不要幼稚、不要卡通化，也不要失去专业产品感。视觉主体需要足够清晰，适合小尺寸显示，不依赖细碎装饰。不要沿用旧抽象 `H` 视觉。请统一输出主图标、通知图标、自适应图标前景、单色图标、favicon、浅色启动图、深色启动图，最终按工程现有文件名导出 `.png`。

3. 偏产品化感

请为 `HelloVibe` 设计一套更偏成熟产品化的移动端品牌图标系统。整体要可信、稳定、易识别，像一个正式上线的效率工具品牌，而不是实验性项目或开发者玩具。请体现开始感、连接感和工作流感，但保持形态简洁、图标中心符号统一，适合桌面图标、通知图标、favicon 和启动图复用。不要沿用旧抽象 `H` 视觉，也不要做得过于花哨。请统一输出主图标、通知图标、自适应图标前景、单色图标、favicon、浅色启动图、深色启动图，最终按工程现有文件名导出 `.png`。

如果要直接告诉设计下一稿怎么改，可以用下面这版：

1. 下一稿请以第二组 `hv + 底部弧线` 的主结构为基础继续收敛，不再继续沿用旧 `H` 方向
2. 主图标优先做成更像正式上线产品的版本，保持圆角方形底板、中心符号居中、桌面第一眼清晰可辨
3. `hv` 的字母识别要比当前第二组再强一点，可以参考第一组的字母贴合度，但不要带回第一组偏细、偏花的装饰细节
4. 底部弧线不要只像“笑脸”，要更像流动路径，带一点 flow / vibe 的感觉，但仍然保持极简
5. 整体笔画请比第一组更粗、更稳，确保 24px 到 48px 小尺寸下也能成立
6. 通知图标请基于同一中心符号继续极简化，不要渐变、不要小圆点、不要细尾巴
7. Android 自适应图标前景请保留同一主体，但扩大安全边距，避免系统蒙版裁切
8. 单色图标请直接用最核心的 `hv + 弧线` 纯色版，不保留任何依赖色彩才成立的细节
9. 浅色 / 深色启动图只复用同一个中心符号，不再另外设计一套图形语言
10. 如果要保留我这边方案的价值，建议只吸收“开始感 / 流动感”的思路，融入底部弧线，不单独作为最终主稿

当前这轮内部对比后的最新结论也要记一下：

1. 用户主观反馈里，第一稿的整体观感最好
2. 第二稿、第三稿虽然更偏产品化，但当前观感并没有超过第一稿
3. 所以下一轮不应再继续沿着第二稿、第三稿大幅偏移
4. 更合理的做法是回到第一稿作为主方向，再只做小幅优化
5. 优化重点应放在：
   - 保留第一稿的整体气质、构图和辨识度
   - 只微调小尺寸识别、通知图标压缩、单色成立性和 adaptive 安全边距
   - 不要把第一稿改得过于“标准产品图标化”，避免丢掉它原本最打动人的感觉

基于这个结论，第四稿我已经按“第一稿轻量优化版”实际出了一套 SVG 资源，放在：

`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/图片/第四稿`

这一次的定位不是重做方向，而是把第一稿收得更适合正式落地：

1. 主图标仍保留第一稿的 `V` 主结构、底部 flow 弧线、右上连接节点
2. 主体笔画略加粗，让 24px 到 48px 的小尺寸下更稳
3. 通知图标进一步极简化，只保留最核心的 `V + 弧线`
4. 单色版去掉依赖色彩的小节点，优先保证单色成立性
5. Adaptive foreground 主体整体收进安全区，降低系统蒙版裁切风险
6. Splash light / dark 继续复用同一中心符号，没有分叉出新语言
7. 这次顺手把 favicon 概念稿也补齐了，方便后面一次性补全 7 个正式资源

第四稿当前包含：

1. `helloVibe-icon-concept-d.svg`
2. `helloVibe-icon-concept-d-adaptive-foreground.svg`
3. `helloVibe-icon-concept-d-monochrome.svg`
4. `helloVibe-icon-concept-d-notification.svg`
5. `helloVibe-favicon-concept-d.svg`
6. `helloVibe-splash-concept-d-light.svg`
7. `helloVibe-splash-concept-d-dark.svg`

最新决定再补一条：

1. 用户已经明确选择“用第一版”
2. 因此当前正式采用方案改为第一稿 `concept-a`
3. 第二稿、第三稿、第四稿都继续保留，但只作为探索记录，不进入正式替换
4. 接下来工程资源应直接以第一稿这套 SVG 为准导出 PNG，并替换 `packages/happy-app/sources/assets/images/*`
5. 如果后面还有微调，也应基于第一稿做局部修型，而不是再切换主方向

### 5.7 `packages/happy-app/sources/text/_default.ts`

这是 App 内默认文案的基线。

这一批建议至少处理：

1. `aboutFooter`
2. `terminalRequestDescription`
3. About 区块中的品牌定义
4. 明显仍写着 `Happy Coder` 的关键入口文案

### 5.8 `packages/happy-app/sources/text/translations/en.ts`

### 5.9 `packages/happy-app/sources/text/translations/zh-Hans.ts`

### 5.10 `packages/happy-app/sources/text/translations/zh-Hant.ts`

这一批建议至少同步：

1. About 页相关文本
2. 连接设备 / 连接环境的关键高频文案
3. 登录注册相关若已存在的品牌文本
4. 会出现在截图和提审演示中的核心页面文本

我的建议是：

首批至少把英文、简中、繁中一起同步，不要只改一份 `_default.ts`。

---

## 6. 第一批先不要动的文件

为了降低风险，这一批我不建议先动下面这些。

### 6.1 暂不动 CLI 命令与 npm 包迁移

先不动：

1. `packages/happy-cli/package.json`
2. 根 `package.json` 里的 workspace 命令
3. `happy` / `happy-mcp` 命令入口

原因很简单：

1. 这会影响已有脚本
2. 这会影响安装方式
3. 这会扩大改动范围
4. 这不是苹果上架首批阻塞项

### 6.2 暂不动内部包命名

先不动：

1. `packages/happy-agent/package.json`
2. `packages/happy-wire/package.json`
3. `packages/happy-server/package.json`

原因是：

1. 它们更多是内部工程层
2. 第一批提交的重点不在这里

### 6.3 暂不动目录名与仓库大规模重命名

先不做：

1. `packages/happy-*` 目录改名
2. 全仓库无差别替换全部 `happy`
3. 历史文档与 SOP 全量清洗

因为这会明显增加回归风险。

### 6.4 暂不动深层历史字符串

例如：

1. 加密常量
2. 存储 key
3. 深层同步命名
4. 非用户直接可见字符串

这类内容后面作为 P2 再清理更稳妥。

---

## 7. 我建议的首批提交拆分方式

如果真的要提交代码仓库，我建议不要一口气一个超级大提交。

更稳的方式是拆成三个相邻提交。

### 7.1 第 1 提交：品牌与打包主配置

只放：

1. `app.config.js`
2. `eas.json`

目标：

1. 先把打包目标和提交通道定死
2. 先保证 production 不会再指向旧品牌坑位

### 7.2 第 2 提交：商店与法律文本

只放：

1. `Stores.md`
2. `PRIVACY.md`
3. `TERMS.md`

目标：

1. 先把 helloVibe 的对外口径统一
2. 让苹果审核材料和 App 品牌一致

### 7.3 第 3 提交：App 内视觉与关键文案

只放：

1. 图标与启动图
2. `_default.ts`
3. `en.ts`
4. `zh-Hans.ts`
5. `zh-Hant.ts`

目标：

1. 让用户在 App 内外看到同一套 helloVibe
2. 为截图、TestFlight、提审演示做准备

---

## 8. 每个提交前都要做的最小检查

### 8.1 第 1 提交前

必须确认：

1. 正式 App 名已定
2. Bundle ID 已定
3. `ascAppId` 已定
4. 域名 / scheme 策略已定

### 8.2 第 2 提交前

必须确认：

1. helloVibe 的正式定位口径已定
2. 不再使用 “Claude Code on the go” 旧口径
3. Support / Privacy / Marketing URL 的目标地址已准备

### 8.3 第 3 提交前

必须确认：

1. 新图标资源已经导出完整
2. About 页与设置页涉及的品牌文本已经收口
3. 截图时会露出的关键文案已经统一

---

## 9. 首批提交后的立即验证项

第一批提交完成后，我建议立刻验证下面这些点。

### 9.1 品牌可见性

检查：

1. App 名
2. 图标
3. About 页
4. 设置页品牌文案
5. App Store 文案基线

### 9.2 配置一致性

检查：

1. `app.config.js` 的 name、bundle、scheme、域名是否一致
2. `eas.json` 的 `ascAppId` 是否指向目标 App
3. 图标引用路径是否仍有效

### 9.3 上架材料一致性

检查：

1. Privacy 标题与正文一致
2. Terms 标题与正文一致
3. Stores 文案与新定位一致

### 9.4 旧品牌残留

至少搜索确认关键对外位置不再残留：

1. `Happy`
2. `Happy Coder`
3. `easycode`

这里的重点不是一次清空全仓，而是先清掉对外可见层和提审层。

---

## 10. 第一批提交后，最自然的第二批是什么

首批 P0 提交完成后，最自然的下一批是 P1。

也就是：

1. Tauri 桌面端名称与标识
2. 设置页与关于页入口进一步收口
3. README / marketing / CHANGELOG
4. Firebase / Android 推送配置

再下一批，才是 P2：

1. CLI 包名
2. 命令名迁移
3. 根 workspace 与目录名
4. 深层历史字符串

---

## 11. 当前结论

如果只看“下一步代码仓库第一批该怎么提”，我认为最优解是：

先围绕移动端品牌与上架硬阻塞层，做一个小而完整的 P0 提交集。

这批提交的核心文件就是：

1. `packages/happy-app/app.config.js`
2. `packages/happy-app/eas.json`
3. `packages/happy-app/Stores.md`
4. `packages/happy-app/PRIVACY.md`
5. `packages/happy-app/TERMS.md`
6. `packages/happy-app/sources/assets/images/*`
7. `packages/happy-app/sources/text/_default.ts`
8. `packages/happy-app/sources/text/translations/en.ts`
9. `packages/happy-app/sources/text/translations/zh-Hans.ts`
10. `packages/happy-app/sources/text/translations/zh-Hant.ts`

只要这批先统一，helloVibe 的第一步品牌切换就真正落到了仓库里。

而且这一步既能承接后面的 TestFlight，也能承接后面的苹果正式提审。
