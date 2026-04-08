# HV-006 2026-04-08 Trae-Main usage 重置工作日志

## 1. 开工前已读取的输入

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/CLAUDE.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/.trae/rules/project_rules.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/hellovibe-worktree-guide.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/hellovibe-总管派单模板.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/工单中心/HV-006-额度运维能力与内部管理页-主工单卡.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/HV-006-2026-04-08-Trae-Main-账号提档能力收口正式派单.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/HV-006-2026-04-08-Trae-Main-管理员查询quota与subscription正式派单.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/需求清单/20260408-需求草案-额度运维能力与内部管理页.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/20260406-HelloVibe-配额与订阅机制说明.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/执行记录/HV-006-2026-04-08-Trae-Main-账号提档能力收口派单回报.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/执行记录/HV-006-2026-04-08-Trae-Main-管理员查询quota与subscription派单回报.md`

## 2. 本轮范围判断

- 本轮只处理 `usage reset`
- 继续沿用前两张单已经收口的 `/admin/upgrade + admin:upgrade` 与 `/admin/account-quota + admin:account-quota`
- 不新增内部管理页
- 不扩写成完整后台、支付闭环、订阅事实源统一或复杂权限系统

## 3. 现状核查结论

- 账号提档与账号查询两条基线已经具备
- 当前缺口已经不再是“怎么看账号状态”，而是“看清状态之后如何安全重置 usage”
- quota 判定与查询事实当前都直接依赖 `DailyUsage`
- 因此第三张单最合理的收口方式仍然是“共享 reset 逻辑 + admin-only 接口 + 最小内部脚本入口”

## 4. 本轮最终采用的 reset 承接方式

- 标准网络入口：`POST /admin/quota/reset-usage`
- 最小内部脚本入口：`yarn workspace happy-server admin:reset-usage -- --account-id <id> --scope <daily|monthly|all>`
- 复核方式：继续沿用 `yarn workspace happy-server admin:account-quota -- ...` 在 reset 前后做状态对照

## 5. 具体实现

### 5.1 新增共享 reset 逻辑

- 新增 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/quota/adminResetUsage.ts`
- 统一处理以下动作：
  - 按 `accountId` 或 `username` 定位账号
  - 支持 `daily / monthly / all` 三种 scope
  - 按 scope 删除目标账号命中的 `DailyUsage`
  - 返回 `clearedUsageRows`、`clearedDates`、`clearedTokens`、`clearedRequests`

### 5.2 补出 admin-only 网络 reset 入口

- 修改 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/quotaRoutes.ts`
- 新增 `POST /admin/quota/reset-usage`
- 输入 body：
  - `accountId?`
  - `username?`
  - `scope: daily | monthly | all`
- 鉴权边界继续沿用 `ADMIN_TOKEN`
- 继续支持：
  - `x-admin-token`
  - `Authorization: Bearer <ADMIN_TOKEN>`
- 错误口径：
  - `503 admin_token_not_configured`
  - `401 invalid_admin_token`
  - `404 account_not_found`

### 5.3 补出最小内部脚本入口

- 新增 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/adminResetUsage.ts`
- 修改 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/package.json`
- 正式命令：
  - `yarn workspace happy-server admin:reset-usage -- --account-id <id> --scope daily`
  - `yarn workspace happy-server admin:reset-usage -- --username <name> --scope monthly`
  - `yarn workspace happy-server admin:reset-usage -- --account-id <id> --scope all`

### 5.4 测试补齐

- 修改 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/quotaRoutes.test.ts`
- 新增 `/admin/quota/reset-usage` 覆盖：
  - `ADMIN_TOKEN` 未配置返回 `503`
  - token 缺失返回 `401`
  - `daily` 只清当天 usage
  - `monthly` 只清当月 usage
  - `all` 清该账号全部 usage
  - 账号不存在返回 `404`

## 6. 本轮形成的最小闭环

- 内部现在已可先用 `admin:account-quota` 或 `GET /admin/account-quota` 查询指定账号状态
- 再用 `admin:reset-usage` 或 `POST /admin/quota/reset-usage` 执行 usage reset
- 再次复用查询基线验证 `dailyUsed`、`monthlyUsed`、`dailyRemaining`、`monthlyRemaining` 是否符合预期

## 7. reset 影响范围与本轮明确不处理项

- 本轮实际影响的数据表是 `DailyUsage`
- `daily` 只清当天记录
- `monthly` 清当前自然月内的记录
- `all` 清该账号全部 `DailyUsage`
- 本轮不修改 `SubscriptionPlan`
- 本轮不新增内部管理页
- 本轮不处理 `UsageReport` 历史汇总口径；当前 quota 门禁与查询事实仍以 `DailyUsage` 为准

## 8. 本轮未处理内容

- 未新增内部管理页
- 未处理支付闭环
- 未统一订阅事实源
- 未处理复杂权限体系
