# Architecture and code quality

The CLI exposes two MCP backends. The local backend forwards calls to an installed
analyzer; the AIE backend uses the vendored generated HTTP client. Installing the
npm package does not require an analyzer or access to a private package registry.

## Module boundaries

| Directory                                                | Responsibility                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/commands`, `src/agents`                             | CLI workflows and agent configuration                             |
| `src/agents/hooks`                                       | Agent hook adapters, configuration IO and hook matching           |
| `src/services/installer`                                 | Installer download, restricted TLS transport and extraction       |
| `src/mcp`                                                | Public MCP server, result envelope and protocol constants         |
| `src/local`                                              | Lazy analyzer connection and catalog compatibility checks         |
| `src/aie/mcp`                                            | AIE schemas, input validation, typed handler dispatch             |
| `src/aie/api`                                            | Generated-client composition, transport safety and DTO validation |
| `src/aie/auth`                                           | Login lifecycle, shared session storage, locking and renewal      |
| `src/aie/projects`, `settings`, `pm`, `scans`, `sources` | Domain operations                                                 |
| `src/aie/runtime`                                        | Asynchronous jobs, cancellation and snapshot pagination           |
| `src/shared`                                             | Common errors, result effects, limits and JSON operations         |
| `src/telemetry`                                          | Closed attribute allowlists and optional metric export            |
| `src/vendor/aie-v63`                                     | Generated API client and Swagger contract                         |
| `src/vendor/aie-v64`                                     | Generated 6.4 write schemas and source fingerprints               |
| `assets/aie-login`                                       | Login HTML, CSS, browser JavaScript, SVG and fonts                |

The MCP dispatcher validates untrusted arguments once and selects a typed handler.
`context.ts` describes the services available during a call; `handler-contract.ts`
describes handler signatures and the complete typed handler map. `handlers.ts`
assembles the concrete implementations and invokes them. Implementations import
their types from the contract, keeping dependencies directed toward contracts;
lint rejects imports of the registry assembly from individual handlers.

All seven handler maps are compact dispatch tables: tool names point to named
functions, including handlers that delegate with one call. Implementations follow
the table; local argument types and the domain-specific tool-name union follow
the functions. For example, `findingHandlers` uses
`Pick<ToolHandlers, FindingToolNames>` and registers `listIssues`, `getIssueDetails`
and `triageIssue`. Keeping `Pick` preserves the checked set of keys and signatures.
Argument aliases derive from `ToolArguments` instead of repeating its fields;
existing shared types such as `CreateArguments` are imported directly.

Long or repeated `Pick` types in function signatures also receive descriptive
names. Installer `DownloadSecurityOptions` and `DownloadTlsOptions` live beside
`DownloadOptions` in its owning `models.ts`; the aliases preserve their exact
property sets and optionality. Avoid adding a generic registration factory just
to hide the underlying handler contract.

The tool catalog contains ordinary JSON Schema data. Reusable fragments have
names such as `uuidSchema` and `paginationProperties`; they describe argument
formats and property maps. Tool definitions use named options and check property
and required-field names against `ToolArguments`. Strict schema-compilation tests
check the JSON Schema keywords.

Shared agent descriptors, session models, finding filters and job contexts live
in their owning `models.ts` modules. Types that describe one function's API, such
as `DownloadOptions` and `PackedSources`, stay beside that API.

Domain services use `AieApi`, which composes the generated endpoint clients and
normalizes transport failures. Generated sources remain isolated and are excluded
from handwritten-code lint and coverage checks. JSON assertions belong at validated
boundaries rather than in each tool handler.

The 6.3 endpoint client passes request objects directly; `AieApi.json` reads raw
JSON and preserves new response fields. The authenticated server version selects
the write schemas. Optional settings must also appear in the server's current
settings response. Source Swagger hashes are stored beside the schemas.

Incremental scans can reuse issue records from earlier scans. If the record's
`scanResultId` differs from the selected scan, details check its project, branch
and exact ID in the selected scan's compact issue list. A failed membership check
blocks details and triage. Full evidence is fetched only for the selected issue.

Shared session paths are resolved through the platform path helpers, including
`LOCALAPPDATA` on Windows. Sessions are reread under a cross-process lock before
replacement; late login completion must not overwrite a newer shared session.

`src/local/catalog.ts` is a captured external contract. `LocalToolName` names its
tools; a test checks that the names are complete. The two backend vocabularies are
`LocalToolName` in `src/local/tool-names.ts` and `AieToolName` in `src/aie/tool-names.ts`.
MCP protocol parameters are kept separately in `src/mcp/constants.ts`.
An agent's `Stop` lifecycle hook calls `LocalToolName.TriggerScan` to check changes;
stopping an analyzer scan is the separate `LocalToolName.StopScan` tool.

Login assets are copied into `dist/assets/aie-login` during the build. The loopback
server serves an explicit asset allowlist with a restrictive CSP. Templates escape
session-specific values. The packed-artifact smoke check verifies the assets and
starts MCP from a clean npm installation.

The OpenCode source template lives in `assets/agents` and is copied to
`dist/assets/agents`. Rendering replaces only the marker, executable path and
security rules; extracting the template preserves the generated plugin text.

## Readability rules

`npm run lint` enforces:

- Braces for every conditional and loop; one statement per line.
- Explicit class-member visibility, including constructors.
- Module declarations follow a checked order: public types and module
  initialization, public functions/classes, private helper functions, then local
  types. A vocabulary value and its derived exported type stay together. Local
  interfaces stay in their file when they describe only that implementation.
  Initializers retain their dependency order; private base classes belong to
  initialization. Module ordering has no autofix because moving evaluated code
  can change behavior. Entry-point statements and re-export lists are not sorted.
- Static fields, instance fields, constructor, then methods/accessors. Each field
  group and method group is ordered public, protected, private. A nonempty class
  starts with a blank line; visibility groups and methods have blank separators.
  Member order is checked without autofixing: moving initialized fields may change
  behavior. Constructors have a separate 40-code-line limit.
- At most three nested control-flow blocks; no nested ternaries.
- At most two nested callbacks in handwritten source. Extract a named step when
  another callback would obscure the surrounding operation. Branching complexity
  above 15 produces a warning, including in short functions; it is a review signal,
  not a requirement to hide individual conditions in separate helpers.
- A 120-character code line limit. Long URLs, string/template literals and regular
  expressions are exempt; comments still have a 120-character limit.
- Blank lines between methods and around blocks, multiline declarations and returns.
- Named values in typed literal contracts and known protocol contexts, including
  states, effects, tool names, error codes and installer product identity. The
  product identity is also checked inside template strings. Type annotations,
  imports, ordinary object keys and standard Node encodings/events may remain literal.
  The captured local catalog and generated API sources retain their wire values.
- Three or more occurrences of an ordinary string in one file produce an advisory
  warning. Equal text does not prove equal meaning: review ownership and change
  independently meaningful values separately. Duplicate detection has no autofix
  and does not choose a shared constant by matching bytes.
- Checked promises and strict equality, with the intentional `value == null` /
  `value != null` exception for checking both null and undefined.
- Imports at the beginning of the file, ordered as side effects, Node builtins,
  third-party packages, then project modules. Each group has alphabetical ordering
  and follows the previous group without a blank separator. The entire import block
  is followed by one blank line. Side-effect imports preserve their relative order. Run
  `npm run lint:fix` to apply the ordering automatically.
  Type-only imports follow the same groups as runtime imports. Parent (`../`)
  and sibling (`./`) modules belong to one project group. Blank lines between any
  adjacent imports are removed automatically.

The project-specific size, layout, vocabulary, mutable-state and typed-promise
rules apply to handwritten `src` files. General ESLint and formatting rules also
cover tests, maintenance scripts, assets, the launcher and the listed root configs.
Generated API files, build output, dependencies, local runtime/cache and live/probe
scripts are excluded. The captured local catalog is exempt from vocabulary and
duplicate-string checks. These scopes are explicit in `eslint.config.js`.

Inline ESLint configuration is disabled: an `eslint-disable` comment cannot silence
a required check. Put a narrowly scoped exception and its reason in the shared
ESLint config. The ZIP name validator has one such exception for a regular expression
that deliberately rejects control characters. File-size exception comments below
are a separate, checked mechanism and remain visible in the report.

An indexed type such as `PushMetricExporter['export']` refers to an existing SDK
member. Its quoted key is a type annotation and is erased from runtime code.
Use a local type alias when a derived signature becomes hard to read.

The `scripts/prettier-class-padding.mjs` extension keeps the opening blank
line when Prettier formats a class. Tests check that Prettier and ESLint converge
and that empty classes and method bodies keep their usual formatting.

## Values, models and module state

Domain vocabularies live with their models. For example, `LoginState` supplies
runtime values and derives the corresponding TypeScript union from those same
values. Tool names live in backend-specific `tool-names.ts` modules. These are
module exports, not values added to the global namespace.
For example, `Effects.Unknown` and `ScanState.Unknown` remain independent even
though both serialize to `unknown`: changing one domain must not change another.

Common result effects live in `src/shared/effects.ts`; technical IO options live
separately in `src/shared/io-constants.ts`. A constants module should contain
declarative values, not services, mutable caches or business decisions. A value
used by one module stays private to that module unless another caller needs it.
Platform identifiers live in `src/utils/platform-constants.ts`. The installer
product identity is shared by runtime code and Node 18 maintenance scripts through
the checked JavaScript module `src/services/bundle-constants.js`.

Telemetry allowlists are private to `attribute-policy.ts`; callers use predicates
and a filtering function rather than receiving mutable collections. The private
write-validator cache stays in `write-schema.ts`: it is keyed only by bundled schema
names, independently of session or request identity. Request-specific mutable state
belongs to service instances with an explicit lifecycle.
Lint rejects exported module-level `Map`, `Set`, `WeakMap` and `WeakSet` instances,
including local aliases, readonly assertions and `Object.freeze` wrappers. Those
wrappers do not prevent collection mutations. Callers should receive operations,
snapshots or factories rather than the shared mutable instance. This is a targeted
syntax check, not whole-program proof of immutability; nested containers, getters
and arbitrary factory calls still need review.

Functions and methods use these size bands, excluding blank and comment-only lines:

| Code lines   | Classification | Enforcement                                      |
| ------------ | -------------- | ------------------------------------------------ |
| Up to 20     | Optimal        | Informational report                             |
| 21–35        | Normal         | Informational report                             |
| 36–50        | Review         | Lint warning; inspect for named steps to extract |
| More than 50 | Oversized      | Lint error                                       |

Objects containing inline functions also have a combined 50-code-line limit.
This catches large handler registries even when every individual callback fits
the function limit. Move implementations into named functions and register their
references. Plain data objects, including schemas, and tables of named function
references are exempt from this object limit. TypeScript assertions around an
inline function do not bypass the check.

Handwritten source files use the following bands. Blank and comment-only lines
are excluded, just as for functions; the report also shows physical file length.

| Code lines    | Classification | Enforcement                                          |
| ------------- | -------------- | ---------------------------------------------------- |
| Up to 150     | Optimal        | Informational report                                 |
| 151–300       | Normal         | Informational report                                 |
| 301–500       | Review         | Lint warning; inspect responsibility boundaries      |
| More than 500 | Oversized      | Lint error unless a specific exception is documented |

An oversized file may declare `// file-size-exception: <architectural reason>`
in its first five lines. The reason must have at least 30 characters; the exception
remains visible as a lint warning and in the quality report. No current handwritten
source needs this exception. Generated API sources and the captured local catalog
keep their existing treatment as external contract data.

