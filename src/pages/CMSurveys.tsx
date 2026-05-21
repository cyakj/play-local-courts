import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { SurveyList } from '@/components/surveys/SurveyList';
import { SurveyBuilder } from '@/components/surveys/SurveyBuilder';
import { SurveyResults } from '@/components/surveys/SurveyResults';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';

const CMSurveys = () => {
  const { id } = useParams();
  const communityId = id!;
  const navigate = useNavigate();
  const { communities } = useCondoManagerCommunities();
  const community = communities.find(c => c.id === communityId);

  const [showSurveyBuilder, setShowSurveyBuilder] = useState(false);
  const [surveyResultsId, setSurveyResultsId] = useState<string | null>(null);
  const [editSurveyId, setEditSurveyId] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate(`/cm/community/${communityId}`)}
            className="bg-white/[0.12] rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-xl font-extrabold">Surveys</div>
            <div className="text-xs opacity-65">{community?.name}</div>
          </div>
        </div>
      </CMHeader>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <SurveyList
          key={listKey}
          communityId={communityId}
          communityName={community?.name || ''}
          onNewSurvey={() => { setEditSurveyId(null); setShowSurveyBuilder(true); }}
          onViewResults={(id) => setSurveyResultsId(id)}
          onEditSurvey={(s) => { setEditSurveyId(s.id); setShowSurveyBuilder(true); }}
        />
      </div>

      {showSurveyBuilder && (
        <SurveyBuilder
          communityId={communityId}
          onBack={() => setShowSurveyBuilder(false)}
          onComplete={() => { setShowSurveyBuilder(false); setListKey(k => k + 1); }}
          editSurveyId={editSurveyId}
        />
      )}

      {surveyResultsId && (
        <SurveyResults
          surveyId={surveyResultsId}
          communityId={communityId}
          onBack={() => setSurveyResultsId(null)}
        />
      )}
    </div>
  );
};

export default CMSurveys;
