import { BadRequestException } from '@nestjs/common';
import { checkPhotos, detectImageType, MAX_PHOTO_BYTES } from './photo-rules';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.from('RIFF0000WEBPVP8 ', 'ascii');
const TEXT = Buffer.from('not an image', 'ascii');

// A fake uploaded file with a name, a content and a size.
function file(originalname: string, buffer: Buffer, size = buffer.length): Express.Multer.File {
  return { originalname, buffer, size } as Express.Multer.File;
}

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP from their first bytes', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(WEBP)).toBe('image/webp');
  });

  it('refuses any other content, even if the name ends with .jpg', () => {
    expect(detectImageType(TEXT)).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('checkPhotos', () => {
  it('accepts up to 4 valid photos, and no photo at all', () => {
    expect(() => checkPhotos([])).not.toThrow();
    expect(() =>
      checkPhotos([file('a.jpg', JPEG), file('b.png', PNG), file('c.webp', WEBP), file('d.jpg', JPEG)]),
    ).not.toThrow();
  });

  it('refuses more than 4 photos', () => {
    const five = Array.from({ length: 5 }, (_, i) => file(`${i}.jpg`, JPEG));
    expect(() => checkPhotos(five)).toThrow('You can add up to 4 photos.');
  });

  it('refuses a photo larger than 5 MB, naming the file', () => {
    expect(() => checkPhotos([file('big.jpg', JPEG, MAX_PHOTO_BYTES + 1)])).toThrow(
      '"big.jpg" is too large (5.0 MB). The maximum is 5 MB per photo.',
    );
  });

  it('refuses a file that is not a real image, naming the file', () => {
    expect(() => checkPhotos([file('fake.jpg', TEXT)])).toThrow(BadRequestException);
    expect(() => checkPhotos([file('fake.jpg', TEXT)])).toThrow('"fake.jpg" is not a JPEG, PNG or WebP image.');
  });
});
