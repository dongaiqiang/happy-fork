<div align="center"><img src="/logo.png" width="200" title="HelloVibe" alt="HelloVibe"/></div>

<h1 align="center">
  Mobile and Web Client for Claude Code & Codex
</h1>

<h4 align="center">
Use Claude Code or Codex from anywhere with end-to-end encryption.
</h4>

<div align="center">
  
[📱 **iOS App**](https://apps.apple.com/app/id6761639738) • [🤖 **Android App**](https://play.google.com/store/apps/details?id=com.hellovibe.app) • [🌐 **Web App**](https://app.hellovibe.com) • [🎥 **See a Demo**](https://youtu.be/GCS0OG9QMSE) • [📚 **Documentation**](https://github.com/slopus/hellovibe/tree/main/docs) • [💬 **Discord**](https://discord.gg/fX9WBAhyfD)

</div>

<img width="5178" height="2364" alt="github" src="https://github.com/user-attachments/assets/14d517e9-71a8-4fcb-98ae-9ebf9f7c149f" />


<h3 align="center">
Step 1: Download App
</h3>

<div align="center">
<a href="https://apps.apple.com/app/id6761639738"><img width="135" height="39" alt="appstore" src="https://github.com/user-attachments/assets/45e31a11-cf6b-40a2-a083-6dc8d1f01291" /></a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://play.google.com/store/apps/details?id=com.hellovibe.app"><img width="135" height="39" alt="googleplay" src="https://github.com/user-attachments/assets/acbba639-858f-4c74-85c7-92a4096efbf5" /></a>
</div>

<h3 align="center">
Step 2: Install CLI on your computer
</h3>

```bash
npm install -g hellovibe
```

Primary package: `hellovibe`  
Primary command: `hellovibe`  
Compatibility command alias still accepted for now: `happy`

<h3 align="center">
Step 3: Start using the HelloVibe CLI entry point
</h3>

```bash

# Instead of: claude
# Use: hellovibe

hellovibe

# Instead of: codex
# Use: hellovibe codex

hellovibe codex

```

## How does it work?

On your computer, run `hellovibe` instead of `claude` or `hellovibe codex` instead of `codex` to start your AI through the current HelloVibe CLI wrapper. For upgrade compatibility, the old `happy` command still works. When you want to control your coding workflow from your phone, it restarts the session in remote mode. To switch back to your computer, just press any key on your keyboard.

## 🔥 Why HelloVibe?

- 📱 **Mobile access to Claude Code and Codex** - Check what your AI is building while away from your desk
- 🔔 **Push notifications** - Get alerted when Claude Code and Codex needs permission or encounters errors  
- ⚡ **Switch devices instantly** - Take control from phone or desktop with one keypress
- 🔐 **End-to-end encrypted** - Your code never leaves your devices unencrypted
- 🛠️ **Open source** - Audit the code yourself. No telemetry, no tracking

## 📦 Project Components

- **[HelloVibe CLI](https://github.com/slopus/hellovibe/tree/main/packages/happy-cli)** - Command-line interface for Claude Code and Codex
- **[HelloVibe Server](https://github.com/slopus/hellovibe/tree/main/packages/happy-server)** - Backend server for encrypted sync
- **HelloVibe App** - This mobile client (you are here)

## 🏠 Who We Are

We're engineers scattered across Bay Area coffee shops and hacker houses, constantly checking how our AI coding agents are progressing on our pet projects during lunch breaks. HelloVibe was born from the frustration of not being able to peek at our AI coding tools building our side hustles while we're away from our keyboards. We believe the best tools come from scratching your own itch and sharing with the community.

## 📚 Documentation & Contributing

- **[Documentation](https://github.com/slopus/hellovibe/tree/main/docs)** - Learn how HelloVibe works and how to operate it
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development setup including iOS, Android, and macOS desktop variant builds
- **[Repository](https://github.com/slopus/hellovibe)** - Browse code, open issues, and improve the docs and guides

## License

MIT License - see [LICENSE](LICENSE) for details.
