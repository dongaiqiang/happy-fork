# Happy 生产环境部署操作手册（阿里云篇）【更新版】
本手册旨在指导你如何在阿里云服务器上，使用真实域名和 HTTPS 证书，部署 Happy 的“云端分离”架构。
部署完成后，你可以在任何地方通过手机/浏览器安全地控制你本地电脑（MacBook）进行编程。

## 架构说明
阿里云（云端信令）：负责运行 Web UI 和 Server（鉴权与消息路由），并使用 Caddy 处理 HTTPS 证书。
本地 MacBook（计算节点）：负责运行 Daemon，通过合法的 WSS 长连接挂载到阿里云，实际执行代码。
手机/外部设备：通过域名访问阿里云上的 Web UI。

## 第一阶段：阿里云前期准备
### 1. 准备域名
购买一个域名（例如 easycode-ai.xyz）。
注意：如果阿里云服务器在中国大陆节点（如杭州、北京），域名必须完成 ICP 备案。如果是香港或海外节点则不需要。

进入阿里云 云解析 DNS 控制台。
添加两条 A 记录，指向你阿里云服务器的公网 IP：
- 主机记录：app （用于 Web 界面，完整域名为 app.easycode-ai.xyz）
- 主机记录：api （用于 Server 通信，完整域名为 api.easycode-ai.xyz）

### 2. 开放服务器端口
进入阿里云 ECS 控制台 -> 安全组规则 -> 入方向，添加规则放行以下端口：
- 80 (TCP) - 用于 Caddy 自动申请 Let's Encrypt 证书
- 443 (TCP) - 用于 HTTPS 访问
- 22 (TCP) - SSH 登录（通常已默认开放）
- 8081 (TCP) - [新增] Happy App 前端服务端口（可选，仅用于调试）

## 第二阶段：阿里云服务器部署
使用 SSH 登录到你的阿里云服务器。

### 1. 安装基础环境 (Node.js & Yarn & PM2)
根据你的服务器操作系统类型，选择对应的安装命令：

#### 选项 A: 如果是 Ubuntu / Debian 系统
```bash
# 安装 Node.js 22.x (Happy 推荐版本)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 选项 B: 如果是 Alibaba Cloud Linux / CentOS / RHEL 系统
```bash
# 安装 Node.js 22.x
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs
```

#### 全局安装 yarn 和 pm2 (通用)
(注意：请确保 Node.js 安装完成后，再单独执行以下命令，避免复制粘贴时命令粘连报错)
```bash
sudo npm install -g yarn pm2
```

### 2. 安装并配置 Caddy
Caddy 是一个极简的反向代理，它会自动为你申请和续期 HTTPS 证书。

#### 选项 A: 如果是 Ubuntu / Debian 系统
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

#### 选项 B: 如果是 Alibaba Cloud Linux / CentOS / RHEL 系统
```bash
sudo yum install -y yum-plugin-copr
sudo yum copr enable @caddy/caddy -y
sudo yum install -y caddy
```

#### 编辑 Caddy 配置文件（核心更新）：
```bash
sudo nano /etc/caddy/Caddyfile
```
清空里面的内容，粘贴以下配置（请把域名换成你自己的）：
```caddyfile
app.easycode-ai.xyz {
    reverse_proxy localhost:8081  # 【关键修改】从 8083 改为 8081（Happy App 实际运行端口）
}

api.easycode-ai.xyz {
    reverse_proxy localhost:3005
}
```
保存后重启 Caddy：
```bash
sudo systemctl restart caddy
```

### 3. 部署 Happy 代码
```bash
# 找个目录克隆代码
cd ~
git clone https://github.com/你的仓库/happy.git happy-main
cd happy-main

# 安装依赖
yarn install
```

### 4. 使用 PM2 后台启动服务（核心更新）
在 happy-main 目录下执行：

#### 步骤 1: 启动 Server（保持不变）
```bash
pm2 start --name happy-server \
  --env METRICS_ENABLED=false \
  --env ENABLE_PLAINTEXT_MODE=true \
  --env HANDY_MASTER_SECRET='happy-master-secret-2026' \
  -- /usr/bin/yarn workspace happy-server start  # 【新增】指定完整 yarn 路径，避免找不到命令
```

#### 步骤 2: 启动 Happy App 前端（核心修改）
```bash
# 进入 Happy App 前端目录
cd ~/happy-main/packages/happy-app
# 安装前端依赖（首次启动必须）
/usr/bin/yarn install
# 后台启动 Happy App（适配 Expo/React Native 架构）
EXPO_PUBLIC_ENABLE_PLAINTEXT_MODE=true pm2 start --name happy-app \
  --cwd ~/happy-main/packages/happy-app \
  -- /usr/bin/yarn start  # 【关键修改】启动 happy-app 而非 happy-web
```

#### 步骤 3: 保存 pm2 状态，使其开机自启
```bash
pm2 save
pm2 startup
```

### 5. [可选] 在阿里云上部署 Daemon (将服务器变成云端开发机)
你可以让阿里云服务器不仅仅作为“邮局”，同时也作为一台可以执行代码的计算节点。这样你出门时，连家里的 MacBook 都不用开，直接在手机上控制阿里云写代码。

在阿里云终端执行：
```bash
# 1. 登录云端 Server
HAPPY_SERVER_URL=https://api.easycode-ai.xyz yarn workspace happy-coder cli auth login

