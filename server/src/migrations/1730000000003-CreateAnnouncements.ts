import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateAnnouncements1730000000003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // The old table only had a title and a description, and only test data.
    // It is replaced by "announcements", which follows the SDD.
    if (await queryRunner.hasTable('found_announcements')) {
      await queryRunner.dropTable('found_announcements', true, true);
    }

    await queryRunner.createTable(
      new Table({
        name: 'announcements',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'type', type: 'enum', enum: ['found', 'lost'], enumName: 'announcement_type' },
          { name: 'author_id', type: 'integer' },
          { name: 'title', type: 'varchar', length: '100' },
          { name: 'category_id', type: 'integer' },
          { name: 'object_type_id', type: 'integer' },
          { name: 'description', type: 'varchar', length: '1000' },
          { name: 'brand', type: 'varchar', length: '50', isNullable: true },
          { name: 'color', type: 'varchar', length: '50', isNullable: true },
          { name: 'photos', type: 'text', isArray: true },
          { name: 'event_date', type: 'date' },
          { name: 'place_id', type: 'integer' },
          { name: 'place_details', type: 'varchar', length: '200', isNullable: true },
          {
            name: 'current_location',
            type: 'enum',
            enum: ['finder', 'reception'],
            enumName: 'announcement_current_location',
            isNullable: true,
          },
          { name: 'hidden_detail', type: 'varchar', length: '200', isNullable: true },
          {
            name: 'status',
            type: 'enum',
            enum: ['Available', 'Open', 'Returned', 'Closed', 'Hidden', 'Deleted', 'Archived'],
            enumName: 'announcement_status',
          },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'expires_at', type: 'timestamptz' },
          { name: 'returned_at', type: 'timestamptz', isNullable: true },
          { name: 'reminder_sent_at', type: 'timestamptz', isNullable: true },
        ],
      }),
    );

    // Links to the author, the category, the precise object and the place.
    const links: Array<[string, string]> = [
      ['author_id', 'users'],
      ['category_id', 'categories'],
      ['object_type_id', 'object_types'],
      ['place_id', 'places'],
    ];
    for (const [column, table] of links) {
      await queryRunner.createForeignKey(
        'announcements',
        new TableForeignKey({
          columnNames: [column],
          referencedTableName: table,
          referencedColumnNames: ['id'],
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Removes the table and its foreign keys. The three enum types stay in the database:
    // if the migration runs again, createTable reuses them.
    await queryRunner.dropTable('announcements', true, true);
  }
}
