import { Test } from '@nestjs/testing';
import { AnnouncementsService } from '../announcements/announcements.service';
import { ReferenceService } from '../reference/reference.service';
import {
  RECEPTION_DEFAULT_DESCRIPTION,
  RECEPTION_DEFAULT_TITLE,
  ReceptionDeclarationService,
} from './reception-declaration.service';

describe('ReceptionDeclarationService (SCRUM-54, FR-32)', () => {
  let service: ReceptionDeclarationService;
  const announcements = { create: jest.fn() };
  const reference = { getUnidentified: jest.fn() };
  const photo = { originalname: 'p.jpg' } as Express.Multer.File;

  beforeEach(async () => {
    jest.resetAllMocks();
    reference.getUnidentified.mockResolvedValue({ categoryId: 10, objectTypeId: 11, placeId: 12 });
    announcements.create.mockResolvedValue({ announcement: { id: 30 }, matchCount: 2 });
    const module = await Test.createTestingModule({
      providers: [
        ReceptionDeclarationService,
        { provide: AnnouncementsService, useValue: announcements },
        { provide: ReferenceService, useValue: reference },
      ],
    }).compile();
    service = module.get(ReceptionDeclarationService);
  });

  it('declares a found object at the reception with the default values and today\'s date', async () => {
    const result = await service.declare(1, {}, [photo]);

    const [authorId, dto, files] = announcements.create.mock.calls[0];
    expect(authorId).toBe(1);
    expect(files).toEqual([photo]);
    expect(dto).toMatchObject({
      type: 'found',
      title: RECEPTION_DEFAULT_TITLE,
      description: RECEPTION_DEFAULT_DESCRIPTION,
      categoryId: 10,
      objectTypeId: 11,
      placeId: 12,
      currentLocation: 'reception',
      hiddenDetail: undefined,
    });
    expect(dto.title).toBe('Object left at reception');
    expect(dto.eventDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toEqual({ announcement: { id: 30 }, matchCount: 2 });
  });

  it('keeps the hidden detail when the staff write one', async () => {
    await service.declare(1, { hiddenDetail: 'Cat sticker' }, [photo]);
    expect(announcements.create.mock.calls[0][1].hiddenDetail).toBe('Cat sticker');
  });

  it('lets the photo rules of the normal declaration answer (no photo: 400)', async () => {
    announcements.create.mockRejectedValue(new Error('Add at least one photo.'));
    await expect(service.declare(1, {}, [])).rejects.toThrow('Add at least one photo.');
  });
});
