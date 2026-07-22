// src/app/match/new.tsx
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useCreateMatchDraft } from '@/hooks/createMatchDraft';
import { sendMatchInviteNotifications } from '@/lib/matchInvites';
import { supabase } from '@/lib/supabase';
import { StepProgress } from '@/components/match/steps/StepProgress';
import { StepActivity } from '@/components/match/steps/StepActivity';
import { StepLocation } from '@/components/match/steps/StepLocation';
import { StepDateTime } from '@/components/match/steps/StepDateTime';
import { StepPlayers } from '@/components/match/steps/StepPlayers';
import { StepPreferences } from '@/components/match/steps/StepPreferences';
import { StepDetails } from '@/components/match/steps/StepDetails';
import { StepReview } from '@/components/match/steps/StepReview';

const STEP_TITLES: Record<string, string> = {
  activity: 'Activity', location: 'Location', datetime: 'Date & Time',
  players: 'Players', preferences: 'Preferences', details: 'Details', review: 'Review',
};

// Card entrance: fade + translateY(8px) → 0 at --t-base with --ease-signal —
// the same reveal DESIGN.md documents for card transitions, and the same one
// StepPreferences already applies to its advanced-panel reveal. Reusing it
// here for the step-to-step transition keeps the whole wizard's motion feel
// consistent instead of introducing a bespoke curve just for the shell.
const EASE_SIGNAL = Easing.bezier(0.22, 1, 0.36, 1);
// Tap feedback: scale(0.97) at 140ms with --ease-snap — the same primary-CTA
// press treatment StepReview's "Create Match" button uses, applied here to
// Next so the two buttons a user sees across this flow behave identically.
const EASE_SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function animatePressScale(value: Animated.Value, toValue: number) {
  Animated.timing(value, { toValue, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
}

export default function NewMatchScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const draft = useCreateMatchDraft();
  const [userName, setUserName] = useState('A player');

  const stepOpacity = useRef(new Animated.Value(0)).current;
  const stepTranslateY = useRef(new Animated.Value(8)).current;
  const nextScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => {
        if (data?.full_name) setUserName(data.full_name);
      });
    });
  }, []);

  useEffect(() => {
    stepOpacity.setValue(0);
    stepTranslateY.setValue(8);
    Animated.timing(stepOpacity, { toValue: 1, duration: 220, easing: EASE_SIGNAL, useNativeDriver: true }).start();
    Animated.timing(stepTranslateY, { toValue: 0, duration: 220, easing: EASE_SIGNAL, useNativeDriver: true }).start();
  }, [draft.step, stepOpacity, stepTranslateY]);

  function handleBack() {
    if (draft.canGoBack) { draft.goBack(); return; }
    if (draft.hasMeaningfulSelections) {
      Alert.alert('Discard this match?', 'Your selections will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(resident)/match')) },
      ]);
      return;
    }
    if (router.canGoBack()) router.back(); else router.replace('/(resident)/match');
  }

  async function handleSubmit() {
    const listingId = await draft.submit();
    if (!listingId) return;
    if (draft.players.length) {
      await sendMatchInviteNotifications(
        {
          id: listingId,
          format: draft.activity.playFormat ?? 'singles',
          match_date: draft.dateTime.date.toISOString().slice(0, 10),
          start_time: draft.dateTime.time ?? '',
          end_time: draft.dateTime.time ?? '',
          location: draft.location?.name ?? '',
        },
        draft.players.map(p => p.id),
        (await supabase.auth.getUser()).data.user?.id ?? '',
        userName,
      );
    }
    // /my-matches doesn't exist yet — it lands in Task 26/27 of this same plan.
    // Cast rather than block this task on that route's existence, matching the
    // `as any` pattern the pre-rewrite screen already used for not-yet-typed routes.
    router.replace('/my-matches' as any);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBg }]}>
      <Header variant="inner" title="New Match" />
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.stepHeaderIcon}>
          {draft.canGoBack ? <ChevronLeft size={22} color={theme.textPrimary} /> : <X size={22} color={theme.textPrimary} />}
        </TouchableOpacity>
        <Text style={[styles.stepTitle, { color: theme.textPrimary }]}>{STEP_TITLES[draft.step]}</Text>
        <View style={styles.stepHeaderIcon} />
      </View>
      <StepProgress stepIndex={draft.stepIndex} totalSteps={draft.totalSteps} />

      <Animated.View style={[styles.stepBody, { opacity: stepOpacity, transform: [{ translateY: stepTranslateY }] }]}>
        {draft.step === 'activity' && (
          <StepActivity
            activity={draft.activity}
            onActivityType={draft.setActivityType}
            onPlayFormat={draft.setPlayFormat}
            onOrganizerPlaying={draft.setOrganizerPlaying}
            wouldDropInviteesFor={draft.wouldDropInviteesFor}
          />
        )}
        {draft.step === 'location' && <StepLocation location={draft.location} onSelect={draft.setLocation} />}
        {draft.step === 'datetime' && (
          <StepDateTime dateTime={draft.dateTime} onChange={draft.setDateTime} locationCity={draft.location?.city} />
        )}
        {draft.step === 'players' && <StepPlayers players={draft.players} maxPlayers={draft.maxPlayers} onChange={draft.setPlayers} />}
        {draft.step === 'preferences' && (
          <StepPreferences
            playFormat={draft.activity.playFormat}
            visibility={draft.visibility}
            onVisibility={draft.setVisibility}
            genderPreference={draft.genderPreference}
            onGenderPreference={draft.setGenderPreference}
            skillPreference={draft.skillPreference}
            onSkillPreference={draft.setSkillPreference}
          />
        )}
        {draft.step === 'details' && (
          <StepDetails note={draft.note} onNote={draft.setNote} courtReserved={draft.courtReserved} onCourtReserved={draft.setCourtReserved} />
        )}
        {draft.step === 'review' && (
          <StepReview
            activityType={draft.activity.activityType}
            playFormat={draft.activity.playFormat}
            location={draft.location}
            date={draft.dateTime.date}
            time={draft.dateTime.time}
            durationMinutes={draft.dateTime.durationMinutes}
            players={draft.players}
            visibility={draft.visibility}
            genderPreference={draft.genderPreference}
            skillPreference={draft.skillPreference}
            note={draft.note}
            courtReserved={draft.courtReserved}
            onEditStep={draft.goToStep}
            submitting={draft.submitting}
            submitError={draft.submitError}
            onSubmit={handleSubmit}
          />
        )}
      </Animated.View>

      {draft.step !== 'review' && (
        <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 16), borderTopColor: theme.border }]}>
          <AnimatedTouchable
            style={[
              styles.nextBtn,
              !draft.canGoNext && styles.nextBtnDisabled,
              { transform: [{ scale: nextScale }] },
            ]}
            onPress={draft.goNext}
            onPressIn={() => draft.canGoNext && animatePressScale(nextScale, 0.97)}
            onPressOut={() => animatePressScale(nextScale, 1)}
            disabled={!draft.canGoNext}
            activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Next</Text>
          </AnimatedTouchable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.pagePx, paddingTop: 4 },
  stepHeaderIcon: { width: 22, height: 22 },
  stepTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle },
  stepBody: { flex: 1 },
  navBar: { paddingHorizontal: Spacing.pagePx, paddingTop: 12, borderTopWidth: 1 },
  nextBtn: { minHeight: 54, backgroundColor: Colors.blue, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: Colors.white, fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
});
