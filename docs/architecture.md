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
| `assets/aie-login`                                       | Login HTML, CSS, browser JavaScript, SVG and fonts                |

The MCP dispatcher validates untrusted arguments once and selects a typed handler.
`context.ts` describes the services available during a call; `handler-contract.ts`
describes handler signatures and the complete typed handler map. `handlers.ts`
assembles the concrete implementations and invokes them. Implementations import
their types from the contract, keeping dependencies directed toward contracts;
lint rejects imports of the registry assembly from individual handlers.

The tool catalog contains ordinary JSON Schema data. Reusable fragments have
names such as `uuidSchema` and `paginationProperties`; they describe argument
formats and property maps. Tool definitions use named options and check property
and required-field names against `ToolArguments`. Strict schema-compilation tests
check the JSON Schema keywords. The catalog remains declarative JSON Schema data.

Shared agent descriptors, session models, finding filters and job contexts live
in their owning `models.ts` modules. Types that describe one function's API, such
as `DownloadOptions` and `PackedSources`, stay beside that API.

Domain services use `AieApi`, which composes the generated endpoint clients and
normalizes transport failures. Generated sources remain isolated and are excluded
from handwritten-code lint and coverage checks. JSON assertions belong at validated
boundaries rather than in each tool handler.

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
- Checked promises and strict equality.
- Imports at the beginning of the file, ordered as side effects, Node builtins,
  third-party packages, then project modules. Each group has alphabetical ordering
  and follows the previous group without a blank separator. The entire import block
  is followed by one blank line. Side-effect imports preserve their relative order. Run
  `npm run lint:fix` to apply the ordering automatically.
  Type-only imports follow the same groups as runtime imports. Parent (`../`)
  and sibling (`./`) modules belong to one project group. Blank lines between any
  adjacent imports are removed automatically.

An indexed type such as `PushMetricExporter['export']` refers to an existing SDK
member. Its quoted key is a type annotation and is erased from runtime code.
Use a local type alias when a derived signature becomes hard to read.

The small `scripts/prettier-class-padding.mjs` extension keeps the opening blank
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
Lint rejects directly exported module-level `Map`, `Set`, `WeakMap` and `WeakSet`
instances, including collections annotated as readonly: callers should receive
operations or snapshots rather than the shared mutable instance.

Functions and methods use these size bands, excluding blank and comment-only lines:

| Code lines   | Classification | Enforcement                                      |
| ------------ | -------------- | ------------------------------------------------ |
| Up to 20     | Optimal        | Informational report                             |
| 21–35        | Normal         | Informational report                             |
| 36–50        | Review         | Lint warning; inspect for named steps to extract |
| More than 50 | Oversized      | Lint error                                       |

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
Add `-- --json` for an object with `functions` and `files` arrays. Size limits prompt
separation of responsibilities; useful whitespace and comments remain encouraged.

## Verification

Run `npm run verify` for metadata, lint, formatting, TypeScript, the test suite with
coverage gates and the build. Run `npm run smoke:artifact` afterward to verify the
packed package in isolation. Coverage gates remain 90% for lines, statements and
functions, and 80% for branches. Tests use synthetic sessions and an independent
AIE HTTP fixture; published artifacts contain no credentials.
