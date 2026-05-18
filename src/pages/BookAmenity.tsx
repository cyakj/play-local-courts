import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useActiveHOA } from '../contexts/ActiveHOAContext';
import { AlertCircle, Waves, Flame, Sparkles } from 'lucide-react';
import AmenityRulesDialog from '../components/AmenityRulesDialog';

// ── Context-aware SVG icons ──────────────────────────────────────────────────

const TennisBallIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M5.5 5.5C8 8 8 16 5.5 18.5"/>
    <path d="M18.5 5.5C16 8 16 16 18.5 18.5"/>
  </svg>
);

const DumbbellSvgIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M6 4v16M18 4v16"/>
    <path d="M4 7h4M16 7h4M4 17h4M16 17h4"/>
    <path d="M8 10h8v4H8z"/>
  </svg>
);

const BasketballIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2v20M2 12h20"/>
    <path d="M5 5c2 2 4 4 4 7s-2 5-4 7"/>
    <path d="M19 5c-2 2-4 4-4 7s2 5 4 7"/>
  </svg>
);

const ClubhouseSvgIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 21h18M3 7l9-4 9 4"/>
    <path d="M3 21V7M21 21V7"/>
    <rect x="9" y="12" width="6" height="9"/>
    <path d="M9 7h.01M15 7h.01"/>
  </svg>
);

const ParkingCarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 17H3v-5l2-5h14l2 5v5h-2"/>
    <circle cx="7" cy="17" r="2"/>
    <circle cx="17" cy="17" r="2"/>
    <path d="M5 12h14"/>
  </svg>
);

const FallbackGridIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

// ── Icon config map ──────────────────────────────────────────────────────────

type AmenityIconEntry = { Icon: React.ElementType; color: string; bg: string };

const amenityIconConfig: Record<string, AmenityIconEntry> = {
  tennis:     { Icon: TennisBallIcon,   color: '#00D4FF', bg: '#E0F9FF' },
  pickleball: { Icon: TennisBallIcon,   color: '#00D4FF', bg: '#E0F9FF' },
  pool:       { Icon: Waves,            color: '#0369A1', bg: '#E0F9FF' },
  barbecue:   { Icon: Flame,            color: '#F97066', bg: '#FFF5F5' },
  clubhouse:  { Icon: ClubhouseSvgIcon, color: '#0F1F3D', bg: '#F3F4F6' },
  gym:        { Icon: DumbbellSvgIcon,  color: '#8892A4', bg: '#F3F4F6' },
  fitness:    { Icon: DumbbellSvgIcon,  color: '#8892A4', bg: '#F3F4F6' },
  jacuzzi:    { Icon: Sparkles,         color: '#0369A1', bg: '#E0F9FF' },
  spa:        { Icon: Sparkles,         color: '#0369A1', bg: '#E0F9FF' },
  basketball: { Icon: BasketballIcon,   color: '#F97066', bg: '#FFF5F5' },
  parking:    { Icon: ParkingCarIcon,   color: '#8892A4', bg: '#F3F4F6' },
};

const amenityLabels: Record<string, string> = {
  tennis: 'Court', pickleball: 'Court', pool: 'Pool', barbecue: 'BBQ Area',
  clubhouse: 'Clubhouse', gym: 'Gym', fitness: 'Gym', jacuzzi: 'Spa', spa: 'Spa',
  basketball: 'Court', parking: 'Parking',
};

const filterMap: Record<string, string[]> = {
  all: [],
  courts: ['tennis', 'pickleball', 'basketball'],
  pools: ['pool', 'jacuzzi', 'spa'],
  other: ['barbecue', 'clubhouse', 'gym', 'fitness', 'parking'],
};

