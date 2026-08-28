import { QueryRunner } from 'typeorm';

export interface DatabaseAuditContext {
  actorId?: string | null;
  inventoryReason?: string | null;
  inventoryType?:
    | 'import'
    | 'export'
    | 'adjustment'
    | 'order_reserve'
    | 'order_restock'
    | null;
}

/**
 * Stores request metadata inside the current PostgreSQL transaction. Database
 * triggers read these values without coupling repositories to the audit tables.
 */
export async function setDatabaseAuditContext(
  queryRunner: QueryRunner,
  context: DatabaseAuditContext,
): Promise<void> {
  if (!queryRunner.isTransactionActive) {
    throw new Error('Audit context requires an active database transaction');
  }

  await queryRunner.query(
    `SELECT
       set_config('app.actor_id', $1, TRUE),
       set_config('app.inventory_reason', $2, TRUE),
       set_config('app.inventory_type', $3, TRUE)`,
    [
      context.actorId ?? '',
      context.inventoryReason ?? '',
      context.inventoryType ?? '',
    ],
  );
}
