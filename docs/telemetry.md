# Telemetry

Configured release builds collect technical usage metrics by default and send
them to the release-configured FLUS/GUS HTTPS service. Local builds without
release telemetry configuration have no sender. Build configuration and release
checks are described in [RELEASING.md](../RELEASING.md).

## Collected data

- Tool invocation counts, durations and confirmed action counts.
- Tool name, outcome, normalized error code, allowlisted action/section/kind and
  AIE version.
- Package name/version, OS and test/production environment.
- A random process-session UUID and a stable installation pseudonym.

The installation pseudonym is the first 16 uppercase hexadecimal characters of
SHA-256 of the OS name, host name and available CPU count. The host name itself
is not sent. The pseudonym can correlate activity with BE4P on the same installation;
it is not an anonymous per-call identifier.

Source code, comments, file paths, AIE URLs, setting values, passwords and tokens
are excluded from the telemetry attributes.

Metrics are aggregated in memory and exported about once per minute. There is
no disk retry queue; failed exports can lose metrics and do not fail a tool.
Workflow acceptance and completion are separate events; polling does not create
extra completion events. Payloads and shutdown flush time are bounded.

Retention and access permissions are governed by the receiving service. This
package does not define an additional retention policy; release owners must
confirm those settings before publication.

## Opt out

Set `PTAI_DISABLE_TELEMETRY=true` in the MCP server's launch environment and
restart it. The value is case-insensitive. For clients using JSON configuration,
add this to the server's configuration:

```json
{
  "env": {
    "PTAI_DISABLE_TELEMETRY": "true"
  }
}
```

This disables the Node collector and exporter and passes the opt-out to the
local analyzer proxy. Node makes no telemetry DNS/HTTP requests in this mode.
Required AIE API requests continue to work. Existing IDE plugins use their own
telemetry settings.
