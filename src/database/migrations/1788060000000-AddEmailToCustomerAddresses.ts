import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailToCustomerAddresses1788060000000 implements MigrationInterface {
  name = 'AddEmailToCustomerAddresses1788060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customer_addresses
      ADD COLUMN IF NOT EXISTS email varchar(254);

      UPDATE customer_addresses AS address
      SET email = users.email
      FROM users
      WHERE address.user_id = users.id
        AND address.email IS NULL
        AND users.email IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customer_addresses
      DROP COLUMN IF EXISTS email;
    `);
  }
}
