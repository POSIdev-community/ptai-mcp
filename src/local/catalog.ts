// Captured from installed McpProxy, bundle 3.0.1.1549-develop.
export const localCatalog = {
  bundle_version: '3.0.1.1549-develop',
  server: {
    name: 'ptai_analyzer',
    version: '1.0.0',
  },
  tools: [
    {
      name: 'get_scan_errors',
      description:
        'Retrieves a list of errors (critical and non-critical) that occurred during the last SAST scan.\nUse this if the scan failed or if you want to investigate why certain files were not analyzed properly.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            description: 'Maximum number of errors to return (1-100, default 50). Ordered by severity.',
            type: 'integer',
            default: 50,
          },
        },
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'set_active_project',
      description:
        "Sets the active project directory for the static analysis scanner.\nCall this tool FIRST to start working with MCP on your project, or if other tools return an 'Active project not set' error.\n\nIMPORTANT:\n- If you see only ONE workspace root directory in your system context, set it automatically without asking the user.\n- If you see MULTIPLE workspace roots, ask the user which one to use. MUST be derived from the 'Active Workspaces' in the system context, not inferred from the currently active document.",
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            description:
              "The absolute path to the project root. MUST be derived from the 'Active Workspaces' in the system context, not inferred from the currently active document.",
            type: 'string',
          },
        },
        required: ['projectPath'],
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'get_issue_details',
      description:
        'Retrieves maximum details for a specific issue by its ID.\nIncludes dataflow paths (source to sink snippets), exploit references, and custom validation conditions.',
      inputSchema: {
        type: 'object',
        properties: {
          issueId: {
            description:
              "The unique identifier of the issue (the actual 'id' field returned by list_issues or get_issues_by_location).",
            type: 'string',
          },
        },
        required: ['issueId'],
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'get_scan_status',
      description:
        "Returns the current execution status of the static analysis engine (idle, running with progress percentage, done, or error).\nWhen status is 'running', follow the wait instruction in the response message before calling this tool again.",
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'trigger_scan',
      description:
        "Starts a static analysis (SAST) scan on the project workspace.\nCan be run in incremental (default) or full mode.\nIf the response status is 'running', follow the wait instruction in the response message before calling 'get_scan_status'.",
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            description:
              "Optional mode for the scan. Use 'incremental' (default) to only scan changed files, or 'full' to perform a complete analysis from scratch.",
            type: 'string',
            default: 'incremental',
          },
          blocking: {
            description:
              'If true (default), waits up to 30 seconds for completion, then returns either a summary or running status. If false, starts the scan in the background and returns running status immediately.',
            type: 'boolean',
            default: true,
          },
          source: {
            description:
              "Optional. The source of the scan invocation. Use 'hook' when called from a lifecycle hook to enable .hooks_disabled check. Leave empty for manual invocations.",
            type: 'string',
            default: '',
          },
          hookFormat: {
            description:
              "Optional. When source='hook', specifies the output format for the hook response. Valid values: 'codex' (Codex StopOutput schema), 'claude-code' (Claude Code hook schema). Leave empty for standard MCP tool output.",
            type: 'string',
            default: '',
          },
          stopHookActive: {
            description:
              "Optional. Set to true by the agent when the Stop hook is re-running after a previous block. Used for 'block once' logic: first stop (false) → block, re-run (true) → soft inform.",
            type: 'boolean',
            default: false,
          },
        },
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'triage_issue',
      description:
        "Triages an issue by changing its status (e.g. to 'Approval' or 'Discard')\nwith an explanatory comment.",
      inputSchema: {
        type: 'object',
        properties: {
          issueId: {
            description:
              "The unique identifier of the issue (the actual 'id' field returned by list_issues or get_issues_by_location).",
            type: 'string',
          },
          newStatus: {
            description: "The new target status: 'Approval' or 'Discard'.",
            type: 'string',
          },
          comment: {
            description: 'The reasoning or comment justifying the status change.',
            type: 'string',
          },
        },
        required: ['issueId', 'newStatus', 'comment'],
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'list_issues',
      description:
        'Retrieves a filtered list of issues discovered during the last SAST scan.\nUse this to find critical bugs.',
      inputSchema: {
        type: 'object',
        properties: {
          severity: {
            description: "Optional filter for severity level: 'High', 'Medium', 'Low', or 'Potential'.",
            type: 'string',
            default: '',
          },
          status: {
            description: "Optional filter for triage status: 'None', 'Approval', 'Discard', or 'AutoApproval'.",
            type: 'string',
            default: '',
          },
          filePath: {
            description: 'Optional filter to search in a specific file path relative to project root.',
            type: 'string',
            default: '',
          },
          vulnType: {
            description:
              "Optional filter by issue type, CWE name, or component name. Accepts both internal type identifiers (e.g. 'Potential Path Traversal') and display names shown in the UI (e.g. 'Improper Limitation', 'lodash'). ",
            type: 'string',
            default: '',
          },
        },
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'get_issues_by_location',
      description:
        'Finds all issues attached to a specific file and optional line number.\nPerfect for resolving a bug at a cursor position. Returns the ID that should be used to get issue details.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            description: 'The specific file path (relative to project root) to search for issues.',
            type: 'string',
          },
          lineNumber: {
            description: 'Optional line number (1-indexed) where the issue is reported.',
            type: 'integer',
            default: 0,
          },
        },
        required: ['filePath'],
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'get_scan_history',
      description:
        "Returns a list of past scan results with dates and severity breakdown.\nUse this to compare scan results over time (e.g. 'did my fixes reduce the number of issues?').",
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            description: 'Maximum number of past scan results to return (1-50, default 10).',
            type: 'integer',
            default: 10,
          },
        },
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'stop_scan',
      description: 'Stops the currently running static analysis (SAST) scan on the project.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execution: {
        taskSupport: 'optional',
      },
    },
    {
      name: 'modify_scan_settings',
      description:
        "Modifies settings in the project .aiproj file dynamically and returns the updated settings JSON config.\nUse dot-notation for nested keys (e.g. 'DotNetSettings.UsePublicAnalysisMethod').\nRead current settings and schema via the 'get_scan_settings' tool first to see available keys and valid values.",
      inputSchema: {
        type: 'object',
        properties: {
          settingKey: {
            description:
              "The setting key to modify. Uses dot-notation for nested properties.\nExamples: 'ProjectName', 'SkipGitIgnoreFiles', 'DotNetSettings.DownloadDependencies', 'ProgrammingLanguages'.",
            type: 'string',
          },
          settingValue: {
            description:
              'The new setting value to assign as a JSON literal.\nExamples: \'true\', \'"my-project"\', \'["Java","CSharp (Windows, Linux)"]\', \'{"UsePublicAnalysisMethod": true}\'.',
            type: 'string',
          },
        },
        required: ['settingKey', 'settingValue'],
      },
      execution: {
        taskSupport: 'optional',
      },
    },
  ],
  resources: [
    {
      name: 'get_latest_issues_resource',
      uri: 'ptai://scans/latest/issues',
      description:
        'Provides a complete, unfiltered JSON snapshot of all issues detected during the latest static analysis (SAST) scan.',
      mimeType: 'application/octet-stream',
    },
    {
      name: 'get_scan_status_resource',
      uri: 'ptai://scans/status',
      description:
        'Provides the current execution state of the static analysis (SAST) engine (idle, running X%, done, or error status).',
      mimeType: 'application/octet-stream',
    },
    {
      name: 'get_scan_settings_resource',
      uri: 'ptai://resources/scan_settings',
      description:
        'Provides the current static analysis settings read directly from the project .aiproj file, including its validation JSON schema.',
      mimeType: 'application/octet-stream',
    },
  ],
  resourceTemplates: [],
  prompts: [
    {
      name: 'secure_coding_session',
      description:
        'Activates a strict secure coding workflow. The agent will automatically run SAST scans after modifications and fix any introduced issues before reporting completion. Recommended for security-critical codebases.',
      arguments: [],
    },
  ],
} as const;
