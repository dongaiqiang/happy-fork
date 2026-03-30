# Happy daemon 与 session 关系说明

## 1. 这份文档解决什么问题

今天在真机回归里，出现了一个很容易让人混淆的现象：

- 停掉 daemon 后，App 里已有会话还能继续对话
- 但停掉 daemon 后，新建 session 会失败
- 等超过 10 分钟后，已有会话仍然还能继续工作

如果只凭直觉判断，很容易误以为：

- daemon 没真正停掉
- App 在线状态判断有 bug
- 或者 session 根本不依赖 daemon

这份文档的目的，就是把 daemon、session、machine online 这三件事分开讲清楚，并结合 `packages/happy-cli/src/daemon/CLAUDE.md` 的设计说明，给后续排查一个统一认知。

---

## 2. 一句话结论

- daemon 不是“所有聊天消息都必须经过的中转站”
- daemon 的核心职责是“机器在线 + 远程控制入口 + 会话生命周期管理”
- 已经运行起来的 session，可以在 daemon 停止后继续依靠自己的 session-scoped 连接与服务端通信
- 但没有 daemon 时，App 无法再远程拉起新的 session

---

## 3. 三个角色分别是什么

### 3.1 App

手机 App 负责：

- 展示机器和会话列表
- 发起“新建会话”“发送消息”等操作
- 接收服务端同步和实时更新

App 自己不直接在电脑上创建进程，它更多是“发请求”和“看结果”。

### 3.2 daemon

daemon 是运行在电脑上的后台控制进程。

它的职责不是直接生成每条回复，而是：

- 以 machine-scoped 客户端身份连上服务端
- 让这台机器在系统里保持“可被远程控制”
- 接收来自 App 的 RPC 请求
- 负责远程创建/停止 session
- 跟踪本机有哪些 happy session 正在运行
- 上报 machine heartbeat、daemon state、machine metadata

这部分职责在 `packages/happy-cli/src/daemon/CLAUDE.md` 中有完整设计说明，核心点包括：

- daemon 启动后会建立 machine-scoped websocket
- 暴露 `spawn-happy-session`、`stop-session`、`requestShutdown`
- 本地维护 tracked sessions
- 通过 heartbeat 和 state file 管理自身生命周期

### 3.3 session

session 是真正执行任务、收消息、产出回复的运行中会话进程。

session 负责：

- 连接自己的 session-scoped websocket
- 接收属于当前 session 的消息
- 持续上报 `session-alive`
- 实际执行 Claude / Codex / Gemini 等代理逻辑

换句话说：

- daemon 更像控制室
- session 更像真正干活的工人

---

## 4. 为什么 daemon 停了，旧 session 还能继续聊

原因是：

- daemon 停掉后，machine-scoped 控制连接没了
- 但已经跑起来的 session 进程本身还活着
- 这些 session 自己仍然持有 session-scoped 连接
- 所以它们仍然可以继续：
  - 收消息
  - 发回复
  - 上报存活状态

代码上可以看到：

- session 侧会持续发送 `session-alive`
  - `packages/happy-cli/src/api/apiSession.ts`
- 服务端收到 `session-alive` 后，会继续把该 session 视为活跃
  - `packages/happy-server/sources/app/api/socket/sessionUpdateHandler.ts`

所以“daemon 停了但旧 session 还能继续对话”不是异常，而是当前架构下的正常表现。

---

## 5. 为什么 daemon 停了，新 session 会创建失败

新 session 创建失败，说明的是另一件事：

- App 发起“新建会话”时，需要有一个 machine-scoped 控制入口来接这个请求
- 这个入口就是 daemon
- daemon 收到请求后，会执行 `spawn-happy-session`，并在本机真正拉起新的 happy session

一旦 daemon 不在：

- machine-scoped websocket 不在
- RPC 没有人接
- 新 session 就无法被远程拉起

因此会出现：

- 旧 session 还能聊
- 新 session 建不起来

这两个现象放在一起，其实正说明系统职责边界是自洽的。

---

## 6. 为什么 machine 在线状态不会立刻掉

machine 的“在线/离线”并不是 daemon 一停就实时切换。

当前实现里：

- App 判断 machine online 时，直接看 `machine.active`
- 服务端会通过 presence timeout 定时把长时间未活跃的 machine 标记为离线
- 超时阈值当前是 10 分钟

这意味着：

- daemon 刚停掉时，App 里机器状态仍可能暂时显示在线
- 这是服务端超时机制导致的延迟，不代表 daemon 还在工作

所以：

- “停 daemon 后几分钟仍显示在线”是正常
- “停 daemon 后新建 session 失败”才更能说明 daemon 确实已经不在了

---

## 6.1 为什么 machine 有时不是变成 offline，而是直接消失

