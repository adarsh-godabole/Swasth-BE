import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().default('*'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  OTP_LENGTH: Joi.number().min(4).max(8).default(6),
  OTP_TTL_SECONDS: Joi.number().min(30).default(300),
  OTP_MAX_ATTEMPTS: Joi.number().min(1).default(5),
  OTP_RESEND_COOLDOWN_SECONDS: Joi.number().min(0).default(60),
  OTP_DEV_MODE: Joi.boolean().default(false),
  OTP_DEV_CODE: Joi.string().allow('').default(''),

  THROTTLE_TTL_SECONDS: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(120),

  // Telemetry. Everything here is optional: with no endpoint the exporters
  // never start, so a missing credential leaves the API running rather than
  // refusing to boot. Read by the OpenTelemetry SDK directly, which is why the
  // names are the OTel spec ones rather than ours.
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().allow('').optional(),
  OTEL_EXPORTER_OTLP_HEADERS: Joi.string().allow('').optional(),
  OTEL_EXPORTER_OTLP_PROTOCOL: Joi.string()
    .valid('http/protobuf', 'http/json')
    .default('http/protobuf'),
  OTEL_SERVICE_NAME: Joi.string().default('swasth-api'),
  OTEL_DIAG_LOG: Joi.boolean().default(false),
})
  // A fixed dev OTP or dev-mode echo must never reach production. Staging is
  // allowed to use it: it is a test environment, and until a real SMS provider
  // is wired up it is the only way to log in there.
  .custom((value, helpers) => {
    if (
      value.NODE_ENV === 'production' &&
      (value.OTP_DEV_MODE === true || value.OTP_DEV_CODE)
    ) {
      return helpers.error('any.invalid', {
        message: 'OTP_DEV_MODE / OTP_DEV_CODE cannot be set in production',
      });
    }
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      return helpers.error('any.invalid', {
        message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ',
      });
    }
    return value;
  });
