import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

describe('AnnouncementsController', () => {
  let controller: AnnouncementsController;
  let service: {
    create: jest.Mock;
    find: jest.Mock;
  };
  let jwt: {
    verify: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({
        announcement: { id: 1, title: 'Item', description: 'Desc' },
      }),
      find: jest.fn().mockResolvedValue({
        announcement: { id: 1, title: 'Item', description: 'Desc' },
      }),
    };

    jwt = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnnouncementsController],
      providers: [
        { provide: AnnouncementsService, useValue: service },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    controller = module.get<AnnouncementsController>(AnnouncementsController);
  });

  describe('create', () => {
    it('should throw UnauthorizedException if header is missing or token is invalid', () => {
      expect(() =>
        controller.create(undefined as unknown as string, { title: 'T', description: 'D' }),
      ).toThrow(UnauthorizedException);

      jwt.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      expect(() =>
        controller.create('Bearer bad', { title: 'T', description: 'D' }),
      ).toThrow(UnauthorizedException);
    });

    it('should create announcement with extracted user id', async () => {
      jwt.verify.mockReturnValue({ sub: '12' });

      const res = await controller.create('Bearer validtoken', {
        title: 'Title',
        description: 'Desc',
      });

      expect(service.create).toHaveBeenCalledWith(12, 'Title', 'Desc');
      expect(res).toEqual({
        announcement: { id: 1, title: 'Item', description: 'Desc' },
      });
    });
  });

  describe('find', () => {
    it('should return announcement by id', async () => {
      const res = await controller.find('1');
      expect(service.find).toHaveBeenCalledWith(1);
      expect(res).toEqual({
        announcement: { id: 1, title: 'Item', description: 'Desc' },
      });
    });
  });
});
