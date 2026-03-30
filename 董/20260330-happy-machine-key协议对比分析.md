# Happy Machine Key 协议对比分析

## 1. 目的

本文只做分析，不做代码决策。

目标是把当前排查到的两套协议语义整理清楚：

- 上游旧协议
- 本地新协议

重点回答四个问题：

- App 发什么
- CLI 存什么
- Server 存什么
- App 解什么

---

## 2. 一句话结论

- 上游旧协议更接近“隐式约定”，字段名与真实语义存在混淆。
- 本地新协议更接近“显式约定”，把 `publicKey` 和 `machineKey` 明确拆开。
- 从本次真实报错现象看，本地新协议更容易解释 brand-new machine 仍然解密失败的问题。
- 但本地新协议与 upstream 当前公开实现存在协议分叉，后续若要回归上游，需要再考虑兼容策略。

---

## 3. 四列表总览

| 环节 | 上游旧协议 | 本地新协议 | 直接影响 |
| - | - | - | - |
| App 发什么 | App 扫码认证时只发 `version + sync.encryption.contentDataKey`，总长度 33 字节；但这个 `contentDataKey` 在上游实现里实际被保存成了 `contentKeyPair.publicKey` | App 扫码认证时发 `version + contentPublicKey + contentDataKey`，总长度 65 字节，显式区分公钥与真实 seed/data key | 上游是“字段名像 data key，实际更像 public key”；本地是“publicKey 和 machineKey 分开发” |
| CLI 存什么 | CLI 收到 v2 响应后，旧逻辑里 `publicKey` 取响应内容，但 `machineKey` 并不稳定，旧实现里甚至可能直接随机生成 | CLI 优先按 65 字节协议解析，明确把 `publicKey` 和 `machineKey` 成对落盘，并写入 `dataKeyVersion: 2` | 上游旧逻辑里凭据关系不稳定；本地新逻辑里凭据是可验证、自洽的 |
| Server 存什么 | Server 基本不理解 key 的内部语义，只是把 CLI 传来的 `dataEncryptionKey` 原样存库并广播 | Server 这一层没有本质变化，仍然只做原样存储与透传 | 协议正确与否，关键不在 Server，而在 App/CLI 两端对 key 语义的约定 |
| App 解什么 | App 用自己的 `contentKeyPair.privateKey` 去解 machine/session 的 `dataEncryptionKey`；如果前面注册阶段材料传错，就会在这里失败 | App 仍然用自己的私钥去解，但由于前面显式区分了 `publicKey` 与 `machineKey`，理论上可以解回正确的 machine data key | 这正对应实际看到的 `Failed to decrypt data encryption key for machine ...` |

---

## 4. 两套协议分别是什么意思

### 4.1 上游旧协议

它更像是这样一套隐含约定：

1. App 内部先 derive 出一个内容相关 key
2. 再用这个 key 推导出 box keypair
3. 但对外暴露时，没有严格区分：
   - 哪个是“真正可用于解密的 seed / private material”
   - 哪个是“由它派生出来的 public key”
4. 扫码认证时，v2 只传一个 33 字节结构：
   - 1 字节版本号
   - 32 字节内容
5. CLI 再自行推测这些字节到底表示什么

这套写法的问题不一定是“完全不能跑”，而是：

- 协议语义不够直白
- 字段名与真实职责容易错位
- 一旦 App/CLI 任一侧对同一字段的理解不同，就容易出现 brand-new machine 也解不出来的情况

### 4.2 本地新协议

本地新协议的核心思想是把角色拆开：

- `machineKey`
  - 表示真实 seed / data key
  - 是后续 machine 记录真正使用的加密材料
- `publicKey`
  - 是根据 `machineKey` 派生出来的公钥
  - 用来封装 `dataEncryptionKey`

扫码认证时，App 不再只发一个“语义不明的 32 字节”，而是显式发出：

- 版本号
- `contentPublicKey`
- `contentDataKey`

CLI 收到后也不再猜，而是按固定结构落盘。

这套协议的优点是：

- 字段职责更清楚
- 可以直接校验 `publicKey` 是否真的是由 `machineKey` 派生得到
- 更容易解释和定位链路上的问题

---

## 5. 真实链路拆解

### 5.1 App 端生成与保存

当前本地 App 的关键逻辑是：

1. 先 derive 出 `contentDataKey`
2. 再基于它生成 `contentKeyPair`
3. 内部保存时，保留真实的 `contentDataKey`
4. 不再把 `contentDataKey` 覆盖成 `contentKeyPair.publicKey`

这样做的意义是：

- App 内部保留了真正可用于后续解密的 seed/data key
- public key 只作为派生结果存在，不再和原始 key 混成一个字段

### 5.2 App 扫码认证回传

当前本地协议里，App 扫码批准终端时，会回传两份材料：

- 一个显式 public key
- 一个显式 machine key

而不是只回传一个“你自己猜它是什么”的 32 字节值。

### 5.3 CLI 持久化

当前本地 CLI 收到响应后：

- 如果 payload 是新格式，就显式解析 `publicKey + machineKey`
- 再写入 `access.key`
- 并标记 `dataKeyVersion: 2`

这一步的意义是：

- 以后读凭据时，不需要再靠启发式猜测
- 可以把老格式迁移与新格式直接区分开

### 5.4 CLI 注册 machine

