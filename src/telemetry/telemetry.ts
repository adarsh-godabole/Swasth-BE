import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

/**
 * Telemetry, shipped to Grafana Cloud over OTLP.
 *
 * One pipe for all three signals rather than a Prometheus scrape plus a
 * separate log shipper: the API runs on Render, which nothing can scrape from
 * outside, so everything has to be pushed. Grafana Cloud's OTLP gateway takes
 * metrics, traces and logs on a single endpoint with a single token.
 *
 * ## Why this file is imported before anything else
 *
 * The auto-instrumentations work by patching modules (http, express, pg) as
 * they are required. Anything already loaded is missed, so this has to run
 * before `AppModule` — see the first line of `main.ts`.
 *
 * ## Disabled by default
 *
 * With no endpoint configured this is inert: no exporters start and no
 * background timers run. Local development and tests get nothing extra unless
 * they ask for it, and a missing credential can never break a deploy.
 */

export interface TelemetryHandle {
  enabled: boolean;
  shutdown: () => Promise<void>;
}

const NOOP: TelemetryHandle = {
  enabled: false,
  shutdown: () => Promise.resolve(),
};

export function startTelemetry(): TelemetryHandle {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();

  if (!endpoint) return NOOP;

  // Surfaces exporter failures — a bad token otherwise fails silently and the
  // dashboards just stay empty with no hint why.
  if (process.env.OTEL_DIAG_LOG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
  }

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'swasth-api',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
        process.env.NODE_ENV ?? 'development',
    }),
  );

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        // The free tier bills on series, not scrape frequency, but a gym API
        // is low-traffic and 60s is plenty to spot a problem.
        exportIntervalMillis: 60_000,
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Noise with no diagnostic value on a server: every file read the
        // process makes would become a span.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          // Health checks run every few seconds on Render and would otherwise
          // dominate both the trace bill and the latency percentiles.
          ignoreIncomingRequestHook: (request) =>
            (request.url ?? '').includes('/health'),
        },
      }),
    ],
  });

  sdk.start();

  return {
    enabled: true,
    // Flush on the way out. Render sends SIGTERM on redeploy, and without this
    // the last minute of telemetry — usually the interesting minute — is lost.
    shutdown: async () => {
      try {
        await sdk.shutdown();
      } catch {
        // Never let a telemetry failure hold up or crash a shutdown.
      }
    },
  };
}

/**
 * The OTLP logger the Nest logger writes through. Safe to call whether or not
 * telemetry started — the no-op provider is the default when nothing has been
 * registered.
 */
export function otelLogger() {
  return logs.getLogger('swasth-api');
}
