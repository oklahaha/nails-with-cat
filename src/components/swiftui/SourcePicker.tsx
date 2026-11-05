/** 來源 (how the customer found the studio) as a SwiftUI menu picker, with 未記錄 for none. */
import { Picker, Text } from '@expo/ui/swift-ui';
import { tag } from '@expo/ui/swift-ui/modifiers';

import { CUSTOMER_SOURCES } from '@/constants/customerSources';

/** The tag for "not recorded": a Picker tag can't be empty. */
const NO_SOURCE = 'none';

export function SourcePicker({ value, onChange }: { value: string; onChange: (source: string) => void }) {
  return (
    <Picker
      label="來源"
      selection={value || NO_SOURCE}
      onSelectionChange={(picked) => {
        if (typeof picked === 'string') onChange(picked === NO_SOURCE ? '' : picked);
      }}
    >
      <Text modifiers={[tag(NO_SOURCE)]}>未記錄</Text>
      {CUSTOMER_SOURCES.map((s) => (
        <Text key={s} modifiers={[tag(s)]}>
          {s}
        </Text>
      ))}
    </Picker>
  );
}