当前本地 CLI 注册 machine 时：

- `machineKey` 作为 machine 的真实加密 key
- `publicKey` 用来加密包裹 `machineKey`
- 包裹后的结果作为 `dataEncryptionKey` 发给服务端

也就是说：

- Server 存的是“加密后的 machine key”
- App 日后是要用自己对应的私钥/seed把它解回来

### 5.5 Server 存储与广播

Server 在这条链路里基本不做语义判断：

- 收到 `dataEncryptionKey`
- 存数据库
- 广播给客户端

所以真正的协议一致性，主要取决于：

- App 发送时的含义
- CLI 接收与注册时的含义
- App 之后解密时的含义

---

## 6. 为什么这次问题更像协议语义错位

这次现象不是只有旧数据解不出来，而是：

- 重新 auth 后
- 新生成的 machine ID
- 依然出现 machine data key 解密失败

这很关键，因为它说明问题不像是单纯“数据库里残留了几条坏记录”。

如果 brand-new machine 也失败，更像下面这种问题：

- App 回传给 CLI 的材料本身就不对
- 或者 App 与 CLI 对同一份材料的理解不同
- 或者 CLI 写盘时把两种 key 的关系破坏了

从这个角度看，本地新协议比上游旧协议更能解释现象。

---

## 7. 为什么不能简单以 upstream 为准

虽然上游当前公开仓库的实现更接近旧协议，但这不代表它就是当前问题的标准答案。

原因有两点：

### 7.1 上游 App 侧字段语义本身就有混淆

上游当前实现里，`contentDataKey` 最终保存成的是 `contentKeyPair.publicKey`。

这意味着：

- 字段名叫 data key
- 但里面装的是 public key

这会显著增加协议理解成本，也给 App/CLI 两端的语义漂移留下空间。

### 7.2 上游 CLI 侧旧逻辑也不够稳

上游公开实现中，v2 auth 响应的处理逻辑里还能看到：

- `publicKey` 取自响应
- `machineKey` 却可能直接随机生成

这说明上游当前公开仓库这条链路本身就还带有历史实现痕迹，不能直接当作“绝对正确的基准协议”。

---

## 8. 风险与取舍

### 8.1 继续沿本地新协议走

优点：

- 语义清楚
- 更容易验证 `publicKey` 与 `machineKey` 是否匹配
- 更能解释当前 brand-new machine 仍失败的问题

风险：

- 与 upstream 形成协议分叉
- 后续若想回并上游，需要再设计兼容策略

### 8.2 回退到上游旧协议

优点：

- 更贴近 upstream 当前公开实现
- 本地改动面可能更小

风险：

- 可能回到旧问题语义中
- 无法自然解释这次 brand-new machine 仍然失败
- 继续保留“字段名与真实职责不一致”的隐患

---

## 9. 当前判断

基于目前证据，更合理的判断是：

- 这次问题更像是 machine key 协议语义没有完全对齐
- 而不是简单的旧数据残留
- 也不是因为“没有照抄 upstream”才出问题

因此，在没有更多反证之前：

- 不建议仅仅因为 upstream 当前实现更像旧协议，就直接回退
- 更建议继续围绕“显式区分 publicKey / machineKey”的方向理解和验证整条链路

---

## 10. 关键代码位置

### 10.1 本地新协议关键点

- App 保留真实 `contentDataKey`
  - `packages/happy-app/sources/sync/encryption/encryption.ts`
- App 显式回传 `contentPublicKey + contentDataKey`
  - `packages/happy-app/sources/hooks/useConnectTerminal.ts`
- CLI 显式解析 `publicKey + machineKey`
  - `packages/happy-cli/src/ui/auth.ts`
- CLI 以版本化格式落盘
  - `packages/happy-cli/src/persistence.ts`
- CLI 用 `machineKey` 注册 machine
  - `packages/happy-cli/src/api/api.ts`
- Server 原样存储 `dataEncryptionKey`
  - `packages/happy-server/sources/app/api/routes/machinesRoutes.ts`

### 10.2 本地代码参考

- App encryption 创建与保存逻辑： [encryption.ts#L14-L45](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app/sources/sync/encryption/encryption.ts#L14-L45)
- App 扫码认证回传逻辑： [useConnectTerminal.ts#L30-L60](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app/sources/hooks/useConnectTerminal.ts#L30-L60)
- CLI 解析认证响应： [auth.ts#L172-L214](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-cli/src/ui/auth.ts#L172-L214)
- CLI 凭据读取与落盘： [persistence.ts#L447-L535](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-cli/src/persistence.ts#L447-L535)
- CLI 注册 machine： [api.ts#L188-L242](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-cli/src/api/api.ts#L188-L242)
- Server 存储 machine： [machinesRoutes.ts#L21-L106](file:///Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-server/sources/app/api/routes/machinesRoutes.ts#L21-L106)

---

## 11. 最终摘要

如果只问一句“上游旧协议和本地新协议的本质区别是什么”，可以概括成：

- 上游旧协议：把关键语义藏在隐式约定里
- 本地新协议：把关键语义拆成显式字段

如果只问一句“当前更应该优先信哪种解释”，现阶段更像是：

- 本地新协议更符合这次 brand-new machine 解密失败的现象
- upstream 当前公开实现不能直接视为这条链路的最终正确答案
