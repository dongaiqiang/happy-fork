# Universal App (通用应用) 开发最佳实践与注意事项

Happy Coder 采用了现代化的 **Universal App** 架构，实现了 **Web First** 的跨平台开发体验。以下是实现此类架构的关键实践和注意事项：

## 1. 核心思维：Web First (Web 优先)

虽然是 React Native 项目，但建议**优先在 Web 端开发和调试**。
*   **为什么？** Web 端调试速度快（秒级热重载），不需要模拟器/真机，也没有原生构建的等待时间。
*   **怎么做？** 日常开发运行 `yarn web` 或 `expo start --web`。确保你的逻辑在浏览器里跑通，这通常意味着它在 JS 层面是通的。

## 2. 组件与样式规范

### 2.1 避免直接使用 HTML 标签
*   **绝对禁止**：在代码里写 `<div>`, `<span>`, `<img>`。
*   **必须使用**：React Native 组件 `<View>`, `<Text>`, `<Image>`, `<ScrollView>`。
*   **原理**：`react-native-web` 会自动把 `<View>` 编译成 `<div>`，但浏览器不懂 `<View>`。反过来，原生 App 根本不懂 `<div>`。

### 2.2 样式处理：拥抱 NativeWind
*   **不要写 CSS 文件**：原生 App 不支持 `.css` 文件。
*   **推荐**：使用 **NativeWind** (Tailwind for RN) 或 `StyleSheet.create`。
*   **注意**：Flexbox 是唯一布局方式（RN 默认是 Flex 列布局，Web 默认是行布局，要注意 `flex-direction`）。

## 3. 路由与导航：Expo Router

*   **文件即路由**：使用 `app/index.tsx`, `app/profile/[id].tsx` 这种结构。
*   **链接跳转**：使用 `<Link href="/profile/123">` 而不是 `history.push` 或 `<a href>`。
*   **栈 vs URL**：Expo Router 会自动把 Web 的 URL 映射为 App 的 Stack Navigation。

## 4. 平台差异隔离 (Platform Specific Code)

当遇到必须区分平台的功能时，有三种隔离策略：

### 4.1 策略 A：文件后缀（推荐用于组件）
*   `Button.tsx` (通用接口)
*   `Button.web.tsx` (Web 实现)
*   `Button.ios.tsx` (iOS 实现)
*   `Button.android.tsx` (Android 实现)
*   引用时只需 `import Button from './Button'`，构建工具会自动挑。

### 4.2 策略 B：Platform.OS（推荐用于小逻辑）
```typescript
import { Platform } from 'react-native';
const isWeb = Platform.OS === 'web';
const eventType = isWeb ? 'click' : 'press';
```

### 4.3 策略 C：Platform.select（推荐用于样式/配置）
```typescript
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      web: { cursor: 'pointer' }, // Web 独有
      default: { elevation: 5 }   // Native 阴影
    })
  }
});
```

## 5. 第三方库的选择

选库是最大的坑。**必须选择支持双端的库**。
*   ❌ 避免：`react-router-dom` (Web only), `react-native-maps` (Native only)。
*   ✅ 推荐：`Moti` (通用动画), `Zeego` (通用菜单), `Dripsy` (通用样式)。
*   **检查方法**：去 [React Native Directory](https://reactnative.directory/) 搜索库，看它是否标记了 "Web" 支持。

## 6. 环境变量与 API

*   **网络请求**：Web 端发请求不存在跨域问题（如果是同源）。
*   **App 端注意**：**不能用 `localhost`**！因为手机的 `localhost` 是手机自己。必须用电脑的局域网 IP。
*   **环境配置**：使用 `expo-constants` 或 `.env` 文件来区分不同环境的 API 地址。

## 7. 调试与构建

*   **Web 调试**：Chrome DevTools (F12) 是神器。
*   **App 调试**：使用 Expo Go（如果无原生代码）或 Development Build（如果有原生代码）。
*   **EAS Build**：这是云端构建服务。你不需要买 Mac 也能构建 iOS App（EAS 会在云端 Mac 上帮你打包）。

**总结一句话：**
**把 Web 当作“另一个原生平台”来开发**，而不是把 App 当作“网页套壳”。遵循 React Native 的规范，Web 端自然水到渠成。
