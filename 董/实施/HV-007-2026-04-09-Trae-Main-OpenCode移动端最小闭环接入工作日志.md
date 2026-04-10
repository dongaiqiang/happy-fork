# HV-007-2026-04-09-Trae-Main-OpenCode移动端最小闭环接入工作日志

## 0. 文件绝对路径

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/实施/HV-007-2026-04-09-Trae-Main-OpenCode移动端最小闭环接入工作日志.md`

## 1. 任务信息

- 责任位：`Trae-主线执行位`
- 工单号：`HV-007` / `HV-007-TRAE-MAIN-02`
- 工作目录：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`
- 任务主题：OpenCode 移动端最小闭环接入

## 2. 输入材料读取

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/HV-007-2026-04-09-Trae-Main-OpenCode移动端最小闭环接入正式派单.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/CLAUDE.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/.trae/rules/project_rules.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/docs/hellovibe-worktree-guide.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/hellovibe-worktree-guide.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/docs/hellovibe-总管派单模板.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/HV-007-2026-04-09-Trae-Main-移动端通用CLI-Agent接入需求评审正式派单.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/HV-007-2026-04-09-Claude-移动端通用CLI-Agent接入需求复核正式派单.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/评审/HV-007-2026-04-09-Trae-Main-移动端通用CLI-Agent接入需求评审结论.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/评审/HV-007-2026-04-09-Trae-Main-移动端通用CLI-Agent接入实施拆分建议.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-claude/董/评审/HV-007-2026-04-09-Claude-移动端通用 CLI-Agent 接入复核结论.md`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-claude/董/评审/HV-007-2026-04-09-Claude-固定枚举扩散范围与回归风险清单.md`

## 3. 实施过程

### 3.1 App 侧主链路补齐

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/new/index.tsx` 中把 OpenCode 纳入可选 agent 集合，补齐：
  - agent 初始值恢复
  - agent 切换顺序
  - CLI detection 自动回退
  - profile 可用性判断
  - create session 前的兼容性守卫
  - 顶部 CLI 状态展示
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/AgentInput.tsx` 中补齐 OpenCode 显示名和 CLI 状态位展示。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/modelModeOptions.ts` 中把 OpenCode 第一阶段收敛为 `default` 单选项，避免误用 Claude/Codex 的高级模式集。

### 3.2 App 数据与设置口径补齐

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/hooks/useCLIDetection.ts` 中新增 `opencode` 检测字段与 `command -v opencode` 解析。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/persistence.ts` 中让新建会话草稿支持 `opencode`。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/settings.ts` 中新增 `compatibility.opencode` 与 `dismissedCLIWarnings.opencode`。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/profileUtils.ts` 中把 OpenAI / Azure OpenAI 内建 profile 标记为支持 OpenCode，把 Anthropic 系列保持为不支持。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/ops.ts` 与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/utils/tempDataStore.ts` 中把 `agent` / `agentType` 联合类型扩到 `opencode`。

### 3.3 CLI / daemon 主拉起链路补齐

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/modules/common/registerCommonHandlers.ts` 中让 daemon RPC 的 `SpawnSessionOptions.agent` 接受 `opencode`。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/persistence.ts` 中同步 profile compatibility schema，避免 daemon 读本地 settings 时口径落后。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/run.ts` 中完成：
  - `selectedAgent` 识别 `opencode`
  - profile compatibility 查询接受 `opencode`
  - token 注入不再误把 OpenCode 当 Claude
  - 常规 spawn 切到 `hellovibe acp opencode --started-by daemon`
  - tmux 分支也能生成 OpenCode ACP 命令
  - 继续保留 `resume` / `openTerminal` 仅限 Claude 的边界

### 3.4 测试与回归

- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/modelModeOptions.test.ts` 中新增 OpenCode 默认模式测试。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/settings.spec.ts` 中新增内建 profile 的 OpenCode compatibility 断言。
- 在 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/run.test.ts` 中新增 OpenCode ACP 启动参数测试。
- 顺手修正了 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/settings/profiles.tsx` 与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/NewSessionWizard.tsx` 中因 compatibility schema 扩展带来的类型缺口。

## 4. 实际修改文件

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/new/index.tsx`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/settings/profiles.tsx`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/AgentInput.tsx`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/NewSessionWizard.tsx`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/modelModeOptions.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/modelModeOptions.test.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/hooks/useCLIDetection.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/ops.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/persistence.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/profileUtils.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/settings.spec.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/settings.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/utils/tempDataStore.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/run.test.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/run.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/modules/common/registerCommonHandlers.ts`
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/persistence.ts`

## 5. 本轮未扩的边界

- 未把所有 agent 主分发点抽成 catalog。
- 未为 OpenCode 补 `resume`、`openTerminal direct`、`hosted open-in-mac`、tmux 高级复用。
- 未扩 Gemini 或更多 CLI 的接入复用。
- 未改 Profile 编辑界面去显式暴露 OpenCode 独立开关，本轮仍以 schema + 内建 profile 事实口径为主。
