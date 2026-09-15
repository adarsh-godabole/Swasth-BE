import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { trace } from '@opentelemetry/api';
import { otelLogger } from './telemetry';

/**
 * The application logger, forwarding everything it prints to Grafana Cloud.
 *
 * Extends `ConsoleLogger` rather than replacing it: Render's own log tail stays
 * exactly as it was, and the OTLP copy is additive. If telemetry never started,
 * `otelLogger()` returns the API's no-op logger and this costs a function call.
 *
 * Because the OTel context is active during a request, each record is stamped
 * with the trace and span id automatically — so a log line in Grafana links
 * back to the request that produced it.
 */
@Injectable({ scope: Scope.DEFAULT })
export class OtelLoggerService extends ConsoleLogger {
  log(message: unknown, ...rest: unknown[]): void {
    super.log(message as string, ...(rest as string[]));
    this.emit(SeverityNumber.INFO, 'INFO', message, rest);
  }

  error(message: unknown, ...rest: unknown[]): void {
    super.error(message as string, ...(rest as string[]));
    this.emit(SeverityNumber.ERROR, 'ERROR', message, rest);
  }

  warn(message: unknown, ...rest: unknown[]): void {
    super.warn(message as string, ...(rest as string[]));
    this.emit(SeverityNumber.WARN, 'WARN', message, rest);
  }

  debug(message: unknown, ...rest: unknown[]): void {
    super.debug(message as string, ...(rest as string[]));
    this.emit(SeverityNumber.DEBUG, 'DEBUG', message, rest);
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    super.verbose(message as string, ...(rest as string[]));
    this.emit(SeverityNumber.TRACE, 'TRACE', message, rest);
  }

  private emit(
    severityNumber: SeverityNumber,
    severityText: string,
    message: unknown,
    rest: unknown[],
  ): void {
    try {
      // Nest passes the context (the class name) as the last argument, and an
      // Error's stack as the first of the rest on `error`.
      const context = typeof rest.at(-1) === 'string' ? (rest.at(-1) as string) : undefined;
      const stack = severityText === 'ERROR' && rest.length > 1 ? String(rest[0]) : undefined;

      otelLogger().emit({
        severityNumber,
        severityText,
        body: typeof message === 'string' ? message : JSON.stringify(message),
        attributes: {
          ...(context ? { 'code.namespace': context } : {}),
          ...(stack ? { 'exception.stacktrace': stack } : {}),
        },
      });
    } catch {
      // Logging must never be the thing that takes the process down.
    }
  }
}

/**
 * Marks the current span as failed so an error shows up on the trace, not only
 * in the log stream. Called from the global exception filter.
 */
export function recordExceptionOnSpan(error: unknown): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.recordException(error instanceof Error ? error : String(error));
}
