# 需求清单：HelloVibe 双模架构（本地专业版 + 云端托管版）

**文档创建日期：** 2026 年 4 月 4 日  
**文档类型：** 产品架构需求  
**优先级：** P0（战略级）

---

## 一、背景与目标

### 1.1 背景

当前 HelloVibe 已实现「手机远程控制器 Claude Code/Codex」的核心能力，但仅支持单一模式：用户在本地电脑安装 CLI 和 AI 工具，手机通过云端服务器中转进行远程控制。

为覆盖更广泛的用户群体并实现商业化，需要支持两种差异化部署模式：
- **模式 A（本地专业版）**：面向专业开发者，代码和 AI 工具均在本地
- **模式 B（云端托管版）**：面向普通用户，代码和 AI 工具均在云端

### 1.2 产品愿景

**HelloVibe —— 让人通过氛围编程，轻松开发第一个程序**

就像写代码的人都知道「Hello World」一样，HelloVibe 要让每个人都能轻松写出自己的第一个程序。

打造「氛围编程」工具的双模生态系统：
- 本地专业版 → 积累技术口碑和开发者用户
- 云端托管版 → 实现 SaaS 订阅商业化

---

## 二、模式定义与对比

### 2.1 模式 A：本地专业版（Local Pro Mode）

| 维度 | 描述 |
|------|------|
| **目标用户** | 专业开发者、极客、企业内网用户、对代码隐私敏感者 |
| **代码位置** | 用户本地电脑（Mac/PC） |
| **AI 工具** | 用户自行安装 Claude Code / Codex |
| **API Key** | 用户自备（Anthropic / OpenAI / Gemini） |
| **HelloVibe CLI** | 全局安装 `npm i -g @hellovibe/cli` |
| **部署复杂度** | 中（需配置环境） |
| **数据隐私** | 代码不出本地，端到端加密 |
| **网络依赖** | 仅需连接 AI API（可选连 HelloVibe Server） |
| **计费模式** | 用户自付 AI API 费用，HelloVibe 免费/开源 |

#### 使用场景
- 开发者在公司 Mac 上写代码，午休时用手机查看进度
- 企业内网环境，代码不能出公司
- 已有 Claude/Codex 订阅，不想重复付费

---

### 2.2 模式 B：云端托管版（Cloud Hosted Mode）

| 维度 | 描述 |
|------|------|
| **目标用户** | 普通用户、学生、快速体验者、多设备协同用户 |
| **代码位置** | 云端服务器（阿里云/自建机房） |
| **AI 工具** | 云端预装 Claude Code / Codex |
| **API Key** | 运营方统一提供（共享 Key 池） |
| **HelloVibe CLI** | 云端容器内运行，用户无需安装 |
| **部署复杂度** | 低（用户扫码即用） |
| **数据隐私** | 代码在云端（需加密存储 + 合规） |
| **网络依赖** | 需连接 HelloVibe 云端服务器 |
| **计费模式** | 订阅制 / 按量付费（打包 AI API 成本） |

#### 使用场景
- 学生没有信用卡，无法支付 Claude API
- 多设备用户（手机 + 平板 + 网页）希望随时随地继续
- 企业批量采购，员工无需各自配置

---

### 2.3 双模对比总览

| 维度 | 模式 A：本地专业版 | 模式 B：云端托管版 |
|------|-------------------|-------------------|
| 目标用户 | 开发者、极客、企业内网 | 普通用户、学生、体验者 |
| 代码位置 | 本地电脑 | 云端服务器 |
| AI 模型 | 用户自备 API Key | 云端统一提供 |
| 部署复杂度 | 用户自己装 CLI + 配置 | 开箱即用（扫码即开始） |
| 数据隐私 | 代码不出本地 | 代码在云端（需加密/合规） |
| 网络依赖 | 仅需连 API | 需连云端服务器 |
| 计费模式 | 用户自付 API 费 | 打包收费（订阅/按量） |
| 技术难度 | ⭐ 低（现有架构） | ⭐⭐⭐ 中（需容器化改造） |
| 商业价值 | ⭐⭐ 开源口碑 | ⭐⭐⭐⭐⭐ SaaS 订阅收入 |

