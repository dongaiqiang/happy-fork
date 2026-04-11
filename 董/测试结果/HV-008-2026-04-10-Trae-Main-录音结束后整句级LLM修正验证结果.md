# HV-008-2026-04-10-Trae-Main-录音结束后整句级LLM修正验证结果

- 工单号：`HV-008` / `HV-008-TRAE-MAIN-02`
- 工作目录：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`
- 验证角色：`Trae-主线执行位`

## 验证范围

- 录音结束后整句级 LLM 修正前后端链路是否仍成立
- Claude / OpenCode 兼容配置来源是否可被后端识别并打入日志
- 400/404 老服务回退定位能力是否增强
- 不回退 `HV-008-TRAE-MAIN-01` 已完成的实时去重与草稿保留收口

## 自动化验证

### 1. 前端语音草稿与去重测试

- 命令：

```bash
yarn workspace happy-app test --run sources/features/voice-input/providers/useStreamingAsrProvider.test.ts
```

- 结果：
  - `1` 个测试文件通过
  - `22` 条测试全部通过
  - 已覆盖实时片段去重、跨轮草稿合成、整句化规则、继续听写判定

### 2. 服务端路由与日志测试

- 命令：

```bash
yarn workspace happy-server test --run sources/app/api/routes/voiceRoutes.test.ts
```

- 结果：
  - `1` 个测试文件通过
  - `6` 条测试全部通过
  - 已覆盖：
    - 共享 `ANTHROPIC_*` 配置被识别并进入 success log
    - 产品术语提示词已包含 Claude / Codex / OpenCode / HelloVibe 等纠错引导
    - 无单独 voice env key 时，Claude 仍可复用已连接 `serviceAccountToken`
    - Codex(OpenAI) OAuth token 可被后端复用为 OpenAI 兼容链路
    - Gemini 共享 `GEMINI_API_KEY` / `GEMINI_MODEL` 可被后端复用
    - 无可用 provider 时进入 `reason=no-target` fallback log

### 3. 类型与构建校验

- 命令：

```bash
yarn workspace happy-app typecheck
yarn workspace happy-server build
```

- 结果：
  - `happy-app` typecheck 通过
  - `happy-server` build 通过

## 部署校验

### 1. 路由存在性校验

- 本地启动 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server` 后，对 `http://127.0.0.1:3005/v1/voice/postprocess` 发送未授权请求。
- 返回结果：

```text
HTTP/1.1 401 Unauthorized
{"error":"Missing authorization header"}
```

- 结论：
  - 当前本地开发服务已挂载 `/v1/voice/postprocess`
  - 已从此前现场出现的 `404 Not Found` 老进程状态恢复为“新路由已部署、只差授权与模型配置”

### 2. 本地模型配置校验

- 对当前运行中的 server 进程做环境键核对，仅检查变量名、不输出密钥内容。
- 结果：

```text
NO_MODEL_ENV_KEYS
```

- 结论：
  - 当前本地 dev server 进程没有看到可复用的 `OPENAI_*`、`ANTHROPIC_*`、`GEMINI_*`、`GOOGLE_API_KEY`、`VOICE_POSTPROCESS_*`，也没有实际命中已连接 `serviceAccountToken`
  - 因此本地本轮不能完成真实模型命中，只能完成路由部署校验与自动化验证；这不代表要单独新增一套模型接入

## 命中日志样例

### 1. success 样例

```text
[voice-postprocess] success user=user-1 provider=anthropic-compatible model=claude-3-5-haiku-latest baseUrl=https://router.example.com/anthropic source=apiKey=shared-env:ANTHROPIC_AUTH_TOKEN;baseUrl=shared-env:ANTHROPIC_BASE_URL;model=shared-env:ANTHROPIC_MODEL applied=true
```

### 2. fallback 样例

```text
[voice-postprocess] fallback user=user-1 provider=none reason=no-target openaiApiKeySource=none anthropicApiKeySource=none
```

### 3. 前端请求样例

```text
[Voice] 发起最终文本修正 url=http://127.0.0.1:3005 source=stored-custom-server-url
[Voice] 最终文本修正接口不可用，直接回退原文 status=404 url=http://127.0.0.1:3005 source=stored-custom-server-url
[ASR Frontend] 跳过应用最终文本修正 requestId=3, reasons=not-applied,same-text
```

## 效果验收结论

- 录音结束后的整句级 LLM 修正代码链路：已建立
- Claude / OpenCode / Codex / Gemini 兼容配置识别与日志留痕：已建立
- 本地服务 `/v1/voice/postprocess` 路由部署：已确认
- 本地带真实模型凭据的 live hit：未完成
- 与 `HV-008-TRAE-MAIN-01` 实时去重主链路冲突：未发现

## 当前仍未命中的部分

- 由于本地运行进程还没有实际拿到现有 Claude / OpenCode / Codex / Gemini 所在的共享配置或已连接 token，无法在本轮给出“真实授权用户 + 真实模型 provider + 真实前端应用”的黑盒录音证据。
- 该部分需要在已挂上共享 `ANTHROPIC_*` / `OPENAI_*` / `GEMINI_*` / `GOOGLE_API_KEY` 或可直接命中 `serviceAccountToken` 的环境，补一轮真实录音验收。

## 2026-04-11 复核

- 已重新复跑以下命令，结果保持通过：
  - `yarn workspace happy-app test --run sources/features/voice-input/providers/useStreamingAsrProvider.test.ts`
  - `yarn workspace happy-server test --run sources/app/api/routes/voiceRoutes.test.ts`
  - `yarn workspace happy-app typecheck`
  - `yarn workspace happy-server build`
- 当前代码层面的实现、测试、类型与构建口径一致，仍然只缺“让 server 实际复用现有 Claude / OpenCode / Codex / Gemini 凭据后再跑一轮”的真实黑盒录音验收。
