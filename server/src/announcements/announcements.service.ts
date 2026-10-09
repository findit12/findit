import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FoundAnnouncement } from './found-announcement.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    @InjectRepository(FoundAnnouncement)
    private readonly items: Repository<FoundAnnouncement>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly mail: MailService,
  ) {}

  async create(userId: number, title: string, description: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const announcement = await this.items.save(
      this.items.create({ user, title, description }),
    );

    // Send confirmation in background without breaking or blocking the request (Point B2)
    void this.mail.confirmation(user.email, announcement.id).catch((err) => {
      this.logger.error(`Failed to send confirmation email for announcement ${announcement.id}`, err);
    });

    return {
      announcement: {
        id: announcement.id,
        title: announcement.title,
        description: announcement.description,
        created_at: announcement.createdAt,
      },
    };
  }

  async find(id: number) {
    const item = await this.items.findOneBy({ id });
    if (!item) {
      throw new NotFoundException('Announcement not found.');
    }

    return {
      announcement: {
        id: item.id,
        title: item.title,
        description: item.description,
        created_at: item.createdAt,
      },
    };
  }
}
