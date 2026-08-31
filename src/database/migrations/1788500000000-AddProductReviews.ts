import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductReviews1788500000000 implements MigrationInterface {
  name = 'AddProductReviews1788500000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "product_reviews" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "deleted_at" timestamptz,
      "order_item_id" uuid NOT NULL, "product_id" uuid NOT NULL, "user_id" uuid NOT NULL,
      "rating" smallint NOT NULL, "content" text NOT NULL, "media" jsonb NOT NULL DEFAULT '[]',
      "product_name" varchar(255) NOT NULL, "variant_name" varchar(100), "variant_value" varchar(150), "variant_sku" varchar(100),
      "admin_reply" text, "replied_at" timestamptz, "replied_by" uuid,
      CONSTRAINT "PK_product_reviews" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_product_reviews_order_item" UNIQUE ("order_item_id"),
      CONSTRAINT "CHK_product_reviews_rating" CHECK (rating BETWEEN 1 AND 5),
      CONSTRAINT "FK_reviews_order_item" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_reviews_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_reviews_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_reviews_replied_by" FOREIGN KEY ("replied_by") REFERENCES "users"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_product_reviews_product_created" ON "product_reviews" ("product_id", "created_at" DESC) WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_reviews_user" ON "product_reviews" ("user_id") WHERE "deleted_at" IS NULL`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "product_reviews"`);
  }
}
