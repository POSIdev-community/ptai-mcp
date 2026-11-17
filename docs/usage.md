# Configuration and AIE usage reference

Run `npx -y @posidev-community/ptai-mcp install` to configure supported agents.
For manual setup or troubleshooting, use the sections below.

## Tools and requirements

MCP lists both groups of tools. Listing a tool does not confirm that its bundle
is installed or that an AIE session is active.

### Local analyzer

These tools run through the installed local analyzer bundle. They do not require
AIE sign-in. Local hooks, the `secure_coding_session` prompt, and the `ptai://`
resources also require the bundle.

| Task                             | Tools                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| Select the local project         | `set_active_project`                                         |
| Start, monitor, or stop analysis | `trigger_scan`, `get_scan_status`, `stop_scan`               |
| Inspect scan history and errors  | `get_scan_history`, `get_scan_errors`                        |
| Find and inspect findings        | `list_issues`, `get_issues_by_location`, `get_issue_details` |
| Save a triage decision           | `triage_issue`                                               |
| Change local scan settings       | `modify_scan_settings`                                       |

Read current local settings and their schema from the `ptai://resources/scan_settings`
resource before changing them. `get_scan_settings` is not a separate MCP tool.

### AIE server

The `aie_*` tools use AIE APIs and do not require the local analyzer bundle.
Sign in before working with server data. Your AIE account needs permission for
each requested action. Authentication and context tools help establish or inspect
the session; operation tools can also inspect or cancel work in the current MCP
process.

| Task                                                | Tools                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Sign in, sign out, or inspect the connection        | `aie_auth`, `aie_get_context`                                                  |
| Browse projects, branches, and scans                | `aie_list_projects`, `aie_list_branches`, `aie_list_scans`                     |
| Find, inspect, and triage findings                  | `aie_list_issues`, `aie_get_issue_details`, `aie_triage_issue`                 |
| Create a project or branch                          | `aie_create`                                                                   |
| Read, download, or upload sources                   | `aie_get_sources`, `aie_download_project`, `aie_upload_sources`                |
| Read or update project settings                     | `aie_get_project_settings`, `aie_update_project_settings`                      |
| Read or save Pattern Matching rules and groups      | `aie_list_pm_catalog`, `aie_get_pm_catalog_entry`, `aie_save_pm_catalog_entry` |
| List scan agents or start a scan                    | `aie_list_scan_agents`, `aie_start_scan`                                       |
| Check or cancel an operation, or stop a server scan | `aie_get_operation`, `aie_cancel_operation`                                    |

## Connect to AIE

1. Ask your agent to connect to your AIE server, giving its HTTPS address. The
   agent calls `aie_auth` with `action=login` and `server_url`.
2. Complete sign-in in the system browser. The AIE page may mention Visual Studio
   because MCP uses that integration flow. It can stay open after a successful
   background callback. Ask the agent to check the connection before copying a code.
3. Ask the agent to check `aie_get_context`. During sign-in, it can pass the
   returned `login_id` to check progress. Once connected, list projects with
   `aie_list_projects` and select the project and branch for your task.

If the connection is still waiting and AIE displays a code (also labeled "token"),
open the fallback link the agent provides: the `manual_url` from the current login
attempt. Paste the code into **Код авторизации** and click **Продолжить**. The form
shows the AIE server and confirms the connection when sign-in completes. Keep
passwords, codes, and tokens out of chat and tool arguments. Visual Studio does
not need to be installed or opened.

A callback can fail if the browser blocks its request to the local address,
the local listener is no longer running, or the browser is on another computer.
The fallback form must also be reachable on the computer running MCP. If neither
local page opens, pasting a code into chat will not restore that connection.
Check where MCP and the browser are running. After an MCP restart, cancellation,
or expiry (10 minutes), start a new login and use its new links and code.
If context already reports a connected session, no manual code is needed even
when the confirmation tab did not open.

If the browser callback reaches MCP but the code exchange fails, MCP opens the
local form to show the failure. An already opened local form shows the result
without another tab. The AIE success page confirms browser sign-in only; use
`aie_get_context(login_id)` to confirm the MCP connection. If the browser blocks
the callback or MCP cannot open the local page, ask the agent to check that status.
For identified certificate failures, the local page shows CA setup and an exception
example for the selected origin. It explains the approval and restart steps and
does not change settings. Protocol errors do not show certificate exceptions.

