import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AnnouncementType } from './announcement.entity';
import { CreateAnnouncementDto } from './announcements.dto';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

describe('AnnouncementsController', () => {
  let controller: AnnouncementsController;
  let service: Record<'create' | 'findPublic' | 'findMine' | 'findMineById' | 'update' | 'replace' | 'remove' | 'getAdminStatistics', jest.Mock>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ announcement: { id: 1 } }),
      findPublic: jest.fn().mockResolvedValue({ announcement: { id: 1 } }),
      findMine: jest.fn(),
      findMineById: jest.fn(),
      update: jest.fn(),
      replace: jest.fn(),
      remove: jest.fn(),
      getAdminStatistics: jest.fn().mockResolvedValue({ declaredCount: 10, returnedCount: 4, recoveryRate: 40 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnnouncementsController],
      providers: [
        { provide: AnnouncementsService, useValue: service },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
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

  it('passes the signed-in user, the id and the full form to the PUT route (Lab 6)', async () => {
    const dto = {
      title: 'Black iPhone 13',
      categoryId: 1,
      objectTypeId: 2,
      description: 'Found under a table',
      eventDate: '2026-10-01',
      placeId: 3,
    };

    await controller.replace(5, 1, dto);

    expect(service.replace).toHaveBeenCalledWith(5, 1, dto);
  });

  it('returns platform recovery statistics for administrators (SCRUM-36)', async () => {
    const res = await controller.getAdminStatistics();
    expect(service.getAdminStatistics).toHaveBeenCalled();
    expect(res).toEqual({ declaredCount: 10, returnedCount: 4, recoveryRate: 40 });
  });
});