# 20260331 Open in Mac：原生 Claude 终端与 tmux 托管决策版摘要

## 1. 结论先行

当前已经明确：

- `Open in Mac` 的最终目标不是继续优化自绘 remote viewer
- 最终目标应收敛为：**原生 Claude 终端 + tmux 托管 + Happy 控制层**
- `Open in Mac` 作为正式产品能力，以 tmux 为前提
- Mac 端必须看到原生 Claude 终端
- 信息必须准确显示，不能依赖 Happy 自己重绘后展示
- 手机端与 Mac 端必须保持同一会话同步

一句话总结：

**最终方案不是“让 Happy 更会渲染终端”，而是“让 Happy 接管控制与同步，让 Claude 继续负责原生终端显示”。**

---

## 2. 为什么不能继续走 remote viewer

当前 remote viewer 路线已经验证出几个根本问题：

- Mac 端看到的不是 Claude 原生终端
- markdown、tool block、长文本、滚动体验很难真正还原
- 即使继续优化，也只能越来越像“日志窗口”
- 一旦继续往这条路上投入，维护成本会不断增加

所以：

- remote viewer 可以保留为 fallback
- 但不应再作为主产品方向

---

## 3. 当前最核心的架构矛盾

现有实现里：

- `local` = 原生 Claude 终端
- `remote` = 双端同步能力

这带来一个根本冲突：

- 想要原生 Claude，就容易失去手机端远程输入能力
- 想要双端同步与远端输入，就容易退回 remote viewer

也就是说，当前系统把：

- **原生终端**
- **双端同步**

错误地绑成了两个互斥能力。

而用户真正要的是：

- **原生终端**
- **双端同步**
- **同一会话**
- **显式控制切换**

四件事同时成立。

---

## 4. tmux 在方案中的角色

tmux 不是用户界面，而是底层托管设施。

它在本方案里承担四个作用：

- 托管原生 Claude 会话
- 提供可重复 attach 的能力
- 把 Terminal 窗口生命周期和 Claude 会话生命周期解耦
- 为手机端输入注入提供稳定承载点

如果没有 tmux：

- Claude 原生终端很难稳定重连
- Open in Mac 很难回到同一个现场
- 手机消息也很难进入正在运行的原生 Claude 终端

因此当前判断应修正为：

- **tmux 是 `Open in Mac` 的正式承载前提**
- **没有安装 tmux 时，`Open in Mac` 应明确提示不可用**
- **这时不再把 direct 原生终端包装成正式双端同步能力**
- **如果用户只是想继续在 Mac 终端里看会话，可手动执行 `claude resume`**

---

## 5. 最终方案长什么样

理想形态如下：

### 新建会话

- 手机端创建 Happy session
- 若检测到 tmux，则在 tmux window 中托管原生 Claude
- 若未检测到 tmux，会话仍可继续在手机端使用
- Claude 会话继续通过 Happy 同步消息到手机端

### Open in Mac

- 手机点击 `Open in Mac`
- 系统不再把 remote viewer 作为主路径
- 若已有 `tmuxSessionId`，则直接打开 Terminal 并 attach 到对应 tmux window
- 若机器未安装 tmux，或当前会话没有 tmux 托管信息，则 `Open in Mac` 明确提示不可用
- 提示里应直接告诉用户：如需在 Mac 终端里继续查看/接续该会话，可手动执行 `claude resume`
- Mac 端正式产品目标仍然是看到原生 Claude 终端
- 这个正式能力只在 tmux 前提成立时提供

### 双端同步

- Mac 本地输入，手机端同步可见
- 手机端输入，优先投递到 tmux 托管的原生 Claude 会话
- 无 tmux 时，不承诺 `Open in Mac` 下的双端同步能力
- agent 回复继续同步回双端

### 控制权

- 默认手机主控，Mac 可观察
- 显式切到 Mac 后，Mac 成为主输入端
- 显式切回手机后，手机恢复主控
- 同一时刻只允许一端写入

---

## 6. 现在最值得做的第一步

当前最值得做的不是继续修 UI，而是补底层锚点：

- 把 `terminalCarrier` 与 `tmuxSessionId` 纳入 session metadata 与同步链路

原因：

- daemon 内部已经知道部分会话挂在哪个 tmux window
- 但 App / Server / Session 元数据目前还拿不到这个信息
- 如果没有这个锚点，就无法稳定做到：
  - tmux 场景下 attach 回原会话
  - tmux 场景下手机消息投递到正确 pane
  - 生命周期治理
- 如果没有 `terminalCarrier`，系统也无法正确区分当前是否满足 `Open in Mac` 的 tmux 前提

所以第一阶段的正确方向是：

- 先让系统“知道原生 Claude 会话挂在哪里”
- 再让系统“回得去、投得进、控得住”

---

## 7. 实施优先级

### 优先级 1

- `terminalCarrier` / `carrierMode` 进入 metadata
- `tmuxSessionId` 在 tmux 场景下进入 metadata
- Open in Mac 优先 attach tmux 承载
- 无 tmux 时明确提示不可用，并引导用户手动使用 `claude resume`

### 优先级 2

- 手机端消息在 tmux 场景下注入 tmux pane
- 不再触发 local → remote 切换

### 优先级 3

- 控制权与输入门禁完全收口
- 明确观察态 / 控制态规则

### 明确不再优先做

- 继续打磨 `RemoteModeDisplay`
- 继续打磨 `messageFormatterInk`
- 继续把自绘 viewer 当最终形态

---

## 8. 风险提醒

这条方案最大的风险不在显示，而在输入注入与控制边界：

- 手机消息如何可靠注入 tmux pane
- 多行文本与特殊字符如何处理
- Claude 当前不在等待输入时如何避免误注入
- 观察态下如何防止 Mac 端绕过控制规则

但这些风险都属于“正确方向上的工程问题”，
而不是“方向本身错误”。

---

## 9. 最终判断

当前应正式拍板：

- **主方向：原生 Claude 终端 + tmux 托管 + Happy 控制层**
- **`Open in Mac` 以 tmux 为正式前提**
- **无 tmux 时，功能明确提示不可用，不做伪降级**
- **用户若要自行在 Mac 终端接续会话，可手动使用 `claude resume`**
- **过渡方案：remote viewer 仅作 fallback**
- **第一阶段重点：carrier 元数据打底，并在 tmux 场景补齐 `tmuxSessionId`**

一句话结论：

**Open in Mac 后续不该继续做“更像终端的 viewer”，而要做“真正回到原生 Claude 终端”。**
