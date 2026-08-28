import { MigrationInterface, QueryRunner } from 'typeorm';

export class SearchPerformanceIndexes1787892000000 implements MigrationInterface {
  name = 'SearchPerformanceIndexes1787892000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS idx_products_name_trgm_active
        ON products USING gin (name gin_trgm_ops)
        WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_products_sku_trgm_active
        ON products USING gin (sku gin_trgm_ops)
        WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_categories_name_trgm_active
        ON categories USING gin (name gin_trgm_ops)
        WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_categories_slug_trgm_active
        ON categories USING gin (slug gin_trgm_ops)
        WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_code_trgm_active
        ON orders USING gin (order_code gin_trgm_ops)
        WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_recipient_name_trgm_active
        ON orders USING gin (recipient_name gin_trgm_ops)
        WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_recipient_phone_trgm_active
        ON orders USING gin (recipient_phone gin_trgm_ops)
        WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_users_email_trgm_active
        ON users USING gin (email gin_trgm_ops)
        WHERE deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_email_trgm_active;
      DROP INDEX IF EXISTS idx_orders_recipient_phone_trgm_active;
      DROP INDEX IF EXISTS idx_orders_recipient_name_trgm_active;
      DROP INDEX IF EXISTS idx_orders_code_trgm_active;
      DROP INDEX IF EXISTS idx_categories_slug_trgm_active;
      DROP INDEX IF EXISTS idx_categories_name_trgm_active;
      DROP INDEX IF EXISTS idx_products_sku_trgm_active;
      DROP INDEX IF EXISTS idx_products_name_trgm_active;
    `);
  }
}
