# Happy Coder iOS 云端打包与 TestFlight 上架手册

这份文档记录了使用 Expo EAS (Expo Application Services) 将 Happy Coder 前端项目打包成原生 iOS App，并发布到苹果 TestFlight 进行公测的完整闭环流程。

---

## 前置准备与环境修复
在进行云端打包前，必须确保本地环境的干净和配置的正确性。

**操作目录**：必须在前端目录下执行所有打包命令：
```bash
cd /Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/packages/happy-app
```

### 1. 修复 Node.js 版本兼容性
Expo 云端服务器默认 Node 版本可能较低（如 20.19.4），会导致依赖（如 `rollup-plugin-import-trace`）安装失败。
**解决办法**：在 `eas.json` 中的每一个 build profile 下增加强制的 Node 版本声明：
```json
"node": "20.20.0"
```

### 2. 移除导致 Xcode 编译报错的废弃包
如果在云端 Xcode 编译阶段报错 `'SafeAreaControllable' is not a member type of struct 'ExpoModulesCore.ExpoSwiftUI'`，说明引入了不兼容的 Beta 版 UI 库。
**解决办法**：
```bash
# 移除罪魁祸首
yarn remove @expo/ui

# 清理缓存并重新安装依赖
rm -rf node_modules yarn.lock ios
yarn install
```

---

## 第一阶段：执行云端打包 (EAS Build)

当环境准备就绪后，通过 EAS 将代码推送到 Expo 云端进行 macOS/Xcode 编译。

1. **登录 Expo 账号**（如未登录）：
   ```bash
   npx eas-cli login
   ```
2. **执行生产环境打包命令**：
   ```bash
   npx eas-cli build --platform ios --profile production
   ```
3. **交互提示说明**：
   - 终端会询问你的 Apple ID 和密码（或双重认证验证码），请如实填写。
   - 遇到是否自动创建 App ID、生成 Provisioning Profile 等提示，全部输入 `Y` 同意。
4. **等待编译**：
   打包大约需要 15-25 分钟。完成后终端会打印出一个绿色的 `✔ Build finished`，并附带一个 `.ipa` 文件的下载链接。

> **注意**：Production 证书打出来的 `.ipa` 文件**无法**通过数据线或第三方助手直接安装到手机，必须通过苹果官方的 TestFlight 渠道分发。

---

## 第二阶段：在苹果开发者后台创建应用坑位

在将包推送给苹果之前，必须在苹果后台建立档案。

1. 登录 [App Store Connect](https://appstoreconnect.apple.com/)。
2. 点击 **“我的 App”** -> 左上角 **“+”** -> **“新建 App”**。
3. **填写表单关键信息**：
   - **名称**：必须全球唯一（如果提示被占用，请加后缀如 "EasyCode 智能终端"）。
   - **主要语言**：选择 `简体中文`。
   - **套装 ID (Bundle ID)**：下拉选择 `com.easycode.app`。
   - **SKU**：自定义，如 `easycode-01`。
   - **用户访问权限**：选择 `完全访问权限`。
4. 点击 **“创建”**。

---

## 第三阶段：将包推送至苹果服务器 (EAS Submit)

**避坑指南**：在推送前，必须确保 `eas.json` 中没有残留原作者的提交配置。请检查并确保 `submit.production` 下没有错误的 `ascAppId`，或者直接指定为你刚才新建的 App 的 ID。

在 `happy-app` 目录下执行推送命令：
```bash
npx eas-cli submit --platform ios --profile production
```

**交互流程**：
1. **选择包**：默认高亮 `Select a build from EAS`，按回车，选择刚刚打包完成的最新一条记录。
2. **密码验证**：当系统索要 `App-Specific Password` 时，去 [appleid.apple.com](https://appleid.apple.com/) 生成一个“App 专用密码”并粘贴进来（注意：绝不能用平时的登录密码）。
3. 看到绿色的 `✔ Submitted your app to Apple App Store Connect!` 即代表推送成功。

---

## 第四阶段：TestFlight 配置与分发

包推送到苹果服务器后，需要约 10-15 分钟进行机审代码扫描。

1. **处理出口合规证明**：
   - 回到 App Store Connect 网页，点击顶部的 **“TestFlight”**。
   - 看到刚才推送的包旁边有黄色警告（Missing Compliance）时，点击它。
   - 询问是否包含加密功能，直接选择 **“否 (No)”** 即可。
   - 此时包的状态会变成 **“准备提交”**。

2. **创建内部测试组并发放邀请**：
   - 在左侧菜单点击 **“内部测试 ⊕”**，新建一个群组（如 `Dev Team`）。
   - 在群组中点击 **“+ 添加测试员”**，勾选你的苹果账号邮箱。
   - 在同一页面点击 **“+ 添加构建版本”**，把刚才处理好的包加进来。

3. **手机端下载安装**：
   - 苹果会自动发一封邀请邮件到你的邮箱。
   - 在手机 App Store 下载官方的 **“TestFlight”** 应用。
   - 打开邮件，点击 `View in TestFlight` 或复制 `Redeem Code` 到 TestFlight 中兑换。
   - 点击 **Install**，原生应用即刻安装到手机桌面！