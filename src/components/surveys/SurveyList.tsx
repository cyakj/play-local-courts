import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SurveyStatusBadge } from './SurveyStatusBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Survey {
  id: string;
  title: string;
  description: string | null;
  audience: string;
  status: string;
  opens_at: string;
  closes_at: string;
  created_at: string;
  results_visibility: string;
  results_reveal: string;
  anonymous: boolean;
  response_count: number;
  total_members: number;
}

interface SurveyListProps {
  communityId: string;
  communityName: string;
  onNewSurvey: () => void;
  onViewResults: (surveyId: string) => void;
  onEditSurvey: (survey: Survey) => void;
}

export const SurveyList: React.FC<SurveyListProps> = ({
  communityId,
  communityName,
  onNewSurvey,
  onViewResults,
  onEditSurvey,
}) => {
  const { currentUser } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [publishing, setPublishing] = useState<string | null>(null);

  const fetchSurveys = async () => {
    const { data } = await supabase
      .from('hoa_surveys')
      .select('*')
      .eq('hoa_id', communityId)
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const surveyIds = data.map(s => s.id);
    const [responsesRes, membersRes] = await Promise.all([
      surveyIds.length > 0
        ? supabase.from('hoa_survey_responses').select('survey_id').in('survey_id', surveyIds)
        : { data: [] },
      supabase.from('hoa_memberships').select('id', { count: 'exact', head: true }).eq('hoa_id', communityId).eq('status', 'approved'),
    ]);

    const countMap = new Map<string, number>();
    (responsesRes.data || []).forEach(r => {
      countMap.set(r.survey_id, (countMap.get(r.survey_id) || 0) + 1);
    });
    const totalMembers = membersRes.count || 0;

    setSurveys(data.map(s => ({
      ...s,
      results_visibility: (s as any).results_visibility || 'admin_only',
      results_reveal: (s as any).results_reveal || 'on_close',
      anonymous: (s as any).anonymous ?? true,
      response_count: countMap.get(s.id) || 0,
      total_members: totalMembers,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchSurveys(); }, [communityId]);

  const handleCloseEarly = async (surveyId: string) => {
    if (!confirm('Close this survey early? Residents will no longer be able to respond.')) return;
    const { error } = await supabase.from('hoa_surveys').update({ status: 'closed', closes_at: new Date().toISOString() }).eq('id', surveyId);
    if (error) { toast.error('Failed to close survey'); return; }
    toast.success('Survey closed');
    fetchSurveys();
  };

  const handlePublish = async (survey: Survey) => {
    // Check it has questions
    const { data: questions } = await supabase
      .from('hoa_survey_questions')
      .select('id')
      .eq('survey_id', survey.id);
    if (!questions || questions.length === 0) {
      toast.error('Add at least one question before publishing');
      return;
    }
    if (!confirm('Publish this survey? Residents will be notified.')) return;
    setPublishing(survey.id);
    const { error } = await supabase
      .from('hoa_surveys')
      .update({ status: 'active' })
      .eq('id', survey.id);
    if (error) { toast.error('Failed to publish survey'); setPublishing(null); return; }

    // Send notifications
    const { data: members } = await supabase
      .from('hoa_memberships')
      .select('user_id')
      .eq('hoa_id', communityId)
      .eq('status', 'approved');
    if (members && members.length > 0 && currentUser?.id) {
      await supabase.from('hoa_notifications').insert(
        members.map(m => ({
          user_id: m.user_id,
          hoa_id: communityId,
          type: 'survey_published',
          title: `New survey: ${survey.title}`,
          body: `A new community survey is available — closes ${new Date(survey.closes_at).toLocaleDateString()}`,
        }))
      );
    }

    toast.success('Survey published!');
    setPublishing(null);
    fetchSurveys();
  };

  const filtered = surveys.filter(s => {
    if (filter === 'All') return true;
    return s.status === filter.toLowerCase();
  });

  const filters = ['All', 'Active', 'Draft', 'Closed'];

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-extrabold" style={{ color: '#1A1A2E' }}>Surveys</div>
        <div
          onClick={onNewSurvey}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer min-h-[36px]"
          style={{ background: '#00B4D8', color: '#fff' }}
        >
          + New Survey
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {filters.map(f => (
          <div
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-full text-xs font-bold cursor-pointer"
            style={{
              padding: '6px 14px',
              background: filter === f ? '#0A1628' : '#FFFFFF',
              color: filter === f ? '#fff' : '#9CA3AF',
              border: `1px solid ${filter === f ? '#0A1628' : '#E5E7EB'}`,
            }}
          >
            {f}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-3 border-[#00B4D8]/20 border-t-[#00B4D8] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {filtered.map(s => {
            const pct = s.total_members > 0 ? Math.round((s.response_count / s.total_members) * 100) : 0;
            return (
              <div
                key={s.id}
                className="rounded-2xl p-4 mb-3 border"
                style={{ background: '#FFFFFF', borderColor: '#E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-3">
                    <div className="text-[15px] font-extrabold" style={{ color: '#1A1A2E' }}>{s.title}</div>
                    <div className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>
                      {s.status === 'closed' ? 'Closed' : 'Closes'} {new Date(s.closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <SurveyStatusBadge status={s.status} />
                </div>

                {/* Response rate bar */}
                <div className="mb-3">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[11px] font-semibold" style={{ color: '#9CA3AF' }}>Responses</span>
                    <span className="text-[11px] font-extrabold" style={{ color: '#1A1A2E' }}>
                      {s.response_count}/{s.total_members}{' '}
                      <span style={{ color: '#9CA3AF', fontWeight: 600 }}>({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F4F8' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00B4D8, #2DD4BF)' }}
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {s.status === 'draft' && (
                    <div
                      onClick={() => !publishing && handlePublish(s)}
                      className="flex-1 rounded-[10px] py-2.5 text-xs font-bold text-center cursor-pointer min-h-[40px] flex items-center justify-center"
                      style={{ background: '#00B4D8', color: '#fff', opacity: publishing === s.id ? 0.6 : 1 }}
                    >
                      {publishing === s.id ? 'Publishing...' : '🚀 Publish'}
                    </div>
                  )}
                  {s.status !== 'draft' && (
                    <div
                      onClick={() => onViewResults(s.id)}
                      className="flex-1 rounded-[10px] py-2.5 text-xs font-bold text-center cursor-pointer min-h-[40px] flex items-center justify-center"
                      style={{ background: '#0A1628', color: '#fff' }}
                    >
                      View Results
                    </div>
                  )}
                  <div
                    onClick={() => onEditSurvey(s)}
                    className="flex-1 rounded-[10px] py-2.5 text-xs font-bold text-center cursor-pointer border min-h-[40px] flex items-center justify-center"
                    style={{ borderColor: '#E5E7EB', color: '#4B5563' }}
                  >
                    Edit
                  </div>
                  {s.status === 'active' && (
                    <div
                      onClick={() => handleCloseEarly(s.id)}
                      className="rounded-[10px] py-2.5 px-3 text-xs font-bold text-center cursor-pointer border min-h-[40px] flex items-center justify-center"
                      style={{ borderColor: '#EF4444', color: '#EF4444' }}
                    >
                      Close
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-10" style={{ color: '#9CA3AF' }}>
              No {filter === 'All' ? '' : filter.toLowerCase()} surveys yet
            </div>
          )}
        </>
      )}
    </div>
  );
};
