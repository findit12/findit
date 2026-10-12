import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { AuthToken, AuthTokenType } from './auth-token.entity';
import { MailService } from '../mail/mail.service';
import { CredentialsDto } from './auth.dto';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: {
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let tokensRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
  };
  let mailService: {
    verification: jest.Mock;
    reset: jest.Mock;
    confirmation: jest.Mock;
  };

  beforeEach(async () => {
    process.env.SCHOOL_EMAIL_DOMAIN = 'school.edu';

    usersRepo = {
      findOneBy: jest.fn(),
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
    };

    tokensRepo = {
      findOne: jest.fn(),
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve({ id: 10, ...entity })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
    };

    mailService = {
      verification: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
      confirmation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(AuthToken), useValue: tokensRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

    describe('register', () => {
    // A valid registration form (FR-01); each test changes only what it checks.
    const form = (changes: Partial<CredentialsDto> = {}): CredentialsDto => ({
      email: 'user@school.edu',
      password: 'Password123',
      firstName: 'Elea',
      lastName: 'Schom',
      gdprConsent: true,
      ...changes,
    });

    it('should throw BadRequestException if email is not from school domain', async () => {
      await expect(service.register(form({ email: 'user@other.com' }))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if password is weak', async () => {
      await expect(service.register(form({ password: 'short' }))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should refuse an account without the GDPR consent (TC-AUTH-01)', async () => {
      await expect(service.register(form({ gdprConsent: false }))).rejects.toThrow(
        'You must accept the privacy policy to create an account.',
      );
      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('should refuse an account without a first name or a last name', async () => {
      await expect(service.register(form({ firstName: '   ' }))).rejects.toThrow(
        'Enter your first name and last name.',
      );
      await expect(service.register(form({ lastName: '' }))).rejects.toThrow(
        'Enter your first name and last name.',
      );
      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      usersRepo.findOneBy.mockResolvedValue({ id: 1, email: 'user@school.edu' });

      await expect(service.register(form())).rejects.toThrow(ConflictException);
    });

    it('should register user and send verification email in background without blocking', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);

      const result = await service.register(
        form({ email: 'User@School.EDU ', firstName: ' Elea ', lastName: 'Schom ' }),
      );

      // FR-01: the names are saved without extra spaces, and the consent date is recorded.
      const saved = usersRepo.save.mock.calls[0][0];
      expect(saved.firstName).toBe('Elea');
      expect(saved.lastName).toBe('Schom');
      expect(saved.consentAt).toBeInstanceOf(Date);

      expect(usersRepo.save).toHaveBeenCalled();
      expect(tokensRepo.delete).toHaveBeenCalledWith({
        user: { id: 1 },
        type: AuthTokenType.EmailVerification,
      });
      expect(tokensRepo.save).toHaveBeenCalled();
      expect(result).toEqual({
        user: { id: 1, email: 'user@school.edu', is_verified: false },
      });
    });
  });

  describe('verify', () => {
    it('should throw BadRequestException if token is invalid or already used', async () => {
      tokensRepo.findOne.mockResolvedValue(null);
      await expect(service.verify('bad-token')).rejects.toThrow(BadRequestException);

      tokensRepo.findOne.mockResolvedValue({ usedAt: new Date() });
      await expect(service.verify('used-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with expired flag if token is expired', async () => {
      tokensRepo.findOne.mockResolvedValue({
        usedAt: null,
        expiresAt: new Date(Date.now() - 10000),
      });

      await expect(service.verify('expired-token')).rejects.toMatchObject({
        response: {
          error: 'This verification link has expired. Request a new link below.',
          expired: true,
        },
      });
    });

    it('should mark token as used and user as verified', async () => {
      const user = { id: 1, isVerified: false };
      const token = {
        usedAt: null,
        expiresAt: new Date(Date.now() + 10000),
        user,
      };
      tokensRepo.findOne.mockResolvedValue(token);

      const res = await service.verify('valid-token');

      expect(token.usedAt).toBeInstanceOf(Date);
      expect(user.isVerified).toBe(true);
      expect(tokensRepo.save).toHaveBeenCalledWith(token);
      expect(usersRepo.save).toHaveBeenCalledWith(user);
      expect(res).toEqual({ message: 'Your account has been verified.' });
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found or password incorrect', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);
      await expect(service.login('user@school.edu', 'Password123')).rejects.toThrow(
        UnauthorizedException,
      );

      const hash = await bcrypt.hash('Correct123', 10);
      usersRepo.findOneBy.mockResolvedValue({
        id: 1,
        email: 'user@school.edu',
        passwordHash: hash,
        isVerified: true,
      });
      await expect(service.login('user@school.edu', 'WrongPass123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should refuse login for unverified account with unverified: true (Point B1)', async () => {
      const hash = await bcrypt.hash('Password123', 10);
      usersRepo.findOneBy.mockResolvedValue({
        id: 1,
        email: 'user@school.edu',
        passwordHash: hash,
        isVerified: false,
      });

      await expect(service.login('user@school.edu', 'Password123')).rejects.toMatchObject({
        response: {
          error: 'Please verify your account before signing in.',
          unverified: true,
        },
      });
    });

    it('should return session token and user info on valid credentials', async () => {
      const hash = await bcrypt.hash('Password123', 10);
      usersRepo.findOneBy.mockResolvedValue({
        id: 1,
        email: 'user@school.edu',
        passwordHash: hash,
        isVerified: true,
      });

      const res = await service.login('user@school.edu', 'Password123');

      expect(res).toEqual({
        token: 'signed-jwt-token',
        user: { id: 1, email: 'user@school.edu', isVerified: true },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {},
        { subject: '1', expiresIn: '8h' },
      );
    });
  });

  describe('resend', () => {
    it('should issue new verification token only if unverified user exists', async () => {
      usersRepo.findOneBy.mockResolvedValue({ id: 1, email: 'user@school.edu', isVerified: false });

      const res = await service.resend('user@school.edu');
      expect(res).toEqual({
        message: 'If an unverified account exists, a verification email has been sent.',
      });
      expect(tokensRepo.delete).toHaveBeenCalled();
    });

    it('should return confirmation message without issuing token if user already verified', async () => {
      usersRepo.findOneBy.mockResolvedValue({ id: 1, email: 'user@school.edu', isVerified: true });

      const res = await service.resend('user@school.edu');
      expect(res).toEqual({
        message: 'If an unverified account exists, a verification email has been sent.',
      });
      expect(tokensRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('forgot and reset password', () => {
    it('should send reset email if user exists on forgot password', async () => {
      usersRepo.findOneBy.mockResolvedValue({ id: 1, email: 'user@school.edu' });

      const res = await service.forgot('user@school.edu');
      expect(res).toEqual({
        message: 'If an account exists for that email, a reset link has been sent.',
      });
      expect(tokensRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if new password in reset is weak', async () => {
      await expect(service.reset('token', 'weak')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reset token is invalid, expired or used', async () => {
      tokensRepo.findOne.mockResolvedValue(null);
      await expect(service.reset('bad-token', 'NewPass123')).rejects.toThrow(BadRequestException);
    });

    it('should reset password and mark token as used', async () => {
      const user = { id: 1, passwordHash: 'old' };
      const token = {
        usedAt: null,
        expiresAt: new Date(Date.now() + 10000),
        user,
      };
      tokensRepo.findOne.mockResolvedValue(token);

      const res = await service.reset('valid-token', 'NewPassword123');

      expect(token.usedAt).toBeInstanceOf(Date);
      expect(tokensRepo.save).toHaveBeenCalledWith(token);
      expect(usersRepo.save).toHaveBeenCalledWith(user);
      expect(res).toEqual({
        message: 'Your password has been reset. You can now log in.',
      });
    });
  });
});
