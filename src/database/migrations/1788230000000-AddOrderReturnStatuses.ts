import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderReturnStatuses1788230000000 implements MigrationInterface {
  name = 'AddOrderReturnStatuses1788230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE orders_status_enum ADD VALUE IF NOT EXISTS 'return_requested';
      ALTER TYPE orders_status_enum ADD VALUE IF NOT EXISTS 'returned';
      ALTER TYPE orders_status_enum ADD VALUE IF NOT EXISTS 'return_rejected';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE orders
      SET status = 'completed'
      WHERE status::text IN ('return_requested', 'returned', 'return_rejected');

      ALTER TYPE orders_status_enum RENAME TO orders_status_enum_with_returns;
      CREATE TYPE orders_status_enum AS ENUM (
        'pending', 'confirmed', 'processing', 'shipping', 'completed',
        'cancelled', 'rejected'
      );
      ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE orders ALTER COLUMN status TYPE orders_status_enum
        USING status::text::orders_status_enum;
      ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';
      DROP TYPE orders_status_enum_with_returns;
    `);
  }
}
