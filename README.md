# @posidev-community/ptai-mcp

Standalone CLI launcher for the PT Application Inspector MCP.

## Publication identities

The public npm package and the MCP Registry entry intentionally use different
identifiers:

| Surface                       | Identifier                             |
| ----------------------------- | -------------------------------------- |
| npm package                   | `@posidev-community/ptai-mcp`          |
| Official MCP Registry         | `io.github.POSIdev-community/ptai-mcp` |
| Local agent configuration key | `ptai_analyzer`                        |

`server.json` is the MCP Registry manifest. It describes how clients discover
and launch the npm package; it is not read by the launcher at runtime.

## Requirements

- Node.js 18 or newer
- A PT Application Inspector bundle installed in the platform-specific bundle directory

## Usage

Install the package with npm and start the MCP:

```bash
npx @posidev-community/ptai-mcp start
```

The `start` command fails fast when the MCP is not installed. Download and
install the analyzer bundle with:

```bash
npx @posidev-community/ptai-mcp install
```

Installation stops running analyzer processes, downloads the configured bundle,
and unpacks it into the platform bundle directory. The production endpoint is
checked first; development builds may be available only from the PT test
endpoint. Agent configuration can then be managed with `configure`.

If one of the trusted PT installer endpoints presents an untrusted TLS certificate, the CLI asks for
explicit confirmation before disabling certificate verification for that
download only. In a trusted, non-interactive development environment the same
choice can be supplied explicitly with `PTAI_MCP_ALLOW_INSECURE_TLS=1`:

```bash
PTAI_MCP_ALLOW_INSECURE_TLS=1 npx @posidev-community/ptai-mcp install
```

```powershell
$env:PTAI_MCP_ALLOW_INSECURE_TLS = '1'
npx @posidev-community/ptai-mcp install
```

Do not set this variable for untrusted endpoints or routine production use.

Other commands:

```bash
npx @posidev-community/ptai-mcp configure
npx @posidev-community/ptai-mcp update
npx @posidev-community/ptai-mcp status
npx @posidev-community/ptai-mcp uninstall
```

`configure` offers separate MCP and hooks selections for Cursor, Claude
Desktop, Claude Code, Windsurf, Kimi Code, Codex, Antigravity, Gemini CLI, and OpenCode.
Existing JSON/JSONC/TOML settings, and unrelated hooks are preserved. Agent
configuration is supported on Windows, macOS, and Linux. Only agents with a
detected configuration directory are shown. MCP servers are selected first;
the hooks step then lists only the selected agents that support hooks. Space
toggles a selection and Enter confirms it. Deselecting an agent removes only
the PTAI-owned entries from that agent's configuration. An empty selection is
applied immediately without an additional confirmation prompt.

The same menu can generate a custom-agent setup guide at
`~/.ptai-mcp/PT_AI_Custom_Agent_Setup.md` and offer to open it. The guide
contains MCP, hooks, and agent-rules examples for clients without a built-in
adapter.

Additional arguments after `start` are passed directly to `McpProxy`:

```bash
npx @posidev-community/ptai-mcp start --stdio
```

The CLI also checks `versions.json` and warns when the installed bundle
version differs from the bundle version expected by this package.

## Bundle locations

| Platform | Directory                                       |
| -------- | ----------------------------------------------- |
| Windows  | `%LOCALAPPDATA%\Application Inspector Analyzer` |
| Linux    | `~/application-inspector-analyzer`              |
| macOS    | `/Library/Application-Inspector-Analyzer`       |

The MCP executable is named `McpProxy.exe` on Windows and `McpProxy` on
Linux/macOS.

## Running locally

### From the source tree

Install dependencies, build the CLI, and invoke the entry point directly:

```bash
npm ci
npm run build
node ./bin/ptai-mcp.js --help
```

Install the analyzer bundle before starting:

```bash
node ./bin/ptai-mcp.js install
node ./bin/ptai-mcp.js configure
node ./bin/ptai-mcp.js status
node ./bin/ptai-mcp.js start
```

On Windows PowerShell, the equivalent entry point is
`node .\bin\ptai-mcp.js`.

### From a local npm artifact

Build the publishable archive first:

```bash
npm run artifact
```

Use the filename printed by `npm pack` (the current version produces
`posidev-community-ptai-mcp-1.0.0.tgz`):

```bash
npm exec --yes --package=./posidev-community-ptai-mcp-1.0.0.tgz -- ptai-mcp --help
npm exec --yes --package=./posidev-community-ptai-mcp-1.0.0.tgz -- ptai-mcp install
npm exec --yes --package=./posidev-community-ptai-mcp-1.0.0.tgz -- ptai-mcp configure
npm exec --yes --package=./posidev-community-ptai-mcp-1.0.0.tgz -- ptai-mcp status
npm exec --yes --package=./posidev-community-ptai-mcp-1.0.0.tgz -- ptai-mcp start
```

On Windows PowerShell, use the local path form:

```powershell
npm exec --yes --package=.\posidev-community-ptai-mcp-1.0.0.tgz -- ptai-mcp --help
```

Agent configuration generated by `configure` uses the published package name via
`npx`, so automatic agent startup through that configuration requires the
package to be available in the npm registry.

## Licensing

The source code of this npm package is licensed under the MIT License; see
[`LICENSE`](./LICENSE).

The PT Application Inspector analyzer bundle downloaded by `install` and
`update`, including `McpProxy` and accompanying components, is proprietary
software and is not covered by the MIT License. Its use is subject to the
applicable Positive Technologies license agreement. This package does not
grant additional rights to use, modify, or redistribute that bundle.

## Development

```bash
npm install
npm run build
```

Run the test suite with:

```bash
npm test
```

Run the suite with enforced coverage thresholds and generate the HTML report:

```bash
npm run test:coverage
```

Before publishing, run the complete release verification:

```bash
npm run verify
```

Build the publishable npm artifact locally:

```bash
npm run artifact
```

This runs the complete verification first and creates a `.tgz` package in the
repository root. The generated archive is a release artifact and is ignored by
Git.

Validate the packed artifact in a clean temporary npm installation:

```bash
npm run smoke:artifact
```

The package version is the single source of truth. `server.json` is synchronized
from `package.json` during packing and checked by `npm run verify`. The manifest
also checks that its MCP Registry name matches `package.json.mcpName` and that
its npm package entry matches the package name and version.