const BookAmenity: React.FC = () => {
  const { currentUser } = useAuth();
  const { amenities } = useData();
  const { isHOAUser, loading: hoaLoading } = useActiveHOA();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [rulesAmenity, setRulesAmenity] = useState<{ id: string; name: string; amenityType: string } | null>(null);

  if (!hoaLoading && !isHOAUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: '#F9FAFB' }}>
        <div className="w-full max-w-sm bg-white rounded-2xl p-8 text-center border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F3F4F6' }}>
            <AlertCircle className="h-7 w-7" style={{ color: '#8892A4' }} />
          </div>
          <h2 className="text-[18px] font-extrabold mb-2" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>Community Required</h2>
          <p className="text-[13px] mb-6" style={{ color: '#8892A4' }}>You need to be a member of a community to book amenities.</p>
          <Link to="/my-home?tab=community" className="block w-full py-3 rounded-xl text-[14px] font-bold text-white text-center mb-2 min-h-[44px] flex items-center justify-center" style={{ backgroundColor: '#0F1F3D' }}>
            Join a Community
          </Link>
          <Link to="/" className="block w-full py-3 rounded-xl text-[14px] font-bold text-center min-h-[44px] flex items-center justify-center border border-gray-200" style={{ color: '#6B7280', backgroundColor: '#F3F4F6' }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const filtered = activeFilter === 'all'
    ? amenities
    : amenities.filter(a => filterMap[activeFilter]?.includes(a.amenityType));

  const getStatus = (id: string) => {
    const h = id.charCodeAt(0) % 3;
    return h === 0 ? 'open' : h === 1 ? 'open' : 'closed';
  };

  const filters = ['all', 'courts', 'pools', 'other'];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9FAFB' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0F1F3D' }} className="px-5 pt-12 pb-8 relative overflow-visible">
        <div className="text-[13px] uppercase font-semibold mb-1" style={{ color: '#00D4FF', letterSpacing: '0.15em' }}>
          Amenities
        </div>
        <h1 className="text-[32px] font-black text-white leading-[1.1] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Book Amenity
        </h1>
        <p className="text-cyan-200 mt-2 leading-relaxed" style={{ fontSize: '15px', opacity: 0.85 }}>
          Reserve your spot instantly.
        </p>
        <div
          className="absolute -bottom-6 left-0 right-0 h-8 pointer-events-none z-0"
          style={{ background: 'linear-gradient(to bottom, #0F1F3D, transparent)' }}
        />
      </div>

      {/* Filter chips */}
      <div style={{ paddingTop: 32, paddingLeft: 16, paddingRight: 16, paddingBottom: 0 }}>
        <div className="flex gap-2 overflow-x-auto" style={{ paddingBottom: 6 }}>
          {filters.map(f => {
            const active = activeFilter === f;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className="min-h-[44px]"
                style={{
                  padding: '10px 18px',
                  borderRadius: 99,
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  border: active ? 'none' : '1.5px solid #E5E7EB',
                  background: active ? '#0F1F3D' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#9CA3AF',
                  cursor: 'pointer',
                }}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '14px 16px 8px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase' }}>
        Available Amenities
      </div>

      {/* Amenity cards */}
      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(amenity => {
          const status = getStatus(amenity.id);
          const isClosed = status === 'closed';
          const label = amenityLabels[amenity.amenityType] || amenity.amenityType;
          const iconEntry = amenityIconConfig[amenity.amenityType] || { Icon: FallbackGridIcon, color: '#8892A4', bg: '#F3F4F6' };
          const { Icon: AmenityIcon, color: iconColor, bg: iconBg } = iconEntry;

          return (
            <div
              key={amenity.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid rgba(15,31,61,0.08)',
                padding: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                {/* Icon */}
                <div style={{
                  width: 52, height: 52, borderRadius: 14, backgroundColor: iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <AmenityIcon className="h-6 w-6" style={{ color: iconColor }} />
                </div>
                {/* Name + type */}
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>{amenity.name}</div>
                  <div style={{ fontSize: 11, color: '#8892A4', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: 2 }}>{label}</div>
                </div>
                {/* Status badge */}
                <div style={{
                  padding: '4px 10px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  background: isClosed ? '#FEF2F2' : '#E0F9FF',
                  color: isClosed ? '#EF4444' : '#0369A1',
                  border: `1px solid ${isClosed ? '#EF4444' : '#00D4FF'}`,
                }}>
                  {isClosed ? 'Closed' : 'Open Now'}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => !isClosed && navigate(`/book/${amenity.id}`)}
                  disabled={isClosed}
                  className="min-h-[44px] flex-1"
                  style={{
                    borderRadius: 10,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: isClosed ? 'default' : 'pointer',
                    background: isClosed ? '#E5E7EB' : '#00D4FF',
                    color: isClosed ? '#9CA3AF' : '#FFFFFF',
                    padding: '11px 0',
                  }}
                >
                  Book Now →
                </button>
                <button
                  onClick={() => {}}
                  className="min-h-[44px]"
                  style={{
                    borderRadius: 10,
                    border: '1.5px solid #E5E7EB',
                    background: '#FFFFFF',
                    color: '#4B5563',
                    fontSize: 13,
                    fontWeight: 700,
                    padding: '11px 16px',
                    cursor: 'pointer',
                  }}
                >
                  Rules
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#F3F4F6' }}>
              <FallbackGridIcon className="h-7 w-7" style={{ color: '#D1D5DB' }} />
            </div>
            <div className="text-[15px] font-bold mb-1" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>No Amenities Available</div>
            <div className="text-[13px]" style={{ color: '#8892A4' }}>Check back later or try a different filter.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookAmenity;
