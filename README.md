# @posidev-community/ptai-mcp

PT Application Inspector MCP with local analysis and AIE server tools.

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

- Node.js 18.19.x or newer in the 18.x line, or Node.js 20.6 or newer
- AIE 6.3.x or 6.4.x for server tools; both use the API 6.3 client
- The existing local analyzer bundle for local tools and hooks

## Usage

Install the package with npm and start the MCP:

```bash
npx @posidev-community/ptai-mcp start
```

`start` launches a Node stdio MCP server without requiring the analyzer bundle.
The catalog contains 22 `aie_*` tools and 11 local tools, with local resources
and prompts. AIE tools work independently of the local analyzer. The local proxy
starts on the first local request; its catalog is checked for compatibility.
To use local analysis, install the analyzer bundle with:

```bash
npx @posidev-community/ptai-mcp install
```

Installation stops running analyzer processes, downloads the configured bundle,
and unpacks it into the platform bundle directory. The production endpoint is
checked first; development builds may be available only from the PT test
endpoint. Agent configuration can then be managed with `configure`.

The POC does not require a BE4P update. Installation preserves the existing
`shared_variables` session file. With legacy BE4P, concurrent token refresh or
provider shutdown can still require signing in again; Node cannot fully change
another process's session behavior.
An MCP client running in a packaged Windows app may redirect AppData to its own
LocalCache. In that environment, IDE and MCP sessions may not share the same
physical file; use `aie_get_context` to check the MCP connection and sign in
through `aie_auth` when needed. Cross-process session pickup requires a native
integration check in each supported client environment.

## AIE workflow

Call `aie_get_context` to inspect readiness, then `aie_auth` with `action=login`
and an HTTPS `server_url`. Follow the system browser. If callback delivery fails,
open the returned local `manual_url` and enter the code there. Do not put codes,
passwords or tokens in tool arguments. `cancel_login` cancels a pending attempt;
`logout` ends the shared session. Closing MCP preserves the session.

Use project, branch and scan lists to select explicit IDs before reading findings,
triaging, updating settings or starting a scan. Lists return bounded pages and
opaque continuation cursors. Settings return write schemas and revisions; include
the revision when saving to detect stale edits. Long source/scan workflows return
an `operation_id`; poll `aie_get_operation` for the retained result. Cancellation
reports completed stages and known IDs, and does not roll back server changes or
stop a scan automatically. Jobs are held only in the current MCP process.

Create/upload applies the union of `.aiignore` and `.ptaiignore`, always excludes
`.git`, skips symbolic links and converts an included `.aiproj` only inside the
archive. Downloads require a new destination directory and publish under its
`sources` child. Branch downloads do not guarantee the exact snapshot of a
historical scan. Inspect `effects` and known IDs after an interrupted change
before retrying it. A fast queue transition can leave scan correlation unconfirmed;
select an explicit scan rather than assuming the latest scan is yours.

BlackBox settings expose per-field credential semantics. Omitted/null HTTP and
Form passwords preserve the value; empty clears it. Empty proxy passwords preserve
it. Readable RawCookie is retained for adjacent edits. If the server hides a
RawCookie, replace it explicitly or disable that authentication type before a
write requiring preservation. Accepted hidden password replacements report
`verified=false` and `verification.unverified_fields`; inspect these fields before
claiming exact readback.

AIE HTTPS always verifies certificates. For corporate certificates, set
`NODE_EXTRA_CA_CERTS` to a trusted PEM file before starting MCP.

## Telemetry

Release builds send bounded technical metrics using the existing FLUS contract.
Source code, comments, paths, AIE URLs, setting values and tokens are excluded.
Set `PTAI_DISABLE_TELEMETRY=true` in the MCP process environment to disable Node
collection/export and pass the opt-out to the local proxy. Existing IDE plugins
use their own telemetry configuration. Local builds without release FLUS
configuration have no sender; see [RELEASING.md](RELEASING.md).

Collection is enabled by default in configured release artifacts. The receiver
is the release-configured FLUS/GUS HTTPS origin at `/telemetry/v1/push/`;
`PTAI_FLUS_HOST` supplies that origin during the build. Invocation counts,
durations in milliseconds and confirmed action counts carry only the tool name,
outcome, normalized error code, whitelisted action/section/kind and AIE version.
Resource fields are service name/version, OS, test/production contour, a random
process-session UUID and an installation pseudonym. The pseudonym is the first
16 uppercase hex characters of SHA-256 of OS name, host name and available CPU
count; the host name itself is not sent. It can correlate activity with BE4P on
the same installation; it is not an anonymous per-call identifier.
For the existing `ApplicationInspectorPlugins` table, MCP also emits the same
values as `user_id`, `session_id` and `plugin_version`. Its `service_name` is
`ptai-mcp` (BE4P uses `BE4P.Telemetry`), and its metric names start with
`ptai.mcp.aie.`. These fields distinguish MCP rows without overloading the
BE4P metric names.

Example metric attributes (illustrative values):

```json
{
  "metric": "ptai.mcp.aie.tool.invocations",
  "value": 1,
  "attributes": {
    "tool": "aie_update_project_settings",
    "outcome": "success",
    "error_code": "NONE",
    "section": "scan",
    "aie_version": "6.4.0.7986"
  }
}
```

The SDK aggregates in memory, exports about once per minute and does not keep a
disk retry queue. A failed export can lose metrics and does not fail a tool.
Payloads are bounded to 256 KiB with one export in flight; shutdown flush is
bounded. Workflow acceptance and completion are different events, and repeated
polling does not create extra completion events. The intended analytics target is
the existing `application_inspector_plugins_metrics` pipeline; end-to-end
ingestion of MCP metrics still requires verification. Actual retention periods
and access permissions must be confirmed with its owner before release; no
additional retention policy is established by this package.

To opt out, put `"env": { "PTAI_DISABLE_TELEMETRY": "true" }` in the MCP launch
configuration and restart the MCP server. The value is case-insensitive. The
opt-out creates no Node collector/export queue/exporter and makes no Node
DNS/HTTP requests to FLUS. It does not disable required AIE API requests.

## Analyzer installation and agent configuration

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
