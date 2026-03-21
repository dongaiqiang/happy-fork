# Happy Coder 移动端 (happy-app) 技术分析

`happy-app` 是一个全能的远程控制客户端，负责与 Daemon 交互，通过 WebSocket 实现实时通信，并通过 LiveKit/ElevenLabs 实现多模态交互（语音/视频）。

## 1. 核心技术栈

*   **框架**: **Expo SDK 54** (React Native 的超集)
    *   `expo-router`: 文件系统路由（类似 Next.js），处理页面跳转。
    *   `expo-dev-client`: 支持自定义原生代码的开发客户端。
*   **UI 库**:
    *   `react-native-reanimated` + `react-native-gesture-handler`: 高性能动画和手势。
    *   `@shopify/react-native-skia`: 高性能 2D 图形渲染（可能用于代码编辑器或酷炫背景）。
    *   `nativewind`: Tailwind CSS 风格的样式支持。
*   **通信**:
    *   `@slopus/happy-wire`: 项目自研的通信协议库（可能封装了 WebSocket/HTTP）。
    *   `axios`: HTTP 请求。
*   **实时音视频**:
    *   `@livekit/react-native`: 提供实时语音/视频通话功能（可能用于语音编程助手）。
    *   `@elevenlabs/react-native`: AI 语音合成（TTS）。

## 2. 架构设计

从文件结构看，它是**通用化设计**，一套代码跑多端：

*   **路由结构 (`sources/app`)**:
    *   `(app)`: 主应用逻辑，包含 `dev`, `friends`, `inbox`, `machine`, `session` 等功能模块。
    *   `session/[id]`: 核心聊天界面。
    *   `terminal`: 终端连接界面。
*   **多端适配**:
    *   `package.json` 里有 `web`, `android`, `ios`, `tauri` (macOS桌面端) 的启动脚本。
    *   这意味着它不仅是个手机 App，还是个 Web App（你现在浏览器里看到的那个），甚至可以打包成 macOS 原生应用。

## 3. 关键功能模块

1.  **Session 管理 (`sources/app/(app)/session`)**:
    *   这是聊天的核心页面。它应该会复用 Web 端的逻辑，通过 WebSocket 连接 Daemon。
2.  **Machine 管理 (`sources/app/(app)/machine`)**:
    *   管理连接的机器（你的电脑）。
    *   通过扫描二维码 (`sources/app/(app)/dev/qr-test.tsx`) 或手动输入 URL 来连接。
3.  **语音交互**:
    *   集成了 LiveKit 和 ElevenLabs，说明它支持**语音对话编程**。你可以对着手机说话，它把语音转文字发给 Server，Server 处理完再把结果读出来。

## 4. 如何连接本地环境？

移动端 App 要连接你本地的 Server，有一个网络问题要解决：**手机和电脑必须在同一个局域网，或者通过公网访问。**

*   **局域网模式**:
    1.  手机连 WiFi，电脑连 WiFi。
    2.  在 App 里输入电脑的局域网 IP（例如 `http://192.168.1.5:3005`）。
    3.  Server 必须监听 `0.0.0.0` 而不是 `localhost`（我们之前的脚本默认是监听所有接口的，或者需要配置）。
*   **公网模式 (Ngrok)**:
    1.  电脑上运行 `ngrok http 3005`。
    2.  App 里输入 ngrok 的公网 URL。

## 5. 总结

`happy-app` 是一个**全能客户端**。
- 它不包含编译/运行代码的能力（那是 Daemon/CLI 的事）。
- 它只是一个**远程控制器**。
- 它利用 React Native 实现了跨平台，利用 WebSocket 实现了实时性，利用 LiveKit 实现了多模态交互（语音）。
