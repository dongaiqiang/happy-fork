# HV-006 2026-04-08 Trae-Main 管理员查询 quota 与 subscription 工作日志

## 1. 开工前已读取的输入

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/CLAUDE.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/.trae/rules/project_rules.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/hellovibe-worktree-guide.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/hellovibe-总管派单模板.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/工单中心/HV-006-额度运维能力与内部管理页-主工单卡.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/HV-006-2026-04-08-Trae-Main-账号提档能力收口正式派单.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/需求清单/20260408-需求草案-额度运维能力与内部管理页.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/20260406-HelloVibe-配额与订阅机制说明.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/执行记录/HV-006-2026-04-08-Trae-Main-账号提档能力收口派单回报.md`

## 2. 本轮范围判断

- 本轮只处理“管理员查询 quota / subscription”
- 继续沿用第一张单已经收口的 `/admin/upgrade` + `admin:upgrade` 基线
- 不新增 usage reset
- 不新增内部管理页
- 不扩写成完整后台、支付闭环或复杂权限系统

## 3. 现状核查结论

- 现有 `/quota` 只支持当前登录账号，不支持内部按 `accountId` 或 `username` 查询指定账号
- 第一张单已经把账号提档收成“标准网络入口 + 最小脚本入口”
- 第二张单最合理的收口方式仍然是同样模式：补标准 admin-only 查询接口，再补最小内部脚本入口

## 4. 本轮最终采用的查询承接方式

- 标准网络入口：`GET /admin/account-quota`
- 最小内部脚本入口：`yarn workspace happy-server admin:account-quota -- --account-id <id>` 或 `--username <name>`

## 5. 具体实现

### 5.1 新增共享查询逻辑

- 新增 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/quota/adminAccountQuota.ts`
- 统一处理以下动作：
  - 按 `accountId` 或 `username` 定位账号
  - 读取当前 `SubscriptionPlan`
  - 复用 `getUserQuota` 计算 daily / monthly usage 与 remaining
  - 统一返回 `account`、`subscription`、`quota`

### 5.2 补出 admin-only 网络查询入口

- 修改 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/quotaRoutes.ts`
- 新增 `GET /admin/account-quota`
- 输入为 querystring：
  - `accountId?`
  - `username?`
- 鉴权边界继续沿用 `ADMIN_TOKEN`
- 继续支持：
  - `x-admin-token`
  - `Authorization: Bearer <ADMIN_TOKEN>`
- 错误口径：
  - `503 admin_token_not_configured`
  - `401 invalid_admin_token`
  - `404 account_not_found`

### 5.3 补出最小内部脚本入口

- 新增 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/adminAccountQuota.ts`
- 修改 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/package.json`
- 正式命令：
  - `yarn workspace happy-server admin:account-quota -- --account-id <id>`
  - `yarn workspace happy-server admin:account-quota -- --username <name>`

### 5.4 测试补齐

- 修改 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server/sources/app/api/routes/quotaRoutes.test.ts`
- 新增覆盖：
  - `ADMIN_TOKEN` 未配置返回 `503`
  - token 缺失返回 `401`
  - 按 `username` 查询 free 账号
  - 按 `accountId` 查询付费账号
  - 账号不存在返回 `404`

## 6. 本轮形成的最小运维能力

- 内部现在已可在提档前先查询指定账号的当前 subscription 状态
- 内部现在已可在 usage reset 前先查询指定账号的 daily / monthly 已用量与剩余额度
- 后续第三张单如果继续做 usage reset，可以直接复用本轮的账号定位与状态快照基线

## 7. 本轮未处理内容

- 未新增 `POST /admin/quota/reset-usage`
- 未新增内部管理页
- 未处理支付闭环
- 未统一订阅事实源
