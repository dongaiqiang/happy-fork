# Happy Coder 核心设计

本文档描述 Happy Coder 项目的详细技术架构与核心设计。

---

## 一、整体架构图（概念）

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    Happy Server                          │
                    │  Fastify HTTP + Socket.io (/v1/updates)                  │
                    │  Prisma → PostgreSQL / PGLite | Redis | S3/MinIO         │
                    └──────────────┬──────────────────────┬─────────────────────┘
                                   │                      │
         REST (session/machine)     │                      │  WebSocket (update/emit)
         + JWT Bearer              │                      │  auth: token, clientType
                                   │                      │
     ┌─────────────────────────────┼──────────────────────┼─────────────────────────────┐
     │                             │                      │                             │
     ▼                             ▼                      ▼                             ▼
┌─────────────┐            ┌──────────────┐       ┌──────────────┐              ┌─────────────┐
│  Happy CLI  │            │  Happy App   │       │  Happy CLI   │              │ Happy Agent  │
│  (REST 建   │            │  (Web/iOS/  │       │  (session-   │              │ (远程控制     │
│  session/   │            │   Android)   │       │  scoped      │              │  会话)       │
│  machine)   │            │ user-scoped  │       │  socket)     │              │              │
└──────┬──────┘            └──────┬───────┘       └──────┬───────┘              └──────┬──────┘
       │                          │                       │                             │
       │ 协议与类型                │                       │                             │
       └──────────────────────────┴───────────────────────┴─────────────────────────────┘
                                    @slopus/happy-wire
                                    (Zod 协议 + TS 类型)
