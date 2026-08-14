import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const { env, port, apiPrefix, corsOrigins } =
    config.getOrThrow<AppConfig>('app');

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Express sits behind a load balancer in every deployed environment, so
  // req.ip must come from X-Forwarded-For.
  if (env !== 'development') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Swasth API')
      .setDescription('Backend API for the Swasth gym & fitness application')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`Swasth API running on port ${port} [${env}]`);
  if (env !== 'production') {
    logger.log(`Swagger docs at /${apiPrefix}/docs`);
  }
}

void bootstrap();
