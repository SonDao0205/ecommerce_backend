import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderCancellationAndReturns1788230000001 implements MigrationInterface {
  name = 'OrderCancellationAndReturns1788230000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
        ADD COLUMN IF NOT EXISTS cancellation_reason text,
        ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
        ADD COLUMN IF NOT EXISTS cancelled_by uuid,
        ADD COLUMN IF NOT EXISTS return_reason text,
        ADD COLUMN IF NOT EXISTS return_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS return_requested_at timestamptz,
        ADD COLUMN IF NOT EXISTS return_review_reason text,
        ADD COLUMN IF NOT EXISTS return_reviewed_at timestamptz,
        ADD COLUMN IF NOT EXISTS return_reviewed_by uuid,
        ADD COLUMN IF NOT EXISTS stock_restored_at timestamptz;

      UPDATE orders
      SET confirmed_at = COALESCE(updated_at, created_at)
      WHERE confirmed_at IS NULL
        AND status IN ('confirmed', 'processing', 'shipping', 'completed');

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'fk_orders_cancelled_by_user'
        ) THEN
          ALTER TABLE orders ADD CONSTRAINT fk_orders_cancelled_by_user
            FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'fk_orders_return_reviewed_by_user'
        ) THEN
          ALTER TABLE orders ADD CONSTRAINT fk_orders_return_reviewed_by_user
            FOREIGN KEY (return_reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_orders_return_requests
        ON orders (return_requested_at DESC)
        WHERE status = 'return_requested' AND deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_orders_return_requests;
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_return_reviewed_by_user;
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_cancelled_by_user;
      ALTER TABLE orders
        DROP COLUMN IF EXISTS stock_restored_at,
        DROP COLUMN IF EXISTS return_reviewed_by,
        DROP COLUMN IF EXISTS return_reviewed_at,
        DROP COLUMN IF EXISTS return_review_reason,
        DROP COLUMN IF EXISTS return_requested_at,
        DROP COLUMN IF EXISTS return_evidence,
        DROP COLUMN IF EXISTS return_reason,
        DROP COLUMN IF EXISTS cancelled_by,
        DROP COLUMN IF EXISTS cancelled_at,
        DROP COLUMN IF EXISTS cancellation_reason,
        DROP COLUMN IF EXISTS confirmed_at;
    `);
  }
}