`npm run quality:report` lists function and file distributions and review candidates.
Add `-- --json` for an object with `functions`, `files` and `errors` arrays. The report
fails on oversized code or other source lint errors. CI prints the report after
verification. The ESLint configuration and regression tests in
`test/quality-rules.test.ts` define the enforced rules.

## Verification

| Entry point              | Checks                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`           | ESLint errors block; warnings remain advisory.                                                                             |
| `npm run typecheck`      | `tsc --noEmit`: strict types and checked JS in `src` and `test`; no lint or tests.                                         |
| `npm run build`          | Bundle source and copy assets/notices; does not run lint, TypeScript checking or tests.                                    |
| `npm run verify`         | Metadata consistency → lint → formatting → typecheck → coverage tests → build; stops on failure.                           |
| Pre-commit               | `lint-staged`: ESLint fixes and Prettier on staged matching files, including `.mjs`/`.cjs`; no full verification.          |
| Pre-push                 | Full `npm run verify`.                                                                                                     |
| `npm pack` / prepack     | Synchronize metadata, then full verification/build.                                                                        |
| `npm run smoke:artifact` | Pack with scripts disabled, install in isolation and check CLI/MCP/assets; uses the existing build.                        |
| CI                       | Full verification, size report, runtime dependency audit, package inspection and artifact smoke on 3 OSes × Node 18/20/22. |

Run `npm run verify`, then `npm run smoke:artifact` to check both source and the
packed package. Coverage gates are 90% for lines, statements and functions, and
80% for branches across handwritten `src/**/*.ts`; they are aggregate thresholds,
not per-file guarantees. No selected tests is an error. Tests use synthetic
sessions and an independent AIE HTTP fixture.

CI runs for pull requests, pushes to main/master and manual dispatch. Local hooks
can be bypassed, so they do not replace required CI checks in branch protection;
repository files alone do not establish whether that protection is enabled.
Architectural ownership, absence of dependency cycles, meaningful names, suitable
abstractions and complete secret hygiene still require review and targeted tests.
The handler-to-registry import restriction checks normalized static module paths;
it does not enforce every boundary in the architecture table.

## Local development

Install dependencies, verify the source and smoke-test the resulting package:

```bash
npm ci
npm run verify
npm run smoke:artifact
node ./bin/ptai-mcp.js --help
```

Use `npm run build` to rebuild the CLI and `npm run verify` to run all checks.
Use `node ./bin/ptai-mcp.js install` to exercise setup from the source tree. The
analyzer bundle remains optional. `node ./bin/ptai-mcp.js start` launches stdio MCP
for a client configured to use this local checkout.

To inspect a packed build, run `npm run artifact` and use the `.tgz` filename it
prints. Replace `<archive.tgz>` in this example with that filename:

```bash
npm exec --yes --package="./<archive.tgz>" -- ptai-mcp --help
```

The setup CLI writes agent configuration using the published package name via
`npx`. For an unpublished build, configure the test client to invoke Node with the
absolute path to this checkout's `bin/ptai-mcp.js` and the `start` argument.
The artifact smoke check uses an isolated installation automatically.

Package/Registry identities and release metadata synchronization are documented
in [RELEASING.md](../RELEASING.md). User-facing configuration and workflow details
are in [usage.md](usage.md); telemetry collection and opt-out are in
[telemetry.md](telemetry.md).
