# 20260331 Open in Mac：原生 Claude 终端与 tmux 托管详细设计

## 1. 背景与问题定义

当前 `Open in Mac` 虽然已经能做到“打开 Mac 侧会话、尽量绑定原上下文、手机与 Mac 之间同步消息”，但仍存在一个根本问题：

1. **Mac 侧看到的不是原生 Claude 终端**
   - 当前主路径仍然依赖 `remote` 模式。
   - `remote` 模式本质上是 Happy 自己消费消息流，再在终端里做二次展示。
   - 这会天然带来格式损失、内容截断、tool/result 呈现不原生的问题。

2. **“原生 Claude 终端”与“双端同步能力”在现有实现中被绑定为互斥**
   - `local` 模式 = 原生 Claude 终端。
   - `remote` 模式 = 双端同步与远端消息消费。
   - 因此一旦手机端发消息，当前本地原生终端无法继续维持“原生 + 同步”两件事同时成立。

3. **用户的最终目标非常明确**
   - Mac 终端里必须使用原生 Claude 终端。
   - 信息必须准确显示，不能靠 Happy 自己重绘后再展示。
   - 手机端与 Mac 端要同步，且保持同一会话上下文。

这里需要明确区分“现状”和“目标”：

1. **现状**
   - 我们之前已经验证过，直接使用原生 Claude 终端时，系统目前做不到完整的双方同步。
   - 尤其是手机端往会话里继续发消息时，当前原生 direct 路径缺少稳定的远端输入桥接能力。

2. **目标**
   - 本文讨论的是如何通过 carrier 重构、tmux 托管和输入桥接，把“原生 Claude”与“双端同步”重新组合起来。
   - 所以这里写的是目标设计，而不是声称当前实现已经具备该能力。

因此，问题已经不再是“继续把 remote viewer 打磨得更好”，而是：

**如何让 Open in Mac 最终落到原生 Claude 终端，同时保留 Happy 的双端同步与控制权管理能力。**

---

## 2. 设计目标

本设计围绕以下目标展开：

1. **Mac 端使用原生 Claude 终端**
   - 不再把 Happy 自绘终端作为主路径。
   - `Open in Mac` 打开的应该是 Claude 自己的原生终端承载。

2. **手机 / Mac 双端同步**
   - Mac 本地输入，手机端可见。
   - 手机端发送消息，Mac 端可见。
   - agent 回复、tool 调用、结果摘要在双端保持同一会话语义。

3. **单会话、单上下文**
   - 不创建影子 session。
   - 不因为 Open in Mac 产生新的 Happy session 或新的 Claude 会话分叉。

4. **单控制方**
   - 同一时刻只能一端控制。
   - 另一端允许观察，但不应同时作为主写入端。

5. **可重复 attach**
   - Mac 端关掉 Terminal 后可以再次打开。
   - `Open in Mac` 应能够回到同一个原生 Claude 终端现场，而不是重新渲染一个 viewer。

6. **可工程化落地**
   - 尽量复用当前已有链路与工具能力。
   - 减少大范围推翻重做。

---

## 3. 非目标

本设计明确不解决以下问题：

1. 多端同时并发输入的复杂合并策略  
2. Claude 原生 UI 的内部行为修改  
3. 非 Claude agent（如 Codex / Gemini）的统一原生终端方案  
4. 所有历史会话立刻迁移到新模型  
5. 无 tmux 环境下也达到完全同等级体验

---

## 4. 当前现状总结

### 4.1 已经具备的能力

当前代码已经具备一些重要基础：

1. **Open in Mac 能把会话尽量绑定回原 Happy session**
2. **fallback 路径已经支持透传 `happySessionId`**
3. **手机 / Mac 之间的消息同步链路已经基本打通**
4. **控制权状态机已经有初步实现**
   - 默认观察态
   - 显式切换到 Mac
   - 显式切回手机
5. **daemon 已具备 tmux 能力**
   - 检测 tmux 是否可用
   - 在 tmux 新 window 中拉起会话
   - 获得 `tmuxSessionId`
   - 向 tmux pane 注入按键

### 4.2 当前根本限制

当前最核心的限制有三条：

1. **daemon 明确禁止 daemon-spawned session 直接使用 `local` 模式**
   - 当前实现中 `startedBy === 'daemon' && startingMode === 'local'` 会直接报错。
   - 这说明系统默认假设：“daemon 拉起 = remote 模式”。

