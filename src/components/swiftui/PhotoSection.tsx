/**
 * A Form section of booking photos (SwiftUI): a row that opens the picker when
 * empty, then a strip of thumbnails ending in a ＋ tile. `BookingPhotoSection`
 * is the version for a saved booking, where photos upload as soon as they're
 * picked; the new-booking form uses `PhotoSection` directly, with drafts.
 */
import {
  Button,
  HStack,
  Image,
  Menu,
  ProgressView,
  ScrollView,
  Section,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  aspectRatio,
  background,
  buttonStyle,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  opacity,
  resizable,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/constants/theme';
import { addPhotos } from '@/hooks/appointmentWrites';
import { useAddPhotos } from '@/hooks/useAddPhotos';
import { useLiveAppointment, usePendingPhotos } from '@/hooks/useAppointments';
import { usePhotoUri } from '@/hooks/usePhotoUri';
import type { PhotoSource } from '@/services/photoPicker';
import type { Appointment } from '@/types/appointment';
import { openPhotoViewer } from '@/utils/appointmentActions';
import { PHOTO_KINDS, photosOf, type PhotoKind } from '@/utils/appointmentPhotos';

const THUMB = 84;
const CORNER = 10;

type Props = {
  kind: PhotoKind;
  paths: string[];
  /** Shown under the section while there are no photos. */
  hint?: string;
  pending?: ReadonlySet<string>;
  adding: boolean;
  canAdd: boolean;
  onAdd: (source: PhotoSource) => void;
  /** Opens the viewer at this photo. */
  onOpen: (path: string) => void;
  /** Adds a ✕ to each thumbnail; left out where the viewer removes them. */
  onRemove?: (path: string) => void;
};

export function PhotoSection({
  kind,
  paths,
  hint,
  pending,
  adding,
  canAdd,
  onAdd,
  onOpen,
  onRemove,
}: Props) {
  const { title } = PHOTO_KINDS[kind];
  const sources = (
    <>
      <Button label="從相簿揀選" systemImage="photo.on.rectangle" onPress={() => onAdd('library')} />
      <Button label="影相" systemImage="camera" onPress={() => onAdd('camera')} />
    </>
  );

  return (
    <Section
      title={title}
      footer={paths.length === 0 && hint ? <Text>{hint}</Text> : undefined}
    >
      {paths.length === 0 ? (
        <Menu
          label={
            <HStack
              spacing={10}
              modifiers={[frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}
            >
              {adding ? (
                <ProgressView />
              ) : (
                <Image systemName="photo.badge.plus" size={18} color={colors.accent} />
              )}
              <Text modifiers={[foregroundStyle(colors.accent)]}>{`加入${title}`}</Text>
              <Spacer />
            </HStack>
          }
        >
          {sources}
        </Menu>
      ) : (
        <ScrollView axes="horizontal" showsIndicators={false}>
          <HStack spacing={8}>
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
              <Menu
                label={
                  <VStack
                    modifiers={[
                      frame({ width: THUMB, height: THUMB }),
                      background(colors.surfaceRaised),
                      clipShape('roundedRectangle', CORNER),
                      contentShape(shapes.rectangle()),
                      accessibilityLabel(`加入${title}`),
                    ]}
                  >
                    {adding ? (
                      <ProgressView />
                    ) : (
                      <Image systemName="plus" size={22} color={colors.accent} />
                    )}
                  </VStack>
                }
              >
                {sources}
              </Menu>
            ) : null}
          </HStack>
        </ScrollView>
      )}
    </Section>
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

  const tile = (
    <Button
      onPress={failed ? retry : onOpen}
      modifiers={[buttonStyle('plain'), accessibilityLabel(failed ? `${label}，載入失敗，按此重試` : label)]}
    >
      <ZStack
        modifiers={[
          frame({ width: THUMB, height: THUMB }),
          background(colors.surfaceRaised),
          clipShape('roundedRectangle', CORNER),
        ]}
      >
        {uri ? (
          <Image
            uiImage={uri}
            modifiers={[
              resizable(),
              aspectRatio({ contentMode: 'fill' }),
              frame({ width: THUMB, height: THUMB }),
              clipShape('roundedRectangle', CORNER),
              ...(uploading ? [opacity(0.5)] : []),
            ]}
          />
        ) : failed ? (
          <Image systemName="arrow.clockwise" size={20} color={colors.textSecondary} />
        ) : null}
        {uploading || (!uri && !failed) ? <ProgressView /> : null}
      </ZStack>
    </Button>
  );

  if (!onRemove) return tile;
  return (
    <ZStack alignment="topTrailing">
      {tile}
      <Button
        onPress={onRemove}
        modifiers={[buttonStyle('plain'), accessibilityLabel(`移除${label}`)]}
      >
        <Image systemName="xmark.circle.fill" size={22} color={colors.text} />
      </Button>
    </ZStack>
  );
}

/** A saved booking's photos: picked ones upload straight away, without 修改. */
export function BookingPhotoSection({
  appointment,
  kind,
  hint,
}: {
  appointment: Appointment;
  kind: PhotoKind;
  hint?: string;
}) {
  const live = useLiveAppointment(appointment.id) ?? appointment;
  const paths = photosOf(live, kind);
  const pending = usePendingPhotos();
  const { add, adding, canAdd } = useAddPhotos(kind, paths.length, (picked) =>
    addPhotos(live, kind, picked)
  );

  return (
    <PhotoSection
      kind={kind}
      paths={paths}
      hint={hint}
      pending={pending}
      adding={adding}
      canAdd={canAdd}
      onAdd={(source) => void add(source)}
      onOpen={(path) =>
        openPhotoViewer({ kind, start: path, paths, appointmentId: appointment.id })
      }
    />
  );
}
