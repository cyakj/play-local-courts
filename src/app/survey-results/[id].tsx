import { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { Header } from '@/components/ui/Header';

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  position: number;
}

interface TallyResult {
  questionId: string;
  questionText: string;
  questionType: string;
  options: string[];
  tally: Record<string, number>;
  totalResponses: number;
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  closes_at: string;
  anonymous: boolean;
}

export default function SurveyResultsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [results, setResults] = useState<TallyResult[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [surveyRes, questionsRes, responsesRes] = await Promise.all([
          supabase
            .from('hoa_surveys')
            .select('id, title, description, closes_at, anonymous')
            .eq('id', id)
            .single(),
          supabase
            .from('hoa_survey_questions')
            .select('id, question_text, question_type, options, position')
            .eq('survey_id', id)
            .order('position'),
          supabase
            .from('hoa_survey_responses')
            .select('answers')
            .eq('survey_id', id),
        ]);

        if (surveyRes.error || !surveyRes.data) {
          setError('Survey not found.');
          setLoading(false);
          return;
        }

        setSurvey(surveyRes.data as Survey);

        const questions: SurveyQuestion[] = (questionsRes.data ?? []).map((q: any) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : null,
        }));

        const responses = responsesRes.data ?? [];
        setTotalResponses(responses.length);

        const tallied: TallyResult[] = questions
          .filter((q) => q.question_type === 'multiple_choice' || q.question_type === 'single_choice' || q.question_type === 'yes_no')
          .map((q) => {
            const opts: string[] = q.options ?? (q.question_type === 'yes_no' ? ['Yes', 'No'] : []);
            const tally: Record<string, number> = {};
            opts.forEach((o) => { tally[o] = 0; });

            for (const resp of responses) {
              const answers = resp.answers as Record<string, unknown>;
              const val = answers[q.id];
              if (typeof val === 'string' && tally[val] !== undefined) {
                tally[val]++;
              } else if (Array.isArray(val)) {
                for (const v of val) {
                  if (typeof v === 'string' && tally[v] !== undefined) tally[v]++;
                }
              }
            }

            return {
              questionId: q.id,
              questionText: q.question_text,
              questionType: q.question_type,
              options: opts,
              tally,
              totalResponses: responses.length,
            };
          });

        setResults(tallied);
        setLoading(false);
      } catch {
        setError('Unable to load survey results.');
        setLoading(false);
      }
    }
    load();
  }, [id]);

  return (
    <View style={styles.screen}>
      <Header
        variant="inner"
        title={survey?.title ?? 'Survey Results'}
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.cyan} size="large" testID="results-loading" />
            </View>
          ) : error ? (
            <View testID="results-error" style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <>
              {/* Survey meta */}
              <View testID="survey-meta" style={styles.metaCard}>
                {survey?.description ? (
                  <Text style={styles.metaDesc}>{survey.description}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>
                    {totalResponses} response{totalResponses !== 1 ? 's' : ''}
                  </Text>
                  {survey?.closes_at ? (
                    <Text style={styles.metaLabel}>
                      Closed {new Date(survey.closes_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>

              {results.length === 0 ? (
                <View testID="results-no-questions" style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No results to display</Text>
                  <Text style={styles.emptySubtitle}>
                    This survey may not have any multiple-choice responses available.
                  </Text>
                </View>
              ) : (
                results.map((r) => {
                  const maxCount = Math.max(...r.options.map((o) => r.tally[o] ?? 0), 1);
                  return (
                    <View key={r.questionId} testID="result-question" style={styles.questionCard}>
                      <Text style={styles.questionText}>{r.questionText}</Text>

                      {r.options.map((opt) => {
                        const count = r.tally[opt] ?? 0;
                        const pct = r.totalResponses > 0
                          ? Math.round((count / r.totalResponses) * 100)
                          : 0;
                        const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <View key={opt} testID="result-option" style={styles.optionRow}>
                            <View style={styles.optionLabelRow}>
                              <Text style={styles.optionLabel} numberOfLines={2}>{opt}</Text>
                              <Text style={styles.optionPct}>{pct}%</Text>
                            </View>
                            <View style={styles.barTrack}>
                              <View style={[styles.barFill, { width: `${barWidth}%` as any }]} />
                            </View>
                            <Text style={styles.optionCount}>
                              {count} vote{count !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    content: { padding: Spacing.pagePx, paddingBottom: 60 },

    loadingBox: { alignItems: 'center', paddingVertical: 60 },
    errorBox: { alignItems: 'center', paddingVertical: 60 },
    errorText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: Colors.negative,
      textAlign: 'center' as const,
    },

    metaCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowCard,
    },
    metaDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      marginBottom: 10,
      lineHeight: 20,
    },
    metaRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
    metaLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },

    emptyBox: { alignItems: 'center' as const, paddingVertical: 48, gap: 8 },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
    },
    emptySubtitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      textAlign: 'center' as const,
      paddingHorizontal: 24,
    },

    questionCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowCard,
    },
    questionText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 15,
      color: theme.textPrimary,
      marginBottom: 14,
      lineHeight: 20,
    },

    optionRow: { marginBottom: 12 },
    optionLabelRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-end' as const, marginBottom: 5 },
    optionLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 13,
      color: theme.textPrimary,
      flex: 1,
      paddingRight: 8,
    },
    optionPct: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 13,
      color: Colors.cyan,
      minWidth: 36,
      textAlign: 'right' as const,
    },
    barTrack: {
      height: 6,
      backgroundColor: theme.surface2,
      borderRadius: 3,
      overflow: 'hidden' as const,
      marginBottom: 3,
    },
    barFill: { height: '100%' as any, backgroundColor: Colors.cyan, borderRadius: 3 },
    optionCount: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 11,
      color: theme.textMuted,
    },
  }), [theme]);
}
