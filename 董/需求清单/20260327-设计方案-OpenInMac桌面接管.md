# 20260327 设计方案：Open in Mac（桌面接管）

## 1. 设计目标

围绕需求清单《20260327-需求清单-OpenInMac桌面接管》落地以下能力：

1. 手机端一键 `Open in Mac`，在 Mac 端恢复同一 Claude 会话  
2. 手机端与 Mac 端双端可见（消息同步）  
3. Open in Mac 成功后默认仍由手机端主控，Mac 端先进入可见态  
4. 任意时刻仅一端可控（单写入、单执行）  
5. 支持“控制权切换开关”  
6. 支持 `Terminal Direct` / `Hosted` 两种启动承载方式  
7. 新建会话后，手机端可见 `claudeSessionId`（含“获取中”状态）

---

## 2. 范围与非范围

### 2.1 本期范围

1. 控制权模型（服务端真相源）  
2. Open in Mac 动作编排  
3. App 端可视状态与切换入口  
4. daemon/CLI 执行动作适配  
5. 新建会话 `claudeSessionId` 回传与展示

### 2.2 本期不做

1. 双端并发编辑合并  
2. 多设备复杂抢占策略（优先级、排队）  
3. 历史 UI 消息迁移拼接

---

## 3. 总体架构与职责

### 3.1 App（happy-app）

1. 展示双端状态：可见/可控/控制方  
2. 触发动作：Open in Mac、切换控制权  
3. 对失败态给出明确提示（离线、权限、方法不可用）

### 3.2 Server（happy-server）

1. 控制权唯一真相源（controller + leaseVersion）  
2. 互斥校验：仅 controller 可写入/执行  
3. 编排 Open in Mac 时序（handoff -> open，切换动作系统内自动处理）  
4. 广播状态更新到相关客户端

### 3.3 Daemon/CLI（happy-cli）

1. 作为本机执行代理，执行 spawn/resume/stop  
2. 通过 machine-scoped / session-scoped RPC 接收命令  
3. 上报 machine alive、session alive、执行结果  
4. 不负责控制权仲裁

---

## 4. 数据模型设计

## 4.1 Session metadata 扩展

在 `session.metadata` 增加以下字段（向后兼容，缺省可为空）：

1. `controller`: `'mobile' | 'mac'`  
2. `controllerUpdatedAt`: `number`  
3. `controllerLeaseVersion`: `number`  
4. `handoffState`: `'idle' | 'switching' | 'failed'`  
5. `handoffReason`: `string | null`  
6. `claudeSessionId`: `string | null`（已有字段，完善语义）

### 4.2 兼容策略

1. 老会话无 `controller` 时按默认规则推导（在线端优先）  
2. 不阻塞旧版本读取；新字段仅作为增强  
3. 服务端统一兜底写入标准化结构

---

## 5. 状态机设计

### 5.1 会话控制状态

1. `controller-mobile`：手机端可写/可执行，Mac 只读  
2. `controller-mac`：Mac 可写/可执行，手机端只读  
3. `switching`：切换中，双端暂禁写入  
4. `offline-observe`：控制端离线，仅观察，允许发起重新切换

### 5.2 状态迁移

1. 手机发起 Open in Mac：`controller-mobile -> switching -> controller-mobile`（Mac 进入可见态，主控暂不切换）  
2. Mac 发起切回手机：`controller-mac -> switching -> controller-mobile`  
3. 显式切到 Mac 主控：`controller-mobile -> switching -> controller-mac`  
4. 切换失败：`switching -> failed(可重试)`，保留上一个稳定 controller  
5. 控制端离线：进入 `offline-observe`

---

## 6. 核心时序设计

## 6.1 Open in Mac（手机发起）

1. App 请求 `handoffToMac(sessionId, terminalCarrierMode)`  
2. Server CAS 更新 `handoffState=switching`、`leaseVersion+1`  
3. 进入 switching 后，非主控端写入被临时拒绝，双端保持可见同步  
4. Server 调用目标 machine 的 resume/spawn（携带 `claudeSessionId` 与 `terminalCarrierMode`）  
5. `Terminal Direct`：由 Mac 默认终端直接承载 Claude 本体进程；恢复已有会话时才带 `--resume <claudeSessionId>`  
6. `Hosted`：由 daemon/tmux 等后台托管，再在终端中附着或查看  
7. Open in Mac 成功后写回 `handoffState=idle` 并广播，默认保持 `controller=mobile`  
8. 失败则写 `handoffState=failed + reason`，广播错误态  
9. 用户侧无需先手动“停止会话”，会话在线与任务进行中均可直接发起 Open in Mac

