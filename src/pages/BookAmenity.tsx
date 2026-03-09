import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useActiveHOA } from '../contexts/ActiveHOAContext';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ResidentHeader from '@/components/resident/ResidentHeader';

const amenityIcons: Record<string, string> = {
  tennis: '🎾', pickleball: '🏓', pool: '🏊', barbecue: '🍖',
  clubhouse: '🏠', gym: '💪', jacuzzi: '♨️',
};

const amenityLabels: Record<string, string> = {
  tennis: 'Court', pickleball: 'Court', pool: 'Pool', barbecue: 'BBQ Area',
  clubhouse: 'Clubhouse', gym: 'Gym', jacuzzi: 'Spa',
};

const filterMap: Record<string, string[]> = {
  all: [],
  courts: ['tennis', 'pickleball'],
  pools: ['pool', 'jacuzzi'],
  other: ['barbecue', 'clubhouse', 'gym'],
};

const BookAmenity: React.FC = () => {
  const { currentUser } = useAuth();
  const { amenities } = useData();
  const { isHOAUser, loading: hoaLoading } = useActiveHOA();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  if (!hoaLoading && !isHOAUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F0F4F8' }}>
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto" style={{ color: '#9CA3AF' }} />
            <h2 className="text-xl font-semibold">Community Membership Required</h2>
            <p style={{ color: '#4B5563' }}>You need to be a member of a community to book amenities.</p>
            <Button asChild className="w-full" style={{ background: '#0A1628' }}><Link to="/my-home?tab=community">Join a Community</Link></Button>
            <Button asChild variant="outline" className="w-full"><Link to="/">Back to Home</Link></Button>
          </CardContent>
        </Card>
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
    <div className="min-h-screen flex flex-col" style={{ background: '#F0F4F8' }}>
      <ResidentHeader compact>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Book Amenity</div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>Reserve your spot instantly</div>
      </ResidentHeader>

      {/* Filter chips */}
      <div style={{ padding: '14px 16px 0' }}>
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
                  background: active ? '#0A1628' : '#FFFFFF',
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
          const icon = amenityIcons[amenity.amenityType] || '🏢';
          const label = amenityLabels[amenity.amenityType] || amenity.amenityType;

          return (
            <div
              key={amenity.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid #E5E7EB',
                padding: 16,
              }}
            >
              <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                {/* Icon */}
                <div style={{
                  width: 52, height: 52, borderRadius: 14, background: '#E0F7FA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0,
                }}>
                  {icon}
                </div>
                {/* Name + type */}
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{amenity.name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</div>
                </div>
                {/* Status badge */}
                <div style={{
                  padding: '4px 10px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  background: isClosed ? '#FEF2F2' : '#E6FFFA',
                  color: isClosed ? '#EF4444' : '#2DD4BF',
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
                    background: isClosed ? '#E5E7EB' : '#00B4D8',
                    color: isClosed ? '#9CA3AF' : '#FFFFFF',
                    padding: '11px 0',
                  }}
                >
                  Book Now →
                </button>
                <button
                  onClick={() => setRulesAmenityId(amenity.id)}
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
                  <FileText className="h-4 w-4 inline mr-1" style={{ verticalAlign: '-2px' }} />
                  Rules
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center" style={{ padding: 40, color: '#9CA3AF' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>No Amenities Available</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Check back later or try a different filter.</div>
          </div>
        )}
      </div>

      {rulesAmenityId && (
        <AmenityRulesDialog
          amenityId={rulesAmenityId}
          amenityName={amenities.find(a => a.id === rulesAmenityId)?.name || ''}
          open={!!rulesAmenityId}
          onOpenChange={(open) => !open && setRulesAmenityId(null)}
        />
      )}
    </div>
  );
};

export default BookAmenity;
