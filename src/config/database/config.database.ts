import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get<string>('DB_HOST', 'localhost'),
  port: config.get<number>('DB_PORT', 5432),
  username: config.get<string>('DB_USERNAME', 'postgres'),
  password: config.get<string>('DB_PASSWORD', 'password'),
  database: config.get<string>('DB_DATABASE', 'mydb'),
  autoLoadEntities: true,
  synchronize: true,
});
