/**
 * 作品 — every booking's 完成作品 as a SwiftUI photo grid, newest first with a
 * header per month, filtered by 全部 / 整甲 / 眼睫毛 and customer name. Tapping
 * a photo opens gallery-photo. Photos are added in the booking's details.
 *
 * LazyVStack.ForEach only mounts the rows near the screen, so a long history
 * neither draws nor downloads every thumbnail at once. It reuses rows, which
 * is why each tile has a `key` of its path: its state belongs to that photo.
 */
import {
  Button,
  HStack,
  Image,
  LazyVStack,
  NavigationStack,
  Picker,
  ProgressView,
  ScrollView,
  Spacer,
  Text,
  useNativeState,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  aspectRatio,
  background,
  buttonStyle,
  clipped,
  font,
  foregroundStyle,
  frame,
  navigationTitle,
  padding,
  pickerStyle,
  refreshable,
  resizable,
  searchable,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { useHideTabBarOnScrollModifiers } from '@/components/swiftui/hideTabBarOnScroll';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { colors } from '@/constants/theme';
import { useFinishedPhotoAppointments } from '@/hooks/useAppointments';
import { usePhotoUri } from '@/hooks/usePhotoUri';
import { formatMonthTitle } from '@/utils/dates';
import {
  GALLERY_FILTERS,
  galleryItems,
  galleryRows,
  type GalleryFilter,
  type GalleryItem,
  type GalleryRow,
} from '@/utils/gallery';

const COLUMNS = 3;
const GAP = 2;

export default function GalleryScreen() {
  const { appointments, loading, error, reload } = useFinishedPhotoAppointments();
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const searchText = useNativeState('');
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const hideTabBarOnScroll = useHideTabBarOnScrollModifiers();

  const tile = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  const rows = useMemo(
    () => galleryRows(galleryItems(appointments, filter, query), COLUMNS),
    [appointments, filter, query]
  );

  const renderRow = useCallback(
    ({ item }: { item: GalleryRow }) =>
      item.type === 'month' ? (
        <MonthHeader month={item.month} count={item.count} />
      ) : (
        <HStack spacing={GAP} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          {item.items.map((photo) => (
            <Tile key={photo.path} photo={photo} size={tile} filter={filter} query={query} />
          ))}
        </HStack>
      ),
    [tile, filter, query]
  );

  if (loading) {
    return <SwiftStateView loading title="載入作品中…" systemImage="photo.on.rectangle" />;
  }
  if (error && appointments.length === 0) {
    return (
      <SwiftStateView
        title="未能載入作品"
        message={error}
        systemImage="exclamationmark.triangle"
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }

  return (
    <SwiftHost>
      <NavigationStack>
        <ScrollView
          modifiers={[
            navigationTitle('作品'),
            refreshable(() => reload()),
            ...hideTabBarOnScroll,
            searchable(searchText, { prompt: '搜尋顧客姓名', onChange: setQuery }),
          ]}
        >
          <LazyVStack spacing={GAP} alignment="leading">
            <Picker
              label="活動"
              selection={filter}
              onSelectionChange={(value) => setFilter(value as GalleryFilter)}
              modifiers={[pickerStyle('segmented'), padding({ horizontal: 16, vertical: 8 })]}
            >
              {GALLERY_FILTERS.map((option) => (
                <Text key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </Text>
              ))}
            </Picker>
            {rows.length === 0 ? (
              <Empty filtered={filter !== 'all' || query.trim() !== ''} />
            ) : (
              <LazyVStack.ForEach
                data={rows}
                keyExtractor={(row) => row.key}
                estimatedItemSize={tile}
              >
                {renderRow}
              </LazyVStack.ForEach>
            )}
          </LazyVStack>
        </ScrollView>
      </NavigationStack>
    </SwiftHost>
  );
}

function MonthHeader({ month, count }: { month: string; count: number }) {
  return (
    <HStack modifiers={[padding({ horizontal: 16, top: 14, bottom: 6 })]}>
      <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>{formatMonthTitle(month)}</Text>
      <Spacer />
      <Text
        modifiers={[font({ size: 13 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
      >
        {`${count} 張`}
      </Text>
    </HStack>
  );
}

const Tile = memo(function Tile({
  photo,
  size,
  filter,
  query,
}: {
  photo: GalleryItem;
  size: number;
  filter: GalleryFilter;
  query: string;
}) {
  const { uri, failed, retry } = usePhotoUri(photo.path, 'thumb');
  const label = `${photo.service} ${photo.date}`;

  return (
    <Button
      onPress={
        failed
          ? retry
          : () =>
              router.push({
                pathname: '/gallery-photo',
                params: { start: photo.path, filter, query },
              })
      }
      modifiers={[
        buttonStyle('plain'),
        accessibilityLabel(failed ? `${label}，載入失敗，按此重試` : label),
      ]}
    >
      <ZStack modifiers={[frame({ width: size, height: size }), background(colors.surfaceRaised)]}>
        {uri ? (
          <Image
            uiImage={uri}
            modifiers={[
              resizable(),
              aspectRatio({ contentMode: 'fill' }),
              frame({ width: size, height: size }),
              clipped(),
            ]}
          />
        ) : failed ? (
          <Image systemName="arrow.clockwise" size={20} color={colors.textSecondary} />
        ) : (
          <ProgressView />
        )}
      </ZStack>
    </Button>
  );
});

function Empty({ filtered }: { filtered: boolean }) {
  return (
    <VStack spacing={8} modifiers={[frame({ maxWidth: Infinity }), padding({ all: 32 })]}>
      <Image systemName="photo.on.rectangle" size={36} color={colors.textTertiary} />
      <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>
        {filtered ? '沒有符合的作品' : '未有完成作品'}
      </Text>
      {filtered ? null : (
        <Text
          modifiers={[
            font({ size: 14 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
          ]}
        >
          在預約詳情加入完成作品後，會顯示在這裡
        </Text>
      )}
    </VStack>
  );
}
