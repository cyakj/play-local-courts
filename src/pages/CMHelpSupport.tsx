import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, HelpCircle, FileText, ShieldCheck, ChevronRight, ChevronDown,
  MessageSquare, Send, ExternalLink,
} from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SUBJECT_OPTIONS = [
  'Bug report',
  'Feature request',
  'Billing',
  'General question',
];

const FAQ_ITEMS = [
  {
    q: 'How do I book a court?',
    a: 'Go to the Book tab at the bottom of the screen. Select your community, choose an amenity, pick a date and time, then tap Confirm Booking. You\'ll receive a confirmation notification.',
  },
  {
    q: 'How do I cancel a booking?',
    a: 'Navigate to My Reservations and find your upcoming booking. Tap the booking to open details, then tap Cancel Booking. Cancellations within 2 hours of the start time may not be refunded.',
  },
  {
    q: 'How do I report a maintenance issue?',
    a: 'Tap the Reports icon in the bottom navigation bar. Tap "New Report", select the affected amenity or location, describe the issue, optionally add a photo, then submit. Admins will be notified immediately.',
  },
  {
    q: 'How do I add a new community?',
    a: 'From the Portfolio screen, scroll down and tap "Add Community". Enter the community details, confirm, and the community will appear in your portfolio once set up.',
  },
  {
    q: 'How do I approve new members?',
    a: 'Navigate to the community\'s member requests section (Pending Requests in the admin area). Review each pending member, tap Approve or Decline, and they\'ll be notified of the decision.',
  },
  {
    q: 'What is the health score?',
    a: 'The health score (0–100) reflects the overall status of a community, calculated from open issues, pending approvals, and activity levels. 70+ is Optimal, 40–69 is Needs Attention, below 40 is Critical.',
  },
  {
    q: 'How do I contact my residents?',
    a: 'From the community dashboard, tap Announcements or use the notifications feature to send a message to all approved members. Residents will receive an in-app notification and optionally an email.',
  },
];

