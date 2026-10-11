import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AnnouncementType } from './announcement.entity';
import { CreateAnnouncementDto } from './announcements.dto';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

describe('AnnouncementsController', () => {
  let controller: AnnouncementsController;
  let service: Record<'create' | 'findPublic' | 'findMine' | 'findMineById' | 'update' | 'remove', jest.Mock>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ announcement: { id: 1 } }),
      findPublic: jest.fn().mockResolvedValue({ announcement: { id: 1 } }),
      findMine: jest.fn(),
      findMineById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnnouncementsController],
      providers: [
        { provide: AnnouncementsService, useValue: service },
        { provide: JwtService, useValue: { verify: jest.fn() } }, // needed by JwtAuthGuard
      ],
    }).compile();

    controller = module.get(AnnouncementsController);
  });

  it('passes the signed-in user, the form and the photos to the service', async () => {
    const dto = { type: AnnouncementType.Found } as CreateAnnouncementDto;
    const files = [{ originalname: 'a.jpg' }] as Express.Multer.File[];

    await controller.create(5, dto, files);

    expect(service.create).toHaveBeenCalledWith(5, dto, files);
  });

  it('reads one announcement through the public view', async () => {
    await controller.findOne(1);
    expect(service.findPublic).toHaveBeenCalledWith(1);
  });

  it('passes the signed-in user to the "mine", edit and delete routes (SCRUM-18)', async () => {
    await controller.findMine(5);
    await controller.findMineById(5, 1);
    await controller.update(5, 1, { title: 'New title' });
    await controller.remove(5, 1);

    expect(service.findMine).toHaveBeenCalledWith(5);
    expect(service.findMineById).toHaveBeenCalledWith(5, 1);
    expect(service.update).toHaveBeenCalledWith(5, 1, { title: 'New title' });
    expect(service.remove).toHaveBeenCalledWith(5, 1);
  });
});
