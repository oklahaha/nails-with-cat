import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

/** SF Symbol (iOS) / Material Symbol (Android, web) names for each icon. */
const ICONS = {
  add: { ios: 'plus', android: 'add', web: 'add' },
  customers: { ios: 'person.text.rectangle', android: 'badge', web: 'badge' },
  list: { ios: 'list.bullet', android: 'list', web: 'list' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  chat: { ios: 'message.fill', android: 'chat', web: 'chat' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  person: { ios: 'person', android: 'person', web: 'person' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  chevronUp: { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' },
} as const;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  color: ColorValue;
  size?: number;
};

export function Icon({ name, color, size = 24 }: Props) {
  return <SymbolView name={ICONS[name]} tintColor={color} size={size} />;
}