2. **local 模式无法天然消费手机端消息**
   - 当前 `claudeLocal()` 直接把 Claude 接到原生终端 `stdio: inherit`。
   - 这意味着 Happy 无法像 remote 模式那样接管输入流并混入远端消息。
   - 这也正是此前我们试过“原生 Claude 终端”，但它仍做不到完整双方同步的直接原因。

3. **session 元数据里还没有 `tmuxSessionId`**
   - daemon 内部知道某个会话挂在哪个 tmux window。
   - 但 App / Server / Session 元数据链路还不知道。
   - 这导致“重新 attach 到同一个原生终端”还没有稳定锚点。

---

## 5. 为什么需要 tmux

### 5.1 tmux 的角色

tmux 在本方案里不是用户主界面，而是底层托管设施。

它主要承担四个角色：

1. **托管原生 Claude 会话**
   - 让 Claude 原生终端会话有稳定宿主。

2. **提供可重复 attach 的能力**
   - Mac 端随时重新回到原会话终端。

3. **解耦 Terminal 窗口生命周期**
   - 关闭当前 Terminal 不等于 Claude 会话死亡。

4. **提供外部输入注入抓手**
   - 允许系统把手机端输入投递到同一个原生终端承载中。

### 5.2 没有 tmux 会怎样

如果不依赖 tmux，而继续把原生 Claude 直接绑定在某个 Terminal 窗口的前台进程上，会遇到这些问题：

1. 无法稳定重新 attach 到同一现场  
2. 无法清晰区分“终端窗口关闭”与“会话结束”  
3. 很难从系统外部向这个前台原生终端可靠注入输入  
4. 更容易重新退化为 remote viewer 路径

因此：

- **tmux 是 `Open in Mac` 正式能力的承载前提**
- **没有安装 tmux 时，`Open in Mac` 应明确提示不可用**
- **此时不再把 direct 原生终端包装成正式双端同步方案**
- **如果用户只想手动在 Mac 终端里继续查看/接续会话，可使用 `claude resume`**

---

## 6. 总体方案

## 6.1 核心思想

新的主路径不再是：

1. Claude 在某处运行  
2. Happy 抓取消息流  
3. Happy 自己重绘一个终端给 Mac 看

而改成：

1. Claude 原生终端在 `Open in Mac` 正式方案下运行在 tmux 托管的 pane 中  
2. Happy 负责把会话元数据、控制状态、消息同步维持起来  
3. `Open in Mac` 时 attach 回 tmux 承载；无 tmux 时提示不可用并引导手动 `claude resume`  
4. Mac 看到的就是原生 Claude  
5. 手机端继续通过 Happy session 流看到同步内容

### 6.2 新的职责划分

#### App（happy-app）

1. 发起 Open in Mac  
2. 展示 controller / handoff 状态  
3. 展示会话已绑定的原生终端状态  
4. 继续作为手机主控端/观察端之一

#### Server（happy-server）

1. 保持 controller 真相源  
2. 继续做控制权切换 CAS  
3. 编排 Open in Mac 动作  
4. 向 Mac 目标机器下发“attach 原生终端 / 恢复终端 / 切换控制权”语义

#### Daemon（happy-cli daemon）

1. 在 tmux 中托管 `Open in Mac` 所需的原生 Claude 会话  
2. 记录原生终端承载信息，以及 tmux 场景下的 `tmuxSessionId` 与 Happy session 的关系  
3. 接收“重新 attach”“消息注入”“停止会话”等控制动作  
4. 向服务端回传 carrier 信息

#### Claude 会话进程（happy-cli / claude）

1. 继续负责和服务端同步 Claude 消息  
2. 继续维护 `claudeSessionId`  
3. 继续维护 Happy session 生命周期  
4. 不再把“原生终端显示”与“消息同步”当作互斥模式

---

## 7. 目标链路

## 7.1 新建会话

理想链路如下：

1. 手机端点“新建会话”  
2. App 调用 machine RPC 请求创建会话  
3. daemon 检查 tmux 是否可用  
4. 若 tmux 可用，则在指定 tmux session 中新建一个 window  
5. 若 tmux 不可用，则本次会话不具备 `Open in Mac` 正式能力  
6. Claude 启动后：
   - 创建或绑定 Happy session
   - 上报 `claudeSessionId`
   - tmux 场景额外上报 `tmuxSessionId`
   - 所有场景上报 `terminalCarrier`
