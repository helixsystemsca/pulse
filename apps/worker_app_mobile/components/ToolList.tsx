import { StyleSheet, View } from "react-native";
import { ToolItem } from "@/components/ToolItem";
import type { ToolItemData } from "@/utils/uiTypes";
import { space } from "@/utils/designTokens";

export type ToolListProps = {
  items: ToolItemData[];
  onItemPress?: (id: string) => void;
};

export function ToolList({ items, onItemPress }: ToolListProps) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <ToolItem key={item.id} {...item} onPress={onItemPress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.sm,
    paddingBottom: space.xl,
  },
});
