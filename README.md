# PT Application Inspector MCP

Connect your AI agent to PT Application Inspector to triage findings, manage AIE
scans and analyze code locally.

## Quick start

With Node.js installed (18.19+ in the 18.x line, or 20.6+), run:

```bash
npx -y @posidev-community/ptai-mcp install
```

1. Choose whether to install the local analyzer bundle.
2. Select the agents to configure. Use **Space** to select and **Enter** to confirm.
3. Restart or reconnect MCP in your agent.

For AIE server tools, choose **No** (the default) at the bundle prompt. Local
analysis and hooks require the bundle. Setup offers hooks when the required
bundle is installed.

Your configured agent launches the MCP server when it connects.

Ask your agent: "Check that PT Application Inspector MCP is connected and show
its available tools." The tool list includes both AIE and local tools, even when
the local analyzer bundle is not installed.

Supported on Windows, macOS and Linux. Built-in setup supports Cursor, Claude
Desktop, Claude Code, Windsurf, Kimi Code, Codex, Antigravity, Gemini CLI and
OpenCode. The menu lists detected agents and can generate a setup guide for
other MCP clients.

| Task                                                     | Requirements                                                                 | Tools                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| Analyze a local project and inspect its results          | Local analyzer bundle; no AIE sign-in                                        | Tools without the `aie_` prefix |
| Work with projects, scans, settings, and findings on AIE | AIE connection and an account with the required permissions; no local bundle | `aie_*` tools                   |

See the [tool reference](docs/usage.md#tools-and-requirements) for tool names.

## Work with AIE

You need network access to AIE **6.3.x or 6.4.x** and an account with access to
the relevant projects. The local analyzer bundle is not required.

1. Ask your agent: "Connect to AIE at `https://aie.example.com` and show my
   available projects." Replace the example URL with your server address.
2. Complete sign-in in the browser opened by MCP. The AIE page may mention Visual
   Studio; return to your agent and check the connection. If it is still waiting,
   open the agent's fallback link, paste the code from AIE into **Authorization Code**,
   and click **Continue**. Enter the code in that form, never in the chat.
3. Return to the agent and ask it to check the connection and list projects.
   A successful connection identifies your AIE server and account; the project
   list contains the projects your account can access.

For a first investigation, ask: "In project `<project name>`, show the latest
completed scan and up to five High-severity findings with their files and lines."

Once connected, you can ask the agent to:

- Find vulnerabilities, inspect their details and save triage decisions.
- Review project settings, PM rules and groups.
- Create a project or branch and upload local sources.
- Start a scan, check its progress and stop it.
- Read source files or download sources for investigation.

## Analyze code locally

Run `npx -y @posidev-community/ptai-mcp install` and choose **Yes** at the bundle
prompt. Select your agent, then restart or reconnect MCP. Local hooks are optional;
they run local analysis in response to supported agent lifecycle events.

Open your project in the agent and ask: "Use the local PT Application Inspector
analyzer to scan this project and show the findings with their files and lines."
The agent selects the project with `set_active_project`, starts `trigger_scan`,
and reads the results. AIE sign-in is not required for local analysis.

## Manage your installation

Run commands as `npx -y @posidev-community/ptai-mcp <command>`:

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

To check npm for the latest release and run setup again:

```bash
npx -y --prefer-online @posidev-community/ptai-mcp@latest install
```

Choose **Yes** at the bundle prompt to install the analyzer version required by
that release. For AIE-only use, choose **No**. Restart or reconnect MCP afterward
to use the new package. See [how updates work](docs/usage.md#updates) for caching
and bundle checks.

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

This npm package is [MIT licensed](LICENSE). The bundled Inter font uses the SIL
Open Font License 1.1; its license is included with the font.

The optional PT Application Inspector analyzer bundle is proprietary software
covered by the applicable Positive Technologies license agreement.
