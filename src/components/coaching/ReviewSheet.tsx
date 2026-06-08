import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Star, X } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lessonRequestId: string;
  coachUserId: string;
  coachName: string;
}

export function ReviewSheet({
  visible,
  onClose,
  onSuccess,
  lessonRequestId,
  coachUserId,
  coachName,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function reset() {
    setRating(0);
    setReviewText('');
    setSubmitting(false);
    setSuccess(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating before submitting.');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const { error } = await supabase
      .from('coach_reviews')
      .insert({
        coach_id:          coachUserId,
        player_id:         user.id,
        lesson_request_id: lessonRequestId,
        rating,
        review_text:       reviewText.trim() || null,
      });

    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Already reviewed', 'You have already left a review for this lesson.');
        handleClose();
        return;
      }
      Alert.alert('Error', error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      reset();
      onClose();
      onSuccess();
    }, 1500);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <X size={20} strokeWidth={2} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave a Review</Text>
          <View style={{ width: 28 }} />
        </View>

        {success ? (
          <View style={styles.successWrap}>
            <Text style={styles.successIcon}>⭐</Text>
            <Text style={styles.successTitle}>Review submitted!</Text>
            <Text style={styles.successBody}>Your review for {coachName} has been saved.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.coachName}>{coachName}</Text>

            {/* Star selector */}
            <Text style={styles.fieldLabel}>Rating (required)</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRating(n)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  activeOpacity={0.7}
                >
                  <Star
                    size={36}
                    strokeWidth={n <= rating ? 0 : 1.5}
                    fill={n <= rating ? '#F59E0B' : 'transparent'}
                    color={n <= rating ? '#F59E0B' : theme.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {rating > 0 && (
              <Text style={styles.ratingLabel}>{RATING_LABELS[rating - 1]}</Text>
            )}

            {/* Text */}
            <Text style={styles.fieldLabel}>Review (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Describe your experience with this coach…"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              maxLength={600}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{reviewText.length}/600</Text>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || rating === 0) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting || rating === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnLabel}>
                {submitting ? 'Submitting…' : 'Submit Review'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: theme.pageBg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    body: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 24,
      paddingBottom: 40,
      gap: 16,
    },
    coachName: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    fieldLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    ratingLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: '#F59E0B',
      marginTop: -8,
    },
    textInput: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
      minHeight: 110,
    },
    charCount: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'right',
      marginTop: -8,
    },
    submitBtn: {
      height: 52,
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    submitBtnDisabled: {
      opacity: 0.4,
    },
    submitBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.white,
    },
    successWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      paddingHorizontal: Spacing.pagePx,
    },
    successIcon: {
      fontSize: 48,
    },
    successTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: Colors.positive,
    },
    successBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  }), [theme]);
}
