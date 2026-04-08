# HV-006 2026-04-08 Trae-Main 管理员查询 quota 与 subscription 结论

## 1. 本轮结论

- `HV-006-TRAE-MAIN-02` 已按边界完成
- 本轮已把“管理员查询 quota / subscription”收口为可复用的最小能力
- 最终承接方式明确为“标准 admin-only 查询接口 + 最小内部脚本入口”

## 2. 已收口的能力

- 可按 `accountId` 查询指定账号
- 可按 `username` 查询指定账号
- 可返回当前 subscription 的：
  - `tier`
  - `status`
  - `startDate`
  - `endDate`
- 可返回当前 quota 的：
  - `dailyLimit`
  - `dailyUsed`
  - `dailyRemaining`
  - `monthlyLimit`
  - `monthlyUsed`
  - `monthlyRemaining`
  - `rateLimit`
  - `storageLimit`

## 3. 本轮意义

- 提档前已可先看清目标账号当前状态
- usage reset 前已可先看清当前 daily / monthly usage 现状
- 第三张单可直接在本轮查询基线上继续做 usage reset，而不需要继续依赖临时 SQL 和口头判断

## 4. 范围合规性

- 未混入 usage reset
- 未混入内部管理页
- 未混入完整后台
- 未混入支付闭环与订阅事实源统一

## 5. 当前仍留给后续的内容

- `POST /admin/quota/reset-usage`
- 内部管理页承接
- 更完整的订阅状态解释与支付事实源统一

## 6. 当前阻塞判断

- 无代码级阻塞
- 当前查询能力已可安全交付
- 后续若要走网络查询入口，目标环境仍需要正确配置 `ADMIN_TOKEN`
