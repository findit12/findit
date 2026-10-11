import { BadRequestException } from '@nestjs/common';

// SCRUM-19 (FR-06): rules for the photos of an announcement. The client checks the same rules
// before sending, but only the server can be trusted: a request can always skip the client.
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB per photo

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

// Finds the real type of a file from its first bytes (its "signature"). The file name and the
// type announced by the browser can be wrong or faked; the content cannot pretend so easily.
export function detectImageType(buffer: Buffer): ImageType | null {
  const startsWith = (bytes: number[], offset = 0) =>
    buffer.length >= offset + bytes.length && bytes.every((byte, i) => buffer[offset + i] === byte);

  if (startsWith([0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  // WebP: "RIFF" at byte 0, then "WEBP" at byte 8.
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  return null;
}

// Refuses the whole request with a clear message if one photo breaks a rule.
export function checkPhotos(files: Express.Multer.File[]): void {
  if (files.length > MAX_PHOTOS) {
    throw new BadRequestException(`You can add up to ${MAX_PHOTOS} photos.`);
  }

  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) {
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `"${file.originalname}" is too large (${sizeInMb} MB). The maximum is 5 MB per photo.`,
      );
    }
    if (!detectImageType(file.buffer)) {
      throw new BadRequestException(`"${file.originalname}" is not a JPEG, PNG or WebP image.`);
    }
  }
}
