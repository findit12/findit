import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateSavedSearches1730000000100 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'saved_searches',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'user_id', type: 'integer' },
          { name: 'category_id', type: 'integer', isNullable: true },
          { name: 'object_type_id', type: 'integer', isNullable: true },
          { name: 'place_id', type: 'integer', isNullable: true },
          { name: 'date_from', type: 'date', isNullable: true },
          { name: 'date_to', type: 'date', isNullable: true },
          { name: 'keyword', type: 'varchar', length: '100', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );

    // When a user is deleted, their saved searches are deleted with them.
    await queryRunner.createForeignKey(
      'saved_searches',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('saved_searches', true, true);
  }
}