### 6.2 控制权切换开关（双向）

1. 发起端提交 `requestControllerSwitch(target=mobile|mac, expectedLeaseVersion)`  
2. Server 校验 expectedLeaseVersion（防并发覆盖）  
3. 进入 switching 并执行目标侧接管动作  
4. 成功后提交新 controller；失败回滚稳定态并给出 reason

### 6.3 新建会话 `claudeSessionId` 回传

1. 手机创建会话触发 machine spawn  
2. Mac 启动 Claude 进程后拿到 `claudeSessionId`  
3. CLI 通过 metadata update 写回服务端  
4. App 收到 update-session 后展示 ID  
5. 未到达前显示“正在获取 Claude 会话 ID”

---

## 7. 接口设计

### 7.1 App -> Server（新增/调整）

1. `POST /v3/sessions/:id/handoff/mac`  
   - 入参：`expectedLeaseVersion, machineId, directory, claudeSessionId, openTerminal, terminalCarrierMode`  
   - 出参：`{ success, controller, leaseVersion, handoffState, reason }`
2. `POST /v3/sessions/:id/controller-switch`  
   - 入参：`targetController, expectedLeaseVersion`  
   - 出参：同上

### 7.2 Server -> Daemon RPC（machine-scoped）

1. `open-in-mac`（可复用 spawn-happy-session，增加 handoff 语义）  
   - 入参：`directory, claudeSessionId, sessionId, mode=resume, terminalCarrierMode=direct|hosted`  
   - 出参：`success/error + message`

### 7.3 Session RPC（session-scoped）

1. `stopSession` 作为系统内部可选动作，不作为用户手动前置步骤  
2. 明确错误语义：`method unavailable / target offline / timeout / denied`

---

## 8. UI 交互设计（手机端）

### 8.1 会话详情页新增展示

1. `控制方`：手机 / Mac  
2. `控制权状态`：可控 / 只读 / 切换中 / 失败  
3. `Claude Code 会话 ID`：显示与复制（无值时显示获取中）

### 8.2 快捷动作

1. `Open in Mac`（当前 controller=mobile 且目标机器在线即可点击，不以“会话已停止”为前置条件）  
2. `切回手机控制`（controller=mac 时显示）  
3. `Resume Session` 与控制权逻辑保持一致（只读端不允许执行写入动作）

### 8.3 防误触与反馈

1. 切换中按钮 disabled + loading  
2. 成功 toast + 状态刷新  
3. 失败提示携带 reason，并提供重试  
4. Open in Mac 默认前台打开 Mac 终端并展示 Claude 本体界面；仅在显式选择 `Hosted` 时才展示托管会话视图

---

## 9. 并发与一致性策略

1. 所有切换请求使用 `expectedLeaseVersion` 做 CAS  
2. Server 端串行化单 session 的切换请求（锁粒度：sessionId）  
3. 只允许一个活跃切换任务，重复请求直接返回“切换中”  
4. 执行动作与状态提交分两阶段，失败可回滚到稳定态

---

## 10. 失败场景与兜底

1. daemon 不在线：直接失败，reason=`machine-offline`  
2. RPC method unavailable：reason=`rpc-unavailable`，提示升级 daemon/CLI  
3. handoff 超时：reason=`handoff-timeout`，允许用户重试  
4. `Terminal Direct` 打开了终端但未在时限内回传 webhook：reason=`terminal-direct-timeout`  
5. resume 失败：reason=`resume-failed`，保留旧 controller  
6. metadata 未回传 ID：显示“获取中”，并定时刷新或等待 push update

---

## 11. 实施步骤（建议按阶段）

### 阶段 A：服务端控制权基座

1. Session metadata 扩展字段  
2. controller-switch/handoff API + CAS  
3. update 广播与错误码规范

### 阶段 B：CLI/daemon 执行链路

1. machine RPC `open-in-mac` 或 spawn 语义增强  
2. 接管链路支持“在线直接切换”，不要求用户先手动 stop  
3. 回传执行结果与失败原因

