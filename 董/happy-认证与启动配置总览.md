# Happy 认证与启动配置总览（本地开发版）

## 0. 超简操作版（一页）

### 0.1 一键思路
- 先起 Server（3005），再起 Web（8083）。
- Web 和手机 App 都指向同一个 Server：`http://<电脑IP>:3005`。
- 绝对不要在手机场景用 `localhost:3005`。

### 0.2 最短步骤（5 步）
1. 电脑启动服务端：运行 `01-start-server.sh`
2. 电脑启动 Web：运行 `02-start-web.sh`
3. 浏览器打开 `http://<电脑IP>:8083/server`，设置 `http://<电脑IP>:3005`
4. 手机 App 里也设置同样的 Server 地址 `http://<电脑IP>:3005`
5. 回登录页重试“创建账户”或“使用移动应用登录”

### 0.3 30 秒自检
- 打开 `http://<电脑IP>:3005`，能看到 `Welcome to Happy Server!`
- Web 顶部显示的 server 不是 `localhost:3005`
- 手机 App 的 server 也不是 `localhost:3005`

### 0.4 失败时只看这 3 条
- Web 与手机是否连到同一个 `http://<电脑IP>:3005`
- 是否误用了 `localhost`
- 是否修改了启动脚本但没重启 Web

## 1. 先说结论（最容易踩坑的点）

- Web/手机端“认证失败”最常见原因不是算法问题，而是两端没有连到同一个 Server 地址。
- 在手机访问场景下，`localhost` 一定要避免：手机里的 `localhost` 指向手机自身，不是电脑。
- 本地开发时建议统一使用 `http://<电脑局域网IP>:3005`（Server）和 `http://<电脑局域网IP>:8083`（Web）。
- 当前项目“创建账户失败”时 UI 提示不明显，很多错误只在控制台里打印。

## 2. 启动链路（本地开发）

### 2.1 服务端启动（happy-server）
- 脚本：`01-start-server.sh`
- 核心行为：
  1. 设置基础环境变量（如 `HANDY_MASTER_SECRET`、`DATA_DIR`）
  2. 执行数据库迁移
  3. 启动 API 服务

- 服务监听：
  - Server 监听 `0.0.0.0`，可被局域网设备访问（不是仅本机回环）。

### 2.2 Web 启动（happy-app web）
- 脚本：`02-start-web.sh`
- 核心行为：
  1. 设置 Web 侧环境变量（如 `EXPO_PUBLIC_HAPPY_SERVER_URL`）
  2. 启动 `happy-app web --port 8083`

- 注意：
  - 脚本环境变量只在启动时生效。
  - 若你修改脚本内容，需重启 web 进程才生效。
  - 若只在页面 `/server` 中修改地址，通常无需重启。

## 3. Server 地址配置机制（重点）

客户端读取地址优先级如下：

1. 持久化自定义地址（MMKV，key: `custom-server-url`）
2. 环境变量 `EXPO_PUBLIC_HAPPY_SERVER_URL`
3. 默认值 `https://api.cluster-fluster.com`

这意味着：
- 你在 `/server` 页面保存过自定义地址后，会覆盖 env 默认值。
- 同一设备（Web 或手机 App）会记住该地址，跨登录保留。

## 4. 认证链路总览

### 4.1 创建账户（Create Account）
适用于“本设备直接注册”。

流程：
1. 客户端生成 32 字节 secret
2. 本地计算 challenge/signature/publicKey
3. 调用 `POST /v1/auth`
4. 服务端验签成功后签发 token
5. 客户端保存 token + secret（用于后续 E2E 加密会话）

失败常见原因：
- Server URL 配错（请求打到错误服务）
- 服务端不可达或跨网络不可达
- 秘钥或请求体异常（少见）

### 4.2 使用移动应用登录（Web 端恢复/链接）
适用于“已有手机账户，给 Web/新设备授权”。

流程：
1. Web 发起 `POST /v1/auth/account/request`（携带 publicKey）
2. Web 显示二维码（包含公钥信息）
3. 手机 App 扫码后调用 `POST /v1/auth/account/response` 进行批准
4. Web 轮询等待拿到 token/response
5. Web 完成登录

失败常见原因：
- Web 与手机 App 指向不同 Server（最常见）
- 一端是 `localhost`，另一端是局域网 IP
- 批准请求在另一套数据库中，导致 request not found 或 auth failed

## 5. 为什么会出现“创建账户没反应”

当前实现里，`createAccount` 失败时主要是 `console.error`，UI 不一定弹出明显错误提示。  
因此用户体感会是“点了没反应”，但实际网络请求可能已报错。

## 6. 本地开发推荐配置（稳定方案）

统一使用局域网 IP（示例 `172.20.10.2`）：

- Server: `http://172.20.10.2:3005`
- Web: `http://172.20.10.2:8083`

并确保：
- Web `/server` 页面设置为 `http://172.20.10.2:3005`
- 手机 App 的 Server 设置同样为 `http://172.20.10.2:3005`
- 不使用 `localhost` 做跨设备认证

## 7. 排障清单（按顺序）

1. 在电脑浏览器打开 `http://<IP>:3005`，应看到 `Welcome to Happy Server!`
2. Web 打开 `http://<IP>:8083/server`，确认 Server URL 正确
3. 手机 App 服务器设置同样改为 `http://<IP>:3005`
4. 重试“创建账户”或“使用移动应用登录”
5. 若仍失败，再看浏览器控制台与 server 日志定位具体错误码（401/404/网络错误）

## 8. 建议优化（后续可做）

- 启动脚本自动检测局域网 IP，避免硬编码 `localhost`
- 登录页在 createAccount 失败时弹出明确错误
- 登录页显式展示“当前使用的 Server URL”
- 扫码页增加“Web 与手机必须连接同一 Server”的提示
