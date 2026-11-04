/**
 * Booking photos in a browser, which has no files to keep: held in memory as
 * data URLs, so a photo not yet uploaded is lost if the page is reloaded (its
 * upload then fails and says so). Same API as photoFiles.ts.
 */
import type { PhotoSize } from '@/utils/appointmentPhotos';

const photos = new Map<string, string>();
const pending = new Map<string, string>();

function dataUrl(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}

export function localPhotoUri(path: string, size: PhotoSize): string | undefined {
  return (
    photos.get(`${path}|${size}`) ?? (size === 'thumb' ? photos.get(`${path}|full`) : undefined)
  );
}

export function savePickedPhoto(
  path: string,
  picked: { fullUri: string; thumbUri: string; base64?: string }
): void {
  photos.set(`${path}|full`, picked.fullUri);
  photos.set(`${path}|thumb`, picked.thumbUri);
  if (picked.base64) pending.set(path, picked.base64);
}

export async function readPendingPhoto(path: string): Promise<string> {
  const base64 = pending.get(path);
  if (!base64) throw new Error('找不到相片檔案，請重新加入');
  return base64;
}

export function markPhotoUploaded(path: string): void {
  pending.delete(path);
}

export async function saveDownloadedPhoto(
  path: string,
  size: PhotoSize,
  base64: string
): Promise<string> {
  const uri = dataUrl(base64);
  photos.set(`${path}|${size}`, uri);
  return uri;
}

export function discardPhoto(path: string): void {
  pending.delete(path);
  photos.delete(`${path}|full`);
  photos.delete(`${path}|thumb`);
}
