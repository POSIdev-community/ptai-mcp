export const HOOK_EVENTS = {
  CURSOR_STOP: 'stop',
  CURSOR_START: 'beforeSubmitPrompt',
  CLAUDE_STOP: 'Stop',
  CLAUDE_START: 'UserPromptSubmit',
  WINDSURF_STOP: 'post_cascade_response',
  WINDSURF_START: 'pre_user_prompt',
  KIMI_STOP: 'Stop',
  KIMI_START: 'UserPromptSubmit',
  CODEX_STOP: 'Stop',
  CODEX_START: 'UserPromptSubmit',
  CODEX_TRUST_STOP: 'stop', // Codex normalizes event names to snake_case for trust hashing
  CODEX_TRUST_START: 'user_prompt_submit',
} as const;

export const AGENT_FORMATS = {
  CURSOR: 'cursor',
  CLAUDE_CODE: 'claude-code',
  WINDSURF: 'windsurf',
  KIMI: 'kimi',
  CODEX: 'codex',
  OPEN_CODE: 'opencode',
} as const;

export const AGENT_IDS = {
  CURSOR: 'cursor',
  CLAUDE_DESKTOP: 'claude-desktop',
  CLAUDE_CODE: 'claude-code',
  WINDSURF: 'windsurf',
  KIMI_CODE: 'kimi-code',
  CODEX: 'codex',
  ANTIGRAVITY: 'antigravity',
  GEMINI_CLI: 'gemini-cli',
  OPEN_CODE: 'opencode',
} as const;

export const STOP_TOOL_NAME = 'trigger_scan';
export const MCP_SERVER_NAME = 'ptai_analyzer';
