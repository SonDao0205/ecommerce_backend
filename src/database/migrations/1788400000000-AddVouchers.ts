import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVouchers1788400000000 implements MigrationInterface {
  name = 'AddVouchers1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "vouchers_status_enum" AS ENUM ('draft','active','expired','disabled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "vouchers_voucher_type_enum" AS ENUM ('order_discount')`,
    );
    await queryRunner.query(
      `CREATE TYPE "vouchers_discount_type_enum" AS ENUM ('percentage','fixed_amount')`,
    );
    await queryRunner.query(
      `CREATE TYPE "vouchers_scope_enum" AS ENUM ('shop','products','categories')`,
    );
    await queryRunner.query(
      `CREATE TYPE "vouchers_audience_enum" AS ENUM ('all','new_customers','existing_customers','member_groups','specific_customers')`,
    );
    await queryRunner.query(`
      CREATE TABLE "vouchers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, "deleted_at" timestamptz,
        "name" varchar(150) NOT NULL, "code" varchar(50) NOT NULL, "description" text,
        "status" vouchers_status_enum NOT NULL DEFAULT 'draft', "voucher_type" vouchers_voucher_type_enum NOT NULL,
        "discount_type" vouchers_discount_type_enum NOT NULL, "discount_value" numeric(12,2) NOT NULL,
        "max_discount_amount" numeric(12,2), "minimum_order_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "scope" vouchers_scope_enum NOT NULL DEFAULT 'shop', "audience" vouchers_audience_enum NOT NULL DEFAULT 'all',
        "start_at" timestamptz NOT NULL, "end_at" timestamptz NOT NULL, "issued_quantity" integer,
        "max_usage_count" integer, "usage_limit_per_user" integer NOT NULL DEFAULT 1, "used_count" integer NOT NULL DEFAULT 0,
        "combinable_with_vouchers" boolean NOT NULL DEFAULT false, "combinable_with_flash_sale" boolean NOT NULL DEFAULT false,
        "combinable_with_promotions" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_vouchers" PRIMARY KEY ("id"), CONSTRAINT "UQ_vouchers_code" UNIQUE ("code"),
        CONSTRAINT "CHK_vouchers_time" CHECK (end_at > start_at),
        CONSTRAINT "CHK_vouchers_discount" CHECK (discount_value > 0 AND (discount_type <> 'percentage' OR discount_value <= 100)),
        CONSTRAINT "CHK_vouchers_limits" CHECK ((issued_quantity IS NULL OR (issued_quantity > 0 AND used_count <= issued_quantity)) AND (max_usage_count IS NULL OR (max_usage_count > 0 AND used_count <= max_usage_count)) AND usage_limit_per_user > 0 AND used_count >= 0)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_vouchers_code_ci" ON "vouchers" (UPPER(code)) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "voucher_products" ("voucher_id" uuid NOT NULL, "product_id" uuid NOT NULL, CONSTRAINT "PK_voucher_products" PRIMARY KEY ("voucher_id","product_id"), CONSTRAINT "FK_vp_voucher" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE, CONSTRAINT "FK_vp_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE TABLE "voucher_categories" ("voucher_id" uuid NOT NULL, "category_id" uuid NOT NULL, CONSTRAINT "PK_voucher_categories" PRIMARY KEY ("voucher_id","category_id"), CONSTRAINT "FK_vc_voucher" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE, CONSTRAINT "FK_vc_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" varchar(100) NOT NULL, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PK_customer_groups" PRIMARY KEY ("id"), CONSTRAINT "UQ_customer_groups_name" UNIQUE ("name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_group_members" ("group_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_customer_group_members" PRIMARY KEY ("group_id","user_id"), CONSTRAINT "FK_cgm_group" FOREIGN KEY ("group_id") REFERENCES "customer_groups"("id") ON DELETE CASCADE, CONSTRAINT "FK_cgm_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE TABLE "voucher_customer_groups" ("voucher_id" uuid NOT NULL, "group_id" uuid NOT NULL, CONSTRAINT "PK_voucher_customer_groups" PRIMARY KEY ("voucher_id","group_id"), CONSTRAINT "FK_vcg_voucher" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE, CONSTRAINT "FK_vcg_group" FOREIGN KEY ("group_id") REFERENCES "customer_groups"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE TABLE "voucher_customers" ("voucher_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_voucher_customers" PRIMARY KEY ("voucher_id","user_id"), CONSTRAINT "FK_vcu_voucher" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE, CONSTRAINT "FK_vcu_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "subtotal_amount" numeric(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "discount_amount" numeric(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "voucher_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "voucher_code" varchar(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_voucher" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "voucher_redemptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "voucher_id" uuid NOT NULL, "user_id" uuid NOT NULL, "order_id" uuid NOT NULL, "discount_amount" numeric(12,2) NOT NULL, "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PK_voucher_redemptions" PRIMARY KEY ("id"), CONSTRAINT "UQ_voucher_redemptions_order" UNIQUE ("order_id"), CONSTRAINT "FK_vr_voucher" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT, CONSTRAINT "FK_vr_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT, CONSTRAINT "FK_vr_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_voucher_redemptions_user" ON "voucher_redemptions" ("voucher_id","user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "voucher_redemptions"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "voucher_code"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "voucher_id"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "discount_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "subtotal_amount"`,
    );
    await queryRunner.query(`DROP TABLE "voucher_customers"`);
    await queryRunner.query(`DROP TABLE "voucher_customer_groups"`);
    await queryRunner.query(`DROP TABLE "customer_group_members"`);
    await queryRunner.query(`DROP TABLE "customer_groups"`);
    await queryRunner.query(`DROP TABLE "voucher_categories"`);
    await queryRunner.query(`DROP TABLE "voucher_products"`);
    await queryRunner.query(`DROP TABLE "vouchers"`);
    await queryRunner.query(`DROP TYPE "vouchers_audience_enum"`);
    await queryRunner.query(`DROP TYPE "vouchers_scope_enum"`);
    await queryRunner.query(`DROP TYPE "vouchers_discount_type_enum"`);
    await queryRunner.query(`DROP TYPE "vouchers_voucher_type_enum"`);
    await queryRunner.query(`DROP TYPE "vouchers_status_enum"`);
  }
}