### 阶段 C：App 端 UI 与交互

1. 控制方/状态展示  
2. Open in Mac + 切换开关  
3. `claudeSessionId` 展示与“获取中”文案

### 阶段 D：联调与灰度

1. 单机联调  
2. 异常注入（离线、超时、重连）  
3. 小范围灰度验证

---

## 12. 验收用例

1. 手机创建会话后，1 个同步周期内看到 `claudeSessionId`  
2. Open in Mac 成功后，Mac 默认终端可继续同一上下文，手机仍保持主控  
3. 显式切换主控前，手机端仍可执行写入，Mac 端先作为可见态  
4. 双端同时在线时，仅 controller 端可执行写入  
5. 切换失败时有可读 reason，且不出现双端同时可写  
6. daemon 重启后状态可恢复，不破坏控制权一致性

---

## 13. 代码落点（对应仓库）

1. App：`packages/happy-app/sources/app/(app)/session/[id]/info.tsx`  
2. App 操作：`packages/happy-app/sources/sync/ops.ts`  
3. Server RPC 路由：`packages/happy-server/sources/app/api/socket/rpcHandler.ts`  
4. Server 会话更新：`packages/happy-server/sources/app/api/socket/sessionUpdateHandler.ts`  
5. CLI 机器侧：`packages/happy-cli/src/api/apiMachine.ts`  
6. CLI 会话侧：`packages/happy-cli/src/api/rpc/RpcHandlerManager.ts`、`packages/happy-cli/src/claude/registerKillSessionHandler.ts`

---

## 14. 结论

本方案以“服务端控制权真相源 + daemon 执行代理 + 双端同步展示”为核心，优先保证：

1. 控制权一致性  
2. 切换过程可观测  
3. 失败可回滚与可重试  
4. 新建会话 `claudeSessionId` 可及时在手机端可见

---

## 15. 第一阶段可执行任务清单（按代码文件）

### 15.1 happy-server（控制权基座）

1. `packages/happy-server/prisma/schema.prisma`  
   - 在 `Session.metadata` 对应结构中补充控制权字段约定  
2. `packages/happy-server/sources/app/api/routes/sessionRoutes.ts`  
   - 新增 `handoff/mac` 与 `controller-switch` 路由  
   - 接入 `expectedLeaseVersion` CAS 参数  
3. `packages/happy-server/sources/app/api/socket/sessionUpdateHandler.ts`  
   - 广播 `controller/handoff` 变化  
   - 统一 reason 错误码透传  
4. `packages/happy-server/sources/app/api/socket/rpcHandler.ts`  
   - 调整控制权相关 RPC 错误语义（denied、switching、offline）

### 15.2 happy-cli（daemon 执行链路）

1. `packages/happy-cli/src/api/apiMachine.ts`  
   - 增强 machine RPC，支持 `open-in-mac` 语义  
   - 复用 `spawn-happy-session` 的 resume 参数与返回结构  
2. `packages/happy-cli/src/claude/registerKillSessionHandler.ts`  
   - 继续保持 `stopSession` 主路径稳定可用  
3. `packages/happy-cli/src/claude/claudeLocalLauncher.ts`  
   - 明确 handoff 场景下 stop/resume 串联行为  
4. `packages/happy-cli/src/api/rpc/RpcHandlerManager.ts`  
   - 对 handoff 相关错误结果做结构化返回约束

### 15.3 happy-app（UI 与动作）

1. `packages/happy-app/sources/sync/ops.ts`  
   - 新增 `handoffToMac` 与 `switchController` 操作封装  
2. `packages/happy-app/sources/app/(app)/session/[id]/info.tsx`  
   - 增加控制方与切换状态展示  
   - 增加 Open in Mac 与切回手机控制入口  
   - `claudeSessionId` 无值时显示“获取中”  
3. `packages/happy-app/sources/text/_default.ts` 与多语言文件  
   - 补充控制权切换、失败原因、获取中等文案键

### 15.4 第一阶段验收门槛

1. 手机端可见控制方与切换状态  
2. Open in Mac 动作完成后控制方变为 Mac，手机端只读  
3. 新建会话后可在详情页看到 `claudeSessionId`，未回传时有“获取中”文案  
4. 失败时返回可读 reason，且不出现双端同时可写

---

## 16. 技术深化方案（双端可见 + 主控开关）

