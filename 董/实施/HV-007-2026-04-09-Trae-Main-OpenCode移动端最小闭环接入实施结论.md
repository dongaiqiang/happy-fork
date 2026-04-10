# HV-007-2026-04-09-Trae-Main-OpenCode移动端最小闭环接入实施结论

## 0. 文件绝对路径

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/实施/HV-007-2026-04-09-Trae-Main-OpenCode移动端最小闭环接入实施结论.md`

## 1. 任务信息

- 责任位：`Trae-主线执行位`
- 工单号：`HV-007` / `HV-007-TRAE-MAIN-02`
- 工作目录：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`
- 任务名称：`HV-007-TRAE-MAIN-02 OpenCode移动端最小闭环接入`

## 2. 实施结论

- 已在主线代码中完成 OpenCode 通过 ACP 通道进入移动端主链路的 `P0` 最小闭环接入。
- 本轮已命中派单要求的页面、检测、草稿、Profile、spawn、daemon 六条主链路，OpenCode 不再停留在“底层已有部分支持但移动端无法真正使用”的半闭环状态。
- 本轮实现保持在“先闭环、后抽象”的边界内，没有把任务扩成通用 agent catalog 或 capability 全量重构。

## 3. 各链路打通情况

### 3.1 页面可见与可选

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/app/(app)/new/index.tsx` 已把 OpenCode 纳入可选 agent 集合。
- OpenCode 已进入：
  - 新建会话页 agent 初始值恢复
  - agent 切换顺序
  - CLI detection 自动回退
  - 兼容 profile 可用性判断
  - 顶部 CLI 状态展示

### 3.2 CLI detection

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/hooks/useCLIDetection.ts` 已新增 `opencode` 状态位，并纳入统一检测结果结构。
- 检测命令中已增加 `command -v opencode`，移动端不再只识别 `claude / codex / gemini`。

### 3.3 草稿与恢复

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/persistence.ts` 已让新建会话草稿与恢复逻辑承认 `opencode`。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/utils/tempDataStore.ts` 已同步把 `agentType` 联合类型扩到 `opencode`。

### 3.4 Profile compatibility

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/settings.ts` 已新增 `compatibility.opencode` 与 `dismissedCLIWarnings.opencode`。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/profileUtils.ts` 已将内建 OpenAI / Azure OpenAI profile 标记为支持 OpenCode，将 Anthropic 系 profile 保持为不支持。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/persistence.ts` 已同步兼容性 schema，避免 daemon 侧读取本地 settings 时口径滞后。

### 3.5 Spawn 参数贯通

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/sync/ops.ts` 与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/modules/common/registerCommonHandlers.ts` 已把 `SpawnSessionOptions.agent` 联合类型扩到 `opencode`。
- App 发起的新建会话参数现可把 OpenCode 真实带入 daemon 主链路。

### 3.6 daemon 主拉起

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-cli/src/daemon/run.ts` 已识别 `opencode` 为有效 agent。
- OpenCode 常规拉起现走 `hellovibe acp opencode --started-by daemon`，不再误走原有 `claude / codex / gemini` 的 native 命令分支。
- tmux 分支也能生成 OpenCode ACP 命令，且 token 注入逻辑不会再把 OpenCode 误判成 Claude。

## 4. 本轮实际修改文件

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

## 5. 成功链路样例

- 成功样例入口：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/实施/HV-007-2026-04-09-Trae-Main-OpenCode移动端最小闭环接入验证结果.md`
- 结果摘要：
  - 本机 `command -v opencode` 返回 `/opt/homebrew/opt/nvm/versions/node/v22.19.0/bin/opencode`
  - 四 CLI 组合检测返回 `claude:true / codex:true / gemini:true / opencode:true`
  - App 与 daemon 类型链路已允许 OpenCode 透传，并由 daemon 改走 ACP 拉起参数

## 6. 失败提示样例

- 失败样例入口：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/董/实施/HV-007-2026-04-09-Trae-Main-OpenCode移动端最小闭环接入验证结果.md`
- 结果摘要：
  - 在收缩 PATH 后执行 `command -v opencode` 检测样例，得到 `opencode:false`
  - 该样例证明 detection 链路能够明确给出“OpenCode 不可用”的事实，而不是继续停留在“点了没反应”的无反馈状态

## 7. 本轮未覆盖边界

- 未把所有 agent 入口抽成统一 catalog。
- 未为 OpenCode 补 `resume`、`openTerminal direct`、`hosted open-in-mac`、tmux 高级复用。
- 未把 Gemini 或更多 CLI 一并接入同一套抽象。
- 未做真实手机真机创建 OpenCode 会话的人工联调，本轮验证以静态链路、命令样例、typecheck 与单测为主。

## 8. 风险与阻塞

- 当前无代码级阻塞。
- 当前主要剩余风险是：OpenCode 已形成 `P0` 闭环，但通用化抽象尚未开始，后续继续扩更多 CLI 时仍存在固定枚举扩散点。
- 当前待补稳定提交基线；提交完成后即可作为总管位、复核位和后续承接方统一引用的事实入口。
