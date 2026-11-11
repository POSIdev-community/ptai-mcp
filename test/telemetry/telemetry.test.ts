import { createHash } from 'node:crypto';
import { AggregationTemporality, type PushMetricExporter, type ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { describe, expect, it, vi } from 'vitest';
import { result } from '../../src/mcp/result.js';
import { installationId, invocationAttributes } from '../../src/telemetry/attributes.js';
import { FlusMetricExporter } from '../../src/telemetry/flus-exporter.js';
import { createTelemetry } from '../../src/telemetry/telemetry.js';
import { type FlusConfig } from '../../src/telemetry/types.js';

class Capture implements PushMetricExporter {

  public readonly metrics: ResourceMetrics[] = [];
  public selectAggregationTemporality() {
    return AggregationTemporality.DELTA;
  }
  public export(value: ResourceMetrics, callback: Parameters<PushMetricExporter['export']>[1]) {
    this.metrics.push(value);
    callback({ code: 0 });
  }
  public async forceFlush() {}
  public async shutdown() {}
}

async function fixture() {
  const exporter = new Capture();
  const telemetry = createTelemetry({ env: {}, config: { enabled: true, environment: 'test' }, exporter });
  telemetry.invocation('aie_list_projects', result({ items: [] }), 12, {}, '6.4.0.7986');
  telemetry.action('aie_create_project', 'applied', '6.4.0.7986');
  await telemetry.close();
  return exporter.metrics[0];
}

describe('AIE telemetry payload and opt-out', () => {
  it.each(['true', 'TRUE', 'TrUe'])(
    'opts out before reading configuration or constructing collectors: %s',
    (disabled) => {
      const telemetry = createTelemetry({
        env: { PTAI_DISABLE_TELEMETRY: disabled },
        get config(): FlusConfig {
          throw new Error('Opt-out must not read sender configuration.');
        },
      });
      expect(() => telemetry.invocation('aie_list_projects', result({}), 1, {})).not.toThrow();
    },
  );
  it.each(['', 'false', 'FALSE'])('collects unless explicitly true: %s', async (setting) => {
    const exporter = new Capture();
    const telemetry = createTelemetry({
      env: { PTAI_DISABLE_TELEMETRY: setting },
      config: { enabled: true },
      exporter,
    });
    telemetry.invocation('aie_list_projects', result({}), 1, {});
    await telemetry.close();
    expect(exporter.metrics.length).toBeGreaterThan(0);
  });
  it('uses only closed technical dimensions, excluding sensitive data and arbitrary error codes', () => {
    const secret = 'never-export-this-secret';
    const attrs = invocationAttributes(
      'aie_update_project_settings',
      result({ error: { code: secret, effects: 'unknown', message: secret }, raw: secret }, true),
      { section: 'scan', kind: secret, action: secret, server_url: secret, comment: secret, project_id: secret },
      '6.3.0.7990',
    );
    expect(attrs).toEqual({
      tool: 'aie_update_project_settings',
      outcome: 'unknown',
      error_code: 'OTHER',
      section: 'scan',
      aie_version: '6.3.0.7990',
    });
    expect(JSON.stringify(attrs)).not.toContain(secret);
    expect(invocationAttributes(secret, result({}), {}, secret)).toEqual({
      tool: 'unknown',
      outcome: 'success',
      error_code: 'NONE',
    });
  });
  it('distinguishes accepted workflows, errors, and successful Failed scan reads', () => {
    expect(
      invocationAttributes('aie_start_scan', result({ operation_id: 'not-an-attribute', state: 'running' }), {})
        .outcome,
    ).toBe('accepted');
    expect(
      invocationAttributes('aie_list_projects', result({ error: { code: 'AIE_LOGIN_REQUIRED' } }, true), {}).error_code,
    ).toBe('AIE_LOGIN_REQUIRED');
    expect(invocationAttributes('aie_get_scan_status', result({ state: 'failed' }), {}).outcome).toBe('success');
  });
  it('records numeric duration and counters with an explicit resource attribute set', async () => {
    const metrics = await fixture();
    expect(Object.keys(metrics.resource.attributes).sort()).toEqual(
      [
        'deployment.environment.name',
        'installation.id',
        'mcp.session_id',
        'os.type',
        'plugin_version',
        'service.name',
        'service.version',
        'session_id',
        'user_id',
      ].sort(),
    );
    const data = metrics.scopeMetrics.flatMap((scope) => scope.metrics);
    expect(data.map((metric) => metric.descriptor.name)).toEqual(
      expect.arrayContaining(['ptai.mcp.aie.tool.invocations', 'ptai.mcp.aie.tool.duration', 'ptai.mcp.aie.actions']),
    );
    const count = data.find((metric) => metric.descriptor.name === 'ptai.mcp.aie.tool.invocations')!;
    expect(count.dataPoints).toHaveLength(1);
    expect(count.dataPoints[0].value).toBe(1);
    expect(count.aggregationTemporality).toBe(AggregationTemporality.DELTA);
    expect(count.dataPoints[0].attributes).not.toHaveProperty('duration');
    expect(metrics.resource.attributes['installation.id']).toMatch(/^[0-9A-F]{16}$/);
    expect(metrics.resource.attributes['service.name']).toBe('ptai-mcp');
    expect(metrics.resource.attributes.user_id).toBe(metrics.resource.attributes['installation.id']);
    expect(metrics.resource.attributes.session_id).toBe(metrics.resource.attributes['mcp.session_id']);
    expect(metrics.resource.attributes.plugin_version).toBe(metrics.resource.attributes['service.version']);
  });
  it('matches independent .NET fingerprint fixtures', () => {
    // SHA-256 fixtures generated with System.Security.Cryptography.SHA256.
    expect(installationId('Windows', 'HOST-01', 8)).toBe('DF7A7B4B348D503B');
    expect(installationId('Linux', 'host-01', 4)).toBe('EACB8DD8A1A9BF2A');
    expect(installationId('MacOS', 'MacBook', 10)).toBe('43060D3B3880ED62');
  });
});

describe('bounded FLUS OTLP transport', () => {
  it('sends real Protobuf with a fresh UUID, SHA-256 of actual bytes and the existing FLUS headers', async () => {
    const metrics = await fixture();
    const request = vi.fn(async () => new Response(null, { status: 204 }));
    const exporter = new FlusMetricExporter(
      { enabled: true, host: 'https://flus.example', instanceAccessToken: 'synthetic-flus-token' },
      request,
    );
    const send = () => new Promise<{ code: number }>((resolve) => exporter.export(metrics, resolve));
    expect((await send()).code).toBe(0);
    const [url, init] = request.mock.calls[0] as unknown as [URL, RequestInit];
    const bytes = Buffer.from(init.body as Uint8Array);
    const headers = init.headers as Record<string, string>;
    expect(url.href).toBe('https://flus.example/telemetry/v1/push/');
    expect(init.redirect).toBe('error');
    expect(headers).toMatchObject({
      Authorization: 'InstanceAccessToken synthetic-flus-token',
      TelemetryType: 'ApplicationInspectorPlugins',
      TelemetryKey: 'OpenTelemetry',
      'Content-Type': 'application/x-protobuf',
    });
    expect(headers.TelemetryHash).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(bytes.length).toBeGreaterThan(30);
    expect(bytes[0]).not.toBe('{'.charCodeAt(0));
    const first = headers.TelemetryUUID;
    await send();
    expect((request.mock.calls[1] as unknown as [URL, RequestInit])[1].headers).not.toMatchObject({
      TelemetryUUID: first,
    });
    await exporter.shutdown();
  });
  it('rejects concurrent exports without growing an event queue, and contains exporter failures', async () => {
    const metrics = await fixture();
    let reject!: (error: Error) => void;
    const pending = new Promise<Response>((_resolve, fail) => {
      reject = fail;
    });
    const exporter = new FlusMetricExporter(
      { enabled: true, host: 'https://flus.example', instanceAccessToken: 'synthetic' },
      () => pending,
    );
    const first = new Promise<{ code: number }>((resolve) => exporter.export(metrics, resolve));
    const second = await new Promise<{ code: number }>((resolve) => exporter.export(metrics, resolve));
    expect(second.code).toBe(1);
    reject(new Error('never-log-this-secret'));
    expect((await first).code).toBe(1);
    await exporter.forceFlush();
    await exporter.shutdown();
    const stopped = await new Promise<{ code: number }>((resolve) => exporter.export(metrics, resolve));
    expect(stopped.code).toBe(1);
  });
  it('does not attempt a send when local/release configuration is incomplete', async () => {
    const request = vi.fn();
    const exporter = new FlusMetricExporter({ enabled: false }, request);
    const outcome = await new Promise<{ code: number }>((resolve) => {
      void fixture().then((metrics) => exporter.export(metrics, resolve));
    });
    expect(outcome.code).toBe(1);
    expect(request).not.toHaveBeenCalled();
    await exporter.shutdown();
  });
});
