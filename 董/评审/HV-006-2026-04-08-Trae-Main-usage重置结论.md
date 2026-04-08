# HV-006 2026-04-08 Trae-Main usage 重置结论

## 1. 本轮结论

- `HV-006-TRAE-MAIN-03` 已按边界完成
- 本轮已把“usage reset”收口为可复用的最小运维能力
- 最终承接方式明确为“标准 admin-only reset 接口 + 最小内部脚本入口”

## 2. 已收口的能力

- 可按 `accountId` 对指定账号执行 reset
- 可按 `username` 对指定账号执行 reset
- 可支持 `daily`、`monthly`、`all` 三种 scope
- 可返回 reset 结果中的：
  - `scope`
  - `clearedUsageRows`
  - `clearedDates`
  - `clearedTokens`
  - `clearedRequests`

## 3. 鉴权边界与适用场景

- 网络入口继续沿用 `ADMIN_TOKEN`
- 继续支持 `x-admin-token` 与 `Authorization: Bearer <ADMIN_TOKEN>`
- 适用场景是内部测试联调、排障清场和账号运维
- 不面向普通用户开放

## 4. 本轮意义

- 内部已可先查询指定账号当前 quota / subscription
- 内部已可再执行 usage reset
- 内部已可再复用查询能力确认 reset 是否生效
- 第四张单若继续做内部管理页，可以直接复用前三张单已经形成的提档、查询、reset 基线

## 5. 范围合规性

- 未混入内部管理页
- 未混入完整后台
- 未混入支付闭环
- 未混入复杂权限体系

## 6. 本轮影响范围

- 本轮实际清理的是 `DailyUsage`
- 本轮不修改 `SubscriptionPlan`
- 本轮不处理 `UsageReport` 历史统计口径

## 7. 当前仍留给后续的内容

- 内部管理页承接
- 如后续需要更完整报表一致性，再评估是否补 `UsageReport` 同步清理
- 更完整的订阅状态解释与支付事实源统一

## 8. 当前阻塞判断

- 无代码级阻塞
- 当前 reset 能力已可安全交付
- 目标环境若未配置 `ADMIN_TOKEN`，网络 reset 入口仍不可直接使用，但本地脚本入口可继续承接
