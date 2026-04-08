# HV-006 2026-04-08 Trae-Main 管理员查询 quota 与 subscription 验证结果

## 1. 验证目标

- 证明指定账号可按 `accountId` 或 `username` 被管理员查询到
- 证明返回结果包含 subscription 与 quota 关键字段
- 证明查询结果与数据库实际状态一致

## 2. 自动化验证

### 2.1 路由测试

执行命令：

```bash
yarn workspace happy-server test sources/app/api/routes/quotaRoutes.test.ts
```

结果：

- 通过
- `11` 条测试全部通过
- 其中新增 `/admin/account-quota` 相关测试 `5` 条全部通过

### 2.2 构建验证

执行命令：

```bash
yarn workspace happy-server build
```

结果：

- 通过
- `prisma generate` 与 `tsc --noEmit` 正常完成

## 3. 真实链路验证

### 3.1 验证方式

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server` 下插入临时账号 `hv006-trae-main-02-account`
- 写入两条 `DailyUsage`
  - `2026-04-01`：`1200`
  - `2026-04-08`：`3200`
- 通过第一张单已有脚本将该账号提到 `pro`
- 再通过本轮新增脚本查询 quota / subscription
- 最后用 SQL 对照 `SubscriptionPlan` 与 `DailyUsage`
- 验证后清理临时账号、订阅与 usage 数据

### 3.2 实际命令

```bash
npx dotenv -e .env -e .env.dev -- sh -lc 'set -e; cleanup(){ psql "$DATABASE_URL" -c "delete from \"DailyUsage\" where \"accountId\"='\''hv006-trae-main-02-account'\'';" >/dev/null; psql "$DATABASE_URL" -c "delete from \"SubscriptionPlan\" where \"accountId\"='\''hv006-trae-main-02-account'\'';" >/dev/null; psql "$DATABASE_URL" -c "delete from \"Account\" where id='\''hv006-trae-main-02-account'\'';" >/dev/null; }; trap cleanup EXIT; psql "$DATABASE_URL" -c "insert into \"Account\" (id, \"publicKey\", seq, \"feedSeq\", \"createdAt\", \"updatedAt\") values ('\''hv006-trae-main-02-account'\'', '\''hv006-trae-main-02-account-pk'\'', 0, 0, now(), now());"; psql "$DATABASE_URL" -c "insert into \"DailyUsage\" (id, \"accountId\", date, \"tokensUsed\", requests, \"createdAt\", \"updatedAt\") values ('\''hv006-trae-main-02-daily-1'\'', '\''hv006-trae-main-02-account'\'', '\''2026-04-01'\'', 1200, 2, now(), now()), ('\''hv006-trae-main-02-daily-2'\'', '\''hv006-trae-main-02-account'\'', '\''2026-04-08'\'', 3200, 5, now(), now());"; yarn admin:upgrade --account-id hv006-trae-main-02-account --tier pro --billing-period annual; yarn admin:account-quota --account-id hv006-trae-main-02-account; psql "$DATABASE_URL" -c "select tier, status, \"dailyLimit\", \"tokensLimit\", \"endDate\" from \"SubscriptionPlan\" where \"accountId\"='\''hv006-trae-main-02-account'\''; select date, \"tokensUsed\", requests from \"DailyUsage\" where \"accountId\"='\''hv006-trae-main-02-account'\'' order by date;"'
```

### 3.3 查询脚本返回结果

```json
{
  "success": true,
  "account": {
    "id": "hv006-trae-main-02-account",
    "username": null
  },
  "subscription": {
    "tier": "pro",
    "status": "active",
    "startDate": "2026-04-08T08:16:03.316Z",
    "endDate": "2027-04-08T08:16:03.316Z",
    "features": {
      "dailyLimit": 100000,
      "monthlyLimit": 2000000,
      "rateLimit": 100,
      "storageLimit": "21474836480"
    }
  },
  "quota": {
    "tier": "pro",
    "dailyLimit": 100000,
    "dailyUsed": 3200,
    "dailyRemaining": 96800,
    "monthlyLimit": 2000000,
    "monthlyUsed": 4400,
    "monthlyRemaining": 1995600,
    "rateLimit": 100,
    "storageLimit": "21474836480"
  }
}
```

### 3.4 数据库对照结果

`SubscriptionPlan`：

```text
tier=pro
status=active
dailyLimit=100000
tokensLimit=2000000
endDate=2027-04-08 08:16:03.316
```

`DailyUsage`：

```text
2026-04-01 -> tokensUsed=1200, requests=2
2026-04-08 -> tokensUsed=3200, requests=5
```

### 3.5 对照结论

- 查询脚本返回的 `subscription.tier/status/endDate` 与 `SubscriptionPlan` 一致
- 查询脚本返回的 `quota.dailyUsed=3200` 与当天 `DailyUsage` 一致
- 查询脚本返回的 `quota.monthlyUsed=4400` 等于当月两条 usage 汇总
- 查询脚本返回的 `quota.dailyRemaining=96800` 与 `100000 - 3200` 一致
- 查询脚本返回的 `quota.monthlyRemaining=1995600` 与 `2000000 - 4400` 一致

## 4. 验证结论

- 本轮“管理员查询 quota / subscription”已形成真实可用的查询链路
- 指定账号现在可被稳定查询到
- 查询结果已覆盖后续 usage reset 和提档前判断所需的关键字段
