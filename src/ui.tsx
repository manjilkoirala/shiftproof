import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
export const theme = {
  ink: "#193B35",
  muted: "#75847F",
  green: "#147D69",
  pale: "#E6F1EC",
  bg: "#F5F7F3",
  line: "#E1E7E1",
  red: "#B04444",
};
export const Icon = ({
  name,
  color = theme.ink,
  size = 20,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  color?: string;
  size?: number;
}) => <Feather name={name} size={size} color={color} />;
export function Txt({
  children,
  size = 14,
  color = theme.ink,
  bold = false,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  bold?: boolean;
  style?: any;
}) {
  return (
    <Text
      style={[
        {
          color,
          fontSize: size,
          fontWeight: bold ? "700" : "400",
          lineHeight: size * 1.45,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary,
  danger,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Icon>["name"];
}) {
  const color = secondary ? (danger ? theme.red : theme.ink) : "#FFF";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary
            ? theme.pale
            : danger
              ? theme.red
              : theme.green,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon && <Icon name={icon} color={color} size={18} />}
      <Txt color={color} bold>
        {title}
      </Txt>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  numeric,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <View style={{ gap: 6, flexGrow: 1 }}>
      <Txt size={12} bold>
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        autoCapitalize="none"
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 80, textAlignVertical: "top" },
        ]}
      />
      {hint && (
        <Txt size={11} color={theme.muted}>
          {hint}
        </Txt>
      )}
    </View>
  );
}
export function Chips<T extends string>({
  values,
  selected,
  onSelect,
}: {
  values: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      {values.map((v) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: v.value === selected }}
          onPress={() => onSelect(v.value)}
          key={v.value}
          style={[
            styles.chip,
            selected === v.value && {
              backgroundColor: theme.ink,
              borderColor: theme.ink,
            },
          ]}
        >
          <Txt size={12} bold color={selected === v.value ? "#FFF" : theme.ink}>
            {v.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
export function Empty({
  icon = "calendar",
  title,
  detail,
}: {
  icon?: React.ComponentProps<typeof Icon>["name"];
  title: string;
  detail: string;
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 30, gap: 10 }}>
      <View
        style={{ padding: 16, borderRadius: 25, backgroundColor: theme.pale }}
      >
        <Icon name={icon} size={26} color={theme.green} />
      </View>
      <Txt bold size={18}>
        {title}
      </Txt>
      <Txt color={theme.muted} style={{ textAlign: "center", maxWidth: 300 }}>
        {detail}
      </Txt>
    </View>
  );
}
export const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.line,
    gap: 16,
  },
  button: {
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  input: {
    backgroundColor: "#F7F9F6",
    borderColor: "#D7E0D9",
    borderWidth: 1,
    borderRadius: 11,
    minHeight: 47,
    padding: 12,
    color: theme.ink,
    fontSize: 15,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#FFF",
  },
  section: { gap: 16 },
});
