/**
 * Full-screen booking photos (Android and web): swipe between them; for a
 * saved booking, 移除 takes the photo off it.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { colors, pressedStyle, radius, spacing } from '@/constants/theme';
import { removePhoto } from '@/hooks/appointmentWrites';
import { useLiveAppointment } from '@/hooks/useAppointments';
import { usePhotoUri } from '@/hooks/usePhotoUri';
import { showAlert } from '@/utils/alert';
import { photosOf, type PhotoKind } from '@/utils/appointmentPhotos';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function AppointmentPhotoScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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

  useEffect(() => {
    if (paths.length === 0) close();
  }, [paths.length]);

  const current = paths.includes(selected) ? selected : paths[0];

  const confirmRemove = () => {
    if (!live || !current) return;
    showAlert('移除此相片？', '相片會由此預約移除，並移到 Google Drive 的垃圾桶。', [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: () => removePhoto(live, params.kind, current),
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <FlatList
        style={styles.flex}
        data={paths}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(path) => path}
        initialScrollIndex={Math.max(paths.indexOf(params.start ?? ''), 0)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const path = paths[Math.round(e.nativeEvent.contentOffset.x / width)];
          if (path) setSelected(path);
        }}
        renderItem={({ item }) => <PhotoPage path={item} width={width} />}
      />
      {live ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable
            onPress={confirmRemove}
            style={({ pressed }) => [styles.removeBtn, pressed && pressedStyle]}
            accessibilityRole="button"
          >
            <Icon name="trash" color={colors.danger} size={18} />
            <Text style={styles.removeText}>移除</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function PhotoPage({ path, width }: { path: string; width: number }) {
  const { uri, failed, retry } = usePhotoUri(path, 'full');
  return (
    <View style={[styles.page, { width }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.photo} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : failed ? (
        <Pressable onPress={retry} accessibilityRole="button">
          <Text style={styles.failed}>未能載入相片，按此重試</Text>
        </Pressable>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  failed: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
});
