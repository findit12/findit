import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    process.env.CLIENT_URL = 'http://localhost:5173,http://192.168.1.50:5173';

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should format and trigger verification email without error', async () => {
    await expect(service.verification('user@school.edu', 'testtoken123')).resolves.not.toThrow();
  });

  it('should format and trigger password reset email without error', async () => {
    await expect(service.reset('user@school.edu', 'testtoken123')).resolves.not.toThrow();
  });

  it('should format and trigger announcement confirmation email without error', async () => {
    await expect(service.confirmation('user@school.edu', 42)).resolves.not.toThrow();
  });
});
