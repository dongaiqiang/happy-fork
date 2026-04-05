# 📱 HelloVibe：局域网手机联调操作手册

**文档创建日期：** 2026年04月04日

本文档是在“以手机为主设备”的基础上，专门改写出的**局域网联调版本**。目标是让手机 App、Mac CLI、Daemon 全部连到你自己电脑启动的本地 Server，而不是线上服务器。

文中涉及的手机端名称与按钮，已经按当前 HelloVibe App 的最新中文文案更新。

---

## 一、先说结论

局域网手机联调时，核心只记住这 3 条：

1. **手机 App 的 Server 地址要填你电脑的局域网 IP，不是 localhost。**
2. **CLI 和 Daemon 也必须指向同一个地址。**
3. **这次主链路优先按现成的两份测试脚本来跑，不再按旧的手动拆分方式理解。**

推荐地址如下：

- **最终要填的 Server 地址：** `http://192.168.10.114:3005`
- **如果要开 Web 页面：** `http://192.168.10.114:8083`

---

## 二、这次文档按哪两个脚本来理解

结论：**文档中的主流程以这两份脚本为准。**

### 1. 一键版脚本

```bash
/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/测试脚本/20260329-全链路重启前半段一键脚本.sh
```

适合普通终端使用。它会自动完成这些动作：

- 清理旧进程与旧登录态
- 清空 `~/.happy` 与 `~/.happy-rebind-20260327`
- 启动 Docker
- 启动 `happy-server dev`
- 启动 `happy-app start --clear`
- 预设 `SERVER_URL=http://192.168.10.114:3005`
- 在最后进入 `yarn cli auth login --force`

### 2. Ghostty 三分屏版脚本

```bash
/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/测试脚本/20260329-全链路重启-Ghostty三分屏前半段脚本.sh
```

适合 Ghostty。它会把流程拆成三个 pane：

- 左侧：后端日志
- 右上：前端 / Metro 日志
- 右下：登录日志

它和一键版的核心逻辑一致，也是把前半段流程自动化。

### 3. 这两个脚本已经固定好的关键地址

这两份脚本里都已经写死了：

```bash
SERVER_URL="http://192.168.10.114:3005"
```

所以本次文档里的手机地址、CLI 地址、扫码登录地址，都应和它保持一致。

### 4. 这两个脚本负责到哪一步

这两份脚本都属于**前半段脚本**，负责把下面这些内容跑起来：

- 本地后端
- Metro / App 调试入口
- 手机登录前准备
- `auth login --force` 二维码登录

但它们**不会替你完成最后的 `daemon start-sync` 常驻运行**，所以扫码成功后，还需要你手动补最后一步 daemon。

---

## 三、局域网地址到底是什么

手机里要填的，不是你公网域名，也不是 `localhost`，而是：

```text
http://192.168.10.114:3005
```

### 1. 当前这台 Mac 的局域网地址

我已经按当前机器查过，结果是：

```text
192.168.10.114
```

所以这次应统一使用：

- 手机 App 的 Server 地址：`http://192.168.10.114:3005`
- 如果要开 Web，浏览器打开：`http://192.168.10.114:8083`

### 2. 为什么不能填 localhost

因为：

- 手机里的 `localhost` 指向手机自己
- Mac 里的 `localhost` 才是 Mac 自己

所以一旦跨设备联调，手机填 `localhost:3005` 一定会连错地方。

---

## 四、局域网手机联调的标准步骤

下面这套是这次最推荐的实际操作顺序。

### Step 1：先运行两份脚本中的一个

二选一即可。

如果你用普通 Terminal，运行：

```bash
bash "/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/测试脚本/20260329-全链路重启前半段一键脚本.sh"
```

如果你用 Ghostty，运行：

```bash
bash "/Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main/董/测试脚本/20260329-全链路重启-Ghostty三分屏前半段脚本.sh"
```

运行后，脚本会自动：

- 清理旧状态
- 启动本地后端
- 启动 Metro
- 准备好后续 `auth login --force`

### Step 2：手机打开调试 App，并进入主界面

脚本启动后，按脚本提示操作：

1. 手机打开 HelloVibe 调试 App
2. 扫 Metro 二维码
3. 进入欢迎页

当前欢迎页文案应大致如下：

- 标题：`HelloVibe`
- 副标题：`轻松开始你的第一个 vibe coding`
- 主按钮：`注册账号`
- 次按钮：`登录`

脚本里会停在这个提示：

```text
手机完成打开 App / 扫 Metro 二维码 / 进入主界面后，按回车继续...
```

### Step 3：手机先改 Server 地址

进入 App 后，先做这一步：

1. 停留在欢迎页
2. 点击右上角的 `服务器` 图标
3. 进入 `服务配置` 页面
4. 在 `自定义服务 URL` 中填入：

```text
http://192.168.10.114:3005
```

5. 点击保存

如果地址生效，页面会显示：

- `当前正在使用自定义服务地址`

### Step 4：手机注册账号

地址改完后，回到欢迎页：

1. 点击 **注册账号**
2. 等手机本地生成主密钥
3. 创建成功后，手机就成为主控设备

