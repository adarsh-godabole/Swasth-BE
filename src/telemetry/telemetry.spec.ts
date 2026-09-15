import { startTelemetry } from './telemetry';

/**
 * The property worth protecting: a deployment with no Grafana credentials must
 * behave exactly as it did before telemetry existed. A missing or fat-fingered
 * env var should never start exporters, open sockets, or break a boot.
 */
describe('startTelemetry', () => {
  const original = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  afterEach(() => {
    if (original === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = original;
  });

  it('stays off when no endpoint is configured', () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    expect(startTelemetry().enabled).toBe(false);
  });

  it('treats an empty or whitespace endpoint as unset', () => {
    // Render writes an empty string for a variable added but left blank, which
    // would otherwise start the SDK pointed at nowhere.
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = '';
    expect(startTelemetry().enabled).toBe(false);

    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = '   ';
    expect(startTelemetry().enabled).toBe(false);
  });

  it('gives back a shutdown that resolves even when never started', async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    await expect(startTelemetry().shutdown()).resolves.toBeUndefined();
  });
});