---

## 三、技术架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        HelloVibe 生态系统                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐         ┌─────────────────────────┐    │
│  │   模式 A：本地专业版   │         │   模式 B：云端托管版     │    │
│  │                     │         │                         │    │
│  │  ┌───────────────┐  │         │  ┌───────────────────┐  │    │
│  │  │  用户 Mac/PC   │  │         │  │  阿里云容器集群    │  │    │
│  │  │  ┌─────────┐  │  │         │  │  ┌─────────────┐  │  │    │
│  │  │  │ Claude  │  │  │         │  │  │ 容器 user-a │  │  │    │
│  │  │  │ Codex   │  │  │         │  │  │ /workspace/ │  │  │    │
│  │  │  │ (本地)  │  │  │         │  │  │ Claude      │  │  │    │
│  │  │  └────┬────┘  │  │         │  │  └──────┬──────┘  │  │    │
│  │  │       │       │  │         │  │  ┌─────────────┐  │  │    │
│  │  │  ┌────┴────┐  │  │         │  │  │ 容器 user-b │  │  │    │
│  │  │  │ Happy   │  │  │         │  │  │ /workspace/ │  │  │    │
│  │  │  │ Daemon  │  │  │         │  │  │ Claude      │  │  │    │
│  │  │  │ (本地)  │  │  │         │  │  └──────┬──────┘  │  │    │
│  │  │  └────┬────┘  │  │         │  │  ┌─────────────┐  │  │    │
│  │  │       │       │  │         │  │  │ ...更多容器 │  │  │    │
│  │  └───────┼───────┘  │         │  └────────┬────────┘  │    │
│  │          │          │         │           │            │    │
│  └──────────┼──────────┘         └───────────┼────────────┘    │
│             │                                │                  │
│             └────────────┬───────────────────┘                  │
│                          │                                       │
│              ┌───────────┴───────────┐                          │
│              │    HelloVibe Server       │                          │
│              │    (多租户认证中心)     │                          │
│              │  - 账号系统            │                          │
│              │  - 会话路由            │                          │
│              │  - 计量计费            │                          │
│              └───────────┬───────────┘                          │
│                          │                                       │
│         ┌────────────────┼────────────────┐                     │
│         │                │                │                     │
│    ┌─────────┐     ┌─────────┐     ┌─────────┐                 │
│    │ 手机 App │     │  网页端  │     │  Desktop │                 │
│    └─────────┘     └─────────┘     └─────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.2 模式 A：本地专业版架构

```
用户本地 Mac
├─ HelloVibe CLI (全局安装：npm i -g @hellovibe/cli)
├─ Claude Code / Codex (用户自行配置 API Key)
├─ HelloVibe Daemon (后台运行)
│  ├─ tmux session: hellovibe-local-001
│  └─ 工作目录：~/projects/*
└─ 本地代码文件（不出本机）
         │
         │ WebSocket (端到端加密)
         ▼
  HelloVibe Server (仅认证 + 路由)
         │
         ▼
  手机 App (远程控制)
```

#### 当前代码支持情况 ✅

| 功能 | 状态 | 代码位置 |
|------|------|----------|
| 本地 Daemon | ✅ 已实现 | `packages/hellovibe-cli/src/daemon/run.ts` |
| tmux 会话隔离 | ✅ 已实现 | `packages/hellovibe-cli/src/utils/tmux.ts` |
| 多工作目录 | ✅ 已实现 | `SpawnSessionOptions.directory` |
| 手机远程控制 | ✅ 已实现 | `packages/hellovibe-app/sources/sync/` |
| 端到端加密 | ✅ 已实现 | `privacy-kit` + `libsodium` |

#### 部署流程（用户侧）

