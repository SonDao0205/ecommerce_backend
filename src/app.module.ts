import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CartModule } from './modules/cart/cart.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InventoriesModule } from './modules/inventories/inventories.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { CustomerAddressesModule } from './modules/customer-addresses/customer-addresses.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RedisCacheModule } from './common/cache/redis-cache.module';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { HealthModule } from './modules/health/health.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    // 1. Cấu hình ConfigModule toàn cục để đọc file .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    RedisCacheModule,

    // 2. Cấu hình kết nối PostgreSQL bất đồng bộ qua ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_DATABASE', 'ecommerce_db'),
        autoLoadEntities: true,
        synchronize:
          configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true' &&
          configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('DB_LOGGING') === 'true',
        extra: {
          max: Number(configService.get<string>('DB_POOL_MAX', '20')),
          connectionTimeoutMillis: Number(
            configService.get<string>('DB_POOL_CONNECTION_TIMEOUT_MS', '3000'),
          ),
          idleTimeoutMillis: Number(
            configService.get<string>('DB_POOL_IDLE_TIMEOUT_MS', '30000'),
          ),
        },
      }),
    }),

    AuthModule,

    ProductsModule,

    CategoriesModule,

    CartModule,

    StorefrontModule,

    OrdersModule,

    InventoriesModule,

    AuditLogsModule,

    CustomerAddressesModule,

    DashboardModule,

    HealthModule,
    VouchersModule,
    ReviewsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
  }
}
