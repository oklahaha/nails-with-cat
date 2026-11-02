/** One full-screen photo in the Android and web viewers, as wide as the screen. */
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { usePhotoUri } from '@/hooks/usePhotoUri';

export function PhotoPage({ path, width }: { path: string; width: number }) {
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
});
