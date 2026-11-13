# PT Application Inspector MCP

Connect your AI agent to PT Application Inspector to triage findings, manage AIE
scans and analyze code locally.

## Quick start

With Node.js installed (18.19+ in the 18.x line, or 20.6+), run:

```bash
npx @posidev-community/ptai-mcp install
```

1. Choose whether to install the local analyzer bundle.
2. Select the agents to configure. Use **Space** to select and **Enter** to confirm.
3. Restart or reconnect MCP in your agent.

For AIE server tools, choose **No** (the default) at the bundle prompt. Local
analysis and hooks require the bundle. Setup offers hooks when the required
bundle is installed.

Your configured agent launches the MCP server when it connects.

Supported on Windows, macOS and Linux. Built-in setup supports Cursor, Claude
Desktop, Claude Code, Windsurf, Kimi Code, Codex, Antigravity, Gemini CLI and
OpenCode. The menu lists detected agents and can generate a setup guide for
other MCP clients.

## Work with AIE

You need AIE **6.3.x or 6.4.x** and an account with access to the relevant projects.
Ask your agent to connect to your AIE server and complete sign-in in the browser.
If the callback cannot reach MCP, use the local manual sign-in page it provides.
Keep passwords, authorization codes and tokens out of the chat.

Once connected, you can ask the agent to:

- Find vulnerabilities, inspect their details and save triage decisions.
- Review project settings, PM rules and groups.
- Create a project or branch and upload local sources.
- Start a scan, check its progress and stop it.
- Read source files or download sources for investigation.

Install the optional bundle to analyze code locally, without an AIE connection.

## Manage your installation

Run commands as `npx @posidev-community/ptai-mcp <command>`:

| Command     | Purpose                                                      |
| ----------- | ------------------------------------------------------------ |
| `install`   | Set up MCP and optionally install the local analyzer.        |
| `configure` | Change the selected agents and local hooks.                  |
| `update`    | Install or update the local analyzer bundle.                 |
| `status`    | Check the bundle and agent configuration.                    |
| `uninstall` | Remove the analyzer bundle and PTAI integration from agents. |
| `start`     | Launch the MCP server for a manual MCP client configuration. |

`update` downloads the required bundle without the installation opt-in prompt.
Run `configure` afterward if you want to enable local hooks.

For manual configuration, certificates, session troubleshooting and AIE workflow
limits, see the [usage reference](docs/usage.md).

## Privacy and telemetry

Release builds send usage metrics and a pseudonymous installation identifier by
default. They exclude source code, comments, file paths, AIE URLs, setting values
and AIE credentials.

To opt out, add this environment setting to the MCP launch configuration and
restart MCP:

```json
{
  "env": {
    "PTAI_DISABLE_TELEMETRY": "true"
  }
}
```

See [telemetry details](docs/telemetry.md) for the collected fields and opt-out scope.

## For developers

See [architecture and local development](docs/architecture.md) for building,
testing and code conventions, and [RELEASING.md](RELEASING.md) for publication.

## License

This npm package is [MIT licensed](LICENSE). The optional PT Application Inspector
analyzer bundle is proprietary software covered by the applicable Positive
Technologies license agreement.
