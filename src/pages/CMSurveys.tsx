import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Survey {
  id: string;
  title: string;
  description: string | null;
  audience: string;
  status: string;
  opens_at: string;
  closes_at: string;
  created_at: string;
  response_count?: number;
}

interface Question {
  id?: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  position: number;
}

const CMSurveys = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { communities } = useCondoManagerCommunities();
  const community = communities.find(c => c.id === id);

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [showResults, setShowResults] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  // Create form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('all_residents');
  const [closesAt, setClosesAt] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);

  const fetchSurveys = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('hoa_surveys')
      .select('*')
      .eq('hoa_id', id)
      .order('created_at', { ascending: false });

    if (data) {
      // Get response counts
      const surveyIds = data.map(s => s.id);
      const { data: responses } = await supabase
        .from('hoa_survey_responses')
        .select('survey_id')
        .in('survey_id', surveyIds);

      const countMap = new Map<string, number>();
      (responses || []).forEach(r => {
        countMap.set(r.survey_id, (countMap.get(r.survey_id) || 0) + 1);
      });

      setSurveys(data.map(s => ({ ...s, response_count: countMap.get(s.id) || 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchSurveys(); }, [id]);

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', ''],
      position: prev.length,
    }]);
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const addOption = (qIdx: number) => {
    setQuestions(prev => prev.map((q, i) =>
      i === qIdx ? { ...q, options: [...(q.options || []), ''] } : q
    ));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...(q.options || [])];
      opts[oIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: (q.options || []).filter((_, j) => j !== oIdx) };
    }));
  };

  const handlePublish = async (asDraft: boolean) => {
    if (!title.trim() || !closesAt || !id || !currentUser?.id) return;
    if (questions.length === 0 && !asDraft) {
      toast.error('Add at least one question');
      return;
    }

    const { data: survey, error } = await supabase.from('hoa_surveys').insert({
      hoa_id: id,
      created_by: currentUser.id,
      title: title.trim(),
      description: description.trim() || null,
      audience,
      status: asDraft ? 'draft' : 'active',
      closes_at: new Date(closesAt).toISOString(),
    }).select('id').single();

    if (error || !survey) {
      toast.error('Failed to create survey');
      return;
    }

    // Insert questions
    if (questions.length > 0) {
      const questionRows = questions.map((q, i) => ({
        survey_id: survey.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.question_type === 'multiple_choice' ? q.options : null,
        position: i,
      }));
      await supabase.from('hoa_survey_questions').insert(questionRows);
    }

    // Send notifications if publishing
    if (!asDraft) {
      const { data: members } = await supabase
        .from('hoa_memberships')
        .select('user_id')
        .eq('hoa_id', id)
        .eq('status', 'approved');

      if (members) {
        const notifs = members.map(m => ({
          user_id: m.user_id,
          hoa_id: id,
          type: 'survey_published' as const,
          title: `New survey: ${title.trim()}`,
          body: `A new survey is available — closes ${new Date(closesAt).toLocaleDateString()}`,
        }));
        await supabase.from('hoa_notifications').insert(notifs);
      }
    }

    toast.success(asDraft ? 'Draft saved' : 'Survey published');
    setShowCreate(false);
    setTitle('');
    setDescription('');
    setQuestions([]);
    fetchSurveys();
  };

  const viewResults = async (surveyId: string) => {
    const { data: qs } = await supabase
      .from('hoa_survey_questions')
      .select('*')
      .eq('survey_id', surveyId)
      .order('position');

    const { data: responses } = await supabase
      .from('hoa_survey_responses')
      .select('answers')
      .eq('survey_id', surveyId);

    setResults({ questions: qs || [], responses: responses || [] });
    setShowResults(surveyId);
  };

  const filteredSurveys = surveys.filter(s =>
    tab === 'active' ? s.status === 'active' || s.status === 'draft' : s.status === 'closed'
  );

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <div onClick={() => navigate(`/cm/community/${id}`)} className="bg-white/[0.12] rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-xl font-extrabold">Community Surveys</div>
            <div className="text-xs opacity-65">{community?.name} · {surveys.filter(s => s.status === 'active').length} active</div>
          </div>
          <div onClick={() => setShowCreate(true)} className="bg-cm-navy text-white rounded-[10px] px-3.5 py-2 text-xs font-bold cursor-pointer min-h-[44px] flex items-center">
            ＋ Create
          </div>
        </div>
      </CMHeader>

      {/* Tabs */}
      <div className="flex bg-white border-b border-cm-border flex-shrink-0">
        {(['active', 'closed'] as const).map(t => (
          <div key={t} onClick={() => setTab(t)}
            className="flex-1 py-3 text-center text-[11px] font-bold capitalize cursor-pointer"
            style={{
              color: tab === t ? 'hsl(var(--cm-cyan))' : 'hsl(var(--cm-text-light))',
              borderBottom: tab === t ? '2px solid hsl(var(--cm-cyan))' : '2px solid transparent',
            }}>
            {t}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-3 border-cm-cyan/20 border-t-cm-cyan rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {filteredSurveys.map(s => (
              <div key={s.id} className="bg-white rounded-[14px] p-4 mb-3 border border-cm-border">
                <div className="flex justify-between mb-2">
                  <div className="text-sm font-extrabold text-cm-text">{s.title}</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                    background: s.status === 'active' ? '#2DD4BF' : '#F0F4F8',
                    color: s.status === 'active' ? '#fff' : '#9CA3AF',
                  }}>
                    {s.status}
                  </span>
                </div>
                <div className="text-[11px] text-cm-cyan font-semibold">{s.audience === 'all_residents' ? 'All Residents' : 'Board Only'}</div>
                <div className="mt-2 h-2 bg-cm-border rounded-full overflow-hidden">
                  <div className="h-full bg-cm-cyan rounded-full" style={{ width: `${Math.min(100, (s.response_count || 0) * 10)}%` }} />
                </div>
                <div className="flex justify-between mt-1.5">
                  <div className="text-[11px] text-cm-text-light">{s.response_count || 0} responses</div>
                </div>
                <div className="text-[11px] text-cm-text-light italic mt-1">
                  {s.status === 'closed' ? 'Closed' : 'Closes'} {new Date(s.closes_at).toLocaleDateString()}
                </div>
                <div onClick={() => viewResults(s.id)}
                  className="mt-3 bg-cm-navy text-white rounded-[10px] py-2 text-xs font-bold text-center cursor-pointer w-full min-h-[44px] flex items-center justify-center">
                  View Results →
                </div>
              </div>
            ))}
            {filteredSurveys.length === 0 && (
              <div className="text-center py-10 text-cm-text-light">No {tab} surveys</div>
            )}
          </>
        )}
      </div>

      {/* Create Survey Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-4 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="text-lg font-extrabold text-cm-navy mb-4">Create Survey</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Survey title" className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3 resize-none" />
            <select value={audience} onChange={e => setAudience(e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3">
              <option value="all_residents">All Residents</option>
              <option value="board_only">Board Only</option>
            </select>
            <input type="date" value={closesAt} onChange={e => setClosesAt(e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-4" />

            <div className="text-[13px] font-bold text-cm-text mb-2">Questions</div>
            {questions.map((q, qi) => (
              <div key={qi} className="bg-cm-app-bg rounded-xl p-3 mb-2 border border-cm-border">
                <div className="flex justify-between mb-2">
                  <span className="text-[11px] font-bold text-cm-text-light">Q{qi + 1}</span>
                  <Trash2 className="h-4 w-4 text-cm-danger cursor-pointer" onClick={() => removeQuestion(qi)} />
                </div>
                <input value={q.question_text} onChange={e => updateQuestion(qi, 'question_text', e.target.value)} placeholder="Question text" className="w-full px-2.5 py-2 rounded-lg border border-cm-border text-xs mb-2" />
                <select value={q.question_type} onChange={e => updateQuestion(qi, 'question_type', e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-cm-border text-xs mb-2">
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="yes_no">Yes / No</option>
                  <option value="rating">Rating 1–5</option>
                  <option value="open_text">Open Text</option>
                </select>
                {q.question_type === 'multiple_choice' && (
                  <>
                    {(q.options || []).map((opt, oi) => (
                      <div key={oi} className="flex gap-2 mb-1">
                        <input value={opt} onChange={e => updateOption(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="flex-1 px-2 py-1.5 rounded-lg border border-cm-border text-xs" />
                        {(q.options || []).length > 2 && (
                          <Trash2 className="h-4 w-4 text-cm-text-light cursor-pointer mt-1" onClick={() => removeOption(qi, oi)} />
                        )}
                      </div>
                    ))}
                    {(q.options || []).length < 6 && (
                      <div onClick={() => addOption(qi)} className="text-[11px] text-cm-cyan font-bold cursor-pointer mt-1">+ Add Option</div>
                    )}
                  </>
                )}
              </div>
            ))}
            <div onClick={addQuestion} className="border-2 border-dashed border-cm-cyan rounded-xl p-3 text-center text-cm-cyan text-xs font-bold cursor-pointer mb-4">
              ＋ Add Question
            </div>

            <div onClick={() => handlePublish(false)} className="bg-cm-navy text-white rounded-[10px] py-3 text-sm font-bold text-center cursor-pointer w-full mb-2 min-h-[44px] flex items-center justify-center">
              Publish Survey
            </div>
            <div onClick={() => handlePublish(true)} className="bg-cm-app-bg text-cm-text-mid rounded-[10px] py-3 text-sm font-bold text-center cursor-pointer w-full mb-2 min-h-[44px] flex items-center justify-center">
              Save Draft
            </div>
            <div onClick={() => setShowCreate(false)} className="text-center text-sm text-cm-text-light cursor-pointer">Cancel</div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResults && results && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-4 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="flex justify-between mb-4">
              <div className="text-lg font-extrabold text-cm-navy">Survey Results</div>
              <div className="text-xs text-cm-text-light">{results.responses.length} responses</div>
            </div>
            {results.questions.map((q: any, qi: number) => (
              <div key={qi} className="mb-4">
                <div className="text-sm font-bold text-cm-text mb-2">Q{qi + 1}: {q.question_text}</div>
                {q.question_type === 'multiple_choice' || q.question_type === 'yes_no' ? (
                  (() => {
                    const opts = q.question_type === 'yes_no' ? ['Yes', 'No'] : (q.options || []);
                    const counts: Record<string, number> = {};
                    opts.forEach((o: string) => { counts[o] = 0; });
                    results.responses.forEach((r: any) => {
                      const answer = r.answers?.[q.id];
                      if (answer && counts[answer] !== undefined) counts[answer]++;
                    });
                    const total = results.responses.length || 1;
                    return opts.map((opt: string) => (
                      <div key={opt} className="mb-1.5">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-cm-text">{opt}</span>
                          <span className="text-cm-text-light">{counts[opt]} ({Math.round((counts[opt] / total) * 100)}%)</span>
                        </div>
                        <div className="h-2 bg-cm-border rounded-full overflow-hidden">
                          <div className="h-full bg-cm-cyan rounded-full" style={{ width: `${(counts[opt] / total) * 100}%` }} />
                        </div>
                      </div>
                    ));
                  })()
                ) : q.question_type === 'rating' ? (
                  (() => {
                    const ratings = results.responses.map((r: any) => Number(r.answers?.[q.id] || 0)).filter((n: number) => n > 0);
                    const avg = ratings.length > 0 ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : '—';
                    return <div className="text-3xl font-black text-cm-cyan">{avg}<span className="text-sm text-cm-text-light">/5</span></div>;
                  })()
                ) : (
                  <div className="max-h-32 overflow-y-auto">
                    {results.responses.map((r: any, ri: number) => (
                      r.answers?.[q.id] ? <div key={ri} className="text-xs text-cm-text bg-cm-app-bg p-2 rounded-lg mb-1">{r.answers[q.id]}</div> : null
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div onClick={() => setShowResults(null)} className="bg-cm-navy text-white rounded-[10px] py-3 text-sm font-bold text-center cursor-pointer w-full mt-4 min-h-[44px] flex items-center justify-center">
              Close
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CMSurveys;