7. 服务端持久化这些信息  
8. 手机端开始订阅并显示消息流

最终效果：

1. tmux 场景下，Claude 原生界面运行在可 attach 的正式承载中  
2. 非 tmux 场景下，会话仍可在手机端继续使用，但不承诺 `Open in Mac`  
3. 手机端持有同一个 Happy session  
4. 双端正式同步能力只在 tmux 主路径上成立

## 7.2 Open in Mac

理想链路如下：

1. 手机端点击 `Open in Mac`  
2. App 请求 Server 执行 handoff/open 动作  
3. Server 查询该 session 当前元数据：
   - machineId
   - claudeSessionId
   - tmuxSessionId
4. 如果已有 `tmuxSessionId`：
   - daemon 直接在本机打开 Terminal
   - Terminal 直接 attach 到这个 tmux window
5. 如果没有 `tmuxSessionId` 但当前机器具备 tmux 且能恢复到原 Claude session：
   - daemon 先创建/绑定 tmux 托管
   - 再 attach
6. 如果当前机器不具备 tmux：
   - App 明确提示 `Open in Mac` 不可用
   - 同时提示用户可手动使用 `claude resume`
7. App 侧默认仍保持 `controller=mobile`
8. Mac 进入观察态原生 Claude 终端

## 7.3 手机端发送消息

这是整个方案最关键的链路：

1. 手机端发消息到 Happy session  
2. Server 将消息下发给目标会话  
3. 目标会话不是切到 remote viewer，而是：
   - 若当前运行在 tmux 托管环境，则将输入投递到对应 tmux pane
   - 若当前不在 tmux 正式承载环境，则不承诺 `Open in Mac` 下的完整双端同步
4. Claude 在原生终端里收到输入并执行  
5. Claude 产生的消息继续走现有同步链路回传

这里必须额外强调：

1. **tmux 场景是为了把“原生 Claude + 双端同步”真正做实**
2. **非 tmux 场景不是完整等价替代**
3. 没有 tmux 时，不把 `Open in Mac` 包装成正式可用能力

最终效果：

1. Mac 看到这条消息出现在原生 Claude 终端  
2. 手机也看到同样的 user 消息与后续回复  
3. 不发生 “手机一发消息，Mac 原生终端退出/切 remote” 的现象

## 7.4 Mac 本地输入

1. 用户在 Mac 原生 Claude 终端里直接输入  
2. Claude 正常执行  
3. 当前已有同步链路继续把这条 user 输入与 agent 回复发回 Happy session  
4. 手机端同步可见

## 7.5 控制权切换

控制权只决定“谁允许作为主输入端”，不再决定“显示层使用什么 UI”。

### 默认状态

1. 手机主控  
2. Mac 可 attach 观察  
3. Mac 本地不应成为正式主输入端

### 切到 Mac 控制

1. App 发起 `Switch Control to Mac`  
2. Server 完成 CAS 切换  
3. daemon/CLI 放开 Mac 原生 Claude 终端本地输入权限  
4. 手机转为只读/观察

### 切回手机控制

1. App 发起 `Switch Control to Mobile`  
2. Server 完成 CAS 切换  
3. 手机重新成为主写入端  
4. Mac 继续 attach 观察，但不再是主控端

---

## 8. 数据模型设计

### 8.1 Session metadata 新增字段

建议在 `session.metadata` 中新增以下字段：

1. `terminalCarrier`: `'tmux' | 'direct' | 'fallback' | 'unknown'`
2. `terminalCarrierMode`: `'hosted' | 'direct' | null`
3. `tmuxSessionId`: `string | null`
4. `tmuxSessionName`: `string | null`
5. `tmuxWindowName`: `string | null`
6. `nativeTerminalReady`: `boolean | null`
7. `nativeTerminalAttachedAt`: `number | null`

其中最关键的是：

1. `tmuxSessionId`
2. `terminalCarrier`

### 8.2 字段语义

#### `terminalCarrier`

表示当前这个会话真正的终端承载方式：

1. `tmux`：Claude 运行在 tmux pane 中  
2. `direct`：Claude 运行在普通原生终端中  
3. `fallback`：当前只能使用 remote/fallback 路径  
4. `unknown`：旧会话或未探测到

#### `tmuxSessionId`

用于唯一定位当前原生终端承载，格式保持与 daemon 内部一致：

1. `session:window`

它必须成为：

