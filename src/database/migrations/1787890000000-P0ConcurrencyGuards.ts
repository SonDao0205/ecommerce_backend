import { MigrationInterface, QueryRunner } from 'typeorm';

export class P0ConcurrencyGuards1787890000000 implements MigrationInterface {
  name = 'P0ConcurrencyGuards1787890000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS idempotency_key varchar(100),
        ADD COLUMN IF NOT EXISTS request_fingerprint varchar(64)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_orders_user_idempotency_key"
      ON orders (user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email_normalized"
      ON users (LOWER(email))
      WHERE email IS NOT NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_phone_active"
      ON users (phone)
      WHERE phone IS NOT NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_products_sku_normalized"
      ON products (UPPER(sku))
      WHERE sku IS NOT NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_sku_normalized"
      ON product_variants (UPPER(sku))
      WHERE sku IS NOT NULL AND deleted_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_product_variants_sku_normalized"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_products_sku_normalized"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_phone_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_email_normalized"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_orders_user_idempotency_key"`,
    );
    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN IF EXISTS request_fingerprint,
        DROP COLUMN IF EXISTS idempotency_key
    `);
  }
}
