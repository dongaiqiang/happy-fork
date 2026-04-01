# 20260331 Open in Mac：原生 Claude 终端与 tmux 托管第一阶段实施清单

## 1. 第一阶段目标

第一阶段不追求一次性完成全部“原生 Claude + 双端同步”能力，而是先把最关键的底层锚点补齐：

- 让系统知道一个会话当前是否满足 `Open in Mac` 的 tmux 前提
- 在 tmux 场景下，让系统知道这个会话对应哪个 tmux window
- 让 `Open in Mac` 在满足 tmux 前提时回到原生 Claude 承载
- 让 `Open in Mac` 在不满足 tmux 前提时明确提示不可用，并引导手动 `claude resume`

第一阶段完成后，应达到：

1. 新建或恢复后的 Claude 会话，系统能识别其 tmux 承载状态  
2. 如果运行在 tmux 中，可被唯一定位  
3. App / Server / daemon 三端都能读到这些信息  
4. Open in Mac 在 tmux 场景下可回到原生 Claude 终端  
5. 无 tmux 时会明确提示不可用，而不是误走半成品路径

---

## 2. 第一阶段范围

### 2.1 本期要做

- metadata 字段扩展
- daemon 回传 carrier 信息，并在 tmux 场景回传 tmux 承载信息
- server / app 同步新字段
- Open in Mac 按 tmux 前提决定“可用 / 不可用 / 引导 resume”
- 基础验证与回归测试

### 2.2 本期不做

- 手机消息注入 tmux pane
- 观察态 / 控制态输入门禁完全收口
- tmux 生命周期治理专题
- 非 tmux 场景下的 Open in Mac 正式支持
- direct 原生终端下的完整双方同步承诺

---

## 3. 数据模型调整

## 3.1 session.metadata 新增字段

建议新增：

1. `terminalCarrier: 'tmux' | 'fallback' | 'unknown'`
2. `terminalCarrierMode: 'hosted' | 'direct' | null`
3. `tmuxSessionId: string | null`
4. `tmuxSessionName: string | null`
5. `tmuxWindowName: string | null`

### 第一阶段最低必需字段

如果希望先小步快跑，第一阶段至少要补：

1. `terminalCarrier`
2. `tmuxSessionId`

其中：

- `terminalCarrier` 用于判断当前会话是否满足 tmux 前提
- `tmuxSessionId` 用于 tmux 场景下的 Open in Mac attach 锚点

---

## 4. 代码改造清单

## 4.1 happy-cli：metadata 与 daemon

### A. 扩展 metadata schema / 类型

目标：

- 让 CLI、Server、App 都接受新的 tmux 相关字段

候选位置：

- `packages/happy-cli/src/api/types.ts`
- `packages/happy-app/sources/sync/storageTypes.ts`
- 服务端对应 metadata 解密/透传结构

要做：

1. 增加 `terminalCarrier`
2. 增加 `tmuxSessionId`
3. 保持向后兼容，允许老会话为空

### B. daemon 在不同承载路径下补写 carrier 信息

当前基础：

- daemon 在 tmux spawn 成功后已经拿到 `tmuxResult.sessionId`
- 并把它放进了内部 `TrackedSession.tmuxSessionId`
- 非 tmux 路径目前只能视为“不满足 Open in Mac 前提”

缺口：

- 这些承载信息还没有系统性写回 session metadata

要做：

1. 在 webhook 成功关联到 `happySessionId` 后
2. tmux 场景写回 `tmuxSessionId`
3. 同时写回对应 `terminalCarrier`
   - tmux 场景：`terminalCarrier='tmux'`
   - fallback 场景：`terminalCarrier='fallback'`

需要特别注意：

- tmux spawn 成功但 webhook 超时的异常路径
- resume 旧会话时是否要覆盖旧 metadata

### C. 无 tmux 路径的产品要求

要做：

1. 非 tmux 路径下不生成可用于 `Open in Mac` 的 tmux 承载标识
2. `tmuxSessionId=null`
3. 如果最终退到 remote/fallback，也要显式写 `terminalCarrier='fallback'`
4. App 侧收到无 tmux 信息时，直接提示 `Open in Mac` 不可用，并引导手动 `claude resume`

目的：

- 避免 App 端只能根据“有无 tmuxSessionId”做模糊判断
- 避免用户未安装 tmux 时被错误引导到一条并不受正式支持的路径

---

## 4.2 happy-server：透传与读取

目标：

- 服务端无需理解 tmux 细节，但必须稳定透传并提供给 App

要做：

1. 确认 metadata 新字段能正常持久化  
2. 确认 session 更新广播能把这些字段带给 App  
3. Open in Mac 相关接口在选择路径时可读取这些字段

