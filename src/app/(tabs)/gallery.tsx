/**
 * 作品 tab (Android, web) — every booking's 完成作品 as a photo grid, newest
 * first with a header per month, filtered by 全部 / 整甲 / 眼睫毛 and customer
 * name. Tapping a photo opens gallery-photo. Photos are added in the booking's
 * details.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { StateView } from '@/components/StateView';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { useFinishedPhotoAppointments } from '@/hooks/useAppointments';
import { usePhotoUri } from '@/hooks/usePhotoUri';
import { useHideTabBarOnScroll, useTabBarInset } from '@/hooks/useTabBarVisibility';
import { formatMonthTitle } from '@/utils/dates';
import {
  GALLERY_FILTERS,
  galleryItems,
  galleryRows,
  type GalleryFilter,
  type GalleryItem,
} from '@/utils/gallery';

const COLUMNS = 3;
const GAP = 2;

export default function GalleryScreen() {
  const { appointments, loading, error, reload } = useFinishedPhotoAppointments();
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const { scrollHandlers } = useHideTabBarOnScroll();
  const tabBarInset = useTabBarInset();

  const tile = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  const rows = useMemo(
    () => galleryRows(galleryItems(appointments, filter, query), COLUMNS),
    [appointments, filter, query]
  );

  if (loading) return <StateView loading title="載入作品中…" />;
  if (error && appointments.length === 0) {
    return (
      <StateView
        icon="gallery"
        title="未能載入作品"
        message={error}
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }

  const filtered = filter !== 'all' || query.trim() !== '';

  return (
    <FlatList
      style={styles.flex}
      data={rows}
      keyExtractor={(row) => row.key}
      contentContainerStyle={{ paddingBottom: tabBarInset + spacing.md }}
      keyboardShouldPersistTaps="handled"
      {...scrollHandlers}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.accent}
          colors={[colors.accent]}
          onRefresh={() => {
            setRefreshing(true);
            void reload().finally(() => setRefreshing(false));
          }}
        />
      }
      ListHeaderComponent={
        <View style={styles.controls}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="搜尋顧客姓名"
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
            returnKeyType="search"
          />
          <View style={styles.segmented}>
            {GALLERY_FILTERS.map((option) => {
              const selected = filter === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFilter(option.value)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        <StateView
          icon="gallery"
          title={filtered ? '沒有符合的作品' : '未有完成作品'}
          message={filtered ? undefined : '在預約詳情加入完成作品後，會顯示在這裡'}
        />
      }
      renderItem={({ item }) =>
        item.type === 'month' ? (
          <View style={styles.month}>
            <Text style={styles.monthTitle}>{formatMonthTitle(item.month)}</Text>
            <Text style={styles.monthCount}>{`${item.count} 張`}</Text>
          </View>
        ) : (
          <View style={styles.row}>
            {item.items.map((photo) => (
              <Tile key={photo.path} photo={photo} size={tile} filter={filter} query={query} />
            ))}
          </View>
        )
      }
    />
  );
}

function Tile({
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
    <Pressable
      onPress={
        failed
          ? retry
          : () =>
              router.push({
                pathname: '/gallery-photo',
                params: { start: photo.path, filter, query },
              })
      }
      style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && pressedStyle]}
      accessibilityRole="button"
      accessibilityLabel={failed ? `${label}，載入失敗，按此重試` : label}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : failed ? (
        <Icon name="refresh" color={colors.textSecondary} size={20} />
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  controls: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xs,
  },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
  },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: colors.surfaceRaised,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  segmentTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  month: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs + 2,
  },
  monthTitle: {
    ...type.body,
    fontWeight: '700',
  },
  monthCount: {
    ...type.caption,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
});
