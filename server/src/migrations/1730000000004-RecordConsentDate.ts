import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// FR-01 and SDD section 4: the GDPR consent is recorded as a date (consent_at)
// instead of a true/false column (gdpr_consent), so we know when it was given.
export class RecordConsentDate1730000000004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({ name: 'consent_at', type: 'timestamptz', isNullable: true }),
    );
    await queryRunner.dropColumn('users', 'gdpr_consent');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({ name: 'gdpr_consent', type: 'boolean', default: 'false' }),
    );
    await queryRunner.dropColumn('users', 'consent_at');
  }
}