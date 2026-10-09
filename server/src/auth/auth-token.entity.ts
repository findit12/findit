import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum AuthTokenType {
  EmailVerification = 'email_verification',
  PasswordReset = 'password_reset',
}

@Entity('auth_tokens')
export class AuthToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.tokens, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'varchar' })
  type!: AuthTokenType;

  @Column({ name: 'token_hash', unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;
}
