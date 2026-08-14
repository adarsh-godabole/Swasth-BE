import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { GymGuard } from './common/guards/gym.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { GymContextMiddleware } from './modules/gyms/gym-context.middleware';
import { GymsModule } from './modules/gyms/gyms.module';
import { HealthController } from './modules/health/health.controller';
import { MembersModule } from './modules/members/members.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL_SECONDS', 60) * 1000,
          limit: config.get<number>('THROTTLE_LIMIT', 120),
        },
      ],
    }),
    PrismaModule,
    GymsModule,
    AuthModule,
    UsersModule,
    MembersModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: throttle, authenticate, confirm the gym matches the token,
    // then check the role held at that gym.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: GymGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Runs before the guards, so request.gym is ready by the time GymGuard
    // compares it with the token.
    consumer.apply(GymContextMiddleware).forRoutes('*');
  }
}
