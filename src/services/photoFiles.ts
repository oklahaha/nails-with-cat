/**
 * Booking photos on the device (iOS / Android; web uses photoFiles.web.ts).
 * SwiftUI's Image only reads local files, so every photo shown is a file here.
 *
 * Photos waiting to upload stay in the documents folder, which the system
 * doesn't clear, since the outbox only holds their paths; once uploaded, and
 * for photos downloaded from Drive, they live in the cache folder and can be
 * fetched again if the system clears it.
 *
 * Dev builds made before expo-file-system was linked don't have its native
 * module, and importing it would then throw at startup, so it's only required
 * once the module is known to exist. Without it no photo can be shown or saved.
 */
import { requireOptionalNativeModule } from 'expo';
import type * as FileSystem from 'expo-file-system';

import type { PhotoSize } from '@/utils/appointmentPhotos';

const FS: typeof FileSystem | null = requireOptionalNativeModule('FileSystem')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-file-system')
  : null;

function directory(where: 'pending' | 'cache'): FileSystem.Directory | null {
  if (!FS) return null;
  const dir =
    where === 'pending'
      ? new FS.Directory(FS.Paths.document, 'pending-photos')
      : new FS.Directory(FS.Paths.cache, 'photos');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/** The file's name: ASCII, since paths hold 參考作品 / 完成作品. */
function fileName(path: string, size: PhotoSize): string {
  return `${path.replace(/[^A-Za-z0-9.]/g, '_')}.${size}.jpg`;
}

function fileIn(where: 'pending' | 'cache', path: string, size: PhotoSize) {
  const dir = directory(where);
  return dir && FS ? new FS.File(dir, fileName(path, size)) : null;
}

function existing(path: string, size: PhotoSize): string | undefined {
  for (const where of ['pending', 'cache'] as const) {
    const file = fileIn(where, path, size);
    if (file?.exists) return file.uri;
  }
  return undefined;
}

/** The local file for a photo, if there is one; a full photo can stand in for a thumbnail. */
export function localPhotoUri(path: string, size: PhotoSize): string | undefined {
  return existing(path, size) ?? (size === 'thumb' ? existing(path, 'full') : undefined);
}

/** Keep a picked photo (already resized, see photoPicker) until it has uploaded. */
export function savePickedPhoto(
  path: string,
  picked: { fullUri: string; thumbUri: string; base64?: string }
): void {
  if (!FS) throw new Error('請更新 app 後再試');
  const full = fileIn('pending', path, 'full');
  const thumb = fileIn('pending', path, 'thumb');
  if (!full || !thumb) throw new Error('請更新 app 後再試');
  new FS.File(picked.fullUri).copy(full);
  new FS.File(picked.thumbUri).copy(thumb);
}

/** A photo waiting to upload, as base64. */
export async function readPendingPhoto(path: string): Promise<string> {
  const file = fileIn('pending', path, 'full');
  if (!file?.exists) throw new Error('找不到相片檔案，請重新加入');
  return file.base64();
}

/** It's in Drive now, so the system may clear the local copy. */
export function markPhotoUploaded(path: string): void {
  for (const size of ['full', 'thumb'] as const) {
    try {
      const from = fileIn('pending', path, size);
      const to = fileIn('cache', path, size);
      if (from?.exists && to) {
        if (!to.exists) from.copy(to);
        from.delete();
      }
    } catch {
      // Only a local copy: it can be downloaded again
    }
  }
}

export async function saveDownloadedPhoto(
  path: string,
  size: PhotoSize,
  base64: string
): Promise<string> {
  const file = fileIn('cache', path, size);
  if (!file) throw new Error('請更新 app 後再試');
  file.create({ overwrite: true });
  await file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/** Forget a photo's local copies, e.g. one taken off a form before saving. */
export function discardPhoto(path: string): void {
  for (const where of ['pending', 'cache'] as const) {
    for (const size of ['full', 'thumb'] as const) {
      try {
        const file = fileIn(where, path, size);
        if (file?.exists) file.delete();
      } catch {
        // Only leaves a stray file
      }
    }
  }
}
