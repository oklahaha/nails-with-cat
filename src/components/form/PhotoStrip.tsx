/**
 * Booking photos on Android and web: a strip of thumbnails ending in a ＋ tile,
 * or one 加入 row when there are none. `BookingPhotos` is the version for a
 * saved booking, where photos upload as soon as they're picked; the new-booking
 * form uses `PhotoStrip` directly, with drafts.
 */
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { addPhotos } from '@/hooks/appointmentWrites';
import { useAddPhotos } from '@/hooks/useAddPhotos';
import { useLiveAppointment, usePendingPhotos } from '@/hooks/useAppointments';
import { usePhotoUri } from '@/hooks/usePhotoUri';
import type { PhotoSource } from '@/services/photoPicker';
import type { Appointment } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { openPhotoViewer } from '@/utils/appointmentActions';
import { PHOTO_KINDS, photosOf, type PhotoKind } from '@/utils/appointmentPhotos';

const THUMB = 84;

type Props = {
  kind: PhotoKind;
  paths: string[];
  pending?: ReadonlySet<string>;
  adding: boolean;
  canAdd: boolean;
  onAdd: (source: PhotoSource) => void;
  onOpen: (path: string) => void;
  /** Adds a ✕ to each thumbnail; left out where the viewer removes them. */
  onRemove?: (path: string) => void;
};

export function PhotoStrip({ kind, paths, pending, adding, canAdd, onAdd, onOpen, onRemove }: Props) {
  const { title } = PHOTO_KINDS[kind];

  const chooseSource = () => {
    // Browsers offer the camera inside their own file picker
    if (Platform.OS === 'web') {
      onAdd('library');
      return;
    }
    showAlert(`加入${title}`, undefined, [
      { text: '取消', style: 'cancel' },
      { text: '影相', onPress: () => onAdd('camera') },
      { text: '從相簿揀選', onPress: () => onAdd('library') },
    ]);
  };

  if (paths.length === 0) {
    return (
      <Pressable
        onPress={chooseSource}
        disabled={adding}
        style={({ pressed }) => [styles.addRow, pressed && pressedStyle]}
        accessibilityRole="button"
      >
        {adding ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Icon name="add" color={colors.accent} size={20} />
        )}
        <Text style={styles.addText}>{`加入${title}`}</Text>
      </Pressable>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {paths.map((path, i) => (
        <Thumbnail
          key={path}
          path={path}
          label={`${title} ${i + 1}`}
          uploading={pending?.has(path) ?? false}
          onOpen={() => onOpen(path)}
          onRemove={onRemove && (() => onRemove(path))}
        />
      ))}
      {canAdd ? (
        <Pressable
          onPress={chooseSource}
          disabled={adding}
          style={({ pressed }) => [styles.tile, styles.addTile, pressed && pressedStyle]}
          accessibilityRole="button"
          accessibilityLabel={`加入${title}`}
        >
          {adding ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Icon name="add" color={colors.accent} size={24} />
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Thumbnail({
  path,
  label,
  uploading,
  onOpen,
  onRemove,
}: {
  path: string;
  label: string;
  uploading: boolean;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  const { uri, failed, retry } = usePhotoUri(path, 'thumb');

  return (
    <View>
      <Pressable
        onPress={failed ? retry : onOpen}
        style={({ pressed }) => [styles.tile, pressed && pressedStyle]}
        accessibilityRole="button"
        accessibilityLabel={failed ? `${label}，載入失敗，按此重試` : label}
      >
        {uri ? (
          <Image source={{ uri }} style={[styles.photo, uploading && styles.uploading]} />
        ) : failed ? (
          <Icon name="refresh" color={colors.textSecondary} size={20} />
        ) : null}
        {uploading || (!uri && !failed) ? (
          <ActivityIndicator color={colors.accent} style={StyleSheet.absoluteFill} />
        ) : null}
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={styles.remove}
          accessibilityRole="button"
          accessibilityLabel={`移除${label}`}
        >
          <Icon name="close" color={colors.text} size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A saved booking's titled photos: picked ones upload straight away, without 修改. */
export function BookingPhotos({ appointment, kind }: { appointment: Appointment; kind: PhotoKind }) {
  const live = useLiveAppointment(appointment.id) ?? appointment;
  const paths = photosOf(live, kind);
  const pending = usePendingPhotos();
  const { add, adding, canAdd } = useAddPhotos(kind, paths.length, (picked) =>
    addPhotos(live, kind, picked)
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{PHOTO_KINDS[kind].title}</Text>
      <PhotoStrip
        kind={kind}
        paths={paths}
        pending={pending}
        adding={adding}
        canAdd={canAdd}
        onAdd={(source) => void add(source)}
        onOpen={(path) => openPhotoViewer({ kind, start: path, paths, appointmentId: appointment.id })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...type.label,
    marginBottom: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  addText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  strip: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingRight: spacing.xs,
  },
  tile: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  addTile: {
    backgroundColor: colors.surface,
  },
  photo: {
    width: THUMB,
    height: THUMB,
  },
  uploading: {
    opacity: 0.5,
  },
  remove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
});
