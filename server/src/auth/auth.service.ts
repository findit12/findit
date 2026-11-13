import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { User } from '../users/user.entity';
import { AuthToken, AuthTokenType } from './auth-token.entity';
import { MailService } from '../mail/mail.service';
import { CredentialsDto } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthToken) private readonly tokens: Repository<AuthToken>,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async getProfile(userId: number) {
    const user = await this.users.findOne({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isVerified: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }

    return {
      id: user.id,
      email: user.email,
      isVerified: user.isVerified,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueAndSend(user: User, type: AuthTokenType): Promise<string> {
    // Delete previous tokens of this type for this user (Point A7)
    await this.tokens.delete({ user: { id: user.id }, type });

    const raw = randomBytes(32).toString('hex');
    const tokenHash = this.hash(raw);
    const ttlMs =
      type === AuthTokenType.EmailVerification
        ? 24 * 60 * 60 * 1000 // 24 hours
        : 60 * 60 * 1000; // 1 hour

    await this.tokens.save(
      this.tokens.create({
        user,
        type,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMs),
        usedAt: null,
      }),
    );

    if (type === AuthTokenType.EmailVerification) {
      await this.mail.verification(user.email, raw);
    } else {
      await this.mail.reset(user.email, raw);
    }

    return raw;
  }

  async register(dto: CredentialsDto) {
    const email = dto.email.trim().toLowerCase();
    const schoolDomain = (process.env.SCHOOL_EMAIL_DOMAIN || '').toLowerCase();

    if (!schoolDomain || !email.endsWith(`@${schoolDomain}`)) {
      throw new BadRequestException('Use your school email address.');
    }

    if (dto.password.length < 8 || !/\d/.test(dto.password)) {
      throw new BadRequestException('Password must be at least 8 characters and include a number.');
    }

    // FR-01: no account without a name and the GDPR consent (the DTO checks it too).
    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();
    if (!firstName || !lastName) {
      throw new BadRequestException('Enter your first name and last name.');
    }
    if (dto.gdprConsent !== true) {
      throw new BadRequestException('You must accept the privacy policy to create an account.');
    }

    const existing = await this.users.findOneBy({ email });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.save(
      this.users.create({
        email,
        passwordHash,
        isVerified: false,
        firstName,
        lastName,
        consentAt: new Date(),
      }),
    );

    // Send verification email in the background without blocking the response (Point B2)
    void this.issueAndSend(user, AuthTokenType.EmailVerification).catch((err) => {
      this.logger.error(`Failed to send verification email to ${user.email}`, err);
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        is_verified: false,
      },
    };
  }

  async verify(token: string) {
    const tokenHash = this.hash(token);
    const record = await this.tokens.findOne({
      where: { tokenHash, type: AuthTokenType.EmailVerification },
      relations: { user: true },
    });

    if (!record || record.usedAt) {
      throw new BadRequestException('This verification link is invalid.');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException({
        error: 'This verification link has expired. Request a new link below.',
        expired: true,
      });
    }

    record.usedAt = new Date();
    await this.tokens.save(record);

    record.user.isVerified = true;
    await this.users.save(record.user);

    return { message: 'Your account has been verified.' };
  }

  async resend(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.users.findOneBy({ email: normalized });

    if (user && !user.isVerified) {
      void this.issueAndSend(user, AuthTokenType.EmailVerification).catch((err) => {
        this.logger.error(`Failed to resend verification email to ${user.email}`, err);
      });
    }

    return { message: 'If an unverified account exists, a verification email has been sent.' };
  }

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.users.findOneBy({ email: normalized });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Refuse login for unverified accounts with clear message and unverified flag (Point B1)
    if (!user.isVerified) {
      throw new UnauthorizedException({
        error: 'Please verify your account before signing in.',
        unverified: true,
      });
    }

    const token = await this.jwt.signAsync(
      {},
      {
        subject: String(user.id),
        expiresIn: '8h',
      },
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        isVerified: user.isVerified,
      },
    };
  }

  async forgot(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.users.findOneBy({ email: normalized });

    if (user) {
      void this.issueAndSend(user, AuthTokenType.PasswordReset).catch((err) => {
        this.logger.error(`Failed to send password reset email to ${user.email}`, err);
      });
    }

    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  async reset(token: string, password: string) {
    if (password.length < 8 || !/\d/.test(password)) {
      throw new BadRequestException('Password must be at least 8 characters and include a number.');
    }

    const tokenHash = this.hash(token);
    const record = await this.tokens.findOne({
      where: { tokenHash, type: AuthTokenType.PasswordReset },
      relations: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This password reset link is invalid. Request a new one.');
    }

    record.usedAt = new Date();
    await this.tokens.save(record);

    record.user.passwordHash = await bcrypt.hash(password, 10);
    await this.users.save(record.user);

    return { message: 'Your password has been reset. You can now log in.' };
  }
}
