# Happy 局域网/移动端部署与排障总结

这份文档总结了我们在本地开发环境下，如何让手机/其他局域网设备无需官方 App 也能正常访问和使用 Happy 服务的全过程，以及遇到的所有坑和解决方案。

---

## 核心痛点与问题根因

在测试过程中，我们遇到了几个典型的卡点：

1. **服务启动就挂（显示“已断开”）**
   - **现象**：Web 页面左上角显示红色“已断开”，且无法重连。
   - **根因**：后端 Server 默认启用了 metrics 监控（监听 9090 端口），如果该端口被占用，Server 会静默崩溃退出。
   - **解决**：在启动 Server 时添加环境变量禁用它：`METRICS_ENABLED=false bash ./01-start-server.sh`。

2. **局域网 IP 访问报错（创建账户点不动）**
   - **现象**：通过局域网 IP（如 `http://172.20.10.2:8083`）访问时，点击按钮没反应，控制台报 `crypto.subtle.generateKey is undefined`。
   - **根因**：浏览器的安全策略（Secure Context）。Web Crypto API 只能在 `localhost` 或 `HTTPS` 下使用。普通的局域网 IP HTTP 访问会被浏览器禁用加密功能。
   - **解决**：搭建本地 HTTPS 反向代理，将 HTTP 流量包装成 HTTPS。

3. **发消息无响应 / 找不到终端**
   - **现象**：登录成功，但在会话中发送消息没反应，或者提示“请选择一台设备以启动会话”。
   - **根因**：
     - Daemon 没有启动，导致没有计算资源可以响应消息。
     - CLI / Daemon 登录的账号与 Web 端登录的账号**不一致**，导致互相不认识。
     - Web UI 的机器列表里没有手动选中高亮当前机器。
   - **解决**：注销旧 CLI 账号，重新走一次 `Web Browser` 认证；然后手动运行 `daemon start-sync`，并在网页中点选卡片激活。

4. **HTTPS 代理下“连接服务器失败”**
   - **现象**：配置了 HTTPS 后，在网页的 `/server` 里设置自定义 URL（如 `https://172.20.10.2:3443`）时提示失败。
   - **根因**：浏览器允许了 Web 页面（8443）的自签名证书，但拦截了后台通过 Fetch/XHR 发往 API 端口（3443）的请求。
   - **解决**：新开一个浏览器标签，手动访问一次 API 的地址（如 `https://172.20.10.2:3443/v1/version`），点击“高级 -> 继续访问”以信任该端口的证书。

---

## 最终版：局域网手机访问标准启动流程

以后每次重新测试，只需严格按照以下步骤操作，即可一次点亮：

### Step 1: 启动底层服务 (Server & Web)
分别在两个独立的终端窗口运行：
```bash
# 终端 1: 启动 Server（禁用 9090 防止冲突）
METRICS_ENABLED=false bash ./01-start-server.sh

# 终端 2: 启动 Web
bash ./02-start-web.sh
```

### Step 2: 启动 HTTPS 反向代理
在项目根目录下，运行我们写好的 Node.js 代理脚本（自带自签名证书生成）：
```bash
# 终端 3: 启动 HTTPS 代理
node https-proxy.js
```
*(代理映射关系：HTTPS 8443 -> HTTP 8083; HTTPS 3443 -> HTTP 3005)*

### Step 3: 浏览器信任证书（关键）
在电脑或手机浏览器中执行：
1. 访问 `https://<你的局域网IP>:3443/v1/version`，忽略警告并信任证书（为了让 API 请求不被拦截）。
2. 访问 `https://<你的局域网IP>:8443`，忽略警告并信任证书，进入 Web 首页。

### Step 4: 配置 Server 并登录
1. 在 Web 页面进入 `/server` 路由。
2. 将服务器地址改为：`https://<你的局域网IP>:3443`，点击保存。
3. 返回首页，点击 **“创建账户”**。

### Step 5: 同步 CLI 与 Daemon
在电脑终端运行：
```bash
# 终端 4: 强制重新认证（必须带上环境变量，否则请求会发给 http 导致失败）
HAPPY_SERVER_URL=https://<你的局域网IP>:3443 NODE_TLS_REJECT_UNAUTHORIZED=0 yarn workspace happy-coder cli auth login --force
```
- 提示时选择 `2. Web Browser`。
- 在弹出的浏览器（或复制链接到你刚才登录的浏览器）中点击 **Approve**。

认证成功后，启动 Daemon：
```bash
# 终端 5: 启动守护进程
HAPPY_SERVER_URL=https://<你的局域网IP>:3443 NODE_TLS_REJECT_UNAUTHORIZED=0 yarn workspace happy-coder cli daemon start-sync
```

### Step 6: 建立会话
1. 刷新手机/电脑上的 Web 页面。
2. 点击左上角的九宫格图标（Workspace）。
3. 找到名为 `MacBook-Pro`（或对应主机名）的卡片，**点击它**（使其背景高亮，显示 Active）。
4. 点击底部的 **Start Session**。
5. 发送测试消息，验证全链路连通。
