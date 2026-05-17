import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import ResidentHeader from '@/components/resident/ResidentHeader';
import { format } from 'date-fns';

const BookingConfirmed: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    amenityName: string;
    amenityType: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    playType: string;
  } | null;

  const fmtTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const dh = h % 12 === 0 ? 12 : h % 12;
    return `${dh}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const fmtDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = mins / 60;
    return h === 1 ? '1 hr' : `${h} hr`;
  };

  const fmtDate = (d: string) => {
    const [y, mo, day] = d.split('-').map(Number);
    return format(new Date(y, mo - 1, day), 'EEEE, MMMM d, yyyy');
  };

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F9FAFB' }}>
        <div className="text-center">
          <p style={{ color: '#9CA3AF', marginBottom: 16 }}>No booking data found.</p>
          <button onClick={() => navigate('/book')} style={{ color: '#00D4FF', fontWeight: 700 }}>
            Back to Amenities
          </button>
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Date', value: fmtDate(state.date) },
    { label: 'Time', value: `${fmtTime(state.startTime)} – ${fmtTime(state.endTime)}` },
    { label: 'Duration', value: fmtDuration(state.duration) },
    { label: 'Type', value: state.playType.charAt(0).toUpperCase() + state.playType.slice(1) },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9FAFB' }}>
      <ResidentHeader compact>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/book')}
            className="flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Booking Confirmed!</div>
        </div>
      </ResidentHeader>

      <div className="flex-1 flex flex-col items-center" style={{ padding: '40px 16px 100px' }}>
        {/* Success circle */}
        <div style={{
          width: 80, height: 80, borderRadius: 99, background: '#E6FFFA',
          border: '2px solid #00D4FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Check className="h-8 w-8" style={{ color: '#00D4FF' }} />
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F1F3D', marginBottom: 24 }}>
          You're booked!
        </div>

        {/* Summary card */}
        <div style={{
          background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB',
          width: '100%', maxWidth: 400, overflow: 'hidden',
        }}>
          <div style={{ padding: 16, borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F1F3D' }}>{state.amenityName}</div>
            <div style={{ fontSize: 13, color: '#4B5563' }}>{state.amenityType}</div>
          </div>
          {rows.map((row, i) => (
            <div
              key={row.label}
              className="flex items-center justify-between"
              style={{
                padding: '12px 16px',
                borderBottom: i < rows.length - 1 ? '1px solid #E5E7EB' : 'none',
              }}
            >
              <span style={{ fontSize: 13, color: '#4B5563' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1F3D' }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate('/book')}
          className="w-full min-h-[44px]"
          style={{
            marginTop: 24, maxWidth: 400, borderRadius: 12, padding: 14,
            fontSize: 15, fontWeight: 800, border: 'none',
            background: '#0F1F3D', color: '#FFFFFF', cursor: 'pointer',
          }}
        >
          Back to Amenities
        </button>
      </div>
    </div>
  );
};

export default BookingConfirmed;
