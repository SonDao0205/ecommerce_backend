import { Module } from '@nestjs/common';
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
        autoLoadEntities: true, // Tự động load tất cả Entity được khai báo
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // Tương đương hibernate ddl-auto=update (chỉ dùng ở dev)
        logging: configService.get<string>('DB_LOGGING') === 'true', // Log SQL queries (giống spring.jpa.show-sql)
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
