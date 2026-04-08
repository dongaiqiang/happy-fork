# HV-006 2026-04-08 Trae-Main usage 重置验证结果

## 1. 验证目标

- 证明指定账号可按 `accountId` 或 `username` 被执行 usage reset
- 证明 `daily / monthly / all` 三种 scope 都有明确行为
- 证明 reset 前后可用查询结果与数据库事实复核

## 2. 自动化验证

### 2.1 路由测试

执行命令：

```bash
yarn workspace happy-server test sources/app/api/routes/quotaRoutes.test.ts
```

结果：

- 通过
- `17` 条测试全部通过
- 其中新增 `/admin/quota/reset-usage` 相关测试 `6` 条全部通过

### 2.2 构建验证

执行命令：

```bash
yarn build
```

执行目录：

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server`

结果：

- 通过
- `prisma generate` 与 `tsc --noEmit` 正常完成

### 2.3 诊断检查

执行方式：

- `GetDiagnostics`

结果：

- 无新增诊断

## 3. 真实链路验证

### 3.1 验证方式

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-server` 下插入临时账号 `hv006-trae-main-03-account`
- 写入三条 `DailyUsage`
  - 上月一条：`900`
  - 本月首日一条：`1200`
  - 今日一条：`3200`
- 先用第一张单已有脚本把该账号提到 `pro`
- 再用第二张单已有查询脚本查看 reset 前状态
- 依次执行 `daily`、`monthly`、`all` 三种 reset
- 每一步之后都再次查询，并用 SQL 对照 `DailyUsage`
- 验证结束后清理临时账号、订阅与 usage 数据

### 3.2 实际命令

```bash
npx dotenv -e .env -e .env.dev -- sh -lc '
ACCOUNT_ID=hv006-trae-main-03-account
yarn admin:upgrade -- --account-id "$ACCOUNT_ID" --tier pro --billing-period annual
yarn admin:account-quota -- --account-id "$ACCOUNT_ID"
yarn admin:reset-usage -- --account-id "$ACCOUNT_ID" --scope daily
yarn admin:account-quota -- --account-id "$ACCOUNT_ID"
yarn admin:reset-usage -- --account-id "$ACCOUNT_ID" --scope monthly
yarn admin:account-quota -- --account-id "$ACCOUNT_ID"
yarn admin:reset-usage -- --account-id "$ACCOUNT_ID" --scope all
yarn admin:account-quota -- --account-id "$ACCOUNT_ID"
psql "$DATABASE_URL" -c "select date, \"tokensUsed\", requests from \"DailyUsage\" where \"accountId\"='\''hv006-trae-main-03-account'\'' order by date;"
'
```

### 3.3 reset 前查询结果

`admin:account-quota` 返回：

```json
{
  "success": true,
  "account": {
    "id": "hv006-trae-main-03-account",
    "username": "hv006-trae-main-03-user"
  },
  "subscription": {
    "tier": "pro",
    "status": "active"
  },
  "quota": {
    "tier": "pro",
    "dailyUsed": 3200,
    "monthlyUsed": 4400,
    "dailyRemaining": 96800,
    "monthlyRemaining": 1995600
  }
}
```

### 3.4 `daily` reset 结果

`admin:reset-usage -- --scope daily` 返回：

```json
{
  "success": true,
  "reset": {
    "scope": "daily",
    "clearedUsageRows": 1,
    "clearedDates": ["2026-04-08"],
    "clearedTokens": 3200,
    "clearedRequests": 5
  }
}
```

再次查询结果：

- `dailyUsed = 0`
- `monthlyUsed = 1200`
- `dailyRemaining = 100000`
- `monthlyRemaining = 1998800`

数据库对照结果：

```text
2026-03-03 -> tokensUsed=900, requests=1
2026-04-01 -> tokensUsed=1200, requests=2
```

### 3.5 `monthly` reset 结果

`admin:reset-usage -- --scope monthly` 返回：

```json
{
  "success": true,
  "reset": {
    "scope": "monthly",
    "clearedUsageRows": 1,
    "clearedDates": ["2026-04-01"],
    "clearedTokens": 1200,
    "clearedRequests": 2
  }
}
```

再次查询结果：

- `dailyUsed = 0`
- `monthlyUsed = 0`
- `dailyRemaining = 100000`
- `monthlyRemaining = 2000000`

数据库对照结果：

```text
2026-03-03 -> tokensUsed=900, requests=1
```

### 3.6 `all` reset 结果

`admin:reset-usage -- --scope all` 返回：

```json
{
  "success": true,
  "reset": {
    "scope": "all",
    "clearedUsageRows": 1,
    "clearedDates": ["2026-03-03"],
    "clearedTokens": 900,
    "clearedRequests": 1
  }
}
```

再次查询结果：

- `dailyUsed = 0`
- `monthlyUsed = 0`
- `dailyRemaining = 100000`
- `monthlyRemaining = 2000000`

最终数据库对照结果：

```text
(0 行记录)
```

## 4. 验证结论

- `daily` 只清当天 `DailyUsage`，不会误删上月记录
- `monthly` 只清当前自然月内的 `DailyUsage`
- `all` 会清该账号全部 `DailyUsage`
- reset 前后使用查询脚本与 SQL 对照，结果一致
- 本轮已经形成“先查现状 -> 执行 reset -> 再次查询复核”的真实可用闭环
