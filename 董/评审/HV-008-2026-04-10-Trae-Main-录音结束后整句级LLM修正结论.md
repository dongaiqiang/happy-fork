# HV-008-2026-04-10-Trae-Main-录音结束后整句级LLM修正结论

- 工单号：`HV-008` / `HV-008-TRAE-MAIN-02`
- 评审角色：`Trae-主线执行位`
- 工作目录：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`

## 一句话结论

- 本轮已把“录音结束后整句级 LLM 修正”的代码链路、共享模型配置复用口径、命中日志与最小部署校验补齐到可复核状态，并扩展到 Claude / OpenCode / Codex / Gemini 现有凭据入口；但当前本地运行环境还没有实际拿到这些入口正在使用的共享凭据或已连接 token，尚未完成真实模型命中的黑盒录音闭环。

## 已完成部分

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.ts` 已明确复用共享 `ANTHROPIC_*` / `OPENAI_*` / `GEMINI_*` / `GOOGLE_API_KEY` 与 `serviceAccountToken`，不另造并行服务。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/apiVoice.ts` 已能把请求命中的 server url 与 source 打出来，便于定位“到底打到了哪个后端”。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/voice-input/providers/useStreamingAsrProvider.ts` 已能记录“模型返回了但为什么没应用”的 skip reason。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/voiceRoutes.test.ts` 已补齐服务端路由与日志自动化验证。
- 当前本地服务重启后，`/v1/voice/postprocess` 已确认不再是 `404` 老进程状态。

## 模型调用链路结论

- Claude 兼容口径：
  - provider style：Anthropic Messages API
  - 配置来源优先级：`VOICE_POSTPROCESS_ANTHROPIC_*` → `ANTHROPIC_*` → `serviceAccountToken`
- OpenCode / Codex 兼容口径：
  - provider style：OpenAI Chat Completions API
  - 配置来源优先级：`VOICE_POSTPROCESS_OPENAI_*` → `OPENAI_*` → `serviceAccountToken`
- Gemini 兼容口径：
  - provider style：Google Gemini generateContent API
  - 配置来源优先级：`VOICE_POSTPROCESS_GEMINI_*` → `GEMINI_*` / `GOOGLE_API_KEY` → `serviceAccountToken`
- 这三条来源与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/run.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/commands/connect.ts`、`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/agent/factories/gemini.ts` 中现有 CLI / connect 凭据入口口径一致，因此满足“Claude / OpenCode / Codex / Gemini 可兼容模型调用链路”要求。

## 当前缺口

- 当前本地开发进程实测为 `NO_MODEL_ENV_KEYS`，所以没有形成“真实模型 provider 命中 + 前端成功应用”的最终黑盒证据。
- 这不是链路不存在，也不是要单独新接一套模型；而是当前 server 进程还没有拿到现有 Claude / OpenCode / Codex / Gemini 这侧的共享配置或已连接 token，属于环境复用入口未打通，不属于主链代码缺口。

## 风险判断

- 对 `HV-008-TRAE-MAIN-01` 已完成的实时去重、范围替换、草稿保留逻辑，当前未引入新的结构性回退。
- 当前新增内容集中在：
  - 录音结束后的后处理调用
  - 前后端日志与部署定位
  - 服务端 provider 来源解析
- 因此前轮实时出字主链路的回归风险可控。

## 建议后续动作

- 在测试环境或带共享 `ANTHROPIC_*` / `OPENAI_*` / `GEMINI_*` / `GOOGLE_API_KEY`、或能直接命中 `serviceAccountToken` 的本地环境，再补一轮真实录音验证。
- 验证时重点确认三点：
  - 录音结束后是否出现 `start / success / fallback` 服务端日志
  - provider / model / source 是否符合当前环境预期
  - 前端是否只在文本未被用户后续修改时应用最终修正

## 当前评审结论

- 当前状态：实现与证据补齐基本完成，但未完成真实模型命中验收
- 建议口径：可作为 `HV-008-TRAE-MAIN-02` 的阶段性交付回报；若总管要求“真实 live hit 已完成”再结单，则还需补一轮“server 已实际复用现有 Claude / OpenCode / Codex / Gemini 凭据”的真机或黑盒录音复验
