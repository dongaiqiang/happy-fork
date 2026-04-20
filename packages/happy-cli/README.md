# HelloVibe

Code on the go — control AI coding agents from your mobile device.

Free. Open source. Start fast from your phone or Mac.

## Installation

```bash
npm install -g hellovibe
```

Primary package: `hellovibe`  
Primary command: `hellovibe`  
Compatibility command aliases still accepted for now: `happy` and `happy-mcp`

## Quick Start

```bash
hellovibe auth login
hellovibe
```

If you want sessions to stay available when you step away from your computer, start the background service once:

```bash
hellovibe daemon start
```

After installation you can also run `hellovibe --help` for a quick command overview or `hellovibe doctor` if setup looks wrong.

## Run From Source

From a repo checkout:

```bash
# repository root
yarn cli --help

# package directory
yarn cli --help
```

## Usage

### Claude (default)

```bash
hellovibe
```

This will:
1. Start a Claude Code session
2. Show a QR code so you can link from your mobile device
3. Keep the session available in HelloVibe on mobile

### Gemini

```bash
hellovibe gemini
```

Start a Gemini CLI session with remote control capabilities.

**First time setup:**
```bash
# Connect your Google account
hellovibe connect gemini
```

## Commands

### Main Commands

- `hellovibe` – Start Claude Code session (default)
- `hellovibe gemini` – Start Gemini CLI session
- `hellovibe codex` – Start Codex mode
- `hellovibe acp` – Start a generic ACP-compatible agent

### Utility Commands

- `hellovibe auth` – Manage sign-in for this computer
- `hellovibe connect` – Store AI vendor API keys in your HelloVibe account
- `hellovibe sandbox` – Configure sandbox runtime restrictions
- `hellovibe notify` – Send a push notification to your devices
- `hellovibe daemon` – Manage the background service used for remote sessions
- `hellovibe doctor` – System diagnostics & troubleshooting

### Connect Subcommands

```bash
hellovibe connect gemini     # Authenticate with Google for Gemini
hellovibe connect claude     # Authenticate with Anthropic
hellovibe connect codex      # Authenticate with OpenAI
hellovibe connect status     # Show connection status for all vendors
```

### Gemini Subcommands

```bash
hellovibe gemini                      # Start Gemini session
hellovibe gemini model set <model>    # Set default model
hellovibe gemini model get            # Show current model
hellovibe gemini project set <id>     # Set Google Cloud Project ID (for Workspace accounts)
hellovibe gemini project get          # Show current Google Cloud Project ID
```

**Available models:** `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`

### Generic ACP Commands

```bash
hellovibe acp gemini                     # Run built-in Gemini ACP command
hellovibe acp opencode                   # Run built-in OpenCode ACP command
hellovibe acp opencode --verbose         # Include raw backend/envelope logs
hellovibe acp -- custom-agent --flag     # Run any ACP-compatible command directly
```

### Sandbox Subcommands

```bash
hellovibe sandbox configure  # Interactive sandbox setup wizard
hellovibe sandbox status     # Show current sandbox configuration
hellovibe sandbox disable    # Disable sandboxing
```

## Options

### Claude Options

- `-m, --model <model>` - Claude model to use (default: sonnet)
- `-p, --permission-mode <mode>` - Permission mode: auto, default, or plan
- `--claude-env KEY=VALUE` - Set environment variable for Claude Code
- `--claude-arg ARG` - Pass additional argument to Claude CLI

### Global Options

- `-h, --help` - Show help
- `-v, --version` - Show version
- `--no-sandbox` - Disable sandbox for the current Claude/Codex run

## Environment Variables

### HelloVibe Configuration

- `HELLOVIBE_SERVER_URL` - Custom server URL (default: https://api.hellovibe-ai.com)
- `HELLOVIBE_WEBAPP_URL` - Custom web app URL (default: https://app.hellovibe-ai.com)
- `HELLOVIBE_HOME_DIR` - Custom home directory for HelloVibe data (default: ~/.happy)
- `HELLOVIBE_DISABLE_CAFFEINATE` - Disable macOS sleep prevention (set to `true`, `1`, or `yes`)
- `HELLOVIBE_EXPERIMENTAL` - Enable experimental features (set to `true`, `1`, or `yes`)
- Legacy `HAPPY_*` names still work as compatibility fallbacks during migration

### Gemini Configuration

- `GEMINI_MODEL` - Override default Gemini model
- `GOOGLE_CLOUD_PROJECT` - Google Cloud Project ID (required for Workspace accounts)

## Gemini Authentication

### Personal Google Account

Personal Gmail accounts work out of the box:

```bash
hellovibe connect gemini
hellovibe gemini
```

### Google Workspace Account

Google Workspace (organization) accounts require a Google Cloud Project:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Gemini API
3. Set the project ID:

```bash
hellovibe gemini project set your-project-id
```

Or use environment variable:
```bash
GOOGLE_CLOUD_PROJECT=your-project-id hellovibe gemini
```

**Guide:** https://goo.gle/gemini-cli-auth-docs#workspace-gca

## Contributing

Interested in contributing? See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Requirements

- Node.js >= 20.0.0

### For Claude

- Claude CLI installed & logged in (`claude` command available in PATH)

### For Gemini

- Gemini CLI installed (`npm install -g @google/gemini-cli`)
- Google account authenticated via `hellovibe connect gemini`

## Next Steps

- Start your first session with `hellovibe`
- Run `hellovibe daemon start` if you want remote sessions to stay ready in the background
- Run `hellovibe doctor` if authentication, linking, or startup looks off

## License

MIT
