import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateDiscussions1730000000300 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'discussions',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'announcement_id', type: 'integer' },
          { name: 'owner_id', type: 'integer' },
          { name: 'description', type: 'text' },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createForeignKeys('discussions', [
      new TableForeignKey({
        columnNames: ['announcement_id'],
        referencedTableName: 'announcements',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['owner_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('discussions', true, true);
  }
}