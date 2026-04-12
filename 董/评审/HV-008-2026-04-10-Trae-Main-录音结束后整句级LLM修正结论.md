# HV-008-2026-04-10-Trae-Main-录音结束后整句级LLM修正结论

- 工单号：`HV-008` / `HV-008-TRAE-MAIN-02`
- 评审角色：`Trae-主线执行位`
- 工作目录：`/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main`

## 一句话结论

- 本轮最终结论为：按上线优先级先下线“录音结束后整句级 LLM 修正/后处理”，保留语音识别后的本地整句化与草稿保留链路；当前真机黑盒验收已通过，HV-008 可按“功能收口并提验”推进。

## 已完成部分

- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/voice-input/providers/useStreamingAsrProvider.ts` 已在 `asr_end` 后停止等待 `/v1/voice/postprocess`，改为直接进入继续补录或发送态。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/voice-input/providers/streamingAsrDraft.ts` 保留实时去重、跨轮草稿合成与本地整句化规则。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/components/AgentInput.tsx` 与 `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/custom-asr/SmartVoiceButton.tsx` 保持继续补录/发送 UI 逻辑稳定。
- `/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/hellovibe-main/packages/happy-app/sources/features/voice-input/providers/useStreamingAsrProvider.test.ts` 已更新并通过，覆盖当前发送态展示与草稿链路。

## 验证结论

- 自动化验证已通过：
  - `yarn workspace happy-app test --run sources/features/voice-input/providers/useStreamingAsrProvider.test.ts`
  - `yarn workspace happy-app typecheck`
- 真机黑盒验收已通过，当前执行会话中已收到直接确认：`hv-008我真机测试通过了`

## 风险判断

- 对 `HV-008-TRAE-MAIN-01` 已完成的实时去重、范围替换、草稿保留逻辑，当前未引入新的结构性回退。
- 本轮风险收口方式是“直接移除后处理等待链”，因此同时拿掉了 provider/model 路由差异、目标 target 命中失败、后处理等待态卡住等不稳定因素。

## 当前评审结论

- 当前状态：实现完成，黑盒验收通过，可提验
- 建议口径：HV-008 本阶段不再继续推进整句级 LLM 后处理，先以下线该能力并保证语音输入主流程稳定上线为准；后续如产品节奏允许，再单独重启该能力评估
