import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const TelemetryEnvironment = { Test: 'test', Production: 'production' } as const;
export type TelemetryEnvironment = (typeof TelemetryEnvironment)[keyof typeof TelemetryEnvironment];

export interface FlusConfig {
  enabled: boolean;
  host?: string;
  instanceAccessToken?: string;
  environment?: TelemetryEnvironment;
}

export interface Telemetry {
  invocation(
    tool: string,
    response: CallToolResult,
    milliseconds: number,
    args: Record<string, unknown>,
    version?: string,
  ): void;
  action(action: string, outcome: string, version?: string): void;
  close(): Promise<void>;
}
