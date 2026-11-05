import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderIdempotency1793380000000 implements MigrationInterface {
  name = 'AddOrderIdempotency1793380000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(128) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "request_hash" CHAR(64) NULL`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_orders_user_idempotency_key"
      ON "orders" ("user_id", "idempotency_key")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_orders_user_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "request_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotency_key"`,
    );
  }
}
