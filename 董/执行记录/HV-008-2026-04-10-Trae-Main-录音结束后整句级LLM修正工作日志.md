# HV-008-2026-04-10-Trae-Main-录音结束后整句级LLM修正工作日志

- 工单号：`HV-008` / `HV-008-TRAE-MAIN-02`
- 工作目录：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`
- 执行角色：`Trae-主线执行位`

## 本轮目标

- 在不破坏 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/voice-input/providers/useStreamingAsrProvider.ts` 已完成的实时去重与草稿保留链路前提下，收口“录音结束后整句级 LLM 修正”。
- 优先复用后端现有 Claude / OpenCode 可兼容模型调用链路，不另造独立临时服务。
- 补齐请求发出、服务端命中、模型返回、前端应用四层日志。
- 补齐部署校验与最小可复核验证。

## 实施过程

### 1. 链路核对

- 核对 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/voice-input/providers/useStreamingAsrProvider.ts`，确认在 `asr_end` 后会先做规则型整句化，再调用 `postprocessVoiceText`。
- 核对 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/apiVoice.ts`，确认前端最终会请求 `/v1/voice/postprocess`。
- 核对 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.ts`，确认正式路由已存在且挂载在 `/v1/voice/postprocess`。

### 2. 模型调用链路收口

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.ts` 内继续沿用现有后端路由，不新增并行接口。
- 将后处理目标解析收口为三层来源：
  - `VOICE_POSTPROCESS_*`
  - 共享 `ANTHROPIC_*` / `OPENAI_*` / `GEMINI_*` / `GOOGLE_API_KEY`
  - `serviceAccountToken`
- 这一口径与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/run.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/commands/connect.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/agent/factories/gemini.ts` 中 Claude / OpenCode / Codex / Gemini 会消费的共享环境变量或 connect token 保持一致：
  - Claude 口径走 `ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL`
  - OpenCode / Codex 口径走 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`，以及 `openai` vendor 的 connect token
  - Gemini 口径走 `GEMINI_API_KEY`、`GOOGLE_API_KEY`、`GEMINI_MODEL`，以及 `gemini` vendor 的 connect token

### 3. 日志补齐

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.ts` 中补齐：
  - 启动日志：记录可用 target、provider、model、baseUrl、config source
  - 成功日志：记录 provider、model、baseUrl、source、applied
  - 失败日志：记录 provider、model、baseUrl、source、错误信息
  - 无目标回退日志：记录 `reason=no-target`
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/apiVoice.ts` 中补齐：
  - 请求命中的 server url 与 source
  - 400/404 回退时的 url 与 source
  - 正常返回时的 provider / applied / url / source
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/voice-input/providers/useStreamingAsrProvider.ts` 中补齐：
  - “为什么没有把模型结果应用回输入框”的 skip reason

### 4. 部署校验

- 本地重新启动 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server` 开发服务后，日志文件写入：
  - `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/.logs/04-10-06-31-31.log`
- 本地对 `http://127.0.0.1:3005/v1/voice/postprocess` 发送未授权请求，返回 `401 Unauthorized`，证明当前本地服务已挂上该路由，不再是此前现场出现的 `404` 老进程状态。
- 进一步对当前运行进程做环境键核对，结果为 `NO_MODEL_ENV_KEYS`，说明本地这轮 dev server 进程还没有拿到可复用的 `OPENAI_*`、`ANTHROPIC_*`、`VOICE_POSTPROCESS_*` 或已连接 `serviceAccountToken` 上游入口，因此本地只能完成“路由存在性校验”，不能完成真实录音 live hit。

## 本轮实际修改文件

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.test.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/apiVoice.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/voice-input/providers/useStreamingAsrProvider.ts`

## 当前结论

- `录音结束 -> 规则整句化 -> LLM 后处理 -> 条件回写输入框` 的主链路在代码上已明确收口。
- 当前正式采用的是“复用共享 Claude / OpenCode / Codex / Gemini 兼容配置”的后端路由，而不是另起一条独立模型接入。
- 当前已补齐足以区分“接口调用了 / 模型命中了 / 前端应用了没”的日志字段。
- 当前本地部署校验已确认路由存在，但本地进程还没有实际拿到现有 Claude / OpenCode 正在使用的共享凭据或已连接 token，因此尚未形成带真实命中的 live hit 证据，这一项需在测试环境或带复用凭据的本地环境继续补验。

## 2026-04-11 继续推进记录

- 按当前总管口径继续聚焦 `HV-008-TRAE-MAIN-02`，未再主动扩改 `HV-005-TRAE-MAIN-02`、`HV-007-TRAE-MAIN-03` 与 Gemini 入口问题。
- 复读 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/工单中心/HV-008-2026-04-10-Trae-Main-录音结束后整句级LLM修正正式派单.md`，确认本单当前仍以“整句级 LLM 修正链路、命中日志、部署校验、效果验收证据”作为唯一执行焦点。
- 重新核对 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/voice-input/providers/useStreamingAsrProvider.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/apiVoice.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.ts` 与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.test.ts`，确认当前代码仍保持“录音结束后触发整句修正、文本变更则跳过覆盖、后端记录 provider/model/source/applied”这一收口口径。
- 重新复跑 `yarn workspace happy-app test --run sources/features/voice-input/providers/useStreamingAsrProvider.test.ts`、`yarn workspace happy-server test --run sources/app/api/routes/voiceRoutes.test.ts`、`yarn workspace happy-app typecheck`、`yarn workspace happy-server build`，结果全部通过。
- 本地模型环境键复核结果仍然没有变化，当前未发现新增代码缺口；继续阻塞在“当前 server 进程还没看到现有 Claude / OpenCode 共用凭据或已连接 token，导致无法形成 live hit 黑盒录音证据”这一环境侧问题。
- 已继续把 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.ts` 扩展到 Gemini provider，并补齐 `serviceAccountToken` 解析逻辑，使 Claude / OpenCode / Codex / Gemini 均可按现有凭据入口尝试复用；对应 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.test.ts` 当前已覆盖 `6` 条测试全部通过。
- 当前最新阻塞口径同步更新为：不是缺“新模型接入”，而是当前 server 进程还没有实际拿到现有 Claude / OpenCode / Codex / Gemini 正在使用的共享凭据或已连接 token。
