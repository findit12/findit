import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserProfileColumns1730000000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      new TableColumn({ name: 'first_name', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'last_name', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'gdpr_consent', type: 'boolean', default: 'false' }),
      new TableColumn({ name: 'role', type: 'varchar', default: "'student'" }),
      new TableColumn({ name: 'status', type: 'varchar', default: "'active'" }),
    ];
    for (const column of columns) if (!(await queryRunner.hasColumn('users', column.name))) await queryRunner.addColumn('users', column);
  }
  async down(queryRunner: QueryRunner): Promise<void> { for (const name of ['status','role','gdpr_consent','last_name','first_name']) if (await queryRunner.hasColumn('users', name)) await queryRunner.dropColumn('users', name); }
}
