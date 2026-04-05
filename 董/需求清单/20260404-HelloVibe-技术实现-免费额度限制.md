# 技术实现：HelloVibe 免费额度限制

**文档创建日期：** 2026 年 4 月 4 日  
**文档类型：** 技术实现文档  
**关联需求：** 20260404-需求清单-HelloVibe 双模架构定价策略.md

---

## 一、实现概述

### 1.1 目标

实现"三刀流"免费额度限制机制：
- **日限额** - 防止一天刷爆
- **月限额** - 控制总成本
- **速率限制** - 防止脚本滥用

### 1.2 已完成的功能

| 模块 | 文件位置 | 状态 |
|------|---------|------|
| 数据库 Schema | `packages/happy-server/prisma/schema.prisma` | ✅ 已添加 SubscriptionPlan, DailyUsage |
| Token 配额中间件 | `packages/happy-server/sources/app/api/middleware/tokenQuota.ts` | ✅ 已创建 |
| 配额管理 API | `packages/happy-server/sources/app/api/routes/quotaRoutes.ts` | ✅ 已创建 |
| Session 路由集成 | `packages/happy-server/sources/app/api/routes/v3SessionRoutes.ts` | ✅ 已修改 |
| 前端错误处理 | `packages/happy-app/sources/hooks/useHappyAction.ts` | ✅ 已修改 |
| 中英文翻译 | `packages/happy-app/sources/text/_default.ts`, `zh-Hans.ts` | ✅ 已添加 |

---

## 二、数据库设计

### 2.1 SubscriptionPlan 表

**用途：** 存储用户订阅套餐信息

```prisma
model SubscriptionPlan {
    id           String   @id @default(cuid())
    accountId    String   @unique
    account      Account  @relation(fields: [accountId], references: [id])
    tier         String   // "free" | "student" | "pro" | "team" | "enterprise"
    status       String   // "active" | "cancelled" | "expired"
    tokensLimit  Int      // 每月 tokens 限额
    dailyLimit   Int      // 每日 tokens 限额
    rateLimit    Int      // 每分钟请求数限制
    storageLimit BigInt   // 存储限额 (bytes)
    startDate    DateTime @default(now())
    endDate      DateTime?
    createdAt    DateTime @default(now())
    updatedAt    DateTime @updatedAt

    @@index([accountId])
}
```

### 2.2 DailyUsage 表

**用途：** 追踪用户每日用量

```prisma
model DailyUsage {
    id          String   @id @default(cuid())
    accountId   String
    account     Account  @relation(fields: [accountId], references: [id])
    date        String   // 格式："YYYY-MM-DD"
    tokensUsed  Int      @default(0)
    requests    Int      @default(0)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    @@unique([accountId, date])
    @@index([accountId, date])
}
```

### 2.3 数据关系

```
Account (1) ──→ (1) SubscriptionPlan
Account (1) ──→ (N) DailyUsage (按日期)
```

---

## 三、配额配置

### 3.1 套餐常量定义

**文件：** `packages/happy-server/sources/app/api/middleware/tokenQuota.ts`

```typescript
export const QUOTA_TIERS = {
    free: {
        dailyLimit: 5000,        // 5K tokens/天
        monthlyLimit: 100000,    // 10 万 tokens/月
        rateLimit: 10,           // 10 请求/分钟
        tokensPerMonth: 100000,
        storageLimit: BigInt(1024 * 1024 * 100), // 100MB
    },
    student: {
        dailyLimit: 20000,       // 20K tokens/天
        monthlyLimit: 500000,    // 50 万 tokens/月
        rateLimit: 30,           // 30 请求/分钟
        tokensPerMonth: 500000,
        storageLimit: BigInt(1024 * 1024 * 1024 * 5), // 5GB
    },
    pro: {
        dailyLimit: 100000,      // 100K tokens/天
        monthlyLimit: 2000000,   // 200 万 tokens/月
        rateLimit: 100,          // 100 请求/分钟
        tokensPerMonth: 2000000,
        storageLimit: BigInt(1024 * 1024 * 1024 * 20), // 20GB
    },
    team: {
        dailyLimit: 500000,      // 500K tokens/天
        monthlyLimit: 10000000,  // 1000 万 tokens/月
        rateLimit: 300,          // 300 请求/分钟
        tokensPerMonth: 10000000,
        storageLimit: BigInt(1024 * 1024 * 1024 * 100), // 100GB
    },
    enterprise: {
        dailyLimit: 5000000,     // 5M tokens/天
        monthlyLimit: 100000000, // 1 亿 tokens/月
        rateLimit: 1000,         // 1000 请求/分钟
        tokensPerMonth: 100000000,
        storageLimit: BigInt(1024 * 1024 * 1024 * 1000), // 1TB
    },
};
```

