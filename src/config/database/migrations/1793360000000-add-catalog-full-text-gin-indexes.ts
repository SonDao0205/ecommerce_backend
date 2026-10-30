import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCatalogFullTextGinIndexes1793360000000
  implements MigrationInterface
{
  name = 'AddCatalogFullTextGinIndexes1793360000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_categories_search_gin"
      ON "categories"
      USING GIN (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("slug", '')))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_products_search_gin"
      ON "products"
      USING GIN (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("description", '')))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_shops_search_gin"
      ON "shops"
      USING GIN (to_tsvector('simple', coalesce("name", '')))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_shops_search_gin"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_products_search_gin"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_categories_search_gin"');
  }
}
