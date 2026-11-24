
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

  it('should format and trigger saved search alert email without error', async () => {
    await expect(
      service.savedSearchAlert('user@school.edu', { id: 44, title: 'Keys', type: 'found' }),
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

  it('writes a new-message notification email (SCRUM-32)', async () => {
    await service.newMessage('finder@school.edu', {
      discussionId: 42,
      announcementTitle: 'Black phone',
    });

    const dir = path.resolve(process.cwd(), 'dev-emails');
    const files = await readdir(dir);
    const newest = files.sort().reverse()[0];
    const html = await readFile(path.join(dir, newest), 'utf8');

    expect(html).toContain('You have a new FindIt message');
    expect(html).toContain('Black phone');
    expect(html).toContain('http://localhost:5173/messages?discussionId=42');
  });

  it('retries saving an email preview after a temporary failure (SCRUM-32)', async () => {
    const writePreviewSpy = jest
      .spyOn(service as any, 'writePreview')
      .mockRejectedValueOnce(new Error('Temporary disk error'))
      .mockResolvedValueOnce(undefined);

    try {
      await service.newMessage('finder@school.edu', {
        discussionId: 42,
        announcementTitle: 'Black phone',
      });

      expect(writePreviewSpy).toHaveBeenCalledTimes(2);
    } finally {
      writePreviewSpy.mockRestore();
    }
  });
  it('writes a handover confirmation email (SCRUM-32)', async () => {
    await service.handover('claimant@school.edu', {
      id: 42,
      title: 'Black phone',
    });

    const dir = path.resolve(process.cwd(), 'dev-emails');
    const files = await readdir(dir);
    const newest = files.sort().reverse()[0];
    const html = await readFile(path.join(dir, newest), 'utf8');

    expect(html).toContain('Your FindIt item handover is confirmed');
    expect(html).toContain('Black phone');
    expect(html).toContain('http://localhost:5173/announcements/42');
  });
  it('writes a match alert pointing to the other announcement (SCRUM-28)', async () => {
    await service.matchAlert('owner@school.edu', { id: 45, title: 'Black phone', type: 'found' });

    const dir = path.resolve(process.cwd(), 'dev-emails');
    const newest = (await readdir(dir)).sort().reverse()[0];
    const html = await readFile(path.join(dir, newest), 'utf8');

    expect(html).toContain('FindIt found a possible match');
    expect(html).toContain('A found object may be yours: &quot;Black phone&quot;');
    expect(html).toContain('http://localhost:5173/announcements/45');
  });
  it('writes the archive reminder with the date and the link (SCRUM-51)', async () => {
    await service.archiveReminder(
      'author@school.edu',
      { id: 8, title: 'Black phone', type: 'found' },
      new Date('2026-12-30T10:00:00Z'),
    );

    const dir = path.resolve(process.cwd(), 'dev-emails');
    const newest = (await readdir(dir)).sort().reverse()[0];
    const html = await readFile(path.join(dir, newest), 'utf8');

    expect(html).toContain('Your FindIt announcement will be archived soon');
    expect(html).toContain('will be archived on 2026-12-30');
    expect(html).toContain('http://localhost:5173/announcements/8');
  });

  it('writes a new-discussion email that links to the discussion (SCRUM-30)', async () => {
    await service.discussionStarted('finder@school.edu', { id: 7, title: 'Black phone', type: 'found' }, 3);

    const dir = path.resolve(process.cwd(), 'dev-emails');
    const newest = (await readdir(dir)).sort().reverse()[0];
    const html = await readFile(path.join(dir, newest), 'utf8');

    expect(html).toContain('New discussion about your announcement');
    expect(html).toContain('http://localhost:5173/messages?discussionId=3');
  });
});