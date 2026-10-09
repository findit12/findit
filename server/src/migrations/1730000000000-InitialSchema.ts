import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class InitialSchema1730000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const hasUsers = await queryRunner.hasTable('users');
    if (!hasUsers) {
      await queryRunner.createTable(
        new Table({
          name: 'users',
          columns: [
            { name: 'id', type: 'serial', isPrimary: true },
            { name: 'email', type: 'varchar', isUnique: true },
            { name: 'password_hash', type: 'varchar' },
            { name: 'is_verified', type: 'boolean', default: 'false' },
            { name: 'first_name', type: 'varchar', isNullable: true },
            { name: 'last_name', type: 'varchar', isNullable: true },
            { name: 'gdpr_consent', type: 'boolean', default: 'false' },
            { name: 'role', type: 'varchar', default: "'student'" },
            { name: 'status', type: 'varchar', default: "'active'" },
            { name: 'created_at', type: 'timestamptz', default: 'now()' },
          ],
        }),
      );
    } else {
      if (!(await queryRunner.hasColumn('users', 'first_name'))) {
        await queryRunner.addColumn(
          'users',
          new TableColumn({ name: 'first_name', type: 'varchar', isNullable: true }),
        );
      }
      if (!(await queryRunner.hasColumn('users', 'last_name'))) {
        await queryRunner.addColumn(
          'users',
          new TableColumn({ name: 'last_name', type: 'varchar', isNullable: true }),
        );
      }
      if (!(await queryRunner.hasColumn('users', 'gdpr_consent'))) {
        await queryRunner.addColumn(
          'users',
          new TableColumn({ name: 'gdpr_consent', type: 'boolean', default: 'false' }),
        );
      }
      if (!(await queryRunner.hasColumn('users', 'role'))) {
        await queryRunner.addColumn(
          'users',
          new TableColumn({ name: 'role', type: 'varchar', default: "'student'" }),
        );
      }
      if (!(await queryRunner.hasColumn('users', 'status'))) {
        await queryRunner.addColumn(
          'users',
          new TableColumn({ name: 'status', type: 'varchar', default: "'active'" }),
        );
      }
    }

    const hasAuthTokens = await queryRunner.hasTable('auth_tokens');
    if (!hasAuthTokens) {
      await queryRunner.createTable(
        new Table({
          name: 'auth_tokens',
          columns: [
            { name: 'id', type: 'serial', isPrimary: true },
            { name: 'userId', type: 'integer' },
            { name: 'type', type: 'varchar' },
            { name: 'token_hash', type: 'varchar', isUnique: true },
            { name: 'expires_at', type: 'timestamptz' },
            { name: 'used_at', type: 'timestamptz', isNullable: true },
          ],
        }),
      );

      await queryRunner.createForeignKey(
        'auth_tokens',
        new TableForeignKey({
          columnNames: ['userId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (await queryRunner.hasTable('password_reset_tokens')) {
      await queryRunner.dropTable('password_reset_tokens');
    }

    const hasFoundAnnouncements = await queryRunner.hasTable('found_announcements');
    if (!hasFoundAnnouncements) {
      await queryRunner.createTable(
        new Table({
          name: 'found_announcements',
          columns: [
            { name: 'id', type: 'serial', isPrimary: true },
            { name: 'userId', type: 'integer' },
            { name: 'title', type: 'varchar' },
            { name: 'description', type: 'varchar' },
            { name: 'created_at', type: 'timestamptz', default: 'now()' },
          ],
        }),
      );

      await queryRunner.createForeignKey(
        'found_announcements',
        new TableForeignKey({
          columnNames: ['userId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
        }),
      );
    } else {
      const hasUserId = await queryRunner.hasColumn('found_announcements', 'userId');
      const hasLegacyUserId = await queryRunner.hasColumn('found_announcements', 'user_id');
      if (!hasUserId && hasLegacyUserId) {
        await queryRunner.renameColumn('found_announcements', 'user_id', 'userId');
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('found_announcements')) {
      await queryRunner.dropTable('found_announcements');
    }
    if (await queryRunner.hasTable('auth_tokens')) {
      await queryRunner.dropTable('auth_tokens');
    }
    if (await queryRunner.hasTable('users')) {
      await queryRunner.dropTable('users');
    }
  }
}
