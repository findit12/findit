import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

// Creates the tables of the reference lists. Their starting content is added by
// ReferenceService when the server starts (see reference.seed.ts).
export class CreateReferenceTables1730000000002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'categories',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'name', type: 'varchar', length: '60', isUnique: true },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'object_types',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'category_id', type: 'integer' },
          { name: 'name', type: 'varchar', length: '60' },
        ],
      }),
    );
    await queryRunner.createForeignKey(
      'object_types',
      new TableForeignKey({
        columnNames: ['category_id'],
        referencedTableName: 'categories',
        referencedColumnNames: ['id'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'places',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'name', type: 'varchar', length: '80', isUnique: true },
          { name: 'building', type: 'varchar', length: '40', isNullable: true },
          { name: 'floor', type: 'varchar', length: '20', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
        ],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('places');
    await queryRunner.dropTable('object_types', true, true);
    await queryRunner.dropTable('categories');
  }
}
