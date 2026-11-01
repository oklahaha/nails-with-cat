/**
 * Adding photos, as the screens need it: `useAddPhotos` runs the picker and
 * reports problems, and `useDraftPhotos` holds photos for a form that hasn't
 * been saved, dropping them if the form closes without saving.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { discardPhoto } from '@/services/photoFiles';
import { pickPhotos, type PhotoSource } from '@/services/photoPicker';
import { showAlert } from '@/utils/alert';
import { MAX_PHOTOS, type PhotoKind } from '@/utils/appointmentPhotos';

export function useAddPhotos(
  kind: PhotoKind,
  existingCount: number,
  onPicked: (paths: string[]) => void
) {
  /** While picked photos are being shrunk, which takes a moment. */
  const [adding, setAdding] = useState(false);

  const add = async (source: PhotoSource) => {
    setAdding(true);
    try {
      const paths = await pickPhotos(kind, source, MAX_PHOTOS - existingCount);
      if (paths.length > 0) onPicked(paths);
    } catch (e) {
      showAlert('未能加入相片', e instanceof Error ? e.message : '未知錯誤');
    } finally {
      setAdding(false);
    }
  };

  return { add, adding, canAdd: existingCount < MAX_PHOTOS };
}

export function useDraftPhotos(kind: PhotoKind) {
  const [paths, setPaths] = useState<string[]>([]);
  const latest = useRef(paths);
  useEffect(() => {
    latest.current = paths;
  }, [paths]);

  // Closing the form without saving drops what's still here
  useEffect(
    () => () => {
      for (const path of latest.current) discardPhoto(path);
    },
    []
  );

  const { add, adding, canAdd } = useAddPhotos(kind, paths.length, (picked) =>
    setPaths((prev) => [...prev, ...picked])
  );

  const remove = useCallback((path: string) => {
    discardPhoto(path);
    setPaths((prev) => prev.filter((p) => p !== path));
  }, []);

  /** Hand the photos over to be uploaded with the saved booking. */
  const take = useCallback((): string[] => {
    const taken = latest.current;
    latest.current = [];
    return taken;
  }, []);

  return { paths, add, adding, canAdd, remove, take };
}
