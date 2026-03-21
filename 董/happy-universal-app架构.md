# Happy Coder Universal App (通用应用) 架构深度解析

`happy-app` 采用了现代化的 **Universal App** 架构，实现了 **Write Once, Run Everywhere**（一次编写，到处运行）。它不仅是 iOS/Android 原生应用，同时也是功能完整的 Web App 和 macOS 桌面应用。

## 1. 核心架构：React Native + Expo Router

### 1.1 技术栈基石
- **React Native Web**: 将 React Native 组件（`<View>`, `<Text>`）映射为 Web 平台的 HTML 元素（`<div>`, `<span>`），保证一套代码在多端渲染一致。
- **Expo Router**: 文件系统路由方案（类似 Next.js），统一了移动端（栈式导航）和 Web 端（URL 导航）的差异。
    - `sources/app/index.tsx` -> 首页
    - `sources/app/(app)/session/[id].tsx` -> 动态路由页面

### 1.2 平台差异化适配
虽然代码共享率极高，但在细节上通过以下方式处理平台差异：
- **文件后缀区分**：构建工具自动选择 `Input.web.tsx`, `Input.ios.tsx`, `Input.android.tsx`。
- **运行时判断**：使用 `Platform.OS` 在代码中分支处理（如 Web 端处理键盘事件，Native 端调用震动反馈）。
- **配置分离**：Web 端独有的 `webpack.config.js` 和 `public/` 资源目录。

### 1.3 样式系统 (NativeWind)
- 使用 **NativeWind** 实现 Tailwind CSS 风格的样式编写。
- **编译原理**：
    - Web: 编译为标准 CSS。
    - Native: 编译为 React Native `StyleSheet` 对象。
- 优势：一套样式代码，两端表现一致，开发效率极高。

## 2. 为什么真机扫码无法运行？

你在尝试使用 Expo Go 扫描二维码时遇到错误，根本原因是项目依赖了 **Native Modules (原生模块)**：

- **`react-native-webrtc`**: 实时音视频通话底层库。
- **`react-native-skia`**: 高性能 2D 图形渲染引擎。
- **`@livekit/react-native`**: 实时通信 SDK。

**标准的 Expo Go App** 仅包含 Expo SDK 预置的基础原生代码，**不包含**上述第三方原生库的二进制代码。因此，当 JS 代码试图调用这些原生模块时，App 无法响应或报错。

### 解决方案：Development Build
要运行此项目，必须构建自定义的 **Development Client**：
1.  使用 **EAS Build** 服务打包包含所有原生依赖的调试包（`.ipa` / `.apk`）。
2.  安装该调试包到真机。
3.  使用该调试包扫描二维码进行开发。

## 3. 架构优势总结

1.  **极致的代码复用**：业务逻辑、状态管理、网络请求完全共享 (>95%)。
2.  **高效的开发流程**：优先在 Web 端（浏览器）快速迭代 UI/逻辑，无需等待原生编译，验证通过后再进行真机测试。
3.  **全平台覆盖**：低成本同时发布 iOS, Android, Web, macOS (Tauri) 四端应用。
