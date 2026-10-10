import { Test, TestingModule } from '@nestjs/testing';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
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
    await expect(
      service.confirmation('user@school.edu', { id: 42, title: 'Keys', type: 'found' }),
    ).resolves.not.toThrow();
  });

  it('writes the title (escaped) and the link of the announcement in the confirmation (SCRUM-17)', async () => {
    await service.confirmation('user@school.edu', { id: 43, title: 'Scarf <b>blue</b>', type: 'lost' });

    const dir = path.resolve(process.cwd(), 'dev-emails');
    const newest = (await readdir(dir)).sort().reverse()[0];
    const html = await readFile(path.join(dir, newest), 'utf8');

    expect(html).toContain('Your lost object is published on FindIt');
    expect(html).toContain('Scarf &lt;b&gt;blue&lt;/b&gt;');
    expect(html).toContain('http://localhost:5173/announcements/43');
  });
});
