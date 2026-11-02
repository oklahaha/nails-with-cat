/**
 * The pieces of the SwiftUI photo viewers: one full-screen photo, where a tap
 * zooms in and dragging looks around (@expo/ui has no pinch gesture), and a
 * button that shares it (to WhatsApp or 儲存影像) once its file is here.
 */
import {
  Button,
  Image,
  Label,
  ProgressView,
  ScrollView,
  ShareLink,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import { aspectRatio, frame, resizable } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { colors } from '@/constants/theme';
import { usePhotoUri } from '@/hooks/usePhotoUri';

import { glassButton } from './glass';

const ZOOM = 2.5;

export function PhotoPage({ path, width, height }: { path: string; width: number; height: number }) {
  const { uri, failed, retry } = usePhotoUri(path, 'full');
  const [zoomed, setZoomed] = useState(false);
  const scale = zoomed ? ZOOM : 1;

  if (failed) {
    return (
      <VStack spacing={12} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <Text>未能載入相片</Text>
        <Button label="重試" onPress={retry} modifiers={[glassButton()]} />
      </VStack>
    );
  }
  if (!uri) {
    return (
      <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <ProgressView />
      </VStack>
    );
  }
  return (
    <ScrollView axes={zoomed ? 'both' : 'vertical'} showsIndicators={false}>
      <Image
        uiImage={uri}
        onPress={() => setZoomed((z) => !z)}
        modifiers={[
          resizable(),
          aspectRatio({ contentMode: 'fit' }),
          frame({ width: width * scale, height: height * scale }),
        ]}
      />
    </ScrollView>
  );
}

/** Give it a `key` of the path: its state is per photo. */
export function PhotoShareButton({ path }: { path: string }) {
  const { uri } = usePhotoUri(path, 'full');
  if (!uri) return <Label title="分享" systemImage="square.and.arrow.up" color={colors.textTertiary} />;
  return (
    <ShareLink item={uri} modifiers={[glassButton()]}>
      <Label title="分享" systemImage="square.and.arrow.up" />
    </ShareLink>
  );
}
