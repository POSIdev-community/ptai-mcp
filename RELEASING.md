# Releasing `@posidev-community/ptai-mcp`

This document describes how to publish a new npm package version, create the
corresponding GitHub release, and publish the same version to the Official MCP
Registry.

## Release identities

The project has two related but different public identifiers:

| Surface               | Identifier                             |
| --------------------- | -------------------------------------- |
| npm package           | `@posidev-community/ptai-mcp`          |
| Official MCP Registry | `io.github.POSIdev-community/ptai-mcp` |

The capitalization of `POSIdev-community` in the MCP Registry name is
significant. It must exactly match the GitHub organization name and the value
authorized by the Registry.

`package.json` is the source of truth for the package name, version, and MCP
Registry name. The `npm run metadata:sync` command copies those values into
`server.json`.

## Prerequisites

Before starting, verify that you have:

- Node.js 18 or newer and npm;
- publish access to the `posidev-community` npm organization;
- GitHub permission to push and create releases in
  `POSIdev-community/ptai-mcp`;
- a GitHub account that is a public Owner of the `POSIdev-community`
  organization for MCP Registry publication;
- the official `mcp-publisher` CLI.

Never paste npm tokens, GitHub personal access tokens, one-time passwords, or
device authorization codes into issues, chats, build logs, or documentation.
Revoke a token immediately if it is exposed.

## 1. Prepare the release

Start from an up-to-date and clean `main` branch:

```powershell
git switch main
git pull --ff-only
git status --short
npm ci
```

Choose the new semantic version. The examples below use `1.0.3`:

```powershell
$releaseVersion = "1.0.3"
npm version $releaseVersion --no-git-tag-version
npm run metadata:sync
```

The version update must leave these values consistent:

- `package.json.version`;
- the root package version in `package-lock.json`;
- `server.json.version`;
- `server.json.packages[].version` for the npm package.

The following identifiers must not change during an ordinary release:

```text
package.json.name:    @posidev-community/ptai-mcp
package.json.mcpName: io.github.POSIdev-community/ptai-mcp
server.json.name:     io.github.POSIdev-community/ptai-mcp
```

Inspect the changes:

```powershell
git diff -- package.json package-lock.json server.json
npm run metadata:check
```

## 2. Verify the package

Run the complete verification and inspect the publishable artifact:

```powershell
npm run verify
npm pack --dry-run
npm run smoke:artifact
```

Confirm that the package contains the compiled CLI, `README.md`, and
`server.json`, and does not contain credentials, local analyzer data, or
development-only files.

## 3. Commit and push

Commit the version and metadata changes before publishing:

```powershell
git add package.json package-lock.json server.json
git commit -m "chore: release $releaseVersion"
git push origin main
```

Include other intentional release changes and tests in the same commit when
appropriate. Do not commit:

- `.ai/`;
- `mcp-publisher.exe`;
- npm or GitHub tokens;
- locally generated `.tgz` files.

Wait for the GitHub Actions CI workflow to pass before publishing.

## 4. Publish to npm

Confirm which npm account is active:

```powershell
npm whoami
```

If necessary, authenticate:

```powershell
npm login
```

Publish the scoped package publicly:

```powershell
npm publish --access public
```

An npm version cannot be overwritten. If publishing succeeds and a correction
is needed, prepare a new patch version instead of trying to republish the same
version.

Verify the publication:

```powershell
npm view "@posidev-community/ptai-mcp@$releaseVersion" version
npm view @posidev-community/ptai-mcp version dist-tags --json
npx -y "@posidev-community/ptai-mcp@$releaseVersion" -V
```

Do not continue with the MCP Registry until the new npm version is publicly
available. The Registry verifies the referenced package and its `mcpName`.

## 5. Create the GitHub release

Create a GitHub release for the commit that was pushed in step 3.

The repository currently uses tags without a `v` prefix, for example:

```text
1.0.0
1.0.1
1.0.2
```

In the GitHub UI:

1. Open **Releases → Draft a new release**.
2. Create tag `$releaseVersion` from `main`.
3. Use a clear release title and add user-facing release notes.
4. Mark the release as latest if it is the current user-facing stable release.
   A purely technical patch can remain non-latest when the project deliberately
   keeps a primary announcement release marked as latest.
