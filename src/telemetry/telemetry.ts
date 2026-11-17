import { randomUUID } from 'node:crypto';
import os from 'node:os';
import type { Attributes } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AggregationType,
  MeterProvider,
  PeriodicExportingMetricReader,
  type PushMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { getPackageVersion } from '../utils/packageMetadata.js';
import { Platform } from '../utils/platform-constants.js';
import { isKnownAction, isKnownOutcome } from './attribute-policy.js';
import { installationId, invocationAttributes } from './attributes.js';
import { readFlusConfig } from './config.js';
import { MetricName, Outcome } from './constants.js';
import { FlusMetricExporter } from './flus-exporter.js';
import { type FlusConfig, type Telemetry, TelemetryEnvironment } from './types.js';

const osNames: Partial<Record<NodeJS.Platform, string>> = {
  [Platform.Windows]: 'Windows',
  [Platform.Linux]: 'Linux',
  [Platform.MacOS]: 'MacOS',
};

export function createTelemetry(
  options: { env?: NodeJS.ProcessEnv; config?: FlusConfig; exporter?: PushMetricExporter } = {},
): Telemetry {
  const env = options.env ?? process.env;
  const disabled = env.PTAI_DISABLE_TELEMETRY?.toLowerCase() === 'true';
  const noop: Telemetry = { invocation: () => undefined, action: () => undefined, close: async () => undefined };

  // Do not read config or instantiate SDK/reader/exporter when opted out.
  if (disabled) {
    return noop;
  }

  const config = options.config ?? readFlusConfig();

  if (!config.enabled && !options.exporter) {
    return noop;
  }

  const provider = createProvider(config, options.exporter);

  const { calls, duration, actionsCounter } = createInstruments(provider);

  return {
    invocation: (tool, response, milliseconds, args, version) => {
      const attributes = invocationAttributes(tool, response, args, version);
      calls.add(1, attributes);
      duration.record(Math.max(0, milliseconds), attributes);
    },
    action: (action, outcome, version) => {
      if (!isKnownAction(action)) {
        return;
      }

      const attributes: Attributes = { action, outcome: isKnownOutcome(outcome) ? outcome : Outcome.Error };

      if (version && /^6\.[34]\.\d+(?:[.\-+][A-Za-z0-9.\-+]+)?$/.test(version) && version.length <= 64) {
        attributes.aie_version = version;
      }

      actionsCounter.add(1, attributes);
    },
    close: async () => {
      await provider.forceFlush({ timeoutMillis: 750 }).catch(() => undefined);
      await provider.shutdown({ timeoutMillis: 1000 }).catch(() => undefined);
    },
  };
}

function createProvider(config: FlusConfig, exporter?: PushMetricExporter): MeterProvider {
  const osType = osNames[process.platform] ?? 'Other';
  const reader = createMetricReader(config, exporter);

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
      'deployment.environment.name':
        config.environment === TelemetryEnvironment.Test ? TelemetryEnvironment.Test : TelemetryEnvironment.Production,
    }),
    readers: [reader],
    views: [
      {
        instrumentName: MetricName.Duration,
        aggregation: {
          type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
          options: { boundaries: [1, 10, 50, 100, 500, 1000, 5000, 30_000, 60_000, 1_800_000] },
        },
      },
    ],
  });

  return provider;
}

function createMetricReader(config: FlusConfig, exporter?: PushMetricExporter): PeriodicExportingMetricReader {
  const reader = new PeriodicExportingMetricReader({
    exporter: exporter ?? new FlusMetricExporter(config),
    exportIntervalMillis: 60_000,
    exportTimeoutMillis: 2500,
    cardinalityLimits: { default: 256 },
    maxExportBatchSize: 768,
  });

  return reader;
}

function createInstruments(provider: MeterProvider) {
  const meter = provider.getMeter('ptai-mcp-aie', getPackageVersion());
  const calls = meter.createCounter(MetricName.Invocations, {
    description: 'AIE tool invocations including readiness refusals',
    unit: '{call}',
  });

  const duration = meter.createHistogram(MetricName.Duration, { unit: 'ms' });
  const actionsCounter = meter.createCounter(MetricName.Actions, {
    description: 'Confirmed action outcomes; workflow completion counted once',
    unit: '{action}',
  });

  return { calls, duration, actionsCounter };
}