今天的真机观察又补充了一个更容易让用户困惑的现象：

- daemon 停掉后，这台 Mac 机器不一定只是显示成 offline
- 在某些页面里，它会直接从机器列表中消失
- 但与此同时，设置页顶部仍可能显示“已连接”

这背后的原因不是状态冲突，而是前端对“机器列表”和“全局连接状态”用了两套不同口径。

### 机器列表为什么会直接消失

当前 App 里，很多机器列表并不是显示“所有机器”，而是只显示 `active === true` 的机器。

也就是说：

- 机器一旦不再 active
- 前端不是把它保留在列表中并标灰为 offline
- 而是直接把它过滤掉

所以用户看到的效果就是：

- 这台机器“没了”
- 而不是“它还在，但显示离线”

### 为什么顶部还显示“已连接”

设置页顶部那个绿色“已连接”，表示的是：

- App 与 Happy 服务端之间的全局 socket 连接状态

它并不等于：

- daemon 还在线
- machine 仍然可控
- 当前这台 Mac 还在机器列表中

因此完全可能出现下面这种组合：

- App 顶部仍然显示“已连接”
- 机器列表里那台 Mac 已经消失
- 已有 session 还可以继续聊

这三个状态同时存在时，对开发者来说可以解释，但对普通用户来说非常容易混淆。

这也是后续值得考虑优化提示文案和状态表达的地方。

---

## 7. machine online 与 session online 不是一回事

这是今天最关键的认知之一。

### machine online

表示：

- 这台电脑是否仍有 machine-scoped 控制连接
- 服务端是否还认为这台机器活着
- App 是否可以通过这台机器去做远程控制

### session online

表示：

- 某个具体会话进程是否还在运行
- 它是否还在向服务端发送 `session-alive`
- 它是否还能继续收发消息

所以完全可能出现下面这种组合：

- machine 看起来已经接近离线或最终离线
- 但某个已有 session 仍然在线并继续工作

这不是矛盾，而是系统分层设计带来的结果。

---

## 8. `happy daemon stop` 真实停掉了什么

从 `packages/happy-cli/src/daemon/run.ts` 的 shutdown 流程看，daemon 停止时主要做的是：

- 停 heartbeat
- 更新 daemon state 为 `shutting-down`
- 关闭 machine-scoped 连接
- 停本地 control server
- 清理 state file 和 lock file
- 退出 daemon 进程

这里并没有把所有已有 session 一起强杀掉。

因此：

- `happy daemon stop` 更像“关闭控制中枢”
- 不是“把所有工作中的 session 全部终止”

---

## 9. 结合今天实验，可以得出的确定结论

今天的实验已经验证了以下三点：

### 9.1 daemon 停止后，几分钟内 machine 仍显示在线

说明：

- machine online 是超时兜底机制，不是实时断线展示

### 9.2 daemon 停止后，已有 session 还能继续对话

说明：

- 已有 session 具备独立运行能力
- 它不依赖 daemon 才能继续完成当前对话

### 9.3 daemon 停止后，新建 session 失败

说明：

- daemon 确实是远程创建新 session 的关键入口
- 没有 daemon，就没有新的远程会话控制能力

### 9.4 daemon 停止后，machine 可能直接从列表消失

说明：

- 当前前端很多机器列表只展示 active 机器
- 因此前端的默认表现不是“offline machine 置灰保留”
- 而是“不活跃 machine 直接不显示”

### 9.5 设置页顶部“已连接”不等于 daemon 在线

说明：

- 顶部“已连接”代表 App ↔ Server 的连接还在
- 它不能直接等同于“daemon 还在线”
- 也不能直接等同于“当前这台 machine 仍可远程控制”

综合起来，今天最重要的架构结论是：

- daemon 负责“机器在线与远程控制”
- session 负责“具体会话执行与持续对话”

---

## 10. 后续测试应该怎么设计

后续不要再用“停 daemon 后是否立刻离线”作为唯一判断标准。

更合理的测试应该拆成三类：

### A. daemon 控制能力测试

看：

- daemon 停掉后，新建 session 是否失败
- daemon 重启后，新建 session 是否恢复

### B. 既有 session 存活测试

看：

- daemon 停掉后，已有 session 是否还能继续消息往返

### C. online/offline 状态测试

看：

- machine 经过超时窗口后是否转离线
- session 是否仍然可以独立保持活跃

把这三类分开测试，才不会再把“daemon 在线”“machine 在线”“session 在线”“还能不能继续聊天”混成一件事。

---

## 11. 给后续排查的简化记忆法

如果只记一句话，可以记成：

- daemon 管控制
- session 管干活

再展开一点就是：

- daemon 不在，旧活还能干
- daemon 不在，新活干不了

这就是今天实验得到的最直观结论。
