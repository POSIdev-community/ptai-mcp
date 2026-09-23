# @posidev-community/ptai-mcp

Standalone CLI launcher for the PT Application Inspector MCP.

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

Installation stops running analyzer processes, downloads the configured
production bundle, and unpacks it into the platform bundle directory. Agent
configuration can then be managed with `configure`.

Other commands:

```bash
npx @posidev-community/ptai-mcp configure
npx @posidev-community/ptai-mcp update
npx @posidev-community/ptai-mcp status
npx @posidev-community/ptai-mcp uninstall
```

`configure` offers separate MCP and hooks selections for Cursor, Claude
Desktop, Claude Code, Windsurf, Kimi Code, Codex, Antigravity, and Gemini CLI.
Existing JSON/TOML settings and unrelated hooks are preserved. Agent
configuration is supported on Windows, macOS, and Linux.

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