### Step 5：回到终端，继续脚本里的登录流程

完成手机准备后，回到脚本所在终端，按回车继续。

随后脚本会自动执行：

```bash
export HAPPY_SERVER_URL="http://192.168.10.114:3005"
yarn cli auth login --force
```

然后：

1. 看到认证方式选择时，选 **Mobile App**
2. 终端会显示二维码
3. 并停在 `Waiting for authentication..`

### Step 6：手机扫码给 Mac 授权

在手机里进入：

- **设置**
- **账户**
- **链接新设备**

然后扫码终端二维码。

这几个页面的当前文案应是：

- 一级入口：`设置`
- 账户页标题区域：`账户`
- 功能项：`链接新设备`
- 功能项副标题：`扫描二维码来链接设备`

成功后：

- 手机会提示成功
- Mac 终端会打印 `Authentication successful`

### Step 7：脚本结束后，手动启动 Daemon

这一步不在前半段脚本里，需要你手动执行：

```bash
cd /Users/dongaiqiang/Documents/mycode/codes/00-chanpin/happy-main
export HAPPY_SERVER_URL="http://192.168.10.114:3005"
yarn cli daemon start-sync
```

这个终端要保持运行，不要关闭。

### Step 8：手机发起新会话

最后回到手机首页：

1. 点击右上角 `+`
2. 新建会话
3. 发一条测试消息

如果一切正常：

- Mac 端 daemon 会开始工作
- 手机端会收到返回结果

---

## 五、什么时候才需要单独手动跑旧脚本

默认情况下，这次**不用再按旧方式单独手动跑 `01-start-server.sh` 和 `02-start-web.sh` 来理解主流程**。

只有下面这些场景，才需要回退到手动模式：

- 你想单独排查 server 是否能启动
- 你想单独看 Web 页面
- 你不想使用这两份“前半段自动化脚本”

如果只是正常做这次手机局域网联调，优先还是：

- `20260329-全链路重启前半段一键脚本.sh`
- `20260329-全链路重启-Ghostty三分屏前半段脚本.sh`

---

## 六、什么时候才需要 HTTPS 代理

默认情况下，这次**不需要**。

只有当你遇到下面问题时，再启动 `https-proxy.js`：

- 浏览器里按钮点击没反应
- 控制台出现 `crypto.subtle` 或 Secure Context 相关错误
- 浏览器必须经由 HTTPS 才能正常工作

这时再执行：

```bash
node https-proxy.js
```

对应地址改为：

- Web：`https://192.168.10.114:8443`
- Server：`https://192.168.10.114:3443`

同时：

- 手机 App 的 Server 改成 `https://192.168.10.114:3443`
- CLI / Daemon 的 `HAPPY_SERVER_URL` 也要同步改成这个 HTTPS 地址

---

## 七、这次最简执行版

如果你只想看最短版本，就照这个顺序：

1. 先运行两份前半段脚本里的一个
2. 手机扫 Metro 二维码并进入 App
3. 手机上在 `服务配置` 页面把 `自定义服务 URL` 改成 `http://192.168.10.114:3005`
4. 手机上点击 `注册账号`
5. 回终端按回车，让脚本继续执行 `yarn cli auth login --force`
6. 选择 `Mobile App`
7. 手机扫码授权
8. 手动运行 `export HAPPY_SERVER_URL="http://192.168.10.114:3005"` 后执行 `yarn cli daemon start-sync`
9. 手机新建会话做联调

---

## 八、最常见错误

### 1. 手机里填了 localhost

结果：

- 手机连的是自己，不是你的 Mac

正确做法：

- 改成 `http://192.168.10.114:3005`

### 2. 手机、CLI、Daemon 没连同一个 Server

结果：

- 手机扫码看似成功
- Mac 一直卡在 `Waiting for authentication..`

正确做法：

- 三边统一用同一个地址

### 3. Web 能开，但认证不通

结果：

- 很可能是 Web 使用了另一套 Server 地址

正确做法：

- 打开 `/server` 页面再次确认

### 4. 脚本跑完了，但没有 daemon

结果：

- 扫码成功了
- 但后面发消息没响应

正确做法：

- 再手动执行 `yarn cli daemon start-sync`

### 5. Server 一启动就挂

正确做法：

- 用 `METRICS_ENABLED=false bash ./01-start-server.sh`

---

## 九、最后结论

这次你要做的，不是改脚本，而是**统一地址**：

- **手机 App：** `http://192.168.10.114:3005`
- **CLI：** `HAPPY_SERVER_URL=http://192.168.10.114:3005`
- **Daemon：** `HAPPY_SERVER_URL=http://192.168.10.114:3005`

而这次要按它来理解的脚本是：

- `20260329-全链路重启前半段一键脚本.sh`：**普通 Terminal 版主流程**
- `20260329-全链路重启-Ghostty三分屏前半段脚本.sh`：**Ghostty 三分屏版主流程**
- `https-proxy.js`：**只有浏览器 HTTPS 场景才用**

只要三端统一指向同一个局域网 Server，这套手机联调链路就能跑通。