# 2. 验证后，使用 PM2 守护启动 Daemon
HAPPY_SERVER_URL=https://api.easycode-ai.xyz pm2 start "yarn workspace happy-coder cli daemon start-sync" --name "happy-daemon"
pm2 save
```
完成这一步后，你的手机 Web 端会出现一张名为 Aliyun-Ubuntu (或你的服务器主机名) 的卡片。

## 第三阶段：手机端初始化
1. 拿出手机，打开浏览器。
2. 访问 https://app.easycode-ai.xyz。
   (此时你应该能看到绿色的安全锁，没有任何警告！)
3. 进入左侧（或顶部）设置（/server 页面）。
4. 将 自定义服务器 URL 修改为：https://api.easycode-ai.xyz，点击保存。
5. 回到首页，点击 “创建账户”。

## 第四阶段：本地 MacBook 连接云端
现在，云端已经准备就绪，你需要让你自己的 MacBook 作为“打工人”连接上去。

在你的 MacBook 终端里，执行以下命令：

### 1. 清理旧状态（如果在本地折腾过）
```bash
rm -rf ~/.happy/access.key ~/.happy/daemon.state.json ~/.happy/daemon.state.json.lock ~/.happy/settings.json
```

### 2. 登录到云端 Server
```bash
# 注意这里换成你自己的 api 域名，不需要加拒绝证书的参数了，因为证书是真的！
HAPPY_SERVER_URL=https://api.easycode-ai.xyz yarn workspace happy-coder cli auth login
```
选择 2. Web Browser。
在弹出的浏览器里（或在手机上）点击 Approve。

### 3. 启动本地 Daemon
认证成功后，启动守护进程：
```bash
HAPPY_SERVER_URL=https://api.easycode-ai.xyz yarn workspace happy-coder cli daemon start-sync
```
(如果希望 Daemon 在后台默默运行，可以去掉 -sync 或者用 pm2 守护它)

## 第五阶段：起飞
1. 在手机上刷新 https://app.easycode-ai.xyz。
2. 点击左上角九宫格，此时你应该能看到代表你 MacBook 的机器卡片。
3. 点击选中该卡片（显示 Active）。
4. 点击底部 Start Session。
5. 发送指令：“帮我在桌面上建一个 hello.txt”。

至此，完美的云原生端到端架构部署完毕！你的所有消息在手机端产生，经由阿里云中转，最终在 MacBook 上执行。

## 附录：关于端到端加密 (E2EE) 与明文模式的特别说明
在部署步骤的第 4 步中，我们使用了 ENABLE_PLAINTEXT_MODE=true 等环境变量来禁用了应用层的端到端加密。这里详细解释一下背后的原因以及与官方部署的区别。

### 1. 为什么官方部署必须开启端到端加密？
在 Happy Coder 官方提供的公共 SaaS 服务中，全球的开发者都在连接同一个 Server。基于零信任架构 (Zero-Trust Architecture)：
- 用户不应该信任公共服务器的拥有者（如果服务器被黑客攻破，代码和本地权限就会暴露）。
- 因此，官方架构会在 Web UI（手机端）和 Daemon（电脑端）分别生成公私钥。
- 所有消息在发送前，都在手机端使用电脑端的公钥进行加密（基于 libsodium / TweetNaCl）。
- 官方中转 Server 收到的只是一堆 Base64 乱码，它只负责转发，没有私钥，根本无法解密看到里面的内容。这保证了绝对的隐私。

### 2. 为什么我们要在阿里云私有化部署中禁用它？
当我们在一台自己购买的阿里云服务器上进行私有化部署时，信任模型发生了改变：
- 你是服务器的主人：中转 Server 完全在你的控制之下，你不需要防范“服务器拥有者偷看你的数据”。
- 外部 HTTPS 已提供足够安全：我们在步骤 2 中配置了 Caddy 反向代理并绑定了域名，自动启用了标准的 Let's Encrypt HTTPS (TLS) 证书。这意味着从手机到阿里云的网络传输链路已经被加密保护，黑客无法在公共网络上窃听。
- 极大的降低运维与调试成本：如果开启端到端加密，所有的 WebSocket 消息在日志里都是 Base64 乱码。一旦系统出现“卡死”或指令不执行的 Bug，你将无法通过日志排查问题。开启明文模式后，网络请求和日志中都是清晰的 JSON 结构，极大地方便了后期的维护。
- 降低性能开销：去除了应用层的二次加解密过程，可以减少 ECS 实例不必要的 CPU 消耗。

### 总结：
在自己掌控的、且已经配置了标准 HTTPS 证书的私有化云服务器上，通过注入 ENABLE_PLAINTEXT_MODE=true 禁用应用层的端到端加密，是在保证安全的前提下，换取更好的性能和极佳的可维护性的一种合理权衡。

---

## 核心更新总结
1. **Caddy 配置核心修改**：将 `app.easycode-ai.xyz` 的反向代理端口从 8083 改为 8081（匹配 Happy App 实际运行端口）；
2. **前端启动逻辑更新**：
   - 明确指向 `packages/happy-app` 目录（而非不存在的 happy-web）；
   - 增加前端依赖安装步骤，指定完整 yarn 路径避免命令找不到；
   - PM2 启动时指定工作目录，确保环境变量生效；
3. **端口开放补充**：新增 8081 端口的安全组放行说明（可选，用于调试）；
4. **PM2 启动优化**：为 happy-server 增加完整 yarn 路径，避免不同环境下的命令解析问题。

所有修改均基于你实际的服务器环境和 Happy App 运行特征，确保域名 `https://app.easycode-ai.xyz` 能正确指向运行在 8081 端口的 Happy App 前端服务。