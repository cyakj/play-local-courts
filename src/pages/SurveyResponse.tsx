import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ResidentHeader from '@/components/resident/ResidentHeader';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  position: number;
  required: boolean;
}

const TYPE_ICONS: Record<string, string> = { rating: '⭐', multiple_choice: '☑️', yes_no: '✅', open_text: '✏️' };
const TYPE_LABELS: Record<string, string> = { rating: 'Rating', multiple_choice: 'Multiple choice', yes_no: 'Yes / No', open_text: 'Open text' };

const SurveyResponse = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [survey, setSurvey] = useState<any>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [screen, setScreen] = useState<'intro' | 'flow' | 'thankyou'>('intro');
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyResponded, setAlreadyResponded] = useState<string | null>(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [responseCount, setResponseCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!surveyId || !currentUser) return;

      const { data: existing } = await supabase
        .from('hoa_survey_responses')
        .select('submitted_at')
        .eq('survey_id', surveyId)
        .eq('user_id', currentUser.id)
        .limit(1);

      if (existing && existing.length > 0) {
        setAlreadyResponded(existing[0].submitted_at);
        // Still load survey for display
        const { data: surveyData } = await supabase.from('hoa_surveys').select('*').eq('id', surveyId).single();
        setSurvey(surveyData);
        setLoading(false);
        return;
      }

      const { data: surveyData } = await supabase.from('hoa_surveys').select('*').eq('id', surveyId).single();
      setSurvey(surveyData);

      const { data: questionsData } = await supabase
        .from('hoa_survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('position');
      setQuestions((questionsData || []).map(q => ({
        ...q,
        options: Array.isArray(q.options) ? q.options as string[] : null,
        required: (q as any).required ?? true,
      })));

      // Get response stats
      if (surveyData?.hoa_id) {
        const [respRes, memRes] = await Promise.all([
          supabase.from('hoa_survey_responses').select('id', { count: 'exact', head: true }).eq('survey_id', surveyId),
          supabase.from('hoa_memberships').select('id', { count: 'exact', head: true }).eq('hoa_id', surveyData.hoa_id).eq('status', 'approved'),
        ]);
        setResponseCount(respRes.count || 0);
        setTotalMembers(memRes.count || 0);
      }

      setLoading(false);
    };
    load();
  }, [surveyId, currentUser]);

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!currentUser || !surveyId) return;
    setSubmitting(true);
    const { error } = await supabase.from('hoa_survey_responses').insert({
      survey_id: surveyId,
      user_id: currentUser.id,
      answers,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Failed to submit response');
      return;
    }
    setScreen('thankyou');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F8' }}>
        <div className="w-8 h-8 border-3 border-[#00B4D8]/20 border-t-[#00B4D8] rounded-full animate-spin" />
      </div>
    );
  }

  // Already responded
  if (alreadyResponded) {
    const visNote = (survey as any)?.results_visibility === 'community'
      ? (survey as any)?.results_reveal === 'on_submit'
        ? 'Results are available now'
        : `Results will be shared after the survey closes on ${survey?.closes_at ? format(new Date(survey.closes_at), 'MMM d') : '—'}`
      : 'The admin will review your responses privately';

    return (
      <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
        <ResidentHeader compact>
          <div className="flex items-center gap-3">
            <Link to="/" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <ArrowLeft className="h-4 w-4 text-white" />
            </Link>
            <div className="text-xl font-extrabold">Survey</div>
          </div>
        </ResidentHeader>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 border-2" style={{ background: '#E6FFFA', borderColor: '#2DD4BF' }}>
            <Check className="h-10 w-10" style={{ color: '#2DD4BF' }} />
          </div>
          <div className="text-lg font-extrabold mb-2" style={{ color: '#1A1A2E' }}>Already Submitted ✓</div>
          <p className="text-sm text-center mb-2" style={{ color: '#9CA3AF' }}>
            You responded on {format(new Date(alreadyResponded), 'MMM d, yyyy')}
          </p>
          <div className="w-full rounded-2xl p-4 mb-6 border" style={{ background: '#E0F7FA', borderColor: '#00B4D8' }}>
            <div className="text-[13px] font-bold" style={{ color: '#0A1628' }}>{visNote}</div>
          </div>
          <Link to="/" className="w-full text-center py-3 rounded-xl text-sm font-bold text-white" style={{ background: '#0A1628' }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // INTRO SCREEN
  if (screen === 'intro') {
    const estimatedTime = Math.max(1, Math.ceil(questions.length * 0.5));
    const typeCountMap: Record<string, number> = {};
    questions.forEach(q => { typeCountMap[q.question_type] = (typeCountMap[q.question_type] || 0) + 1; });

    return (
      <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
        <div style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D2137 60%, #1A3350 100%)', padding: '44px 20px 24px', color: '#fff' }}>
          <div onClick={() => navigate(-1)} className="rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer mb-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div className="text-[8px] font-bold tracking-widest uppercase mb-1.5" style={{ color: '#00B4D8' }}>📋 COMMUNITY SURVEY</div>
          <div className="text-[22px] font-black leading-tight">{survey?.title}</div>
          <div className="text-xs opacity-65 mt-1.5">
            Posted by Admin · Closes {survey?.closes_at ? format(new Date(survey.closes_at), 'MMM d') : '—'}
          </div>
        </div>

        <div className="p-4 pb-8">
          {survey?.description && (
            <div className="rounded-2xl p-4 mb-3 border" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
              <div className="text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>{survey.description}</div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            {[
              [String(questions.length), 'Questions'],
              [`~${estimatedTime}min`, 'Time'],
              [`${responseCount}/${totalMembers}`, 'Responded'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl p-3 text-center border" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
                <div className="text-xl font-black" style={{ color: '#0A1628' }}>{v}</div>
                <div className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{l}</div>
              </div>
            ))}
          </div>

          {/* What to expect */}
          <div className="rounded-2xl p-4 mb-4 border" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>What to Expect</div>
            {Object.entries(typeCountMap).map(([type, count], i) => (
              <div key={type} className="flex items-center gap-2.5" style={{ marginBottom: i < Object.keys(typeCountMap).length - 1 ? 10 : 0 }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: '#E0F7FA' }}>{TYPE_ICONS[type]}</div>
                <div className="text-[13px]" style={{ color: '#4B5563' }}>{count} {TYPE_LABELS[type]} question{count > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>

          <div
            onClick={() => setScreen('flow')}
            className="w-full text-center py-4 rounded-xl text-[15px] font-extrabold cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #00B4D8, #0091B5)', color: '#fff', boxShadow: '0 6px 20px rgba(0,180,216,0.35)' }}
          >
            Start Survey →
          </div>
          <div className="text-center text-[11px] mt-2.5" style={{ color: '#9CA3AF' }}>Your response is anonymous</div>
        </div>
      </div>
    );
  }

  // THANK YOU SCREEN
  if (screen === 'thankyou') {
    const vis = (survey as any)?.results_visibility;
    const reveal = (survey as any)?.results_reveal;
    let visIcon = '🔒';
    let visTitle = 'The admin will review your responses privately';
    let visDesc = '';
    if (vis === 'board_and_admin') {
      visIcon = '👥';
      visTitle = 'Results will be reviewed by the board and admin';
    } else if (vis === 'community') {
      visIcon = '🌐';
      if (reveal === 'on_submit') {
        visTitle = 'Results are available now';
        visDesc = 'You can view the aggregated results below.';
      } else {
        visTitle = 'Results will be shared with the community';
        visDesc = `You'll be able to see results after the survey closes on ${survey?.closes_at ? format(new Date(survey.closes_at), 'MMM d') : '—'}.`;
      }
    }

    return (
      <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
        <div style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D2137 60%, #1A3350 100%)', padding: '44px 20px 20px', color: '#fff' }}>
          <div className="text-lg font-extrabold">Survey Complete</div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-6 gap-4">
          <div className="w-20 h-20 rounded-full flex items-center justify-center border-2" style={{ background: '#E6FFFA', borderColor: '#2DD4BF', fontSize: 36 }}>✓</div>
          <div className="text-[22px] font-black" style={{ color: '#1A1A2E' }}>Thank you!</div>
          <div className="text-sm text-center leading-relaxed max-w-[260px]" style={{ color: '#4B5563' }}>
            Your response has been submitted. The admin will review all responses and share updates with the community.
          </div>

          <div className="w-full rounded-2xl p-4 border" style={{ background: '#E0F7FA', borderColor: '#00B4D8' }}>
            <div className="flex gap-2.5 items-start">
              <span className="text-xl">{visIcon}</span>
              <div>
                <div className="text-[13px] font-bold mb-0.5" style={{ color: '#0A1628' }}>{visTitle}</div>
                {visDesc && <div className="text-xs" style={{ color: '#4B5563' }}>{visDesc}</div>}
              </div>
            </div>
          </div>

          <Link
            to="/"
            className="w-full text-center py-3.5 rounded-xl text-sm font-extrabold text-white"
            style={{ background: '#0A1628' }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // QUESTION FLOW
  const q = questions[currentQ];
  if (!q) return null;
  const isLast = currentQ === questions.length - 1;
  const progress = (currentQ + 1) / questions.length;
  const ans = answers[q.id];
  const canProceed = !q.required || (ans !== undefined && ans !== null && ans !== '');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F0F4F8' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D2137 60%, #1A3350 100%)', padding: '44px 20px 16px', color: '#fff', flexShrink: 0 }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            onClick={() => currentQ > 0 ? setCurrentQ(currentQ - 1) : setScreen('intro')}
            className="rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div className="text-base font-extrabold">{survey?.title}</div>
        </div>
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] opacity-65">Question {currentQ + 1} of {questions.length}</span>
          <span className="text-[11px] opacity-65">{Math.round(progress * 100)}% complete</span>
        </div>
        <div className="h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, background: '#00B4D8' }} />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: '#00B4D8' }}>
          {!q.required && 'Optional · '}Q{currentQ + 1}
        </div>
        <div className="text-lg font-extrabold mb-6" style={{ color: '#1A1A2E', lineHeight: 1.4 }}>{q.question_text}</div>

        {/* Rating */}
        {q.question_type === 'rating' && (
          <div>
            <div className="flex justify-center gap-3 mb-4">
              {[1, 2, 3, 4, 5].map(s => (
                <div
                  key={s}
                  onClick={() => handleAnswer(q.id, s)}
                  className="cursor-pointer transition-transform text-4xl"
                  style={{ opacity: ans >= s ? 1 : 0.25, transform: ans === s ? 'scale(1.2)' : 'scale(1)' }}
                >
                  ⭐
                </div>
              ))}
            </div>
            {ans && <div className="text-center text-[13px]" style={{ color: '#4B5563' }}>You rated <strong>{ans} out of 5</strong></div>}
          </div>
        )}

        {/* Multiple Choice */}
        {q.question_type === 'multiple_choice' && q.options && (
          <div className="flex flex-col gap-2.5">
            {q.options.map(opt => (
              <div
                key={opt}
                onClick={() => handleAnswer(q.id, opt)}
                className="rounded-xl p-3.5 cursor-pointer flex justify-between items-center border-2"
                style={{
                  borderColor: ans === opt ? '#00B4D8' : '#E5E7EB',
                  background: ans === opt ? '#E0F7FA' : '#fff',
                }}
              >
                <span className="text-sm font-semibold" style={{ color: ans === opt ? '#0A1628' : '#4B5563' }}>{opt}</span>
                {ans === opt && (
                  <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: '#00B4D8' }}>✓</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Yes/No */}
        {q.question_type === 'yes_no' && (
          <div className="flex gap-3">
            {['Yes', 'No'].map(opt => (
              <div
                key={opt}
                onClick={() => handleAnswer(q.id, opt)}
                className="flex-1 rounded-xl p-5 text-center cursor-pointer border-2"
                style={{
                  borderColor: ans === opt ? '#00B4D8' : '#E5E7EB',
                  background: ans === opt ? '#E0F7FA' : '#fff',
                }}
              >
                <div className="text-3xl mb-2">{opt === 'Yes' ? '👍' : '👎'}</div>
                <div className="text-[15px] font-extrabold" style={{ color: ans === opt ? '#0A1628' : '#4B5563' }}>{opt}</div>
              </div>
            ))}
          </div>
        )}

        {/* Open Text */}
        {q.question_type === 'open_text' && (
          <div>
            <textarea
              value={ans || ''}
              onChange={e => handleAnswer(q.id, e.target.value)}
              placeholder="Share your thoughts here..."
              className="w-full border rounded-xl p-3.5 text-sm resize-none"
              style={{ minHeight: 120, borderColor: '#E5E7EB', color: '#1A1A2E', lineHeight: 1.6 }}
              rows={5}
            />
            <div className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>{(ans || '').length}/500 characters</div>
          </div>
        )}
      </div>

      {/* Sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t p-4 pb-7" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
        <div
          onClick={() => {
            if (!canProceed) return;
            if (isLast) handleSubmit();
            else setCurrentQ(currentQ + 1);
          }}
          className="w-full text-center py-3.5 rounded-xl text-[15px] font-extrabold cursor-pointer transition-all"
          style={{
            background: canProceed ? 'linear-gradient(135deg, #00B4D8, #0091B5)' : '#E5E7EB',
            color: canProceed ? '#fff' : '#9CA3AF',
            cursor: canProceed ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Submitting...' : isLast ? 'Submit Survey ✓' : 'Next →'}
        </div>
        {q.required && !ans && <div className="text-center text-[11px] mt-2" style={{ color: '#9CA3AF' }}>This question is required</div>}
        {!q.required && (
          <div
            className="text-center text-[11px] mt-2 cursor-pointer"
            style={{ color: '#9CA3AF' }}
            onClick={() => isLast ? handleSubmit() : setCurrentQ(currentQ + 1)}
          >
            Skip this question
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyResponse;
