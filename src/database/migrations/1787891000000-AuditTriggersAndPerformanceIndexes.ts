import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditTriggersAndPerformanceIndexes1787891000000 implements MigrationInterface {
  name = 'AuditTriggersAndPerformanceIndexes1787891000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION ecommerce_actor_id(row_data jsonb, table_name text)
      RETURNS uuid AS $$
      DECLARE configured_actor text;
      DECLARE resolved_actor uuid;
      BEGIN
        configured_actor := NULLIF(current_setting('app.actor_id', TRUE), '');
        IF configured_actor IS NOT NULL THEN RETURN configured_actor::uuid; END IF;

        IF table_name = 'users' THEN
          SELECT id INTO resolved_actor FROM users
          WHERE id = NULLIF(row_data->>'id', '')::uuid;
          RETURN resolved_actor;
        ELSIF table_name IN ('orders', 'carts', 'customer_addresses') THEN
          RETURN NULLIF(row_data->>'user_id', '')::uuid;
        ELSIF table_name = 'cart_items' THEN
          SELECT user_id INTO resolved_actor FROM carts
          WHERE id = NULLIF(row_data->>'cart_id', '')::uuid;
          RETURN resolved_actor;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION ecommerce_write_audit_log()
      RETURNS trigger AS $$
      DECLARE previous_data jsonb;
      DECLARE current_data jsonb;
      DECLARE source_data jsonb;
      DECLARE audit_id uuid;
      BEGIN
        IF TG_TABLE_NAME = 'users' AND TG_OP = 'UPDATE' AND
           (to_jsonb(NEW) - 'password' - 'refresh_token' - 'updated_at') IS NOT DISTINCT FROM
           (to_jsonb(OLD) - 'password' - 'refresh_token' - 'updated_at') THEN
          RETURN NULL;
        END IF;

        previous_data := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
        current_data := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
        source_data := COALESCE(current_data, previous_data);

        IF TG_TABLE_NAME = 'users' THEN
          previous_data := previous_data - 'password' - 'refresh_token';
          current_data := current_data - 'password' - 'refresh_token';
        END IF;

        INSERT INTO audit_logs
          (action, entity_name, entity_id, actor_id, old_value, new_value)
        VALUES
          (TG_OP, TG_TABLE_NAME, source_data->>'id',
           ecommerce_actor_id(source_data, TG_TABLE_NAME), previous_data, current_data)
        RETURNING id INTO audit_id;
        PERFORM pg_notify(
          'audit_log_created',
          json_build_object('id', audit_id::text, 'action', TG_OP,
                            'entityName', TG_TABLE_NAME)::text
        );
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION ecommerce_write_inventory_transaction()
      RETURNS trigger AS $$
      DECLARE inventory_row inventories%ROWTYPE;
      DECLARE actor uuid;
      DECLARE reason_text text;
      DECLARE transaction_type inventory_transactions_type_enum;
      BEGIN
        IF NEW.stock = OLD.stock THEN RETURN NEW; END IF;
        actor := NULLIF(current_setting('app.actor_id', TRUE), '')::uuid;
        reason_text := COALESCE(
          NULLIF(current_setting('app.inventory_reason', TRUE), ''),
          'Số lượng tồn kho được cập nhật tự động'
        );
        transaction_type := COALESCE(
          NULLIF(current_setting('app.inventory_type', TRUE), ''),
          'adjustment'
        )::inventory_transactions_type_enum;

        IF TG_TABLE_NAME = 'product_variants' THEN
          IF EXISTS (SELECT 1 FROM product_variants WHERE parent_id = NEW.id AND deleted_at IS NULL) THEN
            RETURN NEW;
          END IF;
          SELECT * INTO inventory_row FROM inventories
          WHERE product_id = NEW.product_id AND deleted_at IS NULL LIMIT 1;
          IF inventory_row.id IS NOT NULL THEN
            INSERT INTO inventory_transactions
              (inventory_id, variant_id, type, quantity, previous_stock,
               new_stock, reason, actor_id)
            VALUES
              (inventory_row.id, NEW.id, transaction_type, NEW.stock - OLD.stock,
               OLD.stock, NEW.stock, reason_text, actor);
          END IF;
        ELSE
          IF EXISTS (
            SELECT 1 FROM product_variants variant
            WHERE variant.product_id = NEW.product_id
              AND variant.deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM product_variants child
                WHERE child.parent_id = variant.id AND child.deleted_at IS NULL
              )
          ) THEN RETURN NEW; END IF;
          INSERT INTO inventory_transactions
            (inventory_id, variant_id, type, quantity, previous_stock,
             new_stock, reason, actor_id)
          VALUES
            (NEW.id, NULL, transaction_type, NEW.stock - OLD.stock,
             OLD.stock, NEW.stock, reason_text, actor);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DO $$
      DECLARE table_name text;
      BEGIN
        FOREACH table_name IN ARRAY ARRAY[
          'users', 'roles', 'user_roles', 'categories', 'products',
          'product_variants', 'inventories', 'carts', 'cart_items', 'orders',
          'order_items', 'payments', 'customer_addresses'
        ] LOOP
          IF to_regclass('public.' || table_name) IS NOT NULL THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', table_name, table_name);
            EXECUTE format(
              'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION ecommerce_write_audit_log()',
              table_name, table_name
            );
          END IF;
        END LOOP;
      END $$;

      DROP TRIGGER IF EXISTS trg_inventory_transaction_inventory ON inventories;
      CREATE TRIGGER trg_inventory_transaction_inventory
        AFTER UPDATE OF stock ON inventories
        FOR EACH ROW EXECUTE FUNCTION ecommerce_write_inventory_transaction();

      DROP TRIGGER IF EXISTS trg_inventory_transaction_variant ON product_variants;
      CREATE TRIGGER trg_inventory_transaction_variant
        AFTER UPDATE OF stock ON product_variants
        FOR EACH ROW EXECUTE FUNCTION ecommerce_write_inventory_transaction();

      CREATE INDEX IF NOT EXISTS idx_orders_user_created_active
        ON orders (user_id, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_status_created_active
        ON orders (status, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_order_items_order_active
        ON order_items (order_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_product_variants_product_parent_active
        ON product_variants (product_id, parent_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_categories_parent_active
        ON categories (parent_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_cart_items_cart_active
        ON cart_items (cart_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_inventory_transactions_lookup
        ON inventory_transactions (inventory_id, variant_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_id
        ON audit_logs (created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_customer_addresses_user_active
        ON customer_addresses (user_id) WHERE deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_customer_addresses_user_active;
      DROP INDEX IF EXISTS idx_audit_logs_created_id;
      DROP INDEX IF EXISTS idx_inventory_transactions_lookup;
      DROP INDEX IF EXISTS idx_cart_items_cart_active;
      DROP INDEX IF EXISTS idx_categories_parent_active;
      DROP INDEX IF EXISTS idx_product_variants_product_parent_active;
      DROP INDEX IF EXISTS idx_order_items_order_active;
      DROP INDEX IF EXISTS idx_orders_status_created_active;
      DROP INDEX IF EXISTS idx_orders_user_created_active;
    `);
  }
}