重点检查：

- `v3SessionRoutes.ts`
- session metadata 的加载与更新链路

---

## 4.3 happy-app：读取与使用

### A. metadata 读取

目标：

- App 能读到 `terminalCarrier` 与 `tmuxSessionId`

要做：

1. 扩展本地 schema  
2. 确保同步后不丢字段  
3. 历史会话字段缺失时正常兼容

### B. Open in Mac 路径选择

目标：

- 如果会话已经有 tmux 原生承载，就优先走 attach 原生终端路径

要做：

1. 在会话详情页读取 carrier 信息  
2. Open in Mac 时优先判断：
   - `terminalCarrier === 'tmux'`
   - `tmuxSessionId` 存在
3. 满足条件则走“attach tmux 原生终端”
4. 若不满足 tmux 前提，则直接显示不可用提示
5. 提示中给出手动 `claude resume` 指引

### C. UI 提示

第一阶段不必大改 UI，只需最小提示：

1. 会话是否已绑定原生终端承载  
2. Open in Mac 当前将走：
   - tmux attach
   - 或不可用提示 + `claude resume` 指引

---

## 4.4 Open in Mac 行为改造

### 目标

把当前：

- 优先 remote observe

改成：

- 优先进入已知的原生终端承载

### 目标行为

#### 情况 A：已知 `tmuxSessionId`

1. 直接打开 Terminal
2. attach 到对应 tmux session/window
3. 成功后提示“已在 Mac 打开原生 Claude 会话”

#### 情况 B：没有 `tmuxSessionId`

1. 直接提示当前机器未满足 `Open in Mac` 的 tmux 前提
2. 不再走 direct 原生终端正式路径
3. 提示用户如需在 Mac 终端继续查看/接续会话，可手动执行 `claude resume`

#### 情况 C：未知 `tmuxSessionId`，但能恢复原会话

1. 前提仍然是当前机器具备 tmux
2. 先尝试恢复/重建原生承载
3. 恢复成功后写回 metadata
4. 再 attach

#### 情况 D：tmux 不可用

1. 直接提示不可用
2. 不走伪降级路径
3. 提示用户手动 `claude resume`

---

## 5. 测试清单

## 5.1 单元 / 集成测试

第一阶段建议至少增加这些测试：

1. tmux spawn 成功后，session metadata 更新包含 `tmuxSessionId`
2. 非 tmux 路径下，session metadata 不会伪造 `tmuxSessionId`
3. fallback 路径下 metadata 能标记 `terminalCarrier='fallback'`
4. App 读取新 metadata 字段不报错
5. Open in Mac 在已知 `tmuxSessionId` 时优先选择 attach 路径
6. 无 tmux 时 Open in Mac 会明确提示不可用，并给出 `claude resume` 指引

## 5.2 真机联调

至少验证：

1. 新建会话时，metadata 中能拿到 carrier 字段  
2. 同一个会话重复 `Open in Mac` 时，回到的是同一个原生终端现场  
3. 没有 tmux 时，能明确提示不可用并引导 `claude resume`  
4. 历史老会话没有 `tmuxSessionId` 时，App 不崩溃

---

## 6. 风险点

第一阶段虽然不做手机消息注入，但仍有几个风险要注意：

1. tmux spawn 成功但 metadata 补写失败  
2. 恢复旧会话时 carrier 信息不一致  
3. attach 逻辑只知道 session，不知道 window  
4. 老会话没有新字段导致路径选择混乱

建议：

- 所有新字段都允许为空
- 所有路径都保留 fallback
- 先把“可识别、可 attach”做稳，再推进“可注入”

---

## 7. 实施顺序

推荐按下面顺序推进：

### 第 1 步

- 扩展 metadata schema
- 打通 CLI / Server / App 的字段兼容

### 第 2 步

- daemon 成功 tmux spawn 后，把 `tmuxSessionId` 写回 session metadata

### 第 3 步

- App 读取并识别 `tmuxSessionId`
- Open in Mac 优先 attach tmux

### 第 4 步

- 加测试
- 跑真机回归

---

## 8. 第一阶段完成标准

只有满足以下条件，才算第一阶段完成：

1. 新会话能稳定标记自己的承载类型
2. tmux 托管时，session metadata 中能稳定看到 `tmuxSessionId`
3. App 不依赖猜测，而是能明确知道会话是否有原生终端承载
4. Open in Mac 能优先回到原生 Claude 会话
5. 用户未安装 tmux 时，系统会明确提示 Open in Mac 不可用
6. 提示中会给出手动 `claude resume` 指引

一句话：

**第一阶段的目标不是完成全部原生同步，而是先把“原生 Claude 会话挂在哪里”这件事做成系统真相。**