```bash
# 1. 安装 HelloVibe CLI
npm install -g @hellovibe/cli

# 2. 配置 AI 提供商
hellovibe config set anthropic-key sk-xxx
# 或
hellovibe config set openai-key sk-xxx

# 3. 启动 Daemon
hellovibe daemon start-sync

# 4. 手机扫码连接
# (设置 → 账户 → 链接新设备 → 扫码)

# 5. 开始使用
# 手机发消息 → 本地 Claude 执行 → 结果回传手机
```

---

### 3.3 模式 B：云端托管版架构

```
阿里云服务器
├─ HelloVibe Server (多租户认证)
├─ Docker / Kubernetes 集群
│  ├─ 容器 user-a
│  │  ├─ 预装 Claude Code
│  │  ├─ 工作目录：/workspace/user-a/
│  │  ├─ tmux session: hellovibe-cloud-a001
│  │  └─ 统一 API Key (云端管理)
│  ├─ 容器 user-b
│  │  └─ ...
│  └─ 容器 user-c
│      └─ ...
└─ 计量计费系统
   ├─ Token 用量统计
   ├─ 存储用量统计
   └─ 在线时长统计
         │
         │ WebSocket (端到端加密)
         ▼
  手机 App / 网页端
  (扫码即开始，无需配置)
```

#### 需要新增的功能 ❌

| 功能 | 状态 | 需改造位置 |
|------|------|------------|
| 容器编排 | ❌ 需实现 | 新增 `packages/hellovibe-cloud/` |
| 多租户隔离 | ⚠️ 部分支持 | `AccessKey` 跨账号授权改造 |
| 统一 API Key 池 | ❌ 需实现 | `ServiceAccountToken` 扩展 |
| 计量计费 | ❌ 需实现 | `UsageReport` 聚合 + 计费逻辑 |
| 自动扩缩容 | ❌ 需实现 | Kubernetes HPA 配置 |
| 订阅管理 | ❌ 需实现 | 对接 RevenueCat / Stripe |

#### 部署流程（运营侧）

```bash
# 1. 部署 HelloVibe Server（多租户版）
kubectl apply -f hellovibe-server/

# 2. 部署工作空间容器模板
kubectl apply -f workspace-template/

# 3. 配置 API Key 池
hellovibe-admin api-keys add anthropic sk-xxx --pool shared

# 4. 配置计费规则
hellovibe-admin billing set --rate tokens=0.002/storage=0.1/hour=1.0

# 5. 用户注册后自动创建容器
# (监听 HelloVibe Server 的 user-created 事件)
```

---

## 四、双模统一的关键设计

### 4.1 统一的会话元数据协议

```typescript
// 无论哪种模式，会话元数据结构一致
interface SessionMetadata {
  mode: 'local' | 'cloud';  // 区分模式
  workspace: {
    type: 'local' | 'container';
    path: string;           // 本地路径 or 容器 ID
  };
  aiProvider: {
    vendor: 'anthropic' | 'openai' | 'gemini';
    keySource: 'user' | 'cloud';  // 谁提供的 API Key
  };
}
```

### 4.2 统一的路由层

```typescript
// HelloVibe Server 根据 Session.metadata 路由
if (session.metadata.mode === 'local') {
  // 转发到用户本地 Daemon
  routeToUserDaemon(session.accountId);
} else {
  // 转发到云端容器
  routeToCloudWorkspace(session.cloudWorkspaceId);
}
```

### 4.3 统一的计量接口

```typescript
// UsageReport 统一上报
interface UsageReport {
  accountId: string;
  sessionId: string;
  mode: 'local' | 'cloud';
  metrics: {
    inputTokens: number;
    outputTokens: number;
    storageBytes: number;
    durationSeconds: number;
  };
}
```

---

## 五、实施路线图

### 阶段 1：巩固模式 A（2-4 周）

