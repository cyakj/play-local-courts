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
}

const SurveyResponse = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [survey, setSurvey] = useState<any>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyResponded, setAlreadyResponded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!surveyId || !currentUser) return;

      // Check if already responded
      const { data: existing } = await supabase
        .from('hoa_survey_responses')
        .select('submitted_at')
        .eq('survey_id', surveyId)
        .eq('user_id', currentUser.id)
        .limit(1);

      if (existing && existing.length > 0) {
        setAlreadyResponded(existing[0].submitted_at);
        setLoading(false);
        return;
      }

      const { data: surveyData } = await supabase
        .from('hoa_surveys')
        .select('*')
        .eq('id', surveyId)
        .single();
      setSurvey(surveyData);

      const { data: questionsData } = await supabase
        .from('hoa_survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('position');
      setQuestions((questionsData || []).map(q => ({
        ...q,
        options: Array.isArray(q.options) ? q.options as string[] : null,
      })));
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
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (alreadyResponded) {
    return (
      <div className="min-h-screen bg-background">
        <ResidentHeader compact>
          <div className="flex items-center gap-3">
            <Link to="/" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <ArrowLeft className="h-4 w-4 text-white" />
            </Link>
            <div className="text-xl font-extrabold">Survey</div>
          </div>
        </ResidentHeader>
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(var(--success-bg))' }}>
            <Check className="h-8 w-8" style={{ color: 'hsl(var(--success))' }} />
          </div>
          <div className="text-lg font-extrabold text-foreground mb-2">Already Responded</div>
          <p className="text-sm text-muted-foreground">
            You responded on {format(new Date(alreadyResponded), 'MMM d, yyyy')}
          </p>
          <Link to="/" className="inline-block mt-6 px-5 py-2.5 rounded-[10px] text-sm font-bold text-white" style={{ background: '#0A1628' }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <ResidentHeader compact>
          <div className="text-xl font-extrabold">Survey</div>
        </ResidentHeader>
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(var(--success-bg))' }}>
            <Check className="h-8 w-8" style={{ color: 'hsl(var(--success))' }} />
          </div>
          <div className="text-lg font-extrabold text-foreground mb-2">Thank you!</div>
          <p className="text-sm text-muted-foreground">Your response has been recorded.</p>
          <Link to="/" className="inline-block mt-6 px-5 py-2.5 rounded-[10px] text-sm font-bold text-white" style={{ background: '#0A1628' }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  const isLast = currentQ === questions.length - 1;
  const progress = questions.length > 0 ? ((currentQ + 1) / questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <ResidentHeader compact>
        <div className="flex items-center gap-3">
          <div onClick={() => currentQ > 0 ? setCurrentQ(currentQ - 1) : navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center cursor-pointer" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-xl font-extrabold">{survey?.title}</div>
            {survey?.closes_at && (
              <div className="text-xs opacity-65 mt-0.5">Closes {format(new Date(survey.closes_at), 'MMM d')}</div>
            )}
          </div>
        </div>
      </ResidentHeader>

      {/* Progress */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Question {currentQ + 1} of {questions.length}</span>
        </div>
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-6">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: '#00B4D8' }} />
        </div>
      </div>

      {q && (
        <div className="px-4 pb-24">
          <div className="text-base font-extrabold text-foreground mb-5">{q.question_text}</div>

          {/* Multiple choice */}
          {q.question_type === 'multiple_choice' && q.options && (
            <div className="space-y-2.5">
              {q.options.map((opt: string) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(q.id, opt)}
                  className="w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all"
                  style={{
                    background: answers[q.id] === opt ? '#0A1628' : 'white',
                    color: answers[q.id] === opt ? 'white' : '#1A1A2E',
                    borderColor: answers[q.id] === opt ? '#0A1628' : '#E5E7EB',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Yes/No */}
          {q.question_type === 'yes_no' && (
            <div className="flex gap-3">
              {['Yes', 'No'].map(opt => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(q.id, opt)}
                  className="flex-1 py-3 rounded-xl border text-sm font-bold transition-all"
                  style={{
                    background: answers[q.id] === opt ? '#0A1628' : 'white',
                    color: answers[q.id] === opt ? 'white' : '#1A1A2E',
                    borderColor: answers[q.id] === opt ? '#0A1628' : '#E5E7EB',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Rating */}
          {q.question_type === 'rating' && (
            <div className="flex gap-3 justify-center">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => handleAnswer(q.id, n)}
                  className="w-12 h-12 rounded-full border-2 text-sm font-extrabold transition-all"
                  style={{
                    background: answers[q.id] === n ? '#00B4D8' : 'white',
                    color: answers[q.id] === n ? 'white' : '#1A1A2E',
                    borderColor: answers[q.id] === n ? '#00B4D8' : '#E5E7EB',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {/* Open text */}
          {q.question_type === 'open_text' && (
            <Textarea
              value={answers[q.id] || ''}
              onChange={e => handleAnswer(q.id, e.target.value)}
              placeholder="Type your answer..."
              rows={4}
              className="resize-none"
            />
          )}

          {/* Navigation */}
          <div className="mt-8">
            {currentQ > 0 && (
              <button onClick={() => setCurrentQ(currentQ - 1)} className="text-sm text-muted-foreground font-medium mb-3 block">
                ← Back
              </button>
            )}
            <button
              onClick={isLast ? handleSubmit : () => setCurrentQ(currentQ + 1)}
              disabled={submitting || !answers[q?.id]}
              className="w-full py-3 rounded-[10px] text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#0A1628' }}
            >
              {submitting ? 'Submitting...' : isLast ? 'Submit' : 'Next →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyResponse;
