export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
}

export interface JwtConfig {
  accessSecret: string;
  accessTtl: string;
  refreshSecret: string;
  refreshTtl: string;
}

export interface OtpConfig {
  length: number;
  ttlSeconds: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
  /// When true, the OTP is returned in the API response and logged instead of
  /// being sent over SMS. Never enable outside local development.
  devMode: boolean;
  devCode: string;
}

export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  } satisfies AppConfig,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  } satisfies JwtConfig,
  otp: {
    length: parseInt(process.env.OTP_LENGTH ?? '6', 10),
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    resendCooldownSeconds: parseInt(
      process.env.OTP_RESEND_COOLDOWN_SECONDS ?? '60',
      10,
    ),
    devMode: process.env.OTP_DEV_MODE === 'true',
    devCode: process.env.OTP_DEV_CODE ?? '',
  } satisfies OtpConfig,
});
