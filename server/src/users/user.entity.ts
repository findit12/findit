import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AuthToken } from '../auth/auth-token.entity';

export enum UserRole {
  Student = 'student',
  Admin = 'admin',
}

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
  // FR-25: the account was deleted. The row is kept (announcements and messages point to it) but it holds no personal data.
  Anonymized = 'anonymized',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'is_verified', default: false })
  isVerified!: boolean;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName?: string | null;

  // When the user accepted the privacy policy (GDPR, SDD section 4). Empty for accounts created before.
  @Column({ name: 'consent_at', type: 'timestamptz', nullable: true })
  consentAt!: Date | null;

  @Column({ name: 'role', type: 'varchar', default: 'student' })
  role!: string;

  @Column({ name: 'status', type: 'varchar', default: 'active' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => AuthToken, (token) => token.user)
  tokens!: AuthToken[];
}
