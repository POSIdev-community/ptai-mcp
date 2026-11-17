import { createHash, randomUUID } from 'node:crypto';
import { ProtobufMetricsSerializer } from '@opentelemetry/otlp-transformer';
import { AggregationTemporality, type PushMetricExporter, type ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { HttpHeader, HttpMethod } from '../shared/http-constants.js';
import { RedirectPolicy } from '../shared/io-constants.js';
import type { FlusConfig } from './types.js';

/** One bounded export in flight; aggregation in the SDK replaces an event queue. */
export class FlusMetricExporter implements PushMetricExporter {

  private pending?: Promise<void>;
  private controller?: AbortController;
  private closed = false;

  public constructor(
    private readonly config: FlusConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  public selectAggregationTemporality() {
    return AggregationTemporality.DELTA;
  }

  public export(metrics: ResourceMetrics, callback: MetricExportCallback): void {
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
          method: HttpMethod.Post,
          redirect: RedirectPolicy.Reject,
          signal: this.controller!.signal,
          body,
          headers: {
            Authorization: `InstanceAccessToken ${this.config.instanceAccessToken}`,
            [HttpHeader.ContentType]: 'application/x-protobuf',
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

  public async forceFlush() {
    await this.pending;
  }

  public async shutdown() {
    this.closed = true;
    this.controller?.abort();
    await this.pending;
  }
}

// Derive the completion callback from the SDK method signature.
type MetricExportCallback = Parameters<PushMetricExporter['export']>[1];