const CMHelpSupport = () => {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [messageFocused, setMessageFocused] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Insert into a support_tickets table if it exists, otherwise use email
      const { error } = await supabase.from('support_tickets' as any).insert({
        user_id: user?.id,
        user_email: user?.email,
        subject,
        message: message.trim(),
        created_at: new Date().toISOString(),
      }).select();

      if (error) {
        // Fall back to mailto if table doesn't exist
        const mailtoUrl = `mailto:support@tenisx.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message.trim())}`;
        window.open(mailtoUrl);
      } else {
        toast.success('Message sent! We\'ll get back to you within 24 hours.');
      }
      setMessage('');
    } catch {
      const mailtoUrl = `mailto:support@tenisx.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message.trim())}`;
      window.open(mailtoUrl);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div>
            <span className="text-xl font-extrabold block">Support</span>
            <span className="text-[11px] text-white/60">Help center & contact</span>
          </div>
        </div>
      </CMHeader>

      <div className="px-4 pt-4 pb-28 space-y-5">

        {/* Contact Support */}
        <section>
          <div
            className="text-[11px] uppercase font-semibold mb-3"
            style={{ color: '#8892A4', letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}
          >
            Contact Support
          </div>

          {/* Email button */}
          <a
            href="mailto:support@tenisx.ai"
            className="flex items-center gap-3 bg-white rounded-2xl px-4 py-4 mb-3 active:scale-[0.98] transition-transform"
            style={{
              boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)',
              border: '1px solid rgba(15,31,61,0.06)',
              textDecoration: 'none',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#E0F9FF' }}
            >
              <Mail className="h-5 w-5" style={{ color: '#0369A1' }} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-[15px]" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                Email Support
              </div>
              <div className="text-[12px]" style={{ color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
                support@tenisx.ai
              </div>
            </div>
            <ExternalLink className="h-4 w-4" style={{ color: '#8892A4' }} />
          </a>

          {/* Send a message form */}
          <div
            className="bg-white rounded-2xl p-5"
            style={{
              boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)',
              border: '1px solid rgba(15,31,61,0.06)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4" style={{ color: '#00D4FF' }} />
              <span className="font-bold text-[15px]" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                Send a Message
              </span>
            </div>

            {/* Subject dropdown */}
            <div className="mb-3 relative">
              <label
                className="block text-[12px] font-medium mb-1.5"
                style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}
              >
                Subject
              </label>
              <button
                type="button"
                onClick={() => setSubjectOpen(!subjectOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left"
                style={{
                  border: `1px solid ${subjectOpen ? '#00D4FF' : 'rgba(15,31,61,0.15)'}`,
                  boxShadow: subjectOpen ? '0 0 0 3px rgba(0,212,255,0.15)' : 'none',
                  background: 'white',
                  fontSize: 14,
                  color: '#0F1F3D',
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                  borderRadius: 8,
                }}
              >
                {subject}
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ color: '#8892A4', transform: subjectOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
              {subjectOpen && (
                <div
                  className="absolute left-0 right-0 mt-1 bg-white rounded-xl overflow-hidden z-10"
                  style={{ boxShadow: '0px 8px 24px rgba(15,31,61,0.12)', border: '1px solid rgba(15,31,61,0.08)' }}
                >
                  {SUBJECT_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setSubject(opt); setSubjectOpen(false); }}
                      className="w-full text-left px-4 py-3 text-[14px] transition-colors"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        color: opt === subject ? '#00D4FF' : '#0F1F3D',
                        background: opt === subject ? 'rgba(0,212,255,0.05)' : 'white',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Message textarea */}
            <div className="mb-4">
              <label
                className="block text-[12px] font-medium mb-1.5"
                style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}
              >
                Message
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onFocus={() => setMessageFocused(true)}
                onBlur={() => setMessageFocused(false)}
                placeholder="Describe your question or issue..."
                rows={4}
                className="w-full resize-none"
                style={{
                  border: `1px solid ${messageFocused ? '#00D4FF' : 'rgba(15,31,61,0.15)'}`,
                  boxShadow: messageFocused ? '0 0 0 3px rgba(0,212,255,0.15)' : 'none',
                  borderRadius: 8,
                  padding: '12px 14px',
                  fontSize: 14,
                  color: '#0F1F3D',
                  fontFamily: 'Inter, sans-serif',
                  background: 'white',
                  outline: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxSizing: 'border-box',
                  width: '100%',
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!message.trim() || sending}
              className="w-full flex items-center justify-center gap-2 rounded-[12px] text-white font-bold active:scale-[0.97] transition-transform"
              style={{
                minHeight: 48,
                background: !message.trim() || sending ? '#8892A4' : '#0F1F3D',
                fontSize: 15,
                fontFamily: 'Manrope, sans-serif',
                border: 'none',
                cursor: !message.trim() || sending ? 'not-allowed' : 'pointer',
              }}
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </section>

        {/* FAQ Section */}
        <section>
          <div
            className="text-[11px] uppercase font-semibold mb-3"
            style={{ color: '#8892A4', letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}
          >
            Frequently Asked Questions
          </div>
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{
              boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)',
              border: '1px solid rgba(15,31,61,0.06)',
            }}
          >
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div key={idx} style={{ borderBottom: idx < FAQ_ITEMS.length - 1 ? '1px solid rgba(15,31,61,0.06)' : 'none' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <span
                      className="font-semibold text-[14px] flex-1"
                      style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}
                    >
                      {item.q}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 flex-shrink-0 transition-transform duration-200"
                      style={{
                        color: '#8892A4',
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div
                      className="px-5 pb-4"
                      style={{
                        fontSize: 14,
                        color: '#4B5563',
                        fontFamily: 'Inter, sans-serif',
                        lineHeight: 1.6,
                      }}
                    >
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Links Section */}
        <section>
          <div
            className="text-[11px] uppercase font-semibold mb-3"
            style={{ color: '#8892A4', letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}
          >
            Policies & Information
          </div>
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{
              boxShadow: '0px 2px 8px rgba(15,31,61,0.04), 0px 12px 32px rgba(15,31,61,0.04)',
              border: '1px solid rgba(15,31,61,0.06)',
            }}
          >
            {[
              { label: 'Privacy Policy', icon: ShieldCheck, action: () => navigate('/privacy') },
              { label: 'Terms of Service', icon: FileText, action: () => navigate('/terms') },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F9FAFB] transition-colors min-h-[52px] ${idx < 1 ? 'border-b' : ''}`}
                  style={{ borderColor: 'rgba(15,31,61,0.06)', background: 'none', border: idx < 1 ? '0 0 1px 0 solid rgba(15,31,61,0.06)' : 'none', cursor: 'pointer' }}
                >
                  <div className="p-2 bg-[#F9FAFB] rounded-lg">
                    <Icon className="h-4 w-4" style={{ color: '#4B5563' }} />
                  </div>
                  <span className="flex-1 text-left font-semibold text-[14px]" style={{ color: '#0F1F3D', fontFamily: 'Inter, sans-serif' }}>
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4" style={{ color: '#8892A4' }} />
                </button>
              );
            })}
          </div>

          {/* App version */}
          <div
            className="mt-3 px-5 py-3 rounded-2xl bg-white flex items-center justify-between"
            style={{
              boxShadow: '0px 2px 8px rgba(15,31,61,0.04)',
              border: '1px solid rgba(15,31,61,0.06)',
            }}
          >
            <span className="text-[13px] font-medium" style={{ color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
              App Version
            </span>
            <span className="text-[13px] font-bold" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
              TenisX v1.0.0
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CMHelpSupport;