For example: "Connect to AIE at `https://aie.example.com`, then show the latest
completed scan in project `<project name>`." Replace the URL and project name
with your own values. If certificate verification fails, follow
[Certificates and sessions](#certificates-and-sessions).

## Updates

The npm package contains the MCP server and setup CLI. The local analyzer bundle
is a separate download; each npm release specifies the bundle version it expects.

Generated agent configuration launches `npx -y @posidev-community/ptai-mcp start`.
npm resolves the package when the client starts a new MCP process. It uses its
cache and can fetch a newer release. It does not update a running MCP process,
and individual tool calls do not run `npx` again. Restart or reconnect MCP to
launch another process.

For an explicit update, run:

```bash
npx -y --prefer-online @posidev-community/ptai-mcp@latest install
```

`@latest` selects the release tagged `latest`; `--prefer-online` asks npm to
check cached metadata against the registry. A locally installed project dependency
can satisfy a package name without a version specifier. npm offline settings and
registry availability also affect resolution. See the
[npm execution and caching reference](https://docs.npmjs.com/cli/v11/commands/npm-exec/#a-note-on-caching).

`install` checks the expected bundle version and runs agent setup. If the bundle
is missing or has a different version, choose **Yes** to download the expected
version, or **No** to continue with AIE-only setup. If the required bundle is
already installed, setup proceeds without that download prompt.

To install the expected bundle without the opt-in prompt, run:

```bash
npx -y --prefer-online @posidev-community/ptai-mcp@latest update
```

This command updates the analyzer bundle; it does not configure agents or hooks.
Restart MCP after either update path. Use `status` to inspect the package version,
bundle version, and agent configuration. It does not test a live MCP connection.

MCP starts without a local bundle check. The first local operation checks for
the proxy and validates its tool, resource, and prompt catalog. A bundle with a
different version number can pass that catalog check. Use `status` to compare
its version with the expected version; do not rely on startup to warn about every
bundle update.

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

AIE TLS errors include the Node error code, the affected server origin, and a
description of the certificate problem when known. Check an expired certificate,
hostname mismatch, or server TLS configuration before changing trust settings.
When a certificate problem is identified, the error includes a per-origin exception
example. MCP never applies it automatically. Protocol and handshake failures
recommend checking the HTTPS endpoint, proxy, and supported TLS versions.
Restart or reconnect MCP after changing its environment. If sign-in failed,
start a new login with new links and a new code.

When polling `aie_get_context` with `login_id`, `context_scope=login_attempt`
identifies the selected sign-in target. Waiting and failed attempts are read
locally without contacting the previous server. `current_session`, if present,
shows the stored server with `validation=not_checked`. Call without `login_id`
to validate that session separately; the response uses `context_scope=session`.

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

Summary groups include `scan_module`, `issue_type` and `is_suppressed`.
For example, a race can have
`scan_module=RaceConditionDetection`, `issue_type=Vulnerability`, `type=Toctou`.
Use `is_suppressed=false` to exclude suppressed findings, and `approval_state`
and `severity` to match a UI counter. The complete list includes severity `None`.

Incremental scans can reuse earlier issue records. Details verify membership in
the selected scan and return `issue_record_scan_id` and `evidence_reused`.
Neither field proves a source revision. Race details include
`vulnerableCode.raceCondition.sharedData`, `firstPath` and `secondPath`, with both
entry points, calls, accesses and coordinates. Check the finding type and evidence;
the same module can return other vulnerability types.

Triage uses the comment endpoint when the status is unchanged; an empty comment
with unchanged status is a no-op. Updating a shared issue affects all incremental
results containing it. AIE also synchronizes matching hashes to other branches
asynchronously. Readback verifies the selected issue only.

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

Some AIE 6.3 branch routes return HTTP 500 for paths with special characters.
For those paths, supply a known `scan_id` to use VfsNode. MCP returns 403/500
errors without retrying through an archive or selecting another scan.

## Settings and credentials

Settings return write schemas and revisions. Include the revision when saving
to detect stale edits. Omitted/null HTTP and Form passwords preserve their value;
an empty string clears it. Empty proxy passwords preserve the value.
If AIE hides a RawCookie, explicitly replace it or disable that authentication
type before a write requiring preservation. A response that accepts a hidden
password replacement can still report `verified=false` and
`verification.unverified_fields`. Check these fields to see which values AIE
could not confirm.

Readback compares project languages as a set because AIE may reorder them.
Other arrays use exact comparison.

The write schema uses the connected AIE version and its current settings fields.
Historical reads return historical values and revisions, with
`write_schema_source=current_project`. Read current settings before saving.
Updates preserve untouched sections, including Asint. Unrecognized top-level
scan settings block the write before PUT.

For race detection on AIE 6.4, read `section=scan`, then use
`aie_update_project_settings` to set
`whiteBoxSettings.searchForRaceConditionsEnabled=true`. Leave other module choices
unchanged unless requested. AIE checks languages, license, integrations,
permissions and executor availability; errors include known server codes.
`raceConditionSettings` is offered only when the server returns that section.

`scope=Full|Incremental` selects scan scope. Modules come from project settings,
which an uploaded `.aiproj.json` can override. Check historical
`enabledScanModules`, `scanModules` and `wasOverriddenByAiproj` after launch.

## Local analyzer files

| Platform | Directory                                       |
| -------- | ----------------------------------------------- |
| Windows  | `%LOCALAPPDATA%\Application Inspector Analyzer` |
| Linux    | `~/application-inspector-analyzer`              |
| macOS    | `/Library/Application-Inspector-Analyzer`       |

The proxy is `McpProxy.exe` on Windows and `McpProxy` on Linux/macOS. Startup
diagnostics show the npm version and a short build hash to help identify installed
copies. Bundle/agent status is available through the CLI `status` command.