1. Open in Mac attach 的锚点  
2. 远端输入注入的目标  
3. 生命周期治理的基础标识

---

## 9. 状态机设计

## 9.1 显示态与控制态分离

新的状态机需要明确：

1. **显示态**
   - 是否已有原生终端承载
   - 是否已 attach 到原生终端

2. **控制态**
   - controller 是手机还是 Mac
   - 是否允许该端写入

也就是说，不再用 `local / remote` 简单表示一切。

### 9.2 推荐状态

#### 显示层状态

1. `native-terminal-unavailable`
2. `native-terminal-ready`
3. `native-terminal-attached`

#### 控制层状态

1. `controller-mobile`
2. `controller-mac`
3. `switching`
4. `failed`

### 9.3 关键原则

1. 原生终端是否存在，与 controller 不是同一个概念  
2. Mac attach 到原生终端，不等于自动获得控制权  
3. 手机主控时，Mac 仍可 attach 观察  
4. 控制权切换只影响“谁能写入”

---

## 10. 关键实现点

## 10.1 让 tmux 成为主承载

### 当前问题

daemon 现在虽然支持 tmux，但它只是“可选路径”，且拉起的仍然是 `remote` 语义。

### 目标

让 tmux 承载成为：

1. Claude 原生终端的默认宿主  
2. Open in Mac 的主路径  
3. 远端输入注入的目标

### 需要做的事

1. daemon 在成功 tmux spawn 后，把 `tmuxSessionId` 记录到会话 metadata  
2. 所有路径都补齐 carrier 元数据  
3. Claude 进程启动完成后补齐承载信息  
4. Server / App 可读取这些字段

## 10.2 把同步能力从 remote viewer 身上拆出来

### 当前问题

现在 remote 模式承担了两件事：

1. 消费远端消息  
2. 在终端中展示这些消息

而我们实际上只需要第一件，不需要第二件。

### 目标

把“远端消息处理能力”从自绘终端 UI 中抽离出来，变成“输入投递能力”。

### 需要做的事

1. 当会话处于原生 tmux 承载时：
   - 手机端消息不再触发切换到 remote viewer
   - 而是走“投递到 tmux pane”的路径
2. 非 tmux 场景下，不承诺 `Open in Mac` 的正式双端同步能力  
3. 原生 Claude 会继续自己显示一切  
4. Happy 只负责消息同步与桥接

## 10.3 手机消息如何投递到 tmux pane

这是最关键的一步。

### 目标链路

1. 接收到手机端 user message  
2. 解析目标会话 metadata，判断 `terminalCarrier`
3. 如果是 tmux：
   - 拿到 `tmuxSessionId`
   - daemon 调用 tmux 工具把消息注入 pane
4. 如果不是 tmux：
   - 不作为 `Open in Mac` 正式能力处理
   - 必要时给出手动 `claude resume` 的替代指引
5. Claude 在原生终端中接收该消息

### 注意事项

1. 输入注入必须有明确的控制权校验  
2. 需要考虑多行文本与特殊字符转义  
3. 需要避免在 Claude 正等待用户输入之外的状态盲注  
4. 需要在 UI 上明确表现“消息已发送到 Mac 原生终端”

## 10.4 Open in Mac attach 逻辑

### 当前问题

当前 Open in Mac 还是优先走 remote observe 路径。

### 目标

只要 `tmuxSessionId` 存在，就优先：

1. 打开 Terminal  
2. attach 到对应 tmux window  
3. 显示原生 Claude 会话

### 降级策略

1. `tmuxSessionId` 缺失：尝试恢复并重新绑定 tmux  
2. tmux 不可用：直接提示不可用，并引导手动 `claude resume`  
3. 只有在过渡排障场景下，才考虑 remote/fallback

---

## 11. 分阶段落地方案

## 阶段 A：元数据打底

目标：让系统知道“这个会话对应哪个原生终端承载”。

### 任务

1. 扩展 session metadata schema  
2. daemon 成功 tmux spawn 后回传 `tmuxSessionId`  
3. Claude 会话 metadata 写回 server  
4. App 能看到这些字段

### 产出

1. 每个可托管会话都可被唯一定位到某个 tmux 承载  
2. 为 Open in Mac attach 提供可靠锚点

## 阶段 B：Open in Mac 改为 attach 原生终端

目标：把“看原生 Claude”这件事先做实。

### 任务

