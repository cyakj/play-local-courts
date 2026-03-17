import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SurveyResultsProps {
  surveyId: string;
  communityId: string;
  onBack: () => void;
}

interface QuestionResult {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  position: number;
  required: boolean;
}

export const SurveyResults: React.FC<SurveyResultsProps> = ({ surveyId, communityId, onBack }) => {
  const [survey, setSurvey] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionResult[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [surveyRes, questionsRes, responsesRes, membersRes] = await Promise.all([
        supabase.from('hoa_surveys').select('*').eq('id', surveyId).single(),
        supabase.from('hoa_survey_questions').select('*').eq('survey_id', surveyId).order('position'),
        supabase.from('hoa_survey_responses').select('answers').eq('survey_id', surveyId),
        supabase.from('hoa_memberships').select('id', { count: 'exact', head: true }).eq('hoa_id', communityId).eq('status', 'approved'),
      ]);
      setSurvey(surveyRes.data);
      setQuestions((questionsRes.data || []).map(q => ({
        ...q,
        options: Array.isArray(q.options) ? q.options as string[] : null,
        required: (q as any).required ?? true,
      })));
      setResponses(responsesRes.data || []);
      setTotalMembers(membersRes.count || 0);
      setLoading(false);
    };
    load();
  }, [surveyId, communityId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#F0F4F8' }}>
        <div className="w-8 h-8 border-3 border-[#00B4D8]/20 border-t-[#00B4D8] rounded-full animate-spin" />
      </div>
    );
  }

  const responded = responses.length;
  const pct = totalMembers > 0 ? Math.round((responded / totalMembers) * 100) : 0;
  const isAnonymous = (survey as any)?.anonymous !== false;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#F0F4F8' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D2137 60%, #1A3350 100%)', padding: '44px 20px 16px', color: '#fff', flexShrink: 0 }}>
        <div className="flex items-center gap-3 mb-3">
          <div onClick={onBack} className="rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div>
            <div className="text-base font-extrabold">{survey?.title}</div>
            <div className="text-[11px] opacity-65">Survey Results</div>
          </div>
        </div>

        {/* Response rate */}
        <div className="rounded-xl p-3 flex justify-between items-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div>
            <div className="text-[11px] opacity-65 mb-0.5">Response Rate</div>
            <div className="text-xl font-black">
              {pct}% <span className="text-[13px] opacity-70">({responded}/{totalMembers})</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full border-[3px] flex items-center justify-center" style={{ borderColor: '#00B4D8' }}>
            <div className="text-[13px] font-black" style={{ color: '#00B4D8' }}>{pct}%</div>
          </div>
        </div>
      </div>

      {/* Anonymity note */}
      {isAnonymous && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
          <span className="text-[13px]">🔒</span>
          <span className="text-xs" style={{ color: '#9CA3AF' }}>Responses are anonymous — individual submissions are not shown</span>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {questions.map((q, qi) => {
          const total = responses.length || 1;
          return (
            <div key={q.id} className="rounded-2xl p-4 mb-3 border" style={{ background: '#fff', borderColor: '#E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: '#00B4D8' }}>Q{qi + 1}</div>
              <div className="text-[13px] font-bold mb-3.5" style={{ color: '#1A1A2E', lineHeight: 1.4 }}>{q.question_text}</div>

              {/* Rating */}
              {q.question_type === 'rating' && (() => {
                const ratings = responses.map(r => Number(r.answers?.[q.id] || 0)).filter(n => n > 0);
                const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
                const starCounts = [1, 2, 3, 4, 5].map(s => ({ stars: s, count: ratings.filter(r => r === s).length }));
                return (
                  <>
                    <div className="flex justify-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map(s => (
                        <span key={s} className="text-xl" style={{ opacity: s <= Math.round(avg) ? 1 : 0.25 }}>⭐</span>
                      ))}
                    </div>
                    <div className="text-center text-xs mb-3" style={{ color: '#9CA3AF' }}>
                      Average: <strong style={{ color: '#1A1A2E' }}>{avg.toFixed(1)}/5</strong>
                    </div>
                    {starCounts.map(d => (
                      <div key={d.stars} className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs w-6 text-right" style={{ color: '#9CA3AF' }}>{d.stars}★</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F0F4F8' }}>
                          <div className="h-full rounded-full" style={{ width: `${(d.count / (ratings.length || 1)) * 100}%`, background: 'linear-gradient(90deg, #00B4D8, #2DD4BF)' }} />
                        </div>
                        <span className="text-xs w-8" style={{ color: '#9CA3AF' }}>{d.count}</span>
                      </div>
                    ))}
                  </>
                );
              })()}

              {/* Multiple Choice */}
              {q.question_type === 'multiple_choice' && (() => {
                const opts = q.options || [];
                const counts: Record<string, number> = {};
                opts.forEach(o => { counts[o] = 0; });
                responses.forEach(r => {
                  const answer = r.answers?.[q.id];
                  if (answer && counts[answer] !== undefined) counts[answer]++;
                });
                const sorted = opts.slice().sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
                return sorted.map(opt => (
                  <div key={opt} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: '#1A1A2E' }}>{opt}</span>
                      <span style={{ color: '#9CA3AF' }}>{counts[opt]} ({Math.round((counts[opt] / total) * 100)}%)</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F0F4F8' }}>
                      <div className="h-full rounded-full" style={{ width: `${(counts[opt] / total) * 100}%`, background: 'linear-gradient(90deg, #00B4D8, #2DD4BF)' }} />
                    </div>
                  </div>
                ));
              })()}

              {/* Yes/No */}
              {q.question_type === 'yes_no' && (() => {
                let yesCount = 0, noCount = 0;
                responses.forEach(r => {
                  const answer = r.answers?.[q.id];
                  if (answer === 'Yes') yesCount++;
                  else if (answer === 'No') noCount++;
                });
                return ['Yes', 'No'].map(opt => {
                  const count = opt === 'Yes' ? yesCount : noCount;
                  const color = opt === 'Yes' ? '#00B4D8' : '#0A1628';
                  return (
                    <div key={opt} className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: '#1A1A2E' }}>{opt}</span>
                        <span style={{ color: '#9CA3AF' }}>{count} ({Math.round((count / total) * 100)}%)</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F0F4F8' }}>
                        <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, background: color }} />
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Open Text */}
              {q.question_type === 'open_text' && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {responses.map((r, ri) => {
                    const text = r.answers?.[q.id];
                    if (!text) return null;
                    return (
                      <div key={ri} className="rounded-[10px] p-3 text-xs border-l-[3px]" style={{ background: '#F0F4F8', color: '#4B5563', borderLeftColor: '#00B4D8', lineHeight: 1.5 }}>
                        "{text}"
                      </div>
                    );
                  })}
                  {responses.filter(r => r.answers?.[q.id]).length === 0 && (
                    <div className="text-xs italic" style={{ color: '#9CA3AF' }}>No text responses</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