```

- **Server**：唯一中心，提供 HTTP API 和 WebSocket。
- **CLI / App / Agent**：都通过 REST 建会话/机器，通过 Socket.io 收实时更新；协议和类型统一由 **happy-wire** 定义。

---

## 二、各层职责与实现

### 1. 协议层：`@slopus/happy-wire`

- **位置**：`packages/happy-wire`，被 app / cli / agent / server 共同依赖。
- **内容**：
  - **messages.ts**：会话消息、更新体（如 `SessionMessageContentSchema`、`UpdateNewMessageBodySchema`、`CoreUpdateContainerSchema` 等）。
  - **legacyProtocol.ts**：旧版解密后的 payload（`UserMessage` / `AgentMessage`）。
  - **sessionProtocol.ts**：新会话协议（`SessionEnvelope`、`SessionEvent`、`createEnvelope` 等）。
- **作用**：统一 “new-message / update-session / update-machine” 等 wire 格式，避免各端实现漂移；加密容器里装的是上述协议定义的 payload。

---

### 2. 服务端：Happy Server

**技术栈**：Fastify、Socket.io、Prisma、PostgreSQL（或 PGLite）、可选 Redis、S3/MinIO。

**启动流程**（`sources/main.ts`）：

1. 连接 DB，初始化 activity cache、Redis（若配置）。
2. `initEncrypt()`、`initGithub()`、`loadFiles()`、`auth.init()`。
3. `startApi()`：挂载路由与 **Socket.io**（path: `/v1/updates`）。
4. 启动 metrics、presence timeout 等后台逻辑。

**HTTP 路由**（`app/api/api.ts`）：

- 认证：`authRoutes`、`connectRoutes`。
- 会话/消息：`sessionRoutes`、`v3SessionRoutes`（v3 会话与消息 API）。
- 机器：`machinesRoutes`。
- 推送：`pushRoutes`。
- 账号、artifacts、access keys、feed、kv、voice、dev 等：对应 `*Routes`。

**WebSocket**（`app/api/socket.ts`）：

- 在 Fastify 的 `app.server` 上挂 Socket.io，path `/v1/updates`，cors 开放。
- 连接时校验 `handshake.auth.token`（JWT），可选 `clientType`、`sessionId`、`machineId`。
- 支持三种连接：
  - **user-scoped**：用户级，收该用户下会话/机器/账号等所有更新。
  - **session-scoped**：仅某会话（CLI 跑会话时用），带 `sessionId`。
  - **machine-scoped**：仅某机器（CLI 的 daemon/机器状态），带 `machineId`。
- 注册的 socket 事件包括：`update-metadata`、`update-state`、RPC、usage、ping、session/machine/artifact/accessKey 等。

**事件路由**（`app/events/eventRouter.ts`）：

- 按 `userId` 维护多类连接（user / session / machine scoped）。
- **持久化更新**（`emitUpdate`）：如 `new-message`、`update-session`、`update-machine`、`new-session`、`new-machine`、artifact 等，带 `recipientFilter`。
- **临时事件**（`emitEphemeral`）：如 `activity`、`machine-activity`、`usage`、`machine-status`，不落库，只推给在线连接。

**存储**（Prisma `schema.prisma`）：

- **Account**：id、publicKey、seq、settings、github、profile 等。
- **Session**：id、tag、accountId、**metadata**（密文）、**agentState**（密文）、**dataEncryptionKey**（可选）、seq、active、lastActiveAt 等。
- **SessionMessage**：id、sessionId、localId、content（密文）、createdAt、updatedAt 等。
- **Machine**：类似 Session，存 metadata、daemonState 等密文及 dataEncryptionKey。
- 还有 PushToken、UsageReport、Artifact、AccessKey、Feed、KV、Relationship 等。

服务端**只存密文**：metadata、agentState、message content 等均为加密 blob；解密在客户端用各自持有的 key 完成。

---

### 3. 客户端 CLI：Happy CLI（happy-coder）

**入口**：`bin/happy.mjs` 用 Node 调 `dist/index.mjs`；实际逻辑在 `src/index.ts`。

**子命令**：

- **默认（无子命令）**：走 Claude 模式 → `runClaude(credentials, options)`。
- **codex**：`runCodex`；**gemini**：`runGemini`；**acp**：通用 ACP agent。
- **daemon**：start/stop/start-sync/status/list/logs/install/uninstall 等。
- **auth**：登录/登出等；**connect**：连各 AI 厂商；**sandbox**：沙箱配置；**notify**：发推送；**doctor**：诊断。

**Claude 主流程**（`claude/runClaude.ts`）：

1. **认证与机器**：`authAndSetupMachineIfNeeded()` → 读/写 credentials 和 machineId。
2. **API 与会话**：`ApiClient.create(credentials)`，`api.getOrCreateMachine({ machineId, metadata })`，`api.getOrCreateSession({ tag, metadata, state })`。
   - 会话/机器级加密：CLI 生成或使用已有 **data key**，用 account 的 publicKey 加密后以 `dataEncryptionKey` 存服务端；metadata/agentState/message 用该 data key 加解密。
3. **Daemon**：若未运行则后台 `spawnHappyCLI(['daemon', 'start-sync'])`，保证本机有一个 Happy 后台服务。
4. **Session 与 Socket**：用 `ApiSessionClient` 连 Socket.io，`clientType: 'session-scoped'`、`sessionId`，收 `update`（new-message、update-session 等），本地解密后驱动 **loop**（与 Claude Code 子进程交互、发消息、权限等）。
5. **本地 Claude**：通过 `claudeLocal` 等 spawn Claude Code 进程，Happy 作为中间层：把用户/Agent 消息经 API 发到 server，并从 server 拉/推消息到 App 与其它端。

**Daemon**（`daemon/run.ts`）：

- 常驻进程，负责：响应 “新建会话” 等请求（如从 App 远程发起）、管理本机多个 session、与 server 同步 machine 状态。
- 通过 **control server** 被本机 CLI/App 调用；和主 CLI 一样用 `ApiClient`/Socket 与 Happy Server 通信。

**加密**（`api/encryption.ts`）：

- **Legacy**：单 secret，`tweetnacl.secretbox` 做会话/消息加解密。
- **DataKey**：每会话/机器生成随机 data key，用 account 公钥加密后存 server；metadata/agentState/message 用 AES-256-GCM 加密。
- 消息体格式遵守 **happy-wire**（如 `content.t === 'encrypted'`, `content.c` 为密文）。

---

### 4. 移动端/Web：Happy App

**技术栈**：Expo 54、React 19、React Native、Expo Router、可选 Tauri（macOS 桌面）。

**与 Server 的同步**（`sources/sync/`）：

- **apiSocket.ts**：使用 `socket.io-client` 连 Server，path `/v1/updates`，`auth: { token, clientType: 'user-scoped' }`。订阅 `update` 等事件，提供 `sessionRPC(sessionId, method, params)`（带会话级加密的 RPC）。
- **sync.ts**：大同步类：管理会话列表、每会话消息队列、发送队列、session/machine 的 data key 缓存。从 REST 拉会话/消息（含 v3 接口），从 Socket 收 `update`，解密后写入本地状态/存储。发消息：加密后通过 Socket RPC 或 REST 上报；支持离线队列与重连。
- **encryption**：与 CLI 类似的密钥派生、会话/机器 data key 解密、消息加解密，和 happy-wire 格式一致。

**数据流**：

- 拉会话/机器列表、消息历史：HTTP（v3 session/messages 等）。
- 实时：Socket.io `update`（new-message、update-session、update-machine 等）→ 按 session 解密 → 更新 UI。
- 发消息/更新 metadata：通过 Socket 的 `update-metadata`、`update-state` 或 RPC，payload 在客户端加密后发送。

---

### 5. 远程 Agent：Happy Agent

- 独立 CLI（`packages/happy-agent`），通过同一套 **happy-wire** 和 Server 通信。
- 用途：远程创建/发送/监控会话，不负责本机 spawn Claude/Codex，只做 “控制面”。

---

## 三、端到端加密与密钥模型

- **认证**：JWT（Bearer token），Server 只验证签名与过期，不参与业务数据解密。
- **Account**：注册/登录时生成或绑定公钥；dataKey 模式下，会话/机器的 data key 用该公钥加密后存 Server（`dataEncryptionKey` 字段）。
- **会话/机器**：metadata、agentState、daemonState、每条消息的 content 均在客户端用对应 data key（或 legacy 的 single secret）加密后上传；Server 只存/转发表层和密文。
- **密钥从不到达 Server**：加解密仅在 CLI 与 App 端完成，实现 E2E。

---

## 四、数据流小结

| 场景 | 路径 |
|------|------|
| 用户在本机跑 `happy` | CLI 建 session/machine → Socket session-scoped 连接 → 与 Claude 进程 loop → 消息加密发 Server → Server 推给同 session 的 App/其他 CLI |
| 用户在手机打开 App | App user-scoped Socket + REST 拉会话/消息 → 解密 → 展示；发消息 → 加密 → Socket/RPC → Server → 推给 CLI |
| 远程启动会话（如从 App） | App 或 Agent 调 API/发指令 → Daemon 收到后 spawn `happy`（或 codex/gemini）→ 新 session 建连，同上 |
| 多端同会话 | 同一 sessionId，多个 session-scoped（CLI）或 user-scoped（App）连接；Server 按 recipientFilter 把 update 推给所有订阅该 session 的连接 |

---

## 五、技术要点汇总

- **Monorepo**：Yarn workspaces，happy-wire 被多处引用，保证协议一致。
- **实时**：Socket.io（WebSocket + fallback），按 user/session/machine 三种 scope 订阅，eventRouter 做过滤与广播。
- **持久化**：Prisma + PostgreSQL（或 PGLite）；Session/Machine/Message 等核心实体带版本号（metadataVersion、agentStateVersion 等）做乐观锁与冲突控制。
- **加密**：客户端 TweetNaCl + AES-GCM，密钥与 dataKey 由客户端管理，Server 不存明文业务内容。
- **多端**：CLI（含 daemon）+ App（Web/iOS/Android/桌面）+ Agent，共用同一 Server 与 happy-wire 协议，实现 “电脑 + 手机 + 远程” 统一体验。
