import { createHash } from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Attributes } from '@opentelemetry/api';
import { JobState } from '../aie/runtime/models.js';
import { Effects } from '../shared/effects.js';
import { allowedEnumAttributes, isKnownErrorCode, isKnownTool } from './attribute-policy.js';
import { MetricErrorCode, Outcome, UNKNOWN_TOOL } from './constants.js';

export function installationId(osType: string, machine: string, processors: number) {
  return createHash('sha256').update(`${osType}|${machine}|${processors}`).digest('hex').slice(0, 16).toUpperCase();
}

export function invocationAttributes(
  tool: string,
  response: CallToolResult,
  args: Record<string, unknown>,
  version?: string,
): Attributes {
  const value = response.structuredContent;
  const error = value?.error && typeof value.error === 'object' ? (value.error as Record<string, unknown>) : undefined;
  const attributes: Attributes = {
    tool: isKnownTool(tool) ? tool : UNKNOWN_TOOL,
    outcome: invocationOutcome(response, error),
    error_code: normalizedErrorCode(error),
    ...allowedEnumAttributes(args),
  };

  if (version && /^6\.[34]\.\d+(?:[.\-+][A-Za-z0-9.\-+]+)?$/.test(version) && version.length <= 64) {
    attributes.aie_version = version;
  }

  return attributes;
}

function invocationOutcome(response: CallToolResult, error?: Record<string, unknown>): string {
  const value = response.structuredContent;

  if (response.isError) {
    const effect = typeof value?.effects === 'string' ? value.effects : error?.effects;

    if (effect === Effects.Unknown || effect === Effects.Partial) {
      return effect;
    }

    return Outcome.Error;
  }

  if (value?.operation_id && value.state === JobState.Running) {
    return Outcome.Accepted;
  }

  return Outcome.Success;
}

function normalizedErrorCode(error?: Record<string, unknown>): string {
  if (!error) {
    return MetricErrorCode.None;
  }

  const code = String(error.code);

  return isKnownErrorCode(code) ? code : MetricErrorCode.Other;
}
