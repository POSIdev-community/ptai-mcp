import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  AggregationTemporality,
  AggregationType,
  type PushMetricExporter,
  type ResourceMetrics,
} from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ProtobufMetricsSerializer } from '@opentelemetry/otlp-transformer';
import type { Attributes } from '@opentelemetry/api';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { aieCatalog } from '../aie/catalog.js';
import { getPackageVersion } from '../utils/packageMetadata.js';

export interface FlusConfig {
  enabled: boolean;
  host?: string;
  instanceAccessToken?: string;
  environment?: 'test' | 'production';
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

const tools = new Set(aieCatalog.map((tool) => tool.name));
const actions = new Set([
  'login',
  'logout',
  'session_pickup',
  'aie_create_project',
  'aie_upload_sources',
  'aie_download_project',
  'aie_start_scan',
  'aie_triage_issue',
  'aie_update_project_settings',
  'aie_save_pm_catalog_entry',
  'aie_stop_scan',
  'scan_terminal',
]);
const enums: Record<string, Set<string>> = {
  action: new Set(['login', 'logout', 'cancel_login', 'create', 'update']),
  section: new Set(['scan', 'pm_groups', 'policies', 'blackbox', 'preferred_agents']),
  kind: new Set(['rules', 'groups', 'types']),
};
const outcomes = new Set([
  'success',
  'error',
  'accepted',
  'applied',
  'partial',
  'unknown',
  'cancelled',
  'not_applied',
  'done',
  'failed',
  'stopped',
]);
const errors = new Set([
  'AIE_VALIDATION_ERROR',
  'AIE_LOGIN_REQUIRED',
  'AIE_SERVER_REQUIRED',
  'AIE_VERSION_UNSUPPORTED',
  'AIE_VERSION_UNKNOWN',
  'AIE_TLS_ERROR',
  'AIE_NETWORK_ERROR',
  'AIE_TIMEOUT',
  'AIE_CANCELLED',
  'AIE_PERMISSION_DENIED',
  'AIE_LICENSE_ERROR',
  'AIE_NOT_FOUND',
  'AIE_CONFLICT',
  'AIE_RATE_LIMITED',
  'AIE_SERVER_ERROR',
  'AIE_CONTEXT_CHANGED',
  'AIE_TARGET_MISMATCH',
  'AIE_TARGET_BUSY',
  'AIE_OPERATION_BUSY',
  'AIE_OPERATION_NOT_FOUND',
  'AIE_LOGIN_NOT_FOUND',
  'AIE_SESSION_UNREADABLE',
  'AIE_SESSION_BUSY',
  'AIE_REVISION_CONFLICT',
  'AIE_READBACK_MISMATCH',
  'AIE_READBACK_UNAVAILABLE',
  'AIE_INVALID_RESPONSE',
  'AIE_INVALID_ARCHIVE',
  'AIE_RESULT_LIMIT',
  'AIE_UPSTREAM_LIMIT',
  'AIE_LIST_LIMIT',
  'AIE_CURSOR_INVALID',
  'AIE_ARCHIVE_LIMIT',
  'AIE_INTERNAL_ERROR',
  'AIE_SOURCES_NOT_READY',
  'AIE_SOURCE_CHANGED',
  'AIE_SOURCE_READINESS_UNKNOWN',
  'AIE_SCAN_CORRELATION_REQUIRED',
  'AIE_CREDENTIALS_PRESERVATION_REQUIRED',
]);

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
  const effect = typeof value?.effects === 'string' ? value.effects : error?.effects;
  const outcome = response.isError
    ? effect === 'unknown' || effect === 'partial'
      ? effect
      : 'error'
    : value?.operation_id && value?.state === 'running'
      ? 'accepted'
      : 'success';
  const attributes: Attributes = {
    tool: tools.has(tool) ? tool : 'unknown',
    outcome,
    error_code: error ? (errors.has(String(error.code)) ? String(error.code) : 'OTHER') : 'NONE',
  };
  for (const [key, allowed] of Object.entries(enums))
    if (typeof args[key] === 'string' && allowed.has(args[key])) attributes[key] = args[key];
  if (version && /^6\.[34]\.\d+(?:[.\-+][A-Za-z0-9.\-+]+)?$/.test(version) && version.length <= 64)
    attributes.aie_version = version;
  return attributes;
}

