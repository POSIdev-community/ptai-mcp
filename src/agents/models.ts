export type ConfigFormat = 'json' | 'toml' | 'opencode';

export interface AgentDefinition {
  id: string;
  displayName: string;
  format: ConfigFormat;
  getMcpConfigPaths: () => string[];
  getHooksConfigPaths: () => string[];
  supportsHooks: boolean;
}
