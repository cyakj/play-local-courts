import { useEffect, useMemo, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { Building2, CheckCircle, Clock } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

type ClaimedRole = 'board_member' | 'property_manager' | 'administrator' | 'other' | '';

const ROLE_OPTIONS: { value: ClaimedRole; label: string }[] = [
  { value: 'board_member', label: 'Board Member' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'other', label: 'Other' },
];

interface ExistingApplication {
  id: string;
  hoa_name: string;
  community_location: string;
  estimated_residents: number;
  claimed_role: string;
  claimed_role_other: string | null;
  status: string;
  submitted_at: string;
}

export default function HOAApplicationScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hoaName, setHoaName] = useState('');
  const [communityLocation, setCommunityLocation] = useState('');
  const [estimatedResidents, setEstimatedResidents] = useState('');
  const [claimedRole, setClaimedRole] = useState<ClaimedRole>('');
  const [claimedRoleOther, setClaimedRoleOther] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<ExistingApplication | null>(null);
  const [latestReviewerNote, setLatestReviewerNote] = useState<{ note: string; created_at: string } | null>(null);
  const [forceResubmit, setForceResubmit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (profile?.full_name) setFullName(profile.full_name);

      const { data: app } = await supabase
        .from('hoa_applications')
        .select('id, hoa_name, community_location, estimated_residents, claimed_role, claimed_role_other, status, submitted_at')
        .eq('applicant_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (app) {
        setExistingApplication(app);
        setHoaName(app.hoa_name || '');
        setCommunityLocation(app.community_location || '');
        setEstimatedResidents(String(app.estimated_residents || ''));
        setClaimedRole((app.claimed_role as ClaimedRole) || '');
        setClaimedRoleOther(app.claimed_role_other || '');

        const { data: noteData } = await supabase
          .from('hoa_application_notes')
          .select('note, created_at')
          .eq('application_id', app.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setLatestReviewerNote(noteData ?? null);
      }

      setIsLoading(false);
    }
    init();
  }, []);

  async function handleSubmit() {
    if (!fullName.trim()) { Alert.alert('Required', 'Please enter your full name.'); return; }
    if (!hoaName.trim()) { Alert.alert('Required', 'Please enter your HOA name.'); return; }
    if (!communityLocation.trim()) { Alert.alert('Required', 'Please enter the community location.'); return; }
    if (!claimedRole) { Alert.alert('Required', 'Please select your role.'); return; }

    setIsSubmitting(true);
    try {
      await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', userId);

      const { error } = await supabase.from('hoa_applications').insert({
        applicant_id: userId,
        hoa_name: hoaName.trim(),
        community_location: communityLocation.trim(),
        estimated_residents: parseInt(estimatedResidents || '0', 10),
        claimed_role: claimedRole,
        claimed_role_other: claimedRole === 'other' ? claimedRoleOther.trim() : null,
        verification_documents: [],
      });

      if (error) throw error;

      Alert.alert('Application Submitted', 'Your HOA application has been submitted for review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textMuted }}>Loading…</Text>
      </View>
    );
  }

  // Existing application status view
  if (existingApplication && !forceResubmit) {
    const { status } = existingApplication;
    const isApproved = status === 'approved';
    const isRejected = status === 'rejected';
    const needsMoreInfo = status === 'needs_more_info';

    const badgeBg = isApproved
      ? Colors.optimalBg
      : isRejected
      ? Colors.criticalBg
      : needsMoreInfo
      ? 'rgba(245,158,11,0.12)'
      : 'rgba(154,163,184,0.12)';
    const badgeBorder = isApproved
      ? Colors.accentCyan
      : isRejected
      ? Colors.negative
      : needsMoreInfo
      ? 'rgba(245,158,11,0.40)'
      : 'rgba(154,163,184,0.30)';
    const badgeColor = isApproved
      ? Colors.accentCyan
      : isRejected
      ? Colors.negative
      : needsMoreInfo
      ? '#F59E0B'
      : theme.textMuted;

    return (
      <View style={styles.screen}>
        <Header variant="inner" title="HOA Application" onBack={() => router.back()} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
            <View style={styles.statusCard}>
              <Building2 color={theme.textSecondary} size={36} strokeWidth={1.5} />
              <Text style={styles.statusTitle}>HOA Application Status</Text>
              <Text style={styles.statusHoa}>"{existingApplication.hoa_name}"</Text>

              <View style={[styles.statusBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                {isApproved && <CheckCircle color={Colors.accentCyan} size={18} strokeWidth={1.5} />}
                {!isApproved && <Clock color={badgeColor} size={18} strokeWidth={1.5} />}
                <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                  {isApproved
                    ? 'Application Approved!'
                    : isRejected
                    ? 'Application Not Approved'
                    : needsMoreInfo
                    ? 'Additional Information Needed'
                    : 'Verification Pending'}
                </Text>
              </View>

              <Text style={styles.statusDesc}>
                {isApproved
                  ? 'Your HOA has been registered on TenisX. You can now manage your community.'
                  : isRejected
                  ? 'Please review the reviewer note below for details.'
                  : needsMoreInfo
                  ? 'A reviewer requested more information. Review the request below and resubmit.'
                  : 'TenisX is reviewing your application. This typically takes 1-3 business days.'}
              </Text>

              {(isRejected || needsMoreInfo) && latestReviewerNote && (
                <View style={styles.reviewerNoteBox}>
                  <Text style={styles.reviewerNoteLabel}>Reviewer Note</Text>
                  <Text style={styles.reviewerNoteText}>{latestReviewerNote.note}</Text>
                  {latestReviewerNote.created_at && (
                    <Text style={styles.reviewerNoteDate}>
                      {new Date(latestReviewerNote.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.submittedOn}>
                Submitted {new Date(existingApplication.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>

              {needsMoreInfo && (
                <Button
                  variant="accent"
                  label="Update Documents"
                  onPress={() => setForceResubmit(true)}
                  fullWidth
                />
              )}
              <Button
                variant="ghost"
                label="Return to Dashboard"
                onPress={() => router.back()}
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Application form
  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Register Your HOA" onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          <Text style={styles.intro}>
            Register your HOA on TenisX to manage courts, bookings, and residents. Our team will verify your details within 1–3 business days.
          </Text>

          <Text style={styles.fieldLabel}>YOUR FULL NAME</Text>
          <TextInput
            style={styles.textInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Jane Smith"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>PHONE NUMBER</Text>
          <TextInput
            style={styles.textInput}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>HOA NAME</Text>
          <TextInput
            style={styles.textInput}
            value={hoaName}
            onChangeText={setHoaName}
            placeholder="Sunset Park HOA"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>COMMUNITY LOCATION</Text>
          <TextInput
            style={styles.textInput}
            value={communityLocation}
            onChangeText={setCommunityLocation}
            placeholder="City, State"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ESTIMATED RESIDENTS</Text>
          <TextInput
            style={styles.textInput}
            value={estimatedResidents}
            onChangeText={setEstimatedResidents}
            placeholder="e.g. 150"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>YOUR ROLE</Text>
          <View style={styles.roleGrid}>
            {ROLE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.rolePill, claimedRole === opt.value && styles.rolePillActive]}
                onPress={() => setClaimedRole(opt.value)}>
                <Text style={[styles.rolePillLabel, claimedRole === opt.value && styles.rolePillLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {claimedRole === 'other' && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>DESCRIBE YOUR ROLE</Text>
              <TextInput
                style={styles.textInput}
                value={claimedRoleOther}
                onChangeText={setClaimedRoleOther}
                placeholder="e.g. Community Manager"
                placeholderTextColor={theme.textMuted}
              />
            </>
          )}

          <View style={styles.infoNotice}>
            <Text style={styles.infoNoticeText}>
              <Text style={styles.infoNoticeBold}>Important: </Text>
              Your application will be reviewed by our team to verify your administrative authority. This process typically takes 1-2 business days. You'll receive a notification once reviewed.
            </Text>
          </View>

          <View style={{ marginTop: 20 }}>
            <Button
              variant="accent"
              label={isSubmitting ? 'Submitting…' : 'Submit Application'}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!hoaName.trim() || !claimedRole}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    content: { padding: Spacing.pagePx, paddingBottom: 60 },
    intro: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 22,
      marginBottom: 24,
    },
    fieldLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radius.input,
      padding: 14,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
      backgroundColor: theme.cardBg,
      minHeight: 44,
    },
    roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    rolePill: {
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.cardBg,
    },
    rolePillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
    rolePillLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textMuted,
    },
    rolePillLabelActive: { color: Colors.white },

    // Status view
    statusCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 24,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowCard,
    },
    statusTitle: {
      fontFamily: FontFamily.manropeExtraBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
      textAlign: 'center',
    },
    statusHoa: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      textAlign: 'center',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: Radius.card,
      borderWidth: 1,
      padding: 12,
      paddingHorizontal: 16,
    },
    statusBadgeText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
    },
    statusDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    submittedOn: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.uiLabel,
      color: theme.textMuted,
      marginTop: 4,
    },
    reviewerNoteBox: {
      width: '100%',
      backgroundColor: theme.pageBg,
      borderRadius: Radius.input,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    reviewerNoteLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textMuted,
      marginBottom: 6,
    },
    reviewerNoteText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    reviewerNoteDate: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.min,
      color: theme.textMuted,
      marginTop: 6,
    },
    infoNotice: {
      marginTop: 24,
      padding: 14,
      backgroundColor: 'rgba(45,107,255,0.10)',
      borderRadius: Radius.input,
      borderLeftWidth: 4,
      borderLeftColor: 'rgba(45,107,255,0.30)',
    },
    infoNoticeText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.uiLabel,
      color: Colors.blue,
      lineHeight: 19,
    },
    infoNoticeBold: {
      fontFamily: FontFamily.manropeSemiBold,
    },
  }), [theme]);
}
