// SCRUM-19: the same photo rules as the server (server/src/announcements/photo-rules.ts).
// Checking them here gives an immediate message, before anything is sent. The server still
// checks again, and it also reads the real content of each file.
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Returns an error message for a photo that breaks a rule, or null if the photo is fine.
export function photoError(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `"${file.name}" is not a JPEG, PNG or WebP image.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    return `"${file.name}" is too large (${sizeInMb} MB). The maximum is 5 MB per photo.`;
  }
  return null;
}
