/**
 * Pick or take booking photos, then shrink them: an original is several MB
 * and has to pass through Apps Script as base64. Picked photos are kept on
 * the device under the Drive path they'll get (see photoFiles).
 *
 * The native modules are required only when used, since builds made before
 * they were added would otherwise crash on importing them.
 */
import { requireOptionalNativeModule } from 'expo';
import type * as ImageManipulatorModule from 'expo-image-manipulator';
import type * as ImagePickerModule from 'expo-image-picker';
import { Platform } from 'react-native';

import { savePickedPhoto } from '@/services/photoFiles';
import { newPhotoPath, type PhotoKind } from '@/utils/appointmentPhotos';

export type PhotoSource = 'library' | 'camera';

/** Sharp enough to read a nail design when zoomed, at a few hundred KB. */
const FULL_LONG_SIDE = 1600;
const FULL_QUALITY = 0.75;
const THUMB_LONG_SIDE = 720;
const THUMB_QUALITY = 0.6;

function loadModules() {
  const available =
    Platform.OS === 'web' ||
    (requireOptionalNativeModule('ExponentImagePicker') &&
      requireOptionalNativeModule('ExpoImageManipulator'));
  if (!available) throw new Error('請更新 app 後再試');
  /* eslint-disable @typescript-eslint/no-require-imports */
  return {
    ImagePicker: require('expo-image-picker') as typeof ImagePickerModule,
    Manipulator: require('expo-image-manipulator') as typeof ImageManipulatorModule,
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
}

async function shrink(
  Manipulator: typeof ImageManipulatorModule,
  uri: string,
  width: number,
  height: number,
  longSide: number,
  compress: number,
  base64: boolean
) {
  const context = Manipulator.ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > longSide) {
    context.resize(width >= height ? { width: longSide, height: null } : { width: null, height: longSide });
  }
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ format: Manipulator.SaveFormat.JPEG, compress, base64 });
}

/** Up to `limit` photos; returns their new paths, empty if cancelled. */
export async function pickPhotos(
  kind: PhotoKind,
  source: PhotoSource,
  limit: number
): Promise<string[]> {
  const { ImagePicker, Manipulator } = loadModules();

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('請在「設定」允許使用相機');
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: limit > 1,
          selectionLimit: limit,
          quality: 1,
        });
  if (result.canceled) return [];

  const paths: string[] = [];
  for (const asset of result.assets.slice(0, limit)) {
    const web = Platform.OS === 'web';
    const full = await shrink(Manipulator, asset.uri, asset.width, asset.height, FULL_LONG_SIDE, FULL_QUALITY, web);
    const thumb = await shrink(Manipulator, full.uri, full.width, full.height, THUMB_LONG_SIDE, THUMB_QUALITY, false);
    const path = newPhotoPath(kind);
    savePickedPhoto(path, { fullUri: full.uri, thumbUri: thumb.uri, base64: full.base64 });
    paths.push(path);
  }
  return paths;
}
