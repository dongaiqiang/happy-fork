CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tokensLimit" INTEGER NOT NULL,
    "dailyLimit" INTEGER NOT NULL,
    "rateLimit" INTEGER NOT NULL,
    "storageLimit" BIGINT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyUsage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_accountId_key" ON "SubscriptionPlan"("accountId");

CREATE INDEX "SubscriptionPlan_accountId_idx" ON "SubscriptionPlan"("accountId");

CREATE UNIQUE INDEX "DailyUsage_accountId_date_key" ON "DailyUsage"("accountId", "date");

CREATE INDEX "DailyUsage_accountId_date_idx" ON "DailyUsage"("accountId", "date");

ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyUsage" ADD CONSTRAINT "DailyUsage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
