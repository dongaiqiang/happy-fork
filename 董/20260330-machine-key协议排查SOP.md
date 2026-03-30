# 20260330 Machine Key 协议排查 SOP

这份 SOP 用于按“本地新协议优先、不立即回退 upstream 旧协议”的思路，做一次最小闭环排查。

目标不是一次性修所有问题，而是把问题精确缩到下面三段中的某一段：

- App 发出的认证材料是否正确
- CLI 落盘到 `access.key` 的材料是否正确
- Server 存储的 `dataEncryptionKey` 是否与 App 解密预期一致

---

## 1. 执行原则

- 本轮先不回退到 upstream 旧协议
- 本轮只验证 machine 这条链路
- 本轮尽量使用 brand-new machine 做验证
- 一旦复现错误，不要继续做额外清理动作，优先保留现场抓数据

---

## 2. 这轮要验证什么

验证以下问题是否成立：

1. 手机 App 扫码 auth 时，是否真的发出了当前本地新协议要求的材料
2. CLI 收到 auth 响应后，是否把 `publicKey` 和 `machineKey` 正确写进了 `access.key`
3. CLI 注册 machine 时，是否用正确的 `machineKey/publicKey` 生成了 `dataEncryptionKey`
4. App 后续拉到 machine 后，是否能用自己的私钥/seed 正确解出 machine data key

---

## 3. 成功标准

如果本轮验证成功，应满足：

- `auth login --force` 成功
- `access.key` 中存在 `dataKeyVersion: 2`
- `access.key` 中的 `publicKey` 与 `machineKey` 自洽
- 启动 daemon 后，手机 App 不再出现 `Failed to decrypt data encryption key for machine ...`

---

## 4. Step 1：准备最小环境

### 4.1 目标

确保这次验证尽量只受“全新 auth + 全新 machine”影响，不被旧残留干扰。

### 4.2 操作原则

- 不需要在这一步做更大范围的协议改动
- 可以保留当前本地代码
- 尽量不要把 session 问题、坏 session 清理、其他功能问题混进来

### 4.3 执行方式

按你现有的稳定分屏/重启流程启动：

- 后端
- Metro / App
- auth pane

如果需要，继续用已有脚本：

- [20260329-全链路重启-Ghostty三分屏前半段脚本.sh](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/测试脚本/20260329-全链路重启-Ghostty三分屏前半段脚本.sh)

---

## 5. Step 2：手机 App 更新到当前代码

### 5.1 目标

确保手机端实际运行的是包含“本地新协议”逻辑的前端代码。

### 5.2 检查点

- 手机 App 已重新加载当前 Metro 包
- 进入主界面
- 不在这一阶段主动注销账户，除非 App 本身已无法正常进入

### 5.3 说明

本轮关键不是“把账户洗干净”，而是确认手机端实际运行的就是当前代码。

---

## 6. Step 3：执行全新 auth

### 6.1 目标

强制生成一套新的 CLI 凭据与新的 machine 绑定材料。

### 6.2 命令

```bash
cd /Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main
export HAPPY_SERVER_URL=http://192.168.10.114:3005
export HAPPY_HOME_DIR=$HOME/.happy-rebind-20260327
yarn cli auth login --force
```

### 6.3 执行要求

- 选择 Mobile
- 用手机 App 扫设置页里的授权二维码
- 等待终端出现认证成功信息

### 6.4 成功后立即检查

查看：

```bash
cat /Users/dongaiqiang/.happy-rebind-20260327/access.key
```

最低要求：

- 有 `dataKeyVersion: 2`
- 有 `encryption.publicKey`
- 有 `encryption.machineKey`
- 有 `token`

---

## 7. Step 4：核对 access.key 自洽性

### 7.1 目标

确认 CLI 落盘后的 `publicKey` 与 `machineKey` 不是“表面存在、实际不匹配”。

### 7.2 验证方法

用已有结论判断：

- `machineKey` 必须能按当前 CLI 规则派生出 `publicKey`

### 7.3 结论方式

- 若自洽：说明 auth 响应解析和落盘大概率是对的
- 若不自洽：问题优先落在 CLI auth 解析或持久化阶段

---

## 8. Step 5：启动 daemon，制造 brand-new machine 闭环

### 8.1 目标

让全新 machine 注册一次，并观察 App 是否还能报 machine decrypt 错误。

### 8.2 命令

```bash
cd /Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main
export HAPPY_SERVER_URL=http://192.168.10.114:3005
export HAPPY_HOME_DIR=$HOME/.happy-rebind-20260327
yarn cli daemon start-sync
```

### 8.3 观察点

- CLI/daemon 是否正常启动
- 手机 App 是否出现：

```text
Failed to decrypt data encryption key for machine ...
Machine encryption not found ...
```

---

## 9. Step 6：若复现错误，立即保留现场并抓三段数据

这一步最关键。

一旦错误复现，不要继续做下面这些事：

- 不要再次 auth
- 不要再次清空目录
- 不要继续切换账户
- 不要马上删服务器数据

优先抓三段数据。

### 9.1 第一段：App 发出的 auth 材料

目标：

- 确认这次扫码 auth 发出的到底是不是当前本地新协议定义的内容

重点核对：

- 是否显式包含 `publicKey`
- 是否显式包含 `machineKey`
- 二者是否对应同一套 seed/keypair 关系

### 9.2 第二段：CLI 落盘材料

查看：

```bash
cat /Users/dongaiqiang/.happy-rebind-20260327/access.key
```

重点核对：

- `dataKeyVersion`
- `encryption.publicKey`
- `encryption.machineKey`

### 9.3 第三段：Server 上 machine 记录

目标：

- 确认 Server 存到数据库里的 `dataEncryptionKey` 是否确实来自这次 brand-new machine 注册

重点核对：

- 这条 machine 记录的 ID
- `dataEncryptionKey`
- 是否与当前这次 auth/daemon 启动时间对应

---

## 10. Step 7：如何判断问题落点

### 情况 A：App 发出值就不对

说明问题在：

- App auth 载荷构造
- 或 App 内部 `contentDataKey/publicKey` 语义仍有错位

### 情况 B：App 发出值对，但 CLI 落盘值错

说明问题在：

- CLI auth 响应解析
- 或 CLI persistence/migration

### 情况 C：CLI 落盘值对，但 Server 上存入值错

说明问题在：

- `getOrCreateMachine`
- 或 machine 注册时的 `dataEncryptionKey` 封装过程

### 情况 D：Server 存入值对，但 App 仍解不开

说明问题在：

- App 侧 machine key 解密逻辑
- 或 App 持有的私钥/seed 与 auth 返回材料不一致

---

## 11. 当前执行策略

本轮建议按这个顺序推进：

1. 保持本地新协议方向，不回退
2. 用全新 auth + 全新 machine 做一次最小闭环
3. 若失败，优先抓三段数据
4. 用三段数据反推具体落点
5. 只有在新协议验证不通时，再讨论：
   - 是补实现
   - 还是做旧协议兼容
   - 而不是直接整体回退

---

## 12. 相关文档

- 详细分析： [20260330-happy-machine-key协议对比分析.md](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/20260330-happy-machine-key协议对比分析.md)
- 决策摘要： [20260330-happy-machine-key协议对比-决策版摘要.md](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/20260330-happy-machine-key协议对比-决策版摘要.md)
