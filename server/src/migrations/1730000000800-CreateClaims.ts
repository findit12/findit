import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

// SCRUM-53 (FR-16): claims on the objects held at the reception.
export class CreateClaims1730000000800 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'claims',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'announcement_id', type: 'integer' },
          { name: 'claimant_id', type: 'integer' },
          { name: 'proof', type: 'text' },
          { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
          { name: 'reviewed_by_id', type: 'integer', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'reviewed_at', type: 'timestamptz', isNullable: true },
        ],
      }),
    );
    await queryRunner.createUniqueConstraint(
      'claims',
      new TableUnique({ name: 'UQ_claims_announcement_claimant', columnNames: ['announcement_id', 'claimant_id'] }),
    );
    await queryRunner.createForeignKeys('claims', [
      new TableForeignKey({
        columnNames: ['announcement_id'],
        referencedTableName: 'announcements',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['claimant_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('claims', true, true);
  }
}