1. Open in Mac 优先 attach `tmuxSessionId`  
2. 若不满足 tmux 前提，则直接提示不可用并引导手动 `claude resume`  
3. remote/fallback 仅保留为排障兜底

### 产出

1. Mac 端主路径进入原生 Claude 终端  
2. 自绘 viewer 降为真正 fallback

## 阶段 C：原生终端下的远端输入投递

目标：让手机消息进入原生 Claude，不再强制切 remote。

### 任务

1. 抽离消息桥接逻辑  
2. 识别 tmux carrier  
3. 调用 tmux `sendKeys` / `sendMultipleKeys` 注入消息  
4. 保持现有消息同步回传

### 产出

1. 手机发消息时，Mac 原生终端不退出  
2. 双端继续同步

## 阶段 D：控制权与输入门禁收口

目标：把“谁能写入”严格收口到 controller。

### 任务

1. 手机主控时，限制 Mac 写入  
2. Mac 主控时，限制手机写入  
3. 切换中双端临时禁写  
4. 失败回滚

### 产出

1. 原生终端仍在  
2. 但不会发生双端同时写入混乱

---

## 12. 风险与难点

### 12.1 输入注入风险

把手机消息注入 tmux pane 并不等于简单地执行 `send-keys` 就完了，还要注意：

1. Claude 当前是否在可输入状态  
2. 多行输入怎么表达  
3. 特殊字符如何逃逸  
4. 是否会误操作当前焦点中的命令模式

### 12.2 原生终端与控制权的边界

tmux attach 只是显示与交互承载，不天然理解 Happy 的 controller 概念。

因此系统必须额外保证：

1. 控制权是服务端真相源  
2. 本地输入是否允许生效，要经过 Happy 的控制层判断  
3. 不允许用户在观察态下绕过规则变成实际主控

### 12.3 老会话兼容

老会话没有 `tmuxSessionId`：

1. 只能通过 `claudeSessionId` 和目录等线索尝试恢复  
2. 恢复成功后再补写 carrier 元数据  
3. 无法一次性要求所有历史会话都立即具备原生 attach 能力

### 12.4 tmux 依赖

最终方案对 tmux 的依赖会变强，因此要考虑：

1. tmux 是否已安装  
2. 安装失败如何提示  
3. 无 tmux 环境如何清晰提示不可用  
4. 是否未来提供自动探测与引导安装  
5. 如何在提示不可用的同时给出 `claude resume` 手工替代指引

---

## 13. 降级与兼容策略

为了避免在过渡期间阻断主链路，建议保留分层降级：

### 一级：tmux 原生终端

1. 最终主路径  
2. 最符合目标体验

### 二级：remote/fallback

1. 只在无法进入原生承载时使用  
2. 用于排障、临时观察、过渡期兜底  
3. 不再继续投入为最终体验

---

## 14. 用户体验原则

用户不应被迫理解 tmux、carrier、pane 这些底层概念。

理想体验应当是：

1. 用户在 Mac 上完成 tmux 环境准备  
2. 之后系统自动把 Claude 会话托管到原生终端承载  
3. 手机点 `Open in Mac` 时，直接回到原会话  
4. 若未安装 tmux，用户会得到明确提示，而不是进入半成品路径  
5. 如用户有更强诉求，可手动使用 `claude resume`  
6. 切换控制权时，用户只感知“谁现在能输入”

---

## 15. 设计结论

本设计的核心结论如下：

1. **Open in Mac 的最终目标不是做一个更好的 remote viewer，而是回到原生 Claude 终端。**
2. **tmux 是实现“原生 Claude + 可重复 attach + 双端同步”的正式前提。**
3. **没有 tmux 时，`Open in Mac` 不做伪降级，而是明确提示不可用。**
4. **用户若要手动在 Mac 终端接续会话，可使用 `claude resume` 作为高级替代手段。**
5. **当前真正需要改造的是“模式绑定关系”，而不是继续修显示层。**
6. **同步能力必须从 remote viewer 身上拆出来，重新挂到 tmux 原生终端承载上。**
7. **第一步最值得做的基础工作，是把 `tmuxSessionId` 纳入 session metadata 与同步链路。**

一句话总结：

**最终方案应收敛为：tmux 托管原生 Claude 终端，Happy 负责会话绑定、双端同步与控制权切换；无 tmux 时，`Open in Mac` 明确提示不可用，自绘 viewer 仅保留为 fallback。**
