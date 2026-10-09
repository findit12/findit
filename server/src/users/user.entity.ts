import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AuthToken } from '../auth/auth-token.entity';

export enum UserRole {
  Student = 'student',
  Admin = 'admin',
}

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
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

  @Column({ name: 'gdpr_consent', type: 'boolean', default: false })
  gdprConsent!: boolean;

  @Column({ name: 'role', type: 'varchar', default: 'student' })
  role!: string;

  @Column({ name: 'status', type: 'varchar', default: 'active' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => AuthToken, (token) => token.user)
  tokens!: AuthToken[];
}
