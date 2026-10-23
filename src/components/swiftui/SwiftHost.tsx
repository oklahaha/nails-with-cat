/**
 * Shared Host wrapper for SwiftUI screens — dark color scheme + salmon seed tint.
 */
import { Host, type HostProps } from '@expo/ui/swift-ui';

import { colors } from '@/constants/theme';

type Props = Omit<HostProps, 'colorScheme' | 'seedColor'> & {
  seedColor?: HostProps['seedColor'];
};

export function SwiftHost({ style, seedColor = colors.accent, children, ...rest }: Props) {
  return (
    <Host colorScheme="dark" seedColor={seedColor} style={[{ flex: 1 }, style]} {...rest}>
      {children}
    </Host>
  );
}
