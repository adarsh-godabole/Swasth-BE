import { Global, Module } from '@nestjs/common';
import { OtelLoggerService } from './otel-logger.service';

/// Global so `app.useLogger` can resolve the logger during bootstrap, and so
/// any module can inject it without importing anything.
@Global()
@Module({
  providers: [OtelLoggerService],
  exports: [OtelLoggerService],
})
export class TelemetryModule {}
