/**
 * Full-screen 作品 (Android and web): swipe through the photos the grid was
 * showing, across bookings. Each shows its service and date but not the
 * customer, as this is what gets shown to other customers; 查看預約 opens the
 * booking, which is also where a photo is removed.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoPage } from '@/components/form/PhotoPage';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { useCachedFinishedPhotoAppointments } from '@/hooks/useAppointments';
import { formatDateHeader } from '@/utils/groupByDate';
import { galleryItems, type GalleryFilter } from '@/utils/gallery';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function GalleryPhotoScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ start?: string; filter?: GalleryFilter; query?: string }>();
  const appointments = useCachedFinishedPhotoAppointments();
  const items = useMemo(
    () => galleryItems(appointments, params.filter ?? 'all', params.query ?? ''),
    [appointments, params.filter, params.query]
  );
  const [selected, setSelected] = useState(params.start ?? '');
  const [startIndex] = useState(() =>
    Math.max(items.findIndex((item) => item.path === params.start), 0)
  );

  useEffect(() => {
    if (items.length === 0) close();
  }, [items.length]);

  const index = Math.max(items.findIndex((item) => item.path === selected), 0);
  const current = items[index];
  if (!current) return null;

  return (
    <View style={styles.flex}>
      <FlatList
        style={styles.flex}
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.path}
        initialScrollIndex={startIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        windowSize={3}
        onMomentumScrollEnd={(e) => {
          const item = items[Math.round(e.nativeEvent.contentOffset.x / width)];
          if (item) setSelected(item.path);
        }}
        renderItem={({ item }) => <PhotoPage path={item.path} width={width} />}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.caption}>
          <Text style={styles.service}>{current.service}</Text>
          <Text style={styles.date}>
            {`${formatDateHeader(current.date)} · ${index + 1} / ${items.length}`}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/appointment-details', params: { id: current.appointmentId } })
          }
          style={({ pressed }) => [styles.button, pressed && pressedStyle]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>查看預約</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  footer: {
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  service: {
    ...type.body,
    fontWeight: '700',
  },
  date: {
    ...type.caption,
  },
  button: {
    alignItems: 'center',
    paddingVertical: spacing.md - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
  },
  buttonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
