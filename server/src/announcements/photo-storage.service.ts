import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { detectImageType, ImageType } from './photo-rules';

// Folder where the photos are saved. main.ts serves it at http://localhost:3000/uploads/...
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const EXTENSIONS: Record<ImageType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class PhotoStorageService {
  // Saves the photos on disk with a random name and returns the file names.
  // The photos must have passed checkPhotos() first. The extension comes from the real
  // content of the file, not from the name chosen by the user.
  async save(files: Express.Multer.File[]): Promise<string[]> {
    await mkdir(UPLOADS_DIR, { recursive: true });

    const names: string[] = [];
    for (const file of files) {
      const type = detectImageType(file.buffer);
      const name = `${randomUUID()}${type ? EXTENSIONS[type] : ''}`;
      await writeFile(path.join(UPLOADS_DIR, name), file.buffer);
      names.push(name);
    }
    return names;
  }
}
