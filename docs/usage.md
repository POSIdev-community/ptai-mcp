# Configuration and AIE usage reference

Run `npx @posidev-community/ptai-mcp install` to configure supported agents.
For manual setup or troubleshooting, use the sections below.

## Agent configuration

`configure` offers separate MCP and local hooks selections. Only agents with a
detected configuration directory are listed. Without the required analyzer bundle,
hooks setup is skipped and existing hooks are preserved. Deselecting an agent
removes its PTAI-owned MCP entries. When hooks setup is available, the chosen
hook selections are also applied. Unrelated settings remain intact.

For a client without a built-in adapter, the setup menu can generate
`~/.ptai-mcp/PT_AI_Custom_Agent_Setup.md` with MCP, hooks and agent-rules examples.

A manual MCP launch configuration uses the following command and arguments:

```json
{
  "mcpServers": {
    "ptai_analyzer": {
      "command": "npx",
      "args": ["-y", "@posidev-community/ptai-mcp", "start"]
    }
  }
}
```

Use the configuration format required by your client. Additional arguments after
`start` are forwarded to the local analyzer proxy.

## Certificates and sessions

AIE HTTPS verifies certificates. For a corporate CA, set `NODE_EXTRA_CA_CERTS`
to a trusted PEM file in the MCP process environment before starting it.

If you need to connect to a development AIE server without a trusted CA, explicitly
allow its HTTPS origin in the MCP launch environment, then restart MCP:

```json
{
  "env": {
    "PTAI_MCP_AIE_INSECURE_TLS_ORIGINS": "https://aie.example:8443"
  }
}
```

This disables certificate verification only for the listed AIE origins, including
their ports. Use comma-separated origins for multiple servers. Wildcards,
credentials, paths, queries and fragments are rejected. Other AIE servers, the
analyzer downloader and telemetry retain their normal TLS settings. AIE requests
do not follow redirects. MCP does not enable this mode or retry a failed request
automatically after a certificate error.

The analyzer downloader separately asks for explicit approval if a PT installer
endpoint has an untrusted certificate. For a trusted, non-interactive development
environment, `PTAI_MCP_ALLOW_INSECURE_TLS=1` supplies that approval. It applies
to the analyzer download, not AIE requests. Leave it unset for routine use.

Installation preserves the existing `shared_variables` session file. Legacy
BE4P refresh/shutdown behavior can still require signing in again. Some packaged
Windows clients redirect AppData to a private LocalCache, so their session may
not share the IDE's physical file. Check the MCP connection with `aie_get_context`
and sign in with `aie_auth` when needed. Closing MCP preserves the session;
`aie_auth(action=logout)` ends it.

## Lists and findings

Lists use immutable 10-minute snapshots. Pass `next_cursor` as `cursor` with the
same target and filters; if supplying `page_size` again, keep it unchanged
(maximum 100). A null `next_cursor` ends the list.

Findings support exact file/line filters, module/category filters and type search:
exact match, then substring, then all words in any order within one field.
Search covers internal names, available CWE titles and component names.
`view=summary` groups the entire filtered selection before pagination.
`matched_issues` counts findings; `total` counts finding cards or summary groups.
List/summary counts include discarded and suppressed findings, unlike normal
AIE vulnerability statistics.

Triage uses the separate comment endpoint when the status is unchanged; an empty
comment with unchanged status is a no-op. AIE synchronizes matching hashes to
other branches asynchronously. A verified triage response covers the selected
issue only.

## Projects, sources and scans

`aie_create` creates a project with `kind=project`, or a populated branch in an
existing project with `kind=branch`. Branch mode preserves shared settings and
does not write the user's working-branch selection. AIE's Plugin default branch
can change with scan/creation dates; the response reports before/after IDs when
available. If a later stage fails, the response retains created IDs and completed
stages.

Creation and upload apply both `.aiignore` and `.ptaiignore` exclusions. They
exclude `.git` and staging, skip symlinks and convert `.aiproj.json` only inside
the archive.
Readiness checks the configured source target and revision, plus directory
contents when supported. It does not download an archive just to check readiness.

`aie_start_scan` normally returns `scan_id` in the same call. Its 45-second budget
waits for scan identification, not completion. If identification takes longer,
continue with the returned `operation_id` rather than repeating the launch.
Labels are `MCP` or `MCP-<label_suffix>` and can repeat across scans.
Exact queue correlation differs from inferred `branch_history`; ambiguous
matches stay unconfirmed.

`aie_get_operation` reads a local workflow or an explicitly selected remote scan.
`workflow_state` and `scan_state` are separate. `aie_cancel_operation` cancels
local work or stops a selected remote scan. To stop a scan matched through
history, pass its scan ID explicitly. After AIE accepts a stop request, read the
scan status to confirm the outcome.

Jobs live in the current MCP process; shutdown/logout do not stop server analysis.
Local retained results remain readable offline under the same verified session
fingerprint. After restart, use known server IDs to inspect the outcome before
repeating a change.

`aie_get_sources` reads a paged tree or a bounded file range. Content is the current
branch source, even with `scan_id`; `snapshot_match` remains unknown. File reads
have a 1 MiB upstream limit and 64 KiB output limit, with explicit truncation.
Relative paths from findings, including a leading `./`, are accepted. Parent
segments and absolute paths are rejected.
On servers missing source routes, a reported archive fallback reads at most
32 MiB compressed without extracting to disk. Downloads require a new destination
directory and publish under its `sources` child; they do not guarantee a historical
scan snapshot.

## Settings and credentials

Settings return write schemas and revisions. Include the revision when saving
to detect stale edits. Omitted/null HTTP and Form passwords preserve their value;
an empty string clears it. Empty proxy passwords preserve the value.
If AIE hides a RawCookie, explicitly replace it or disable that authentication
type before a write requiring preservation. A response that accepts a hidden
password replacement can still report `verified=false` and
`verification.unverified_fields`. Check these fields to see which values AIE
could not confirm.

## Local analyzer files

| Platform | Directory                                       |
| -------- | ----------------------------------------------- |
| Windows  | `%LOCALAPPDATA%\Application Inspector Analyzer` |
| Linux    | `~/application-inspector-analyzer`              |
| macOS    | `/Library/Application-Inspector-Analyzer`       |

The proxy is `McpProxy.exe` on Windows and `McpProxy` on Linux/macOS. Startup
diagnostics show the npm version and a short build hash to help identify installed
copies. Bundle/agent status is available through the CLI `status` command.
