import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSepayPayments1788600000000 implements MigrationInterface {
  name = 'AddSepayPayments1788600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE payments_provider_enum ADD VALUE IF NOT EXISTS 'sepay'`,
    );
    await queryRunner.query(
      `ALTER TYPE payments_status_enum ADD VALUE IF NOT EXISTS 'cancelled'`,
    );
    await queryRunner.query(
      `ALTER TYPE payments_status_enum ADD VALUE IF NOT EXISTS 'expired'`,
    );
    await queryRunner.query(
      `ALTER TYPE payments_status_enum ADD VALUE IF NOT EXISTS 'review_required'`,
    );
    await queryRunner.query(`
      ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS method varchar(50) NOT NULL DEFAULT 'cod',
        ADD COLUMN IF NOT EXISTS invoice_number varchar(100),
        ADD COLUMN IF NOT EXISTS provider_order_id varchar(255),
        ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'VND',
        ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS expires_at timestamptz,
        ADD COLUMN IF NOT EXISTS paid_at timestamptz,
        ADD COLUMN IF NOT EXISTS failed_at timestamptz,
        ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
        ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

      UPDATE payments
      SET invoice_number = 'LEGACY-' || id::text
      WHERE invoice_number IS NULL;

      ALTER TABLE payments ALTER COLUMN invoice_number SET NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_invoice_number
        ON payments (invoice_number);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_transaction
        ON payments (provider, transaction_id)
        WHERE transaction_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_payments_order_created
        ON payments (order_id, created_at DESC)
        WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_payments_pending_expiry
        ON payments (expires_at)
        WHERE status = 'pending' AND expires_at IS NOT NULL AND deleted_at IS NULL;
      ALTER TABLE payments
        ADD CONSTRAINT chk_payments_amount_positive CHECK (amount >= 0),
        ADD CONSTRAINT chk_payments_attempt_positive CHECK (attempt_number > 0),
        ADD CONSTRAINT chk_payments_currency CHECK (currency = 'VND');
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payments
        DROP CONSTRAINT IF EXISTS chk_payments_currency,
        DROP CONSTRAINT IF EXISTS chk_payments_attempt_positive,
        DROP CONSTRAINT IF EXISTS chk_payments_amount_positive;
      DROP INDEX IF EXISTS idx_payments_pending_expiry;
      DROP INDEX IF EXISTS idx_payments_order_created;
      DROP INDEX IF EXISTS uq_payments_provider_transaction;
      DROP INDEX IF EXISTS uq_payments_invoice_number;
      ALTER TABLE payments
        DROP COLUMN IF EXISTS last_verified_at,
        DROP COLUMN IF EXISTS cancelled_at,
        DROP COLUMN IF EXISTS failed_at,
        DROP COLUMN IF EXISTS paid_at,
        DROP COLUMN IF EXISTS expires_at,
        DROP COLUMN IF EXISTS attempt_number,
        DROP COLUMN IF EXISTS currency,
        DROP COLUMN IF EXISTS provider_order_id,
        DROP COLUMN IF EXISTS invoice_number,
        DROP COLUMN IF EXISTS method;
    `);
  }
}
