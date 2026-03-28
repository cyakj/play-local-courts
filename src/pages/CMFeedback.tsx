import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { useToast } from '@/hooks/use-toast';

const categories = ['Bug', 'Feature Request', 'General'];

const CMFeedback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [category, setCategory] = useState('General');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim()) {
      toast({ title: 'Please enter your feedback', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    // For now, just show success. Could insert into a feedback table later.
    setTimeout(() => {
      toast({ title: 'Feedback sent', description: 'Thank you for your feedback!' });
      setSubmitting(false);
      navigate(-1);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <span className="text-xl font-extrabold">Send Feedback</span>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-24 space-y-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] space-y-4">
          <div>
            <label className="text-[12px] font-bold text-[#4B5563] mb-1.5 block">Category</label>
            <div className="flex gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all ${
                    category === c
                      ? 'bg-[#00B4D8] text-white'
                      : 'bg-[#F0F4F8] text-[#4B5563]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-bold text-[#4B5563] mb-1.5 block">Your Feedback</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tell us what's on your mind..."
              rows={5}
              className="w-full px-3.5 py-3 rounded-[10px] border border-[#E5E7EB] text-sm text-[#1A1A2E] resize-none focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8]"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-[12px] text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #00B4D8 0%, #0095B6 100%)' }}
        >
          {submitting ? 'Sending...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  );
};

export default CMFeedback;
