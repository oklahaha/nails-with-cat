/**
 * Full-screen 作品 (SwiftUI): swipe through the photos the grid was showing,
 * across bookings. Each shows its service and date but not the customer, as
 * this is what gets shown to other customers; 查看預約 opens the booking, which
 * is also where a photo is removed.
 *
 * The history can be long and each page is a native view, so the TabView only
 * holds a window of pages around the photo on screen, recentred near its ends.
 */
import { Button, HStack, Spacer, TabView, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  onGeometryChange,
  padding,
  tabViewStyle,
} from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { glassButton } from '@/components/swiftui/glass';
import { PhotoPage, PhotoShareButton } from '@/components/swiftui/PhotoPage';
import { SwiftModal } from '@/components/swiftui/SwiftModal';
import { useCachedFinishedPhotoAppointments } from '@/hooks/useAppointments';
import { formatDateHeader } from '@/utils/groupByDate';
import { galleryItems, type GalleryFilter } from '@/utils/gallery';

/** Pages each side of the window's centre. */
const RADIUS = 4;
/** Each drawn page is a decoded image, so only the one on screen and its neighbours are. */
const DRAWN_PAGES_EACH_SIDE = 1;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function GalleryPhotoScreen() {
  const params = useLocalSearchParams<{ start?: string; filter?: GalleryFilter; query?: string }>();
  const appointments = useCachedFinishedPhotoAppointments();
  const items = useMemo(
    () => galleryItems(appointments, params.filter ?? 'all', params.query ?? ''),
    [appointments, params.filter, params.query]
  );
  const [selected, setSelected] = useState(params.start ?? '');
  const window = useWindowDimensions();
  const [page, setPage] = useState({ width: window.width, height: window.height * 0.7 });

  // The photos are gone (removed through 查看預約)
  useEffect(() => {
    if (items.length === 0) close();
  }, [items.length]);

  const found = items.findIndex((item) => item.path === selected);
  const index = Math.max(found, 0);
  const [center, setCenter] = useState(index);
  // During render, so the old window is never drawn around a far-off photo
  if (Math.abs(index - center) > RADIUS - 2) setCenter(index);
  const first = Math.max(center - RADIUS, 0);
  const pages = items.slice(first, center + RADIUS + 1);

  const current = items[index];
  if (!current) return null;

  return (
    <SwiftModal onClose={close}>
      <VStack spacing={0}>
        <TabView
          selection={current.path}
          onSelectionChange={(path) => setSelected(String(path))}
          modifiers={[
            tabViewStyle({ type: 'page', indexDisplayMode: 'never' }),
            onGeometryChange(({ width, height }) => setPage({ width, height })),
          ]}
        >
          {pages.map((item, i) => (
            <TabView.Tab key={item.path} value={item.path}>
              {/* Always here: TabView doesn't redraw when a Tab's own children change */}
              <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
                {Math.abs(first + i - index) <= DRAWN_PAGES_EACH_SIDE ? (
                  <PhotoPage path={item.path} width={page.width} height={page.height} />
                ) : null}
              </VStack>
            </TabView.Tab>
          ))}
        </TabView>

        <VStack spacing={10} modifiers={[padding({ horizontal: 16, vertical: 12 })]}>
          <HStack>
            <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{current.service}</Text>
            <Spacer />
            <Text
              modifiers={[
                font({ size: 13 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {`${formatDateHeader(current.date)} · ${index + 1} / ${items.length}`}
            </Text>
          </HStack>
          <HStack spacing={12}>
            <PhotoShareButton key={current.path} path={current.path} />
            <Spacer />
            <Button
              label="查看預約"
              systemImage="calendar"
              onPress={() =>
                router.push({
                  pathname: '/appointment-details',
                  params: { id: current.appointmentId },
                })
              }
              modifiers={[glassButton()]}
            />
          </HStack>
        </VStack>
      </VStack>
    </SwiftModal>
  );
}
