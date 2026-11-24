import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// SCRUM-52 (FR-14): a discussion can be closed, and a message can be written by the system.
export class AddReceptionColumns1730000000700 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'discussions',
      new TableColumn({ name: 'closed_at', type: 'timestamptz', isNullable: true }),
    );
    await queryRunner.addColumn(
      'messages',
      new TableColumn({ name: 'is_system', type: 'boolean', default: false, isNullable: false }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('messages', 'is_system');
    await queryRunner.dropColumn('discussions', 'closed_at');
  }
}
