# Hellovibe 操作流程优化清单

## 0. 现状操作时序（过去版本）
- 首次访问与未登录首页
  - 首页展示“创建账户/使用移动应用登录/连接设备/恢复密钥”等技术性入口，用户需自行理解差异并选择。
  - 文案强调“Codex/Claude Code 移动客户端、端到端加密”，但对普通用户的“注册/登录”心智不够清晰。
- 登录页与三种登录方式
  - 手机扫码授权登录（推荐）：页面生成 `hellovibe:///account?` 前缀的二维码，移动端 HelloVibe 扫码并同意授权后，服务端返回 `token + secret`，前端完成登录。[restore/index.tsx](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app/sources/app/(app)/restore/index.tsx#L96-L155)
  - 使用恢复密钥登录：用户手动粘贴/输入密钥，前端校验格式和长度（32 字节），从密钥换取 token 并登录。[manual.tsx](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app/sources/app/(app)/restore/manual.tsx#L71-L104)
  - 通过移动应用登录：与扫码链路一致，依赖移动端相机权限与 URL 前缀校验。[useConnectAccount.ts](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app/sources/hooks/useConnectAccount.ts#L12-L41)
- 登录成功后的设备与会话
  - 进入“机器详情”或“新建会话向导”页面，选择路径后点击“开始会话”，调用后端在目标机器上拉起 CLI 子进程（Claude Code），并返回会话 ID。[machine/[id].tsx](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app/sources/app/(app)/machine/[id].tsx#L207-L249)
  - 若机器离线或 Daemon 未运行，按钮会不可用或提示失败，用户需先在本机启动守护进程（Daemon），然后刷新设备状态再重试。
  - Daemon 重启或异常时，旧会话会失效（僵尸状态），需要在机器页面重新“播放/新建会话”才能继续。
- 会话内对话与语音
  - 文本消息正常收发；语音输入依赖 ElevenLabs 的 Agent/Token。若配置缺失，实时语音会话无法初始化或静默失败。[RealtimeVoiceSession.web.tsx](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app/sources/realtime/RealtimeVoiceSession.web.tsx#L38-L55)、[appConfig.ts](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app/sources/sync/appConfig.ts#L87-L105)
- 服务端与配置依赖
  - 登录与设备授权依赖后端 API；会话拉起依赖本机 Daemon 在线；服务器地址与环境变量（如 ElevenLabs Agent ID）需正确配置，否则部分功能不可用或表现为“无响应/静默失败”。

## 0.1 为什么商业推广需要“中继 + 本地后台进程”
- 中继服务器的价值（必须有）
  - 手机/浏览器无法直连用户电脑：NAT、防火墙、无公网 IP、浏览器安全模型决定了必须通过公网中继做路由与转发。[cli-architecture.md](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/cli-architecture.md#L346-L373)
  - 多端同步与离线容错：设备列表、会话列表、状态更新都需要统一的云端“会合点”，否则跨设备体验会断裂。
- 本地后台进程（daemon/本地桥）的价值（远程场景必须有）
  - 远程创建会话：用户在网页/App 点“开始新会话”，必须有人在电脑上接到指令并真正 `spawn` 本地 CLI 进程；没有本地常驻/可被唤醒的代理，就无法可靠完成远程拉起。[cli-architecture.md](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/cli-architecture.md#L275-L307)
  - 机器在线与可控性：云端需要持续确认“这台电脑此刻可被远程控制”，并承载 machine-scoped 的控制通道；否则只能做“已经跑着的会话还能聊”，但无法“从零开始拉起新会话”。[20260330-happy-daemon与session关系说明.md](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/%E8%91%A3/20260330-happy-daemon%E4%B8%8Esession%E5%85%B3%E7%B3%BB%E8%AF%B4%E6%98%8E.md)
  - 会话生命周期与诊断：集中管理、停止、清理、健康检查、目录创建授权等能力需要本地控制面承载，否则只能依赖用户去终端手动处理。[machine/[id].tsx](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app/sources/app/(app)/machine/[id].tsx#L207-L249)
- 没有本地后台进程会带来的“射门影响”（远程/商业场景）
  - 网页/App 无法一键“开始新会话”，只能要求用户回到电脑手动打开终端执行命令（体验断裂）。
  - 机器在线状态不可信：用户以为可用但实际不可控，失败率高且难定位。
  - 只能依赖既有 session 的存活：daemon 停了旧 session 仍可能能聊，但这不等于系统可用；一旦 session 结束或异常退出就无法恢复。

## 1. 背景与目标
- 现状：helloVibe 首次使用/登录/开会话流程暴露过多技术细节（后台进程、命令行、设备链接），普通用户理解与执行成本高。
- 目标：把“身份进入 → 开始 → 自动运转”的最短路径落地为产品化流程，将复杂性下沉到系统自动判断。
- 参考：hycode 的做法——登录后点击“新会话”，系统自动检测本地是否已安装 Claude/Codex，已装则直接本地拉起，未装则引导安装或切云端。

## 2. 原则
- 首页只讲“身份进入”：注册/登录；不在首屏出现“创建账户/链接设备/恢复密钥/使用移动应用登录”等技术术语。
- 登录页讲“登录方式”：邮箱/手机、扫码、恢复密钥。
- 登录后讲“工作环境”：本地/云端；选择工具；开始新会话。
- 自动优先：能自动检测就不让用户手动选择；能自动启动就不让用户手动配置。
- 一致性：术语与页面文案统一为用户视角；避免技术实现词侵入主流程。
- 无感化：后台进程允许存在，但不允许“要求用户理解它”；默认自动启动、自动保活、自动诊断，失败时只给“下一步动作”，不暴露实现细节。

## 3. 首屏文案与分层
- 首页主动作：
  - 注册账号
  - 登录
- 登录页方式：
  - 邮箱/手机登录
  - 已登录设备扫码登录
  - 使用恢复密钥登录
- 登录后主动作：
  - 开始新会话

## 4. 会话启动自动判断
- 本地检测：
  - 已安装 Claude/Codex → 直接本地拉起并开始
  - 未安装 → 显示一键安装入口或切换到云端运行
- 云端选项：
  - 直接使用云端终端（代码留在云端）
  - 绑定已有云端环境（如服务器配置）
- 工具选择：
  - 首次默认推荐最近使用或最稳定方案
  - 提供“选择工具”入口，但默认走自动选择

## 5. 后端依赖简化
- 不要求用户理解/操作后台进程；将服务地址、设备在线状态、授权链路尽量自动化。
- 错误提示改为任务导向：告诉用户下一步该做什么（如“点一键安装”“改为云端运行”）。
- 统一服务器配置入口，避免跨设备/跨环境地址不一致导致的认证失败。

## 5.1 无感化落地（安装一次，其余只用网页/App）
- 目标用户路径（你描述的“简单高效”）
  - 本地 Mac/Windows：安装一个“HelloVibe 桌面端/本地桥”（可以是完整桌面 App，也可以是轻量后台服务 + 托盘）。
  - 其它设备：打开一个网址或下载 App 后直接登录使用，无需在电脑上手动敲命令。
- 无感化的关键机制
  - 自动启动：随系统登录自启本地桥；用户不需要单独启动 daemon。
  - 自动登录与绑定：安装后第一次用网页/App 登录即可完成设备绑定；后续自动保持 machine-scoped 通道在线。
  - 一键修复：当本地桥离线时，网页/App 只展示“点击修复/重新连接”动作；不展示“启动 daemon 命令”。
  - 按需启动会话：网页/App 点“开始新会话”→ 云端 RPC → 本地桥 spawn 本机 CLI 进程；会话进程自己维持 session-scoped 通道。
  - 权限策略收口：仅在首次需要（如目录不存在需创建、需要访问某路径）时弹一次确认；其余走安全默认值与可回滚配置。

## 5.2 目标商业用户体验（结合 README 思路，做到“装一次就能用”）
- 第一次（只发生一次）
  - 用户在本地 Mac/Windows 安装 HelloVibe（桌面端/本地桥），安装包内置并配置好 CLI 包装器（类似 README 里的“用 wrapper 替代 claude/codex”的思路）。
  - 本地桥随系统自启，自动连到云端中继，但在未绑定账号前处于“待绑定”状态。
- 日常使用（用户主观上只剩 2 步）
  - 打开网址或下载 App → 用邮箱/手机号注册/登录。
  - 登录后看到“已发现本机（已安装）”并可直接点击“开始新会话”。
- 绑定与信任（必须存在，但可以做到无感/一键）
  - 绑定不要求用户理解 daemon/命令行，最小化为“点一次确认”。
  - 绑定完成后，后续不再出现“连接设备/扫码授权”的技术流程，除非用户主动更换电脑或重装系统。
- 多端接管（可选增强）
  - 从电脑切到手机/网页时：同一会话可进入“远程模式”继续操作；回到电脑时可一键切回（README 提到的“远程控制时重启为 remote mode / 键盘一按切回”可作为体验目标）。

## 6. 流程草图（用户视角）
1) 注册/登录  
2) 开始新会话  
3) 自动检测本地工具  
   - 已安装 → 本地启动  
   - 未安装 → 一键安装或切云端  
4) 进入会话，并可在设备/环境间继续  
5) 回到首页继续下一次工作  

## 7. 任务拆分
- P0（首页与入口）
  - 首页按钮口径统一为“注册账号 / 登录”
  - 登录页展示三种登录方式（邮箱/手机、扫码、恢复密钥）
  - 登录后主按钮统一为“开始新会话”
- P0（自动判断）
  - 新会话入口添加本地工具检测与自动拉起逻辑
  - 未安装时的“一键安装”与“切云端”分支
- P0（错误与提示）
  - 认证与会话失败提示统一成可执行的下一步建议
  - 服务器地址与设备在线状态异常时的自诊断提示
- P1（环境与工具）
  - “选择工具”页简化为常用/推荐/全部三段
  - 云端环境可用性检测与切换入口
- P1（设置与说明）
  - 设置页“关于”和“登录方式说明”与首页口径一致
  - 引导卡片：首次使用时的三步引导（登录 → 开始 → 自动检测）

## 8. 验收标准
- 首页首屏不出现技术型术语（创建账户/链接设备/移动应用登录/恢复密钥）。
- 登录页能清楚区分“登录方式”，用户不需要理解技术细节也能完成登录。
- 点击“开始新会话”后，若本地工具已安装，能自动启动并进入会话；未安装时能明确给出“一键安装/切云端”的可用分支。
- 常见失败场景（地址不一致、设备离线、权限缺失）均能给出下一步建议。
- 文案与术语在多语言下保持一致，中文/英文口径对齐。

## 9. 风险与兼容
- 兼容旧账户恢复方式：扫码/密钥仍保留在“登录页”层级，不暴露在首页。
- 兼容现有后端：自动化优先，但不强制移除现有服务端；提供简化路径优先于全量改造。
- 云端不可用时的降级策略：提示用户安装本地工具或稍后重试。

## 10. 需要修改/新增的文件（按模块）
- 首页与登录：
  - packages/happy-app/sources/app/(app)/index.tsx
  - packages/happy-app/sources/app/(app)/restore/index.tsx
  - packages/happy-app/sources/text/_default.ts
  - packages/happy-app/sources/text/translations/{en.ts, zh-Hans.ts, zh-Hant.ts}
- 新会话与工具/环境：
  - packages/happy-app/sources/app/(app)/new/index.tsx
  - packages/happy-app/sources/components/NewSessionWizard.tsx
  - packages/happy-app/sources/sync/profileUtils.ts
- 设置与说明：
  - packages/happy-app/sources/components/SettingsView.tsx
  - packages/happy-app/Stores.md

## 11. 里程碑
- 里程碑 A：首屏语言收口 + 登录方式分层
- 里程碑 B：新会话自动检测/自动拉起 + 安装/云端分支
- 里程碑 C：错误提示与引导卡片统一
- 里程碑 D：设置与说明页对齐口径

## 12. 参考
- 董/tmp.md:L42-L53 中关于“废弃‘创建账户’表述、登录后直接选择工作环境”的思路
