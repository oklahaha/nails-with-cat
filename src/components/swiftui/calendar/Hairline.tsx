import { Rectangle } from '@expo/ui/swift-ui';
import { foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/constants/theme';

const THICKNESS = 1 / 3;

/** A calendar grid line, filling the other axis. */
export function Hairline({ axis }: { axis: 'horizontal' | 'vertical' }) {
  return (
    <Rectangle
      modifiers={[
        frame(axis === 'horizontal' ? { height: THICKNESS } : { width: THICKNESS }),
        foregroundStyle(colors.border),
      ]}
    />
  );
}
