/**
 * 可約時間 (Android / web): the poster to look at and the text version to share. The
 * 時間表 only links here on iOS, where the story image is made (available-slots.ios.tsx).
 */
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AvailabilityPoster } from '@/components/AvailabilityPoster';
import { StateView } from '@/components/StateView';
import { colors, radius, spacing } from '@/constants/theme';
import { useAvailableSlots } from '@/hooks/useAvailableSlots';
import { showAlert } from '@/utils/alert';
import { slotsText } from '@/utils/availableSlots';

async function shareText(text: string) {
  try {
    await Share.share({ message: text });
    return;
  } catch {
    // Browsers without navigator.share: copy it instead
  }
  try {
    if (Platform.OS !== 'web' || !navigator.clipboard) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
    showAlert('已複製文字版');
  } catch {
    showAlert('未能分享', '請再試一次');
  }
}

export default function AvailableSlotsScreen() {
  const { week } = useLocalSearchParams<{ week?: string }>();
  const { from, to, days, loading, error, ready, syncError, reload, shareIfCurrent } =
    useAvailableSlots(week);
  const text = useMemo(() => slotsText(days), [days]);
  // Browsers only share or copy straight from a tap, and the sheet check takes longer than
  // that allows: on web the first tap checks, and a second tap shares what it checked
  const [checked, setChecked] = useState<string>();
  const twoStep = Platform.OS === 'web';
  const verified = twoStep && checked === text;
  const onShare = () => {
    if (verified) {
      setChecked(undefined); // the next share checks again
      void shareText(text);
    }
    else if (twoStep) void shareIfCurrent(text, async () => setChecked(text));
    else void shareIfCurrent(text, () => shareText(text));
  };

  if (loading) return <StateView loading title="計算可約時間中…" />;
  if (error) {
    return (
      <StateView
        title="未能載入預約"
        message={error}
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AvailabilityPoster from={from} to={to} days={days} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        style={[styles.button, !ready && { opacity: 0.4 }]}
        onPress={onShare}
      >
        <Text style={styles.buttonText}>
          {verified ? '已核對，分享文字版' : twoStep ? '核對最新預約' : '分享文字版'}
        </Text>
      </Pressable>
      {ready ? null : (
        <Text style={styles.hint}>
          {syncError ? `未能同步最新預約（${syncError}），暫時不能分享` : '同步最新預約中…'}
        </Text>
      )}
      {syncError && !ready ? (
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void reload()}>
          <Text style={styles.buttonText}>重試同步</Text>
        </Pressable>
      ) : null}
      <View style={{ height: spacing.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { alignItems: 'center', padding: spacing.md, gap: spacing.md },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  buttonText: { color: colors.text, fontWeight: '600' },
  hint: { color: colors.textSecondary, textAlign: 'center' },
});
