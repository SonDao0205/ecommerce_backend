import 'dotenv/config';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'ecommerce_db',
  entities: [`${__dirname}/entities/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  // Enum values must be committed before a following migration can use them.
  migrationsTransactionMode: 'each',
  synchronize: false,
  extra: {
    max: Number(process.env.DB_POOL_MAX ?? 20),
    connectionTimeoutMillis: Number(
      process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? 3000,
    ),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 30000),
  },
});