/** One bounded export in flight; aggregation in the SDK replaces an event queue. */
export class FlusMetricExporter implements PushMetricExporter {
  private pending?: Promise<void>;
  private controller?: AbortController;
  private closed = false;
  constructor(
    private readonly config: FlusConfig,
    private readonly request: typeof fetch = fetch,
  ) {}
  selectAggregationTemporality() {
    return AggregationTemporality.DELTA;
  }
  export(metrics: ResourceMetrics, callback: Parameters<PushMetricExporter['export']>[1]) {
    if (this.closed || this.pending) {
      callback({ code: 1 });
      return;
    }
    const bytes = ProtobufMetricsSerializer.serializeRequest(metrics);
    if (!bytes || bytes.length > 256 * 1024 || !this.config.host || !this.config.instanceAccessToken) {
      callback({ code: 1 });
      return;
    }
    const body = Buffer.from(bytes);
    this.controller = new AbortController();
    const timer = setTimeout(() => this.controller?.abort(), 2000);
    timer.unref();
    this.pending = Promise.resolve().then(async () => {
      try {
        const response = await this.request(new URL('/telemetry/v1/push/', this.config.host!), {
          method: 'POST',
          redirect: 'error',
          signal: this.controller!.signal,
          body,
          headers: {
            Authorization: `InstanceAccessToken ${this.config.instanceAccessToken}`,
            'Content-Type': 'application/x-protobuf',
            TelemetryType: 'ApplicationInspectorPlugins',
            TelemetryKey: 'OpenTelemetry',
            TelemetryUUID: randomUUID(),
            TelemetryHash: createHash('sha256').update(body).digest('hex'),
          },
        });
        await response.body?.cancel();
        callback({ code: response.ok ? 0 : 1 });
      } catch {
        callback({ code: 1 });
      } finally {
        clearTimeout(timer);
        this.pending = undefined;
        this.controller = undefined;
      }
    });
  }
  async forceFlush() {
    await this.pending;
  }
  async shutdown() {
    this.closed = true;
    this.controller?.abort();
    await this.pending;
  }
}

export function readFlusConfig(): FlusConfig {
  const current = path.dirname(fileURLToPath(import.meta.url));
  for (const file of [
    path.join(current, 'telemetry-config.json'),
    path.join(current, '../../dist/telemetry-config.json'),
  ]) {
    try {
      const config = JSON.parse(fs.readFileSync(file, 'utf8')) as FlusConfig;
      if (config.enabled && config.host && config.instanceAccessToken && new URL(config.host).protocol === 'https:')
        return config;
    } catch {
      /* A local build without release credentials has no sender. */
    }
  }
  return { enabled: false };
}

export function createTelemetry(
  options: { env?: NodeJS.ProcessEnv; config?: FlusConfig; exporter?: PushMetricExporter } = {},
): Telemetry {
  const env = options.env ?? process.env;
  const disabled = env.PTAI_DISABLE_TELEMETRY?.toLowerCase() === 'true';
  const noop: Telemetry = { invocation: () => undefined, action: () => undefined, close: async () => undefined };
  // Do not read config or instantiate SDK/reader/exporter when opted out.
  if (disabled) return noop;
  const config = options.config ?? readFlusConfig();
  if (!config.enabled && !options.exporter) return noop;
  const osNames: Partial<Record<NodeJS.Platform, string>> = { win32: 'Windows', linux: 'Linux', darwin: 'MacOS' };
  const osType = osNames[process.platform] ?? 'Other';
  const reader = new PeriodicExportingMetricReader({
    exporter: options.exporter ?? new FlusMetricExporter(config),
    exportIntervalMillis: 60_000,
    exportTimeoutMillis: 2500,
    cardinalityLimits: { default: 256 },
    maxExportBatchSize: 768,
  });
  const packageVersion = getPackageVersion();
  const installation = installationId(osType, os.hostname(), os.availableParallelism());
  const session = randomUUID();
  const provider = new MeterProvider({
    resource: resourceFromAttributes({
      'service.name': 'ptai-mcp',
      'service.version': packageVersion,
      'os.type': osType,
      'installation.id': installation,
      'mcp.session_id': session,
      // Existing ApplicationInspectorPlugins columns used by BE4P analytics.
      user_id: installation,
      session_id: session,
      plugin_version: packageVersion,
      'deployment.environment.name': config.environment === 'test' ? 'test' : 'production',
    }),
    readers: [reader],
    views: [
      {
        instrumentName: 'ptai.mcp.aie.tool.duration',
        aggregation: {
          type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
          options: { boundaries: [1, 10, 50, 100, 500, 1000, 5000, 30_000, 60_000, 1_800_000] },
        },
      },
    ],
  });
  const meter = provider.getMeter('ptai-mcp-aie', getPackageVersion());
  const calls = meter.createCounter('ptai.mcp.aie.tool.invocations', {
    description: 'AIE tool invocations including readiness refusals',
    unit: '{call}',
  });
  const duration = meter.createHistogram('ptai.mcp.aie.tool.duration', { unit: 'ms' });
  const actionsCounter = meter.createCounter('ptai.mcp.aie.actions', {
    description: 'Confirmed action outcomes; workflow completion counted once',
    unit: '{action}',
  });
  return {
    invocation: (tool, response, milliseconds, args, version) => {
      const attributes = invocationAttributes(tool, response, args, version);
      calls.add(1, attributes);
      duration.record(Math.max(0, milliseconds), attributes);
    },
    action: (action, outcome, version) => {
      if (!actions.has(action)) return;
      const attributes: Attributes = { action, outcome: outcomes.has(outcome) ? outcome : 'error' };
      if (version && /^6\.[34]\.\d+(?:[.\-+][A-Za-z0-9.\-+]+)?$/.test(version) && version.length <= 64)
        attributes.aie_version = version;
      actionsCounter.add(1, attributes);
    },
    close: async () => {
      await provider.forceFlush({ timeoutMillis: 750 }).catch(() => undefined);
      await provider.shutdown({ timeoutMillis: 1000 }).catch(() => undefined);
    },
  };
}
