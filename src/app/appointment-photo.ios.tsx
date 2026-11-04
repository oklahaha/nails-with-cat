/**
 * Full-screen booking photos (SwiftUI): swipe between them, tap to zoom in
 * and drag to look around. @expo/ui has no pinch gesture, so zoom is a tap. The
 * bottom bar shares the photo (to WhatsApp or 儲存影像) and, for a saved
 * booking, removes it.
 */
import { Alert, Button, HStack, Spacer, TabView, Text, VStack } from '@expo/ui/swift-ui';
import { frame, onGeometryChange, padding, tabViewStyle } from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { glassButton } from '@/components/swiftui/glass';
import { PhotoPage, PhotoShareButton } from '@/components/swiftui/PhotoPage';
import { SwiftModal } from '@/components/swiftui/SwiftModal';
import { removePhoto } from '@/hooks/appointmentWrites';
import { useLiveAppointment } from '@/hooks/useAppointments';
import { photosOf, type PhotoKind } from '@/utils/appointmentPhotos';

/** Each drawn page is a decoded image, so only the one on screen and its neighbours are. */
const DRAWN_PAGES_EACH_SIDE = 1;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function AppointmentPhotoScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    kind: PhotoKind;
    start?: string;
    paths?: string;
  }>();
  const live = useLiveAppointment(params.id);
  const [opened] = useState<string[]>(() => JSON.parse(params.paths ?? '[]') as string[]);
  const paths = live ? photosOf(live, params.kind) : opened;
  const [selected, setSelected] = useState(params.start ?? paths[0]);
  const [askRemove, setAskRemove] = useState(false);
  const window = useWindowDimensions();
  const [page, setPage] = useState({ width: window.width, height: window.height * 0.75 });

  // The last photo was removed
  useEffect(() => {
    if (paths.length === 0) close();
  }, [paths.length]);
  // A removed photo's page is gone: show the one now in its place
  const current = paths.includes(selected) ? selected : paths[0];
  if (current === undefined) return null;
  const index = paths.indexOf(current);

  return (
    <SwiftModal onClose={close}>
      <VStack spacing={0}>
        <TabView
          selection={current}
          onSelectionChange={(path) => setSelected(String(path))}
          modifiers={[
            tabViewStyle({
              type: 'page',
              indexDisplayMode: paths.length > 1 ? 'automatic' : 'never',
            }),
            onGeometryChange(({ width, height }) => setPage({ width, height })),
          ]}
        >
          {paths.map((path, i) => (
            <TabView.Tab key={path} value={path}>
              {/* Always here: TabView doesn't redraw when a Tab's own children change */}
              <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
                {Math.abs(i - index) <= DRAWN_PAGES_EACH_SIDE ? (
                  <PhotoPage path={path} width={page.width} height={page.height} />
                ) : null}
              </VStack>
            </TabView.Tab>
          ))}
        </TabView>

        <HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 12 })]}>
          <PhotoShareButton key={current} path={current} />
          <Spacer />
          {live ? (
            <Alert title="移除此相片？" isPresented={askRemove} onIsPresentedChange={setAskRemove}>
              <Alert.Trigger>
                <Button
                  label="移除"
                  systemImage="trash"
                  role="destructive"
                  onPress={() => setAskRemove(true)}
                  modifiers={[glassButton()]}
                />
              </Alert.Trigger>
              <Alert.Actions>
                <Button label="取消" role="cancel" onPress={() => setAskRemove(false)} />
                <Button
                  label="移除"
                  role="destructive"
                  onPress={() => {
                    setAskRemove(false);
                    removePhoto(live, params.kind, current);
                  }}
                />
              </Alert.Actions>
              <Alert.Message>
                <Text>相片會由此預約移除，並移到 Google Drive 的垃圾桶。</Text>
              </Alert.Message>
            </Alert>
          ) : null}
        </HStack>
      </VStack>
    </SwiftModal>
  );
}