### 3.2 配额配置总览

| 套餐 | 日限额 | 月限额 | 速率限制 | 存储限额 |
|------|--------|--------|---------|---------|
| free | 5K | 10 万 | 10/分钟 | 100MB |
| student | 20K | 50 万 | 30/分钟 | 5GB |
| pro | 100K | 200 万 | 100/分钟 | 20GB |
| team | 500K | 1000 万 | 300/分钟 | 100GB |
| enterprise | 5M | 1 亿 | 1000/分钟 | 1TB |

---

## 四、核心中间件

### 4.1 tokenQuotaMiddleware

**功能：** 检查用户的日限额、月限额和速率限制

```typescript
export async function tokenQuotaMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void
) {
    const userId = (request as any).userId;
    
    // 获取用户订阅计划
    const subscription = await db.subscriptionPlan.findUnique({
        where: { accountId: userId },
    });

    const tier = (subscription?.tier as QuotaTier) || 'free';
    const quota = QUOTA_TIERS[tier];

    // 检查日限额
    const today = new Date().toISOString().split('T')[0];
    const dailyUsage = await db.dailyUsage.findUnique({
        where: {
            accountId_date: {
                accountId: userId,
                date: today,
            },
        },
    });

    const dailyTokens = dailyUsage?.tokensUsed || 0;
    if (dailyTokens >= quota.dailyLimit) {
        return reply.code(429).send({
            error: 'daily_limit_exceeded',
            message: '今日免费额度已用完，明日 0 点重置',
        });
    }

    // 检查月限额
    const firstDayOfMonth = new Date().toISOString().slice(0, 7) + '-01';
    const monthlyUsageResult = await db.dailyUsage.groupBy({
        by: ['accountId'],
        where: {
            accountId: userId,
            date: { gte: firstDayOfMonth },
        },
        _sum: { tokensUsed: true },
    });

    const monthlyTokens = monthlyUsageResult[0]?._sum.tokensUsed || 0;
    if (monthlyTokens >= quota.monthlyLimit) {
        return reply.code(429).send({
            error: 'monthly_limit_exceeded',
            message: '本月免费额度已用完，下月 1 号重置',
        });
    }

    // 将配额信息附加到 request 对象
    (request as any).quota = {
        tier,
        dailyLimit: quota.dailyLimit,
        monthlyLimit: quota.monthlyLimit,
        dailyUsed: dailyTokens,
        monthlyUsed: monthlyTokens,
        dailyRemaining: quota.dailyLimit - dailyTokens,
        monthlyRemaining: quota.monthlyLimit - monthlyTokens,
    } as QuotaInfo;

    next();
}
```

### 4.2 updateUsage

**功能：** 更新用户用量记录

