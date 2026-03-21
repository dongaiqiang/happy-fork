# Happy Coder Daemon 机制深度分析

Happy Coder 的 Daemon 是整个系统的核心枢纽，主要负责 CLI 进程管理和 Web <-> CLI 的路由转发。

## 1. 核心职责
Daemon 扮演着“交通指挥官”的角色：
- **管理 CLI 进程**：启动、停止、监控。
- **管理 Web <-> CLI 的路由**：把 Web 发来的请求转发给正确的 CLI 进程。
- **状态维护**：实时追踪活跃的 Session 列表。

## 2. Session 的两种形态

在 Daemon 的视角里，Session 分为两类：

### 2.1 Externally Started (Terminal Mode)
- **启动方式**：用户在终端手动运行 `happy`（CLI）。
- **注册流程**：
    1.  CLI 启动后，通过 `runClaude.ts` 里的 `notifyDaemonSessionStarted` 向 Daemon 汇报（HTTP POST）。
    2.  Daemon 收到汇报，记录下这个 Session 的 ID 和 PID。
    3.  Daemon **不控制**它的生命周期（如果不小心死了，Daemon 只是清理记录）。
- **权限**：受限于当前终端用户的权限（通常需要交互确认）。
- **典型场景**：本地开发者在终端工作，Web 端作为“副驾驶”观察。

### 2.2 Daemon Started (Remote Mode)
- **启动方式**：用户在 Web 端点击 "New Session"。
- **注册流程**：
    1.  Web -> Server -> Daemon (WebSocket)。
    2.  Daemon 收到指令，调用 `spawnHappyCLI` 启动一个新的 CLI 子进程。
    3.  Daemon **完全控制**它的生命周期（包括重启、强制关闭）。
- **权限**：通常带 `--dangerously-skip-permissions` 参数启动，因为它是为了远程控制而生的，假设操作是受信任的。
- **典型场景**：完全通过 Web 界面远程控制开发环境。

## 3. 请求路由机制

当 Web 端发消息时，数据流向如下：

1.  **消息到达**：Web 消息到达 Daemon 的 WebSocket 接口。
2.  **Session 解析**：Daemon 解析消息里的 `sessionId`。
3.  **目标查找**：Daemon 在内部维护的 `sessions` 表里查找对应的 CLI 进程。
4.  **消息转发**：
    *   Daemon 并不直接发 HTTP 请求给 CLI 进程（因为 CLI 进程没有开放接收端口）。
    *   **WebSocket 推送**：CLI 进程启动时，会连上 Daemon 的 WebSocket（或者通过长轮询）。Daemon 把消息通过 WebSocket 推送给 CLI。
    *   CLI 收到推送 -> 执行操作 -> 把结果推回 Daemon -> Daemon 推回 Web。

## 4. 监控与保活

Daemon 会定期检查所有 Session 的 PID 是否还存在。
- **Terminal Mode**：如果进程死了，Daemon 只是从列表里移除（正如日志里的 `Removing stale session`）。
- **Remote Mode**：如果进程死了，Daemon 可能会尝试重启它（取决于配置）。

## 5. 总结

Daemon 的设计非常灵活且去中心化：
- 它允许“带资进组”（Terminal Mode），也允许“自己招人”（Remote Mode）。
- 它通过 WebSocket 实现了 Web 和 CLI 的实时双向通信，让 Web 端看起来像是在直接操作终端一样。
- 这种架构既保证了本地开发的安全性（Local Mode 下的权限确认），又提供了远程开发的便利性（Remote Mode 下的完全控制）。
