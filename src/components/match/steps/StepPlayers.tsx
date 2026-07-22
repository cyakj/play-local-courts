// src/components/match/steps/StepPlayers.tsx
import { useRef, useState } from 'react';
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { AddPlayersSheet, type MatchInvitee } from '@/components/match/AddPlayersSheet';

interface Props {
  players: MatchInvitee[];
  maxPlayers: number;
  onChange: (players: MatchInvitee[]) => void;
}

// Tap feedback: scale(0.97) at 140ms with a snappy ease — matches DESIGN.md's
// documented Interaction Pattern ("Tap feedback: scale(0.97) at --t-fast with
// --ease-snap") and the Animated-driven treatment StepActivity/StepLocation/
// StepDateTime use elsewhere in this same wizard. The add-row is a single,
// known affordance, so it gets one Animated.Value (like StepDateTime's
// standalone "Dates" segment) rather than a per-row array.
const EASE_SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function animatePressScale(value: Animated.Value, toValue: number) {
  Animated.timing(value, { toValue, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
}

function initials(name: string) {
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

export function StepPlayers({ players, maxPlayers, onChange }: Props) {
  const { theme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const addRowScale = useRef(new Animated.Value(1)).current;

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PLAYERS</Text>
        <Text style={[styles.countLabel, { color: theme.textSecondary }]}>
          {players.length} of {maxPlayers} invited
        </Text>

        {players.map(player => (
          <View key={player.id} style={[styles.row, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
            {player.avatarUrl ? (
              <Image source={{ uri: player.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.surface2 }]}>
                <Text style={[styles.avatarText, { color: theme.textPrimary }]}>{initials(player.name)}</Text>
              </View>
            )}
            <Text style={[styles.name, { color: theme.textPrimary, flex: 1 }]} numberOfLines={1}>
              {player.name}
            </Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onChange(players.filter(p => p.id !== player.id))}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        ))}

        {players.length < maxPlayers && (
          <AnimatedTouchable
            style={[styles.addRow, { borderColor: Colors.blue }, { transform: [{ scale: addRowScale }] }]}
            onPress={() => setSheetOpen(true)}
            onPressIn={() => animatePressScale(addRowScale, 0.97)}
            onPressOut={() => animatePressScale(addRowScale, 1)}
            activeOpacity={0.85}>
            <Plus size={18} color={Colors.blue} />
            <Text style={[styles.addText, { color: Colors.blue }]}>Add Players</Text>
          </AnimatedTouchable>
        )}
      </ScrollView>

      <AddPlayersSheet
        visible={sheetOpen}
        maxPlayers={maxPlayers}
        selected={players}
        onChange={onChange}
        onDismiss={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: 10 },
  sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2 },
  countLabel: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: -4, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.label },
  name: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  removeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.card,
  },
  addText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
});
