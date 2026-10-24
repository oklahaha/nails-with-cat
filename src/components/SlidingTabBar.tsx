/**
 * The standard bottom tab bar (Android, web), floating over the screens so it
 * can slide down out of view while useTabBarHidden is true and slide back up
 * when it turns false. Floating keeps the screens' size fixed, so the slide is
 * a pure transform on the native driver with no layout pass; screens pad their
 * scroll content by useTabBarInset() instead.
 */
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Animated, Easing, Platform, StyleSheet, type LayoutChangeEvent } from 'react-native';

import { useTabBarVisibility } from '@/hooks/useTabBarVisibility';

const useNativeDriver = Platform.OS !== 'web';

export function SlidingTabBar(props: BottomTabBarProps) {
  const { hidden, inset, setInset, progress } = useTabBarVisibility();

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: hidden ? 1 : 0,
      duration: hidden ? 220 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [hidden, progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    if (height !== inset) setInset(height);
  };

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[
        styles.bar,
        {
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, inset + StyleSheet.hairlineWidth],
              }),
            },
          ],
        },
      ]}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