5. Publish the release.

Do not attach the npm `.tgz` unless there is a specific need. npm is the
canonical distribution channel for this package.

## 6. Install or update `mcp-publisher`

On Windows PowerShell, download the official binary into a temporary directory:

```powershell
$publisherArch = if (
  [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq "Arm64"
) { "arm64" } else { "amd64" }

$publisherArchive = Join-Path $env:TEMP "mcp-publisher-$publisherArch.tar.gz"
$publisherDirectory = Join-Path $env:TEMP "ptai-mcp-publisher"
New-Item -ItemType Directory -Force -Path $publisherDirectory | Out-Null

Invoke-WebRequest `
  -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_$publisherArch.tar.gz" `
  -OutFile $publisherArchive

tar -xzf $publisherArchive -C $publisherDirectory mcp-publisher.exe
$publisher = Join-Path $publisherDirectory "mcp-publisher.exe"
& $publisher --help
```

Do not extract the complete archive into the repository root. The archive may
also contain the Registry project's own `README.md` and `LICENSE`, which can
overwrite this repository's files.

On macOS or Linux, follow the installation command from the official Registry
quickstart:

https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx

## 7. Authenticate to the Official MCP Registry

Try the interactive GitHub device flow first:

```powershell
& $publisher logout
& $publisher login github
```

Authorize with the GitHub account that is a public Owner of the
`POSIdev-community` organization.

If the Registry grants only the personal namespace
`io.github.<username>/*`, use a GitHub token that can read the organization
membership:

- classic PAT: `read:org` scope;
- fine-grained PAT: **Organization permissions → Members → Read-only**.

Use the token only locally and do not store it in the repository. After login,
the Registry authorization must include:

```text
io.github.POSIdev-community/*
```

If a token was displayed in a terminal recording, screenshot, issue, or chat,
revoke it and create a replacement before continuing.

## 8. Publish the new version to the Official MCP Registry

Every npm release that should be discoverable as the current MCP version must
also be published to the Registry. npm publication does not update the Registry
automatically.

Validate and publish the synchronized `server.json`:

```powershell
& $publisher validate .\server.json
& $publisher publish .\server.json
```

Expected output:

```text
server.json is valid
Successfully published
Server io.github.POSIdev-community/ptai-mcp version <VERSION>
```

Publishing a new version does not remove the previous versions. The newest
active version is marked as `isLatest: true` by the Registry. There is normally
no need to deprecate the previous version.

Verify the Registry entry:

```powershell
$registryName = [uri]::EscapeDataString("io.github.POSIdev-community/ptai-mcp")
$registryResult = Invoke-RestMethod `
  "https://registry.modelcontextprotocol.io/v0.1/servers?search=$registryName"
$registryResult | ConvertTo-Json -Depth 20
```

Confirm that the response contains:

```text
name:     io.github.POSIdev-community/ptai-mcp
version:  <VERSION>
status:   active
isLatest: true
```

## 9. Final release checklist

- [ ] `package.json`, `package-lock.json`, and `server.json` use the new version.
- [ ] `npm run verify` passes.
- [ ] `npm pack --dry-run` contains only intended files.
- [ ] The release commit is pushed and CI is green.
- [ ] The npm version is public and `latest` points to the intended version.
- [ ] The published package starts through `npx`.
- [ ] The GitHub release and tag exist.
- [ ] The Official MCP Registry version is active and latest.
- [ ] Release links are added to the tracking issue or announcement.

## Useful links

- npm package: https://www.npmjs.com/package/@posidev-community/ptai-mcp
- GitHub releases: https://github.com/POSIdev-community/ptai-mcp/releases
- Official MCP Registry entry:
  https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.POSIdev-community/ptai-mcp
- Official publisher quickstart:
  https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx
- Official publisher CLI reference:
  https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/cli/commands.md

## Future automation

The manual Registry step can be automated in GitHub Actions with GitHub OIDC.
When adding automation, use a release-tag workflow, grant only
`id-token: write` and `contents: read`, and publish npm before publishing the
corresponding Registry metadata.

Official example:

https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/github-actions.mdx
