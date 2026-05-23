import { useEffect, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Building2, CheckCircle, Clock } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { Button } from '@/components/ui/Button';

type ClaimedRole = 'hoa_president' | 'board_member' | 'property_manager' | 'other' | '';

const ROLE_OPTIONS: { value: ClaimedRole; label: string }[] = [
  { value: 'hoa_president', label: 'HOA President' },
  { value: 'board_member', label: 'Board Member' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'other', label: 'Other' },
];

interface ExistingApplication {
  id: string;
  hoa_name: string;
  community_location: string;
  estimated_residents: number;
  claimed_role: string;
  status: string;
  submitted_at: string;
}

export default function HOAApplicationScreen() {
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hoaName, setHoaName] = useState('');
  const [communityLocation, setCommunityLocation] = useState('');
  const [estimatedResidents, setEstimatedResidents] = useState('');
  const [claimedRole, setClaimedRole] = useState<ClaimedRole>('');
  const [claimedRoleOther, setClaimedRoleOther] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<ExistingApplication | null>(null);
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
        .select('id, hoa_name, community_location, estimated_residents, claimed_role, status, submitted_at')
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
        <Text style={{ color: Colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  // Existing application status view
  if (existingApplication) {
    const isPending = existingApplication.status === 'pending';
    const isApproved = existingApplication.status === 'approved';
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>HOA Application</Text>
          <View style={styles.backBtn} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
            <View style={styles.statusCard}>
              <Building2 color={Colors.navy} size={36} strokeWidth={1.5} />
              <Text style={styles.statusTitle}>HOA Application Status</Text>
              <Text style={styles.statusHoa}>"{existingApplication.hoa_name}"</Text>

              <View style={[styles.statusBadge, {
                backgroundColor: isApproved ? Colors.optimalBg : '#FFF9E6',
                borderColor: isApproved ? Colors.accentCyan : '#F59E0B',
              }]}>
                {isApproved
                  ? <CheckCircle color={Colors.accentCyan} size={18} strokeWidth={1.5} />
                  : <Clock color="#F59E0B" size={18} strokeWidth={1.5} />
                }
                <Text style={[styles.statusBadgeText, { color: isApproved ? Colors.accentCyan : '#92400E' }]}>
                  {isApproved ? 'Application Approved!' : 'Verification Pending'}
                </Text>
              </View>

              <Text style={styles.statusDesc}>
                {isApproved
                  ? 'Your HOA has been registered on TenisX. You can now manage your community.'
                  : 'TenisX is reviewing your application to register this HOA. This typically takes 1-3 business days.'
                }
              </Text>

              <Text style={styles.submittedOn}>
                Submitted {new Date(existingApplication.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Application form
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register Your HOA</Text>
        <View style={styles.backBtn} />
      </View>

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
            placeholderTextColor={Colors.textPlaceholder}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>PHONE NUMBER</Text>
          <TextInput
            style={styles.textInput}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={Colors.textPlaceholder}
            keyboardType="phone-pad"
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>HOA NAME</Text>
          <TextInput
            style={styles.textInput}
            value={hoaName}
            onChangeText={setHoaName}
            placeholder="Sunset Park HOA"
            placeholderTextColor={Colors.textPlaceholder}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>COMMUNITY LOCATION</Text>
          <TextInput
            style={styles.textInput}
            value={communityLocation}
            onChangeText={setCommunityLocation}
            placeholder="City, State"
            placeholderTextColor={Colors.textPlaceholder}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ESTIMATED RESIDENTS</Text>
          <TextInput
            style={styles.textInput}
            value={estimatedResidents}
            onChangeText={setEstimatedResidents}
            placeholder="e.g. 150"
            placeholderTextColor={Colors.textPlaceholder}
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
                placeholderTextColor={Colors.textPlaceholder}
              />
            </>
          )}

          <View style={{ marginTop: 32 }}>
            <Button
              variant="accent"
              label="Submit Application"
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  header: {
    backgroundColor: Colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 20,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.white },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  intro: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textSubtle,
    lineHeight: 22,
    marginBottom: 24,
  },
  fieldLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: 14,
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardBg,
    minHeight: 44,
  },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rolePill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.cardBg,
  },
  rolePillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  rolePillLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  rolePillLabelActive: { color: Colors.white },

  // Status view
  statusCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  statusTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    textAlign: 'center',
  },
  statusHoa: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
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
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.body,
  },
  statusDesc: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textSubtle,
    textAlign: 'center',
    lineHeight: 22,
  },
  submittedOn: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
