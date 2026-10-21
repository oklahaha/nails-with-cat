import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { SERVICES, type ServiceType, serviceColor } from '@/constants/services';
import { colors, radius, spacing, type } from '@/constants/theme';

type Props = {
  /** '' when nothing is picked yet. Old rows may hold a service not in the list. */
  value: ServiceType | '';
  onChange: (service: ServiceType) => void;
  invalid?: boolean;
};

/** Dropdown of the 活動 options; the list opens inline below the field. */
export function ServicePicker({ value, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={[styles.field, invalid && styles.fieldInvalid]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={value ? `活動：${value}` : '選擇活動'}
      >
        {value ? (
          <>
            <View style={[styles.dot, { backgroundColor: serviceColor(value) }]} />
            <Text style={styles.value}>{value}</Text>
          </>
        ) : (
          <Text style={styles.placeholder}>請選擇活動</Text>
        )}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} color={colors.textSecondary} size={18} />
      </Pressable>

      {open ? (
        <View style={styles.list}>
          {SERVICES.map(({ name }, i) => {
            const selected = value === name;
            return (
              <Pressable
                key={name}
                onPress={() => {
                  setOpen(false);
                  onChange(name);
                }}
                style={({ pressed }) => [
                  styles.option,
                  i > 0 && styles.optionDivider,
                  pressed && styles.optionPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={[styles.dot, { backgroundColor: serviceColor(name) }]} />
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {name}
                </Text>
                {selected ? <Icon name="check" color={colors.accent} size={18} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  fieldInvalid: {
    borderColor: colors.danger,
  },
  value: {
    ...type.body,
    flex: 1,
    fontWeight: '600',
  },
  placeholder: {
    flex: 1,
    fontSize: 16,
    color: colors.textTertiary,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  list: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  optionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  optionPressed: {
    backgroundColor: colors.border,
  },
  optionText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },
});
