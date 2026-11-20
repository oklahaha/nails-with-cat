/**
 * 可約時間 (iOS), opened from the 時間表's week view: the open times as the Instagram
 * story (AvailabilityPoster, captured to a PNG and previewed as that exact image), shared
 * through the share sheet (Instagram, 儲存影像), plus the text version for WhatsApp.
 */
import {
  Button,
  DatePicker,
  Image,
  List,
  ProgressView,
  Section,
  Label,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  aspectRatio,
  disabled,
  environment,
  frame,
  listStyle,
  resizable,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Share, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import { AvailabilityPoster, POSTER_HEIGHT, POSTER_WIDTH } from '@/components/AvailabilityPoster';
import { SwiftModal } from '@/components/swiftui/SwiftModal';
import { SwiftStateContent } from '@/components/swiftui/SwiftStateView';
import { dateToIso, isoToDate } from '@/components/swiftui/dateIso';
import { colors } from '@/constants/theme';
import { useAvailableSlots } from '@/hooks/useAvailableSlots';
import { showAlert } from '@/utils/alert';
import { dayMonth, slotsText } from '@/utils/availableSlots';

const PICKER_LOOK = [tint(colors.accent), environment('locale', 'zh_Hant_HK')];

function close() {
  if (router.canGoBack()) router.back();
}

export default function AvailableSlotsScreen() {
  const { week } = useLocalSearchParams<{ week?: string }>();
  const { from, to, latestTo, setTo, days, loading, error, ready, syncError, reload, shareIfCurrent } =
    useAvailableSlots(week);
  // Holds everything the poster shows, so it also says when the poster has changed
  const text = useMemo(() => slotsText(days), [days]);

  const posterRef = useRef<ComponentRef<typeof View>>(null);
  // Each capture remembers the text it was made for, so an older image is never shown or shared
  const [capture, setCapture] = useState<{ text: string; uri?: string; failed?: boolean }>();
  // Every PNG made here (raw paths), deleted when the screen closes; not sooner, since the
  // share sheet may still be reading an older one
  const made = useRef<string[]>([]);
  useEffect(() => () => made.current.forEach(releaseCapture), []);
  const [sharing, setSharing] = useState(false);
  const image = capture?.text === text ? capture.uri : undefined;
  const captureFailed = capture?.text === text && capture.failed;

  // Re-capture whenever the poster changes, once it has been drawn
  useEffect(() => {
    if (loading || days.length === 0) return;
    let cancelled = false;
    const fail = () => !cancelled && setCapture({ text, failed: true });
    const timer = setTimeout(() => {
      try {
        // view-shot sizes in points, times the screen scale: this makes exactly 1080 × 1920 px
        const scale = PixelRatio.get();
        captureRef(posterRef, {
          format: 'png',
          width: 1080 / scale,
          height: 1920 / scale,
          result: 'tmpfile',
        })
          .then((path) => {
            if (cancelled) return releaseCapture(path); // superseded before it landed
            made.current.push(path);
            setCapture({ text, uri: path.startsWith('file://') ? path : `file://${path}` });
          })
          .catch(fail);
      } catch {
        fail(); // a build without the native module throws before returning a promise
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, days.length, loading]);

  // Checks the sheet once more first, then shares (the image, or the text for WhatsApp)
  const share = async (content: { url: string } | { message: string }) => {
    if (!ready || sharing) return;
    setSharing(true);
    try {
      await shareIfCurrent(text, () => Share.share(content));
    } catch {
      showAlert('未能分享', '請再試一次');
    } finally {
      setSharing(false);
    }
  };
  const canShare = ready && !sharing;

  return (
    <View style={{ flex: 1 }}>
      {/* Drawn off screen at story size; the preview is the captured PNG */}
      <View style={{ position: 'absolute', left: -10000, top: 0 }} pointerEvents="none">
        <AvailabilityPoster ref={posterRef} from={from} to={to} days={days} />
      </View>
      <SwiftModal onClose={close}>
        {loading ? (
          <SwiftStateContent loading title="計算可約時間中…" />
        ) : error ? (
          <SwiftStateContent
            title="未能載入預約"
            message={error}
            systemImage="exclamationmark.triangle"
            action={{ label: '重試', onPress: () => void reload() }}
          />
        ) : (
          <List modifiers={[listStyle('insetGrouped')]}>
            <Section
              footer={
                <Text>
                  按規則計算：星期三休息、每日最多 4 個項目及 8 小時、客與客之間 15 分鐘，3 個客以上留 1 小時食飯。已約時間會劃走顯示。
                </Text>
              }
            >
              {image ? (
                <Image
                  uiImage={image}
                  modifiers={[
                    resizable(),
                    aspectRatio({ ratio: POSTER_WIDTH / POSTER_HEIGHT, contentMode: 'fit' }),
                    frame({ maxWidth: Infinity, minHeight: 460, maxHeight: 460 }),
                  ]}
                />
              ) : captureFailed ? (
                <Text>未能製作圖片，請更新到最新版本再試</Text>
              ) : (
                <VStack modifiers={[frame({ maxWidth: Infinity, minHeight: 460, maxHeight: 460 })]}>
                  <ProgressView />
                </VStack>
              )}
            </Section>

            <Section title={`由 ${dayMonth(from)} 起`}>
              <DatePicker
                title="至"
                selection={isoToDate(to)}
                displayedComponents={['date']}
                range={{ start: isoToDate(from), end: isoToDate(latestTo) }}
                onDateChange={(d) => setTo(dateToIso(d))}
                // Locked while a share checks the sheet, so it can't send another range
                modifiers={[...PICKER_LOOK, disabled(sharing)]}
              />
            </Section>

            <Section
              footer={
                ready ? undefined : (
                  <Text>
                    {syncError
                      ? `未能同步最新預約（${syncError}），另一部手機的新預約可能未計入，暫時不能分享。`
                      : '同步最新預約中，完成後就可以分享…'}
                  </Text>
                )
              }
            >
              {canShare && image ? (
                <Button onPress={() => void share({ url: image })} modifiers={[tint(colors.accent)]}>
                  <Label title="分享 IG 限時動態圖" systemImage="photo.on.rectangle" />
                </Button>
              ) : (
                <Label title="分享 IG 限時動態圖" systemImage="photo.on.rectangle" color={colors.textTertiary} />
              )}
              {canShare ? (
                <Button onPress={() => void share({ message: text })} modifiers={[tint(colors.accent)]}>
                  <Label title="分享文字版（WhatsApp）" systemImage="text.bubble" />
                </Button>
              ) : (
                <Label title="分享文字版（WhatsApp）" systemImage="text.bubble" color={colors.textTertiary} />
              )}
              {sharing ? <Text>檢查最新預約中…</Text> : null}
              {syncError && !ready ? (
                <Button label="重試同步" onPress={() => void reload()} modifiers={[tint(colors.accent)]} />
              ) : null}
            </Section>
          </List>
        )}
      </SwiftModal>
    </View>
  );
}
