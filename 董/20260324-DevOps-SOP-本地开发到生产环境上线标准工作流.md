# Happy Coder - DevOps 标准作业程序 (SOP)

本文档定义了从本地开发验证到生产环境安全上线的标准工作流，适用于包含 `前端 (React Native/Expo)`、`CLI (Node.js)` 和 `Server 端 (Fastify)` 的全栈功能迭代。

---

## 一、 本地开发与极速验证阶段

目标：在不污染线上生产数据的前提下，实现代码修改的秒级真机验证。

### 1. 环境隔离与准备
- **后端配置**: 
  - 在 `packages/happy-server/` 下维护一份 `.env.dev`。
  - 使用本地测试数据库（如本地起的 PostgreSQL 容器）。
  - 第三方服务（如科大讯飞、ElevenLabs）使用**测试环境 API Key**。
- **启动本地 Server**:
  ```bash
  ./01-start-server.sh
  ```

### 2. 手机真机联调 (局域网直连)
为了让手机 App 能访问您 Mac 上的本地 Server，必须确保：
1. 手机和 Mac 连接**同一个 Wi-Fi**。
2. 运行专用的本地开发脚本：
   ```bash
   ./02-start-web.sh
   ```
   *该脚本会自动获取 Mac 的局域网 IP，并将其作为 `EXPO_PUBLIC_SERVER_URL` 环境变量注入。*

### 3. 热重载 (Hot Reload) 验证
- 在 `packages/happy-app` 中修改前端代码（如 React 组件、Hooks）。
- 保存文件后，手机上的 Expo Development Client 会瞬间自动刷新。
- **验证范围**：UI 交互、状态管理、通过 WebSocket 与本地 Server 的联调。

---

## 二、 生产环境上线策略 (双轨制)

新功能在本地验证通过后，按照以下步骤发布到生产环境（阿里云 + 手机应用商店）。**必须先发布后端，再发布前端。**

### 轨道一：Server 端上线 (阿里云)
稳字当头，涉及数据结构的改动必须谨慎。

1. **数据库迁移 (Migration)**
   - 如果新增了 Prisma 模型或字段，先在生产库执行：
     ```bash
     cd packages/happy-server
     yarn prisma migrate deploy
     ```
2. **构建 Docker 镜像**
   - 使用项目根目录的 `Dockerfile.server` 构建包含最新代码的镜像。
   - 推送镜像至阿里云容器镜像服务 (ACR)。
3. **滚动更新**
   - 在阿里云服务器拉取最新镜像，重启服务。
   - **注意**：生产环境必须使用单独的 `.env` 文件，切勿将线上数据库密码或真实 API Key 提交到 Git。

### 轨道二：App 端上线 (手机端)
根据代码修改的性质，选择不同的发布方式：

#### 方式 A：闪电热更新 (OTA Update) —— 适用于 90% 的场景
- **触发条件**：仅修改了纯 JavaScript/TypeScript 代码（UI 调整、逻辑修复、现有原生组件的方法调用）。
- **操作指令**：
  ```bash
  cd packages/happy-app
  eas update --branch production
  ```
- **效果**：代码推送到 Expo 云端。用户无需前往 App Store 下载，杀掉 App 重新打开即可瞬间加载新功能。

#### 方式 B：发版大更新 (App Store 提审) —— 适用于 10% 的场景
- **触发条件**：修改了底层原生能力，如安装了新的原生模块（依赖 C++/Java/Swift 的库），或修改了 `app.config.js` 中的权限声明（如新增蓝牙权限）。
- **操作指令**：
  ```bash
  cd packages/happy-app
  eas build --profile production --platform ios
  eas build --profile production --platform android
  ```
- **效果**：打出 `.ipa` (iOS) 或 `.aab` (Android) 安装包，需要提交至应用商店重新审核（耗时 1-2 天）。

---

## 三、 高级实践：功能开关 (Feature Flags)

为了在生产环境安全地增强新功能，推荐使用“功能开关”机制：

1. **本地开发并上线隐藏功能**
   - 在 `packages/happy-app/sources/sync/storage.ts` 的 `Settings` 接口中添加默认关闭的新配置项（如 `enableNewVoiceEngine: false`）。
2. **生产环境灰度验证**
   - 代码发布到生产环境后，该功能对普通用户不可见。
   - 开发团队可在自己的 App 设置页中手动开启该开关，进行真实的线上环境验证。
3. **全量开放或紧急熔断**
   - 验证无误后，通过后续的 OTA 更新将默认值改为 `true` 全量开放。
   - 若发现严重线上 Bug，可一键将开关置为 `false` 进行熔断，无需紧急回滚代码。