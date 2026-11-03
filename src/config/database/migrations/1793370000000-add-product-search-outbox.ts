import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductSearchOutbox1793370000000 implements MigrationInterface {
  name = 'AddProductSearchOutbox1793370000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_search_outbox (
        id BIGSERIAL PRIMARY KEY,
        product_id BIGINT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        locked_at TIMESTAMP NULL,
        next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error VARCHAR(2000) NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_product_search_outbox_due ON product_search_outbox (processed_at, next_attempt_at, id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_product_search_outbox_product ON product_search_outbox (product_id)`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS elastic_index_states (
        alias VARCHAR(100) PRIMARY KEY,
        backfill_completed BOOLEAN NOT NULL DEFAULT FALSE,
        backfill_locked_at TIMESTAMP NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS product_search_outbox`);
    await queryRunner.query(`DROP TABLE IF EXISTS elastic_index_states`);
  }
}
