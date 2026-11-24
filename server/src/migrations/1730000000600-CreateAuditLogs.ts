import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

// FR-19: the audit trail of the moderation actions (hide, restore, delete, block, unblock).
export class CreateAuditLogs1730000000600 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'admin_id', type: 'integer' },
          { name: 'action', type: 'varchar', length: '20' },
          { name: 'target_type', type: 'varchar', length: '20' },
          { name: 'target_id', type: 'integer' },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );

    // An administrator who wrote in the audit trail cannot be deleted (users are never deleted anyway).
    await queryRunner.createForeignKey(
      'audit_logs',
      new TableForeignKey({ columnNames: ['admin_id'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_logs', true, true);
  }
}
