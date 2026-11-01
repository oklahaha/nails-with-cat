/**
 * A booking photo's local file, downloading it through Apps Script if needed.
 * Each download takes a second or more, so only a few run at once and two
 * screens asking for the same photo share one.
 */
import { useCallback, useEffect, useState } from 'react';

import { getAppointmentPhoto } from '@/services/appointmentsApi';
import { localPhotoUri, saveDownloadedPhoto } from '@/services/photoFiles';
import type { PhotoSize } from '@/utils/appointmentPhotos';

const MAX_DOWNLOADS = 3;
let running = 0;
const waiting: (() => void)[] = [];
const inflight = new Map<string, Promise<string>>();

async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (running >= MAX_DOWNLOADS) await new Promise<void>((resolve) => waiting.push(resolve));
  else running++;
  try {
    return await run();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

function download(path: string, size: PhotoSize): Promise<string> {
  const key = `${path}|${size}`;
  let request = inflight.get(key);
  if (!request) {
    request = withSlot(async () =>
      saveDownloadedPhoto(path, size, await getAppointmentPhoto(path, size))
    ).finally(() => inflight.delete(key));
    inflight.set(key, request);
  }
  return request;
}

/** Give each photo its own component (a `key` of its path): state is per mount. */
export function usePhotoUri(path: string, size: PhotoSize) {
  const [uri, setUri] = useState(() => localPhotoUri(path, size));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (uri) return;
    let current = true;
    download(path, size)
      .then((downloaded) => {
        if (current) setUri(downloaded);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [path, size, uri, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  return { uri, failed, retry };
}