## 16.1 目标拆分

1. 会话内容双端同步可见（手机与 Mac 都看到同一会话）  
2. 操作权限单端互斥（只允许主控端写入）  
3. Open in Mac 一键接管（不要求先停会话）  
4. Mac 前台可见终端优先（失败时后台降级）  
5. 全链路可观测（用户提示 + 服务端状态 + daemon 执行结果）

## 16.2 Claude 能力边界与系统分层

1. Claude 层：负责 `--resume` 会话恢复、生成对话内容、执行工具  
2. Happy 控制面：负责 controller 选择、租约 CAS、写入互斥、切换状态广播  
3. Happy 展示面：负责手机端与 Mac 端的状态同步展示、只读/可写交互约束  
4. 结论：双端协同不是依赖 Claude 原生多端产品，而是由 Happy 在 Claude 之上实现

## 16.3 双平面架构

1. 数据平面（Data Plane）：Claude 会话消息流、会话元数据、daemon 执行结果  
2. 控制平面（Control Plane）：controller、leaseVersion、handoffState、handoffReason  
3. 控制平面优先级高于数据平面：任何写入前先过 controller 校验  
4. 数据平面可双端订阅，控制平面严格单写入授权

## 16.4 写入门禁策略（核心）

1. 客户端提交写入请求时附带 `expectedLeaseVersion`  
2. 服务端校验：
   - `handoffState !== switching`
   - `requester == controller`
   - `expectedLeaseVersion == controllerLeaseVersion`
3. 校验通过才路由到 session-scoped RPC  
4. 校验失败返回结构化错误：`controller-denied` / `switching-in-progress` / `lease-mismatch`

## 16.5 Open in Mac 详细时序（在线会话可直接发起）

1. App 发起 `POST /v3/sessions/:id/handoff/mac`（包含 leaseVersion）  
2. Server CAS 将会话置为 `switching` 并广播  
3. Server 执行接管序列（系统内部）：
   - 对当前执行链路发“暂停写入/切换中”控制
   - 调用 machine resume/spawn（携带 `claudeSessionId` + directory）
   - 成功后提交 `controller=mac`，`handoffState=idle`，`leaseVersion+1`
4. 失败则提交 `handoffState=failed`，保留上一个稳定 controller  
5. 全程用户不需要先手动 stop

## 16.6 Mac 前台可见策略

1. 第一优先：在 Mac 前台打开终端并附带 resume 命令，用户可直接观察/接管  
2. 第二优先：若前台打开失败（权限/GUI 不可用），后台恢复会话  
3. 降级必须回传模式：
   - `openMode=foreground`
   - `openMode=background-fallback`
4. App 按模式展示成功文案，避免“看不到窗口但提示成功”的认知偏差

## 16.7 主控开关设计

1. 开关入口：会话详情页固定显示“当前主控端”与“切换主控”  
2. 切换接口：`POST /v3/sessions/:id/controller-switch`  
3. 切换语义：
   - 切换到 mobile：手机端恢复可写，Mac 端只读
   - 切换到 mac：Mac 端恢复可写，手机端只读
4. 切换中（switching）状态下双端按钮统一禁用写入类动作

## 16.8 兼容与迁移

1. 老 daemon 不支持新能力时：
   - 返回 `rpc-unavailable`
   - App 引导升级 daemon
2. 老 session 无 controller 字段时按默认值补齐并回写  
3. 保留已实现兜底能力，但标记为临时策略，避免长期掩盖能力缺口

## 16.9 观测与排障

1. 会话维度日志：sessionId、claudeSessionId、controller、leaseVersion、handoffState  
2. 机器维度日志：machineId、daemon version、openMode、rpc result  
3. 关键指标：
   - handoff success rate
   - foreground open rate
   - switching timeout rate
   - controller denied count
4. 失败排障最小闭环：App 错误文案 + server reason + daemon log 三点对齐

## 16.10 实施里程碑（可直接开工）

1. M1（控制面稳定）：写入门禁、lease CAS、switching 状态机闭环  
2. M2（接管体验）：在线直接 Open in Mac、去除用户手动 stop 前置  
3. M3（前台可见）：终端前台打开链路 + 后台降级提示  
4. M4（主控开关）：mobile/mac 双向切换入口与接口打通  
5. M5（验收与灰度）：按指标验证稳定性并收敛失败原因
