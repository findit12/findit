import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly dir = path.resolve(process.cwd(), 'dev-emails');

  private getClientBaseUrl(): string {
    const raw = process.env.CLIENT_URL || 'http://localhost:5173';
    return raw.split(',')[0].trim();
  }

  private async send(to: string, subject: string, url: string): Promise<void> {
    try {
      await mkdir(this.dir, { recursive: true });
      const name = `${Date.now()}-${Math.random().toString(16).slice(2)}.html`;
      await writeFile(
        path.join(this.dir, name),
        `<h1>${subject}</h1><p>To: ${to}</p><p><a href="${url}">${url}</a></p>`,
      );
      this.logger.log(`Local email saved: ${path.join(this.dir, name)}`);
    } catch (error) {
      this.logger.error('Email could not be saved', error);
    }
  }

  async verification(to: string, token: string): Promise<void> {
    const base = this.getClientBaseUrl();
    await this.send(to, 'Verify your FindIt account', `${base}/verify?token=${token}`);
  }

  async reset(to: string, token: string): Promise<void> {
    const base = this.getClientBaseUrl();
    await this.send(to, 'Reset your FindIt password', `${base}/reset-password?token=${token}`);
  }

  async confirmation(to: string, id: number): Promise<void> {
    const base = this.getClientBaseUrl();
    await this.send(to, 'Your FindIt announcement was created', `${base}/announcements/${id}`);
  }
}
