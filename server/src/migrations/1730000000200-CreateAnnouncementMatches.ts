import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique, TableCheck } from 'typeorm';

export class CreateAnnouncementMatches1730000000200 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'announcement_matches',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'announcement_id', type: 'integer' },
          { name: 'matched_announcement_id', type: 'integer' },
          { name: 'score', type: 'integer' },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_announcement_matches_pair',
            columnNames: ['announcement_id', 'matched_announcement_id'],
          }),
        ],
        checks: [
          new TableCheck({
            name: 'CHK_announcement_matches_order',
            expression: '"announcement_id" < "matched_announcement_id"',
          }),
          new TableCheck({
            name: 'CHK_announcement_matches_score',
            expression: '"score" >= 0 AND "score" <= 100',
          }),
        ],
      }),
    );

    await queryRunner.createForeignKeys('announcement_matches', [
      new TableForeignKey({
        columnNames: ['announcement_id'],
        referencedTableName: 'announcements',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['matched_announcement_id'],
        referencedTableName: 'announcements',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('announcement_matches', true, true);
  }
}