```typescript
export async function updateUsage(
    userId: string,
    tokensUsed: number,
    sessionId?: string
): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await db.dailyUsage.upsert({
        where: {
            accountId_date: {
                accountId: userId,
                date: today,
            },
        },
        update: {
            tokensUsed: { increment: tokensUsed },
            requests: { increment: 1 },
        },
        create: {
            accountId: userId,
            date: today,
            tokensUsed,
            requests: 1,
        },
    });

    // 同时更新 UsageReport（用于计费和统计）
    if (sessionId) {
        const usageKey = `session:${sessionId}:${today}`;
        await db.usageReport.upsert({
            where: {
                accountId_sessionId_key: {
                    accountId: userId,
                    sessionId,
                    key: usageKey,
                },
            },
            update: {
                data: {
                    tokens: { total: tokensUsed },
                    cost: { total: 0 },
                },
            },
            create: {
                accountId: userId,
                sessionId,
                key: usageKey,
                data: {
                    tokens: { total: tokensUsed },
                    cost: { total: 0 },
                },
            },
        });
    }
}
```

### 4.3 getUserQuota

**功能：** 获取用户当前配额信息

```typescript
export async function getUserQuota(userId: string): Promise<QuotaInfo | null> {
    const subscription = await db.subscriptionPlan.findUnique({
        where: { accountId: userId },
    });

    const tier: QuotaTier = (subscription?.tier as QuotaTier) || 'free';
    const quota = QUOTA_TIERS[tier];

    if (!quota) {
        return null;
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyUsage = await db.dailyUsage.findUnique({
        where: {
            accountId_date: {
                accountId: userId,
                date: today,
            },
        },
    });

    const firstDayOfMonth = new Date().toISOString().slice(0, 7) + '-01';
    const monthlyUsageResult = await db.dailyUsage.groupBy({
        by: ['accountId'],
        where: {
            accountId: userId,
            date: { gte: firstDayOfMonth },
        },
        _sum: { tokensUsed: true },
    });

    const dailyTokens = dailyUsage?.tokensUsed || 0;
    const monthlyTokens = monthlyUsageResult[0]?._sum.tokensUsed || 0;

    return {
        tier,
        dailyLimit: quota.dailyLimit,
        monthlyLimit: quota.monthlyLimit,
        rateLimit: quota.rateLimit,
        dailyUsed: dailyTokens,
        monthlyUsed: monthlyTokens,
        dailyRemaining: quota.dailyLimit - dailyTokens,
        monthlyRemaining: quota.monthlyLimit - monthlyTokens,
    };
}
```

### 4.4 estimateTokens

**功能：** 估算文本的 token 数量

```typescript
export function estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;

    // 中文约 1.5 字符/token，英文约 4 字符/token
    return Math.ceil(chineseChars / 1.5) + Math.ceil(otherChars / 4);
}
```

---

## 五、API 接口

### 5.1 GET /quota

**用途：** 获取当前用户的用量和配额信息

**请求：**
```http
GET /quota
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "tier": "free",
  "subscription": {
    "status": "free",
    "endDate": null
  },
  "quota": {
    "dailyLimit": 5000,
    "dailyUsed": 1200,
    "dailyRemaining": 3800,
    "dailyReset": "次日 0 点 (北京时间)",
    "monthlyLimit": 100000,
    "monthlyUsed": 45000,
    "monthlyRemaining": 55000,
    "monthlyReset": "次月 1 号 0 点 (北京时间)",
    "rateLimit": 10,
    "rateLimitUnit": "requests/minute",
    "storageLimit": "104857600"
  },
  "usagePercentage": {
    "daily": 24,
    "monthly": 45
  }
}
```

### 5.2 GET /plans

**用途：** 获取所有订阅计划列表

**响应：** 返回 5 个套餐的详细信息，包括价格、功能、支付方式等

### 5.3 POST /subscription/upgrade

**用途：** 升级订阅计划

**请求体：**
```json
{
  "tier": "pro",
  "billingPeriod": "monthly",
  "paymentMethod": "wechat"
}
```

**响应：**
```json
{
  "success": true,
  "orderId": "sub_1234567890_abc123",
  "paymentUrl": "https://payment.example.com/pay?order=xxx",
  "expiresAt": "2026-04-04T12:30:00Z"
}
```

### 5.4 GET /subscription/current

**用途：** 获取当前订阅状态

---

## 六、Session 路由集成

