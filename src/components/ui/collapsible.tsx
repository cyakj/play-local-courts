import { PropsWithChildren, useState } from 'react';
import { Pressable, View } from 'react-native';

export function Collapsible({ children, title: _title }: PropsWithChildren & { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((v) => !v)} />
      {open && <View>{children}</View>}
    </View>
  );
}

export function CollapsibleTrigger({ children, onPress }: PropsWithChildren & { onPress?: () => void }) {
  return <Pressable onPress={onPress}>{children}</Pressable>;
}

export function CollapsibleContent({ children }: PropsWithChildren) {
  return <View>{children}</View>;
}
