import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Question {
  id?: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  position: number;
  required: boolean;
}

interface SurveyBuilderProps {
  communityId: string;
  onBack: () => void;
  onComplete: () => void;
  editSurveyId?: string | null;
}

const STEPS = ['Details', 'Questions', 'Settings'];
const TYPE_ICONS: Record<string, string> = { rating: '⭐', multiple_choice: '☑️', yes_no: '✅', open_text: '✏️' };
const TYPE_LABELS: Record<string, string> = { rating: 'Rating 1–5', multiple_choice: 'Multiple Choice', yes_no: 'Yes / No', open_text: 'Open Text' };

export const SurveyBuilder: React.FC<SurveyBuilderProps> = ({ communityId, onBack, onComplete, editSurveyId }) => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('all_residents');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [resultsVisibility, setResultsVisibility] = useState('admin_only');
  const [resultsReveal, setResultsReveal] = useState('on_close');
  const [anonymous, setAnonymous] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing survey if editing
  useEffect(() => {
    if (!editSurveyId) return;
    const load = async () => {
      const { data: survey } = await supabase.from('hoa_surveys').select('*').eq('id', editSurveyId).single();
      if (survey) {
        setTitle(survey.title);
        setDescription(survey.description || '');
        setAudience(survey.audience);
        setOpensAt(survey.opens_at ? new Date(survey.opens_at).toISOString().split('T')[0] : '');
        setClosesAt(survey.closes_at ? new Date(survey.closes_at).toISOString().split('T')[0] : '');
        setResultsVisibility((survey as any).results_visibility || 'admin_only');
        setResultsReveal((survey as any).results_reveal || 'on_close');
        setAnonymous((survey as any).anonymous ?? true);
      }
      const { data: qs } = await supabase.from('hoa_survey_questions').select('*').eq('survey_id', editSurveyId).order('position');
      if (qs) {
        setQuestions(qs.map(q => ({
          ...q,
          options: Array.isArray(q.options) ? q.options as string[] : null,
          required: (q as any).required ?? true,
        })));
      }
    };
    load();
  }, [editSurveyId]);

  const addQuestion = (type: string) => {
    setQuestions(prev => [...prev, {
      question_text: '',
      question_type: type,
      options: type === 'multiple_choice' ? ['', ''] : null,
      position: prev.length,
      required: true,
    }]);
    setShowTypePicker(false);
  };

  const updateQuestion = (idx: number, updates: Partial<Question>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
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

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) { toast.error('Enter a survey title'); return; }
    if (!closesAt) { toast.error('Set a closing date'); return; }
    if (publish && questions.length === 0) { toast.error('Add at least one question'); return; }
    if (!currentUser?.id) return;

    setSaving(true);
    const status = publish ? 'active' : 'draft';
    const surveyData = {
      hoa_id: communityId,
      created_by: currentUser.id,
      title: title.trim(),
      description: description.trim() || null,
      audience,
      status,
      opens_at: opensAt ? new Date(opensAt).toISOString() : new Date().toISOString(),
      closes_at: new Date(closesAt).toISOString(),
      results_visibility: resultsVisibility,
      results_reveal: resultsReveal,
      anonymous,
    };

    let surveyId = editSurveyId;
    if (editSurveyId) {
      const { error } = await supabase.from('hoa_surveys').update(surveyData).eq('id', editSurveyId);
      if (error) { toast.error('Failed to update survey'); setSaving(false); return; }
      // Delete old questions and re-insert
      await supabase.from('hoa_survey_questions').delete().eq('survey_id', editSurveyId);
    } else {
      const { data, error } = await supabase.from('hoa_surveys').insert(surveyData).select('id').single();
      if (error || !data) { toast.error('Failed to create survey'); setSaving(false); return; }
      surveyId = data.id;
    }

    // Insert questions
    if (questions.length > 0 && surveyId) {
      const rows = questions.map((q, i) => ({
        survey_id: surveyId!,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.question_type === 'multiple_choice' ? q.options : null,
        position: i,
        required: q.required,
      }));
      await supabase.from('hoa_survey_questions').insert(rows);
    }

    // Send notifications if publishing
    if (publish && !editSurveyId) {
      const { data: members } = await supabase
        .from('hoa_memberships')
        .select('user_id')
        .eq('hoa_id', communityId)
        .eq('status', 'approved');
      if (members) {
        const notifs = members.map(m => ({
          user_id: m.user_id,
          hoa_id: communityId,
          type: 'survey_published',
          title: `New survey: ${title.trim()}`,
          body: `A new community survey is available — closes ${new Date(closesAt).toLocaleDateString()}`,
        }));
        await supabase.from('hoa_notifications').insert(notifs);
      }
    }

    toast.success(publish ? 'Survey published' : 'Draft saved');
    setSaving(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#F0F4F8' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D2137 60%, #1A3350 100%)', padding: '44px 20px 16px', color: '#fff', flexShrink: 0 }}>
        <div className="flex items-center gap-3 mb-3">
          <div onClick={onBack} className="rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div className="text-lg font-extrabold">{editSurveyId ? 'Edit Survey' : 'New Survey'}</div>
        </div>
        {/* Step tabs */}
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              onClick={() => setStep(i)}
              className="flex-1 rounded-md py-1.5 text-center cursor-pointer text-[10px] font-bold"
              style={{
                background: step === i ? 'rgba(0,180,216,0.9)' : 'rgba(255,255,255,0.15)',
                color: step === i ? '#fff' : 'rgba(255,255,255,0.5)',
                border: step === i ? 'none' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {i + 1}. {s}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        {/* Step 0 - Details */}
        {step === 0 && (
          <>
            <div className="rounded-2xl p-4 mb-3 border" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Survey Details</div>
              <div className="mb-3">
                <div className="text-xs font-bold mb-1.5" style={{ color: '#4B5563' }}>Title <span style={{ color: '#EF4444' }}>*</span></div>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Survey title" className="w-full px-3 py-2.5 rounded-[10px] border text-sm" style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }} />
              </div>
              <div>
                <div className="text-xs font-bold mb-1.5" style={{ color: '#4B5563' }}>Description</div>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} className="w-full px-3 py-2.5 rounded-[10px] border text-sm resize-none" style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }} />
              </div>
            </div>

            {/* Audience */}
            <div className="rounded-2xl p-4 mb-3 border" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Audience</div>
              {[
                { key: 'all_residents', icon: '👥', label: 'All Residents', desc: 'Every member of this community' },
                { key: 'board_only', icon: '🏛', label: 'Board Members Only', desc: 'Only board members will see & respond' },
              ].map(a => (
                <div
                  key={a.key}
                  onClick={() => setAudience(a.key)}
                  className="flex items-center gap-3 p-3 rounded-xl mb-1.5 cursor-pointer border-[1.5px]"
                  style={{
                    background: audience === a.key ? '#E0F7FA' : 'transparent',
                    borderColor: audience === a.key ? '#00B4D8' : '#E5E7EB',
                  }}
                >
                  <span className="text-xl">{a.icon}</span>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold" style={{ color: '#1A1A2E' }}>{a.label}</div>
                    <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{a.desc}</div>
                  </div>
                  <div className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center" style={{ borderColor: audience === a.key ? '#00B4D8' : '#E5E7EB', background: audience === a.key ? '#00B4D8' : 'transparent' }}>
                    {audience === a.key && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Schedule */}
            <div className="rounded-2xl p-4 mb-3 border" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Schedule</div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="text-xs font-bold mb-1.5" style={{ color: '#4B5563' }}>Opens</div>
                  <input type="date" value={opensAt} onChange={e => setOpensAt(e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] border text-sm" style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold mb-1.5" style={{ color: '#4B5563' }}>Closes <span style={{ color: '#EF4444' }}>*</span></div>
                  <input type="date" value={closesAt} onChange={e => setClosesAt(e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] border text-sm" style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 1 - Questions */}
        {step === 1 && (
          <>
            <div className="flex justify-between items-center mb-3">
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Questions ({questions.length})</div>
              <div
                onClick={() => setShowTypePicker(v => !v)}
                className="text-xs font-bold cursor-pointer rounded-full px-3 py-1.5"
                style={{ color: '#00B4D8', background: '#E0F7FA' }}
              >
                + Add Question
              </div>
            </div>

            {/* Type picker */}
            {showTypePicker && (
              <div className="rounded-2xl p-4 mb-3 border-[1.5px] border-dashed" style={{ borderColor: '#00B4D8', background: '#fff' }}>
                <div className="text-xs font-bold text-center mb-3" style={{ color: '#4B5563' }}>Choose Question Type</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: 'multiple_choice', icon: '☑️', label: 'Multiple Choice' },
                    { type: 'yes_no', icon: '✅', label: 'Yes / No' },
                    { type: 'rating', icon: '⭐', label: 'Rating 1–5' },
                    { type: 'open_text', icon: '✏️', label: 'Open Text' },
                  ].map(t => (
                    <div
                      key={t.type}
                      onClick={() => addQuestion(t.type)}
                      className="border rounded-xl p-3.5 text-center cursor-pointer"
                      style={{ borderColor: '#E5E7EB', background: '#F0F4F8' }}
                    >
                      <div className="text-2xl mb-1.5">{t.icon}</div>
                      <div className="text-[11px] font-bold" style={{ color: '#4B5563' }}>{t.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.map((q, qi) => (
              <div key={qi} className="rounded-2xl p-4 mb-2.5 border" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-base flex-shrink-0" style={{ background: '#E0F7FA' }}>
                    {TYPE_ICONS[q.question_type]}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#00B4D8' }}>
                        {TYPE_LABELS[q.question_type]}{!q.required && ' · Optional'}
                      </div>
                      <Trash2 className="h-4 w-4 cursor-pointer" style={{ color: '#EF4444' }} onClick={() => removeQuestion(qi)} />
                    </div>
                    <input
                      value={q.question_text}
                      onChange={e => updateQuestion(qi, { question_text: e.target.value })}
                      placeholder="Question text"
                      className="w-full px-2.5 py-2 rounded-lg border text-xs mb-2"
                      style={{ borderColor: '#E5E7EB' }}
                    />
                    {q.question_type === 'multiple_choice' && (
                      <>
                        {(q.options || []).map((opt, oi) => (
                          <div key={oi} className="flex gap-2 mb-1">
                            <input
                              value={opt}
                              onChange={e => updateOption(qi, oi, e.target.value)}
                              placeholder={`Option ${oi + 1}`}
                              className="flex-1 px-2 py-1.5 rounded-lg border text-xs"
                              style={{ borderColor: '#E5E7EB' }}
                            />
                            {(q.options || []).length > 2 && (
                              <Trash2 className="h-4 w-4 cursor-pointer mt-1" style={{ color: '#9CA3AF' }} onClick={() => removeOption(qi, oi)} />
                            )}
                          </div>
                        ))}
                        {(q.options || []).length < 6 && (
                          <div onClick={() => addOption(qi)} className="text-[11px] font-bold cursor-pointer mt-1" style={{ color: '#00B4D8' }}>+ Add Option</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* Required toggle */}
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t" style={{ borderColor: '#E5E7EB' }}>
                  <div className="text-[10px]" style={{ color: '#9CA3AF', letterSpacing: 2 }}>⠿ drag to reorder</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: '#9CA3AF' }}>Required</span>
                    <div
                      onClick={() => updateQuestion(qi, { required: !q.required })}
                      className="relative cursor-pointer rounded-full"
                      style={{ width: 32, height: 18, background: q.required ? '#00B4D8' : '#E5E7EB' }}
                    >
                      <div
                        className="absolute top-0.5 rounded-full bg-white transition-all"
                        style={{ width: 14, height: 14, left: q.required ? 16 : 2 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {questions.length === 0 && !showTypePicker && (
              <div className="text-center py-10" style={{ color: '#9CA3AF' }}>
                <div className="text-3xl mb-3">📋</div>
                <div className="text-sm font-semibold">No questions yet</div>
                <div className="text-xs mt-1">Tap "+ Add Question" to get started</div>
              </div>
            )}
          </>
        )}

        {/* Step 2 - Settings */}
        {step === 2 && (
          <>
            {/* Results visibility */}
            <div className="rounded-2xl p-4 mb-3 border" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Results Visibility</div>
              <div className="text-xs mb-3" style={{ color: '#4B5563', lineHeight: 1.5 }}>Who can see the results after the survey closes?</div>
              {[
                { key: 'admin_only', icon: '🔒', label: 'Admin Only', desc: 'Only you see the results' },
                { key: 'board_and_admin', icon: '👥', label: 'Board + Admin', desc: 'Board members can also view results' },
                { key: 'community', icon: '🌐', label: 'Whole Community', desc: 'All residents see results after submitting' },
              ].map(v => (
                <div
                  key={v.key}
                  onClick={() => setResultsVisibility(v.key)}
                  className="flex items-center gap-3 p-2.5 rounded-xl mb-1.5 cursor-pointer border-[1.5px]"
                  style={{
                    background: resultsVisibility === v.key ? '#E0F7FA' : 'transparent',
                    borderColor: resultsVisibility === v.key ? '#00B4D8' : '#E5E7EB',
                  }}
                >
                  <span className="text-xl">{v.icon}</span>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold" style={{ color: '#1A1A2E' }}>{v.label}</div>
                    <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{v.desc}</div>
                  </div>
                  <div className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center" style={{ borderColor: resultsVisibility === v.key ? '#00B4D8' : '#E5E7EB', background: resultsVisibility === v.key ? '#00B4D8' : 'transparent' }}>
                    {resultsVisibility === v.key && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Reveal timing */}
            {resultsVisibility === 'community' && (
              <div className="rounded-2xl p-4 mb-3 border" style={{ background: '#E0F7FA', borderColor: '#00B4D8' }}>
                <div className="text-xs font-bold mb-2.5" style={{ color: '#0A1628' }}>When should residents see results?</div>
                {[
                  { key: 'on_submit', label: 'Immediately after they submit' },
                  { key: 'on_close', label: 'Only after survey closes' },
                ].map(o => (
                  <div key={o.key} onClick={() => setResultsReveal(o.key)} className="flex items-center gap-2.5 mb-2 cursor-pointer">
                    <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: '#00B4D8', background: resultsReveal === o.key ? '#00B4D8' : 'transparent' }} />
                    <div className="text-[13px]" style={{ color: '#0A1628', fontWeight: resultsReveal === o.key ? 700 : 400 }}>{o.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Anonymous toggle */}
            <div className="rounded-2xl p-4 mb-3 border" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[13px] font-bold" style={{ color: '#1A1A2E' }}>Anonymous Responses</div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>Residents' names are hidden from results</div>
                </div>
                <div
                  onClick={() => setAnonymous(!anonymous)}
                  className="relative cursor-pointer rounded-full"
                  style={{ width: 40, height: 22, background: anonymous ? '#00B4D8' : '#E5E7EB' }}
                >
                  <div
                    className="absolute rounded-full bg-white transition-all"
                    style={{ width: 16, height: 16, top: 3, left: anonymous ? 20 : 3 }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t p-4 pb-7 flex gap-2.5" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
        {step > 0 && (
          <div
            onClick={() => setStep(s => s - 1)}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold text-center cursor-pointer border"
            style={{ borderColor: '#E5E7EB', color: '#4B5563' }}
          >
            ← Back
          </div>
        )}
        {step < 2 && (
          <div
            onClick={() => setStep(s => s + 1)}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold text-center cursor-pointer border"
            style={{ borderColor: '#E5E7EB', color: '#4B5563' }}
          >
            Next: {STEPS[step + 1]} →
          </div>
        )}
        <div
          onClick={() => !saving && handleSave(true)}
          className="flex-[2] rounded-xl py-3 text-[13px] font-extrabold text-center cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #00B4D8, #0091B5)',
            color: '#fff',
            opacity: saving ? 0.6 : 1,
            boxShadow: '0 4px 12px rgba(0,180,216,0.3)',
          }}
        >
          {saving ? 'Publishing...' : '🚀 Publish Survey'}
        </div>
        {step === 0 && (
          <div
            onClick={() => !saving && handleSave(false)}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold text-center cursor-pointer border"
            style={{ borderColor: '#E5E7EB', color: '#4B5563', opacity: saving ? 0.6 : 1 }}
          >
            Save Draft
          </div>
        )}
      </div>
    </div>
  );
};