| 任务 | 优先级 | 预估工时 |
|------|--------|----------|
| 完善本地 Daemon 的稳定性 | P0 | 3 天 |
| 优化 tmux 会话管理 | P0 | 2 天 |
| 编写用户安装文档 | P1 | 2 天 |
| 局域网联调 SOP 完善 | P1 | 2 天 |
| 一键安装脚本（Mac/Windows） | P2 | 3 天 |

**里程碑：** 模式 A 可稳定对外发布

---

### 阶段 2：模式 B 原型（4-8 周）

| 任务 | 优先级 | 预估工时 |
|------|--------|----------|
| 容器化工作空间镜像 | P0 | 5 天 |
| Kubernetes 部署配置 | P0 | 5 天 |
| 多租户隔离（AccessKey 改造） | P0 | 5 天 |
| 统一 API Key 池管理 | P0 | 5 天 |
| 基础计量功能（Token 统计） | P1 | 3 天 |
| 云端会话生命周期管理 | P1 | 3 天 |

**里程碑：** 模式 B 可小范围内测

---

### 阶段 3：商业化（8-12 周）

| 任务 | 优先级 | 预估工时 |
|------|--------|----------|
| 计费系统集成 | P0 | 5 天 |
| 订阅管理（RevenueCat/Stripe） | P0 | 5 天 |
| 监控告警系统 | P1 | 5 天 |
| 用户用量 Dashboard | P1 | 5 天 |
| 自动扩缩容（HPA） | P2 | 3 天 |
| 安全合规审计 | P1 | 5 天 |

**里程碑：** 模式 B 可正式对外收费

---

## 六、风险与应对

### 6.1 技术风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 容器隔离失效 | 高（代码泄露） | 严格测试 + 安全审计 |
| API Key 池滥用 | 高（成本失控） | 用量限制 + 实时监控 |
| 云端性能瓶颈 | 中（体验差） | 自动扩缩容 + 负载均衡 |

### 6.2 商业风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 云端成本高于收入 | 高（亏损） | 动态定价 + 用量限制 |
| 用户不愿为云端付费 | 中（收入低） | 免费试用 + 差异化定价 |
| 竞争对手模仿 | 中（市场丢失） | 快速占领 + 品牌建设 |

### 6.3 合规风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 用户代码在云端存储 | 高（隐私问题） | 端到端加密 + 用户协议 |
| AI API 使用条款限制 | 中（服务中断） | 与 Anthropic/OpenAI 商务沟通 |

---

## 七、成功指标（KPI）

### 模式 A（本地专业版）

| 指标 | 目标值 | 衡量周期 |
|------|--------|----------|
| GitHub Star 数 | 1000+ | 3 个月 |
| npm 下载量 | 10000+ | 3 个月 |
| 活跃用户数（DAU） | 100+ | 3 个月 |

### 模式 B（云端托管版）

| 指标 | 目标值 | 衡量周期 |
|------|--------|----------|
| 付费用户数 | 100+ | 6 个月 |
| 月经常性收入（MRR） | $1000+ | 6 个月 |
| 用户留存率（30 天） | 60%+ | 6 个月 |
| 毛利率 | 40%+ | 6 个月 |

---

## 八、附录

### 8.1 相关文件

- `packages/hellovibe-cli/src/daemon/run.ts` - Daemon 启动逻辑
- `packages/hellovibe-cli/src/utils/tmux.ts` - tmux 会话管理
- `packages/hellovibe-server/sources/app/api/routes/sessionRoutes.ts` - 会话创建 API
- `packages/hellovibe-server/sources/app/api/routes/accessKeysRoutes.ts` - AccessKey 授权 API
- `packages/hellovibe-server/prisma/schema.prisma` - 数据库架构

### 8.2 参考文档

- 董/20260404-HelloVibe-局域网手机联调操作手册.md
- 董/20260331-OpenInMac 原生 Claude 终端与 tmux 托管 - 决策版摘要.md
- docs/backend-architecture.md

---

**文档状态：** 待评审  
**下一步：** 与团队评审后拆分为具体开发任务