### 6.1 配额检查逻辑

**文件：** `packages/happy-server/sources/app/api/routes/v3SessionRoutes.ts`

在 `POST /v3/sessions/:sessionId/messages` 中：

1. **估算 tokens：**
```typescript
const estimatedTokens = messages.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content);
}, 0);
```

2. **检查配额：**
```typescript
const quota = await getUserQuota(userId);
if (quota && estimatedTokens > quota.dailyRemaining) {
    return reply.code(429).send({
        error: 'insufficient_quota',
        message: '预估 tokens 超出剩余额度',
        estimated: estimatedTokens,
        remaining: quota.dailyRemaining,
        upgradeUrl: '/pricing',
    });
}
```

3. **更新用量：**
```typescript
await updateUsage(userId, estimatedTokens, sessionId);
```

### 6.2 错误响应

**429 Too Many Requests:**
```json
{
  "error": "insufficient_quota",
  "message": "预估 tokens 超出剩余额度",
  "estimated": 6000,
  "remaining": 3800,
  "dailyLimit": 5000,
  "dailyUsed": 1200,
  "upgradeUrl": "/pricing"
}
```

---

## 七、前端处理

### 7.1 useHappyAction 错误处理

**文件：** `packages/happy-app/sources/hooks/useHappyAction.ts`

```typescript
if (e.message === 'daily_limit_exceeded') {
    Modal.alert(
        t('quota.limitExceeded'),
        t('quota.dailyLimitExceeded'),
        [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('quota.upgrade'),
                onPress: () => {
                    router.push('/(app)/settings/billing');
                }
            }
        ]
    );
} else if (e.message === 'monthly_limit_exceeded') {
    Modal.alert(
        t('quota.limitExceeded'),
        t('quota.monthlyLimitExceeded'),
        [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('quota.upgrade'),
                onPress: () => {
                    router.push('/(app)/settings/billing');
                }
            }
        ]
    );
}
```

### 7.2 翻译文本

**新增 quota 节点：**

| Key | 英文 | 中文 |
|-----|------|------|
| `quota.limitExceeded` | Usage Limit Exceeded | 用量限额已用尽 |
| `quota.dailyLimitExceeded` | Your daily free quota... | 您的今日免费额度... |
| `quota.monthlyLimitExceeded` | Your monthly free quota... | 您的本月免费额度... |
| `quota.insufficientQuota` | Insufficient Quota | 额度不足 |
| `quota.upgrade` | Upgrade Plan | 升级套餐 |

---

## 八、待完成功能

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 支付系统对接 | P0 | 微信支付/支付宝/Stripe |
| 学生认证 | P1 | 学生证验证逻辑 |
| Redis 限流 | P1 | 分布式速率限制 |
| 配额通知 | P2 | 50%/80%/100% 用量提醒 |
| Billing UI | P1 | 用量展示和升级界面 |

---

## 九、实施检查清单

| 任务 | 优先级 | 状态 | 备注 |
|------|--------|------|------|
| 创建数据库迁移 | P0 | ⬜ 待执行 | 需运行 `yarn migrate` |
| 实现 tokenQuota 中间件 | P0 | ✅ 已完成 | tokenQuota.ts |
| 实现 quotaRoutes API | P0 | ✅ 已完成 | quotaRoutes.ts |
| 在 sessionRoutes 集成配额检查 | P0 | ✅ 已完成 | v3SessionRoutes.ts |
| 实现 usageHandler 通知 | P1 | ⬜ 待实现 | 需 Redis 支持 |
| 更新前端 useHappyAction | P0 | ✅ 已完成 | 添加配额错误处理 |
| 添加配额显示 UI 组件 | P1 | ⬜ 待实现 | Billing 设置页 |
| 压力测试配额系统 | P1 | ⬜ 待执行 | 负载测试 |

---

**文档状态：** 已完成核心开发，待测试  
**相关文档：** 
- 20260404-需求清单-HelloVibe 双模架构定价策略.md（商业策略）
