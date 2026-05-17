import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Navigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { AmenityStatus } from '../types';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

const AMENITY_TYPES = [
  { value: 'tennis', label: 'Tennis' },
  { value: 'pickleball', label: 'Pickleball' },
  { value: 'pool', label: 'Pool' },
  { value: 'gym', label: 'Gym' },
  { value: 'clubhouse', label: 'Clubhouse' },
  { value: 'barbecue', label: 'Barbecue' },
  { value: 'jacuzzi', label: 'Jacuzzi' },
] as const;

const ManageCourts = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const { amenities, addAmenity, removeAmenity, getTimeSlots, setAmenityMaintenance } = useData();

  const [newAmenityName, setNewAmenityName] = useState('');
  const [newAmenityType, setNewAmenityType] = useState<'tennis' | 'pickleball' | 'barbecue' | 'jacuzzi' | 'pool' | 'gym' | 'clubhouse'>('tennis');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedAmenity, setSelectedAmenity] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return { value: format(date, 'yyyy-MM-dd'), label: format(date, 'EEE, MMM d'), date };
  });

  const timeSlots = selectedAmenity && selectedDate
    ? getTimeSlots(format(selectedDate, 'yyyy-MM-dd'), selectedAmenity)
    : [];

  const handleAddAmenity = () => {
    if (!currentUser || !newAmenityName.trim()) return;
    addAmenity(newAmenityName, currentUser.hoaId, newAmenityType);
    setNewAmenityName('');
    setShowAddForm(false);
  };

  const handleRemoveAmenity = (amenityId: string) => {
    if (window.confirm('Remove this amenity? All bookings will also be removed.')) {
      removeAmenity(amenityId);
      if (selectedAmenity === amenityId) setSelectedAmenity('');
    }
  };

  const handleMaintenanceToggle = (slotId: string, isMaintenance: boolean) => {
    if (!selectedAmenity || !selectedDate) return;
    const slot = timeSlots.find((s) => s.id === slotId);
    if (slot) {
      const hour = new Date(slot.start).getHours();
      setAmenityMaintenance(selectedAmenity, format(selectedDate, 'yyyy-MM-dd'), hour, isMaintenance);
    }
  };

  const slotBg = (status: string) => {
    if (status === AmenityStatus.MAINTENANCE) return { bg: '#FFFBEB', border: '#F59E0B', text: '#B45309' };
    if (status === AmenityStatus.BOOKED) return { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B' };
    return { bg: '#F9FAFB', border: '#E5E7EB', text: '#0F1F3D' };
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-28">
      {/* Header */}
      <div style={{ backgroundColor: '#0F1F3D' }} className="px-5 pt-12 pb-8 relative overflow-visible">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/admin')} className="text-white active:scale-95 transition-transform">
            <ArrowLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="text-[13px] uppercase font-semibold mb-1" style={{ color: '#00D4FF', letterSpacing: '0.15em' }}>
          Admin
        </div>
        <h1 className="text-[32px] font-black text-white leading-[1.1] tracking-tight">
          Manage Amenities
        </h1>
        <p className="text-cyan-200 mt-2 leading-relaxed" style={{ fontSize: '15px', opacity: 0.85 }}>
          Add, remove, and schedule maintenance for your community amenities.
        </p>
        <div className="absolute -bottom-6 left-0 right-0 h-8 pointer-events-none z-0"
          style={{ background: 'linear-gradient(to bottom, #0F1F3D, transparent)' }} />
      </div>

      <div className="px-5 pt-8 space-y-4">

        {/* Add Amenity toggle */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-gray-200 active:scale-[0.98] transition-transform"
          >
            <Plus className="h-5 w-5" style={{ color: '#00D4FF' }} />
            <span className="text-[14px] font-bold" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>Add New Amenity</span>
          </button>
        ) : (
          <div className="bg-white rounded-2xl p-5 border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="text-[16px] font-extrabold mb-4" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>New Amenity</div>

            <div className="text-[12px] uppercase font-semibold mb-1.5" style={{ color: '#374151', letterSpacing: '0.08em' }}>Name</div>
            <input
              value={newAmenityName}
              onChange={(e) => setNewAmenityName(e.target.value)}
              placeholder="e.g., Tennis Court 3, Pool Area"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm mb-4 outline-none focus:border-[#00D4FF] transition-colors"
              style={{ color: '#0F1F3D' }}
            />

            <div className="text-[12px] uppercase font-semibold mb-2" style={{ color: '#374151', letterSpacing: '0.08em' }}>Type</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {AMENITY_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setNewAmenityType(t.value)}
                  className="rounded-xl border px-3 py-2.5 text-[13px] font-semibold text-center transition-colors"
                  style={{
                    borderColor: newAmenityType === t.value ? '#00D4FF' : '#E5E7EB',
                    backgroundColor: newAmenityType === t.value ? 'rgba(0,212,255,0.08)' : 'transparent',
                    color: newAmenityType === t.value ? '#00D4FF' : '#6B7280',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 min-h-[44px] underline"
                style={{ color: '#0F1F3D', backgroundColor: '#F3F4F6', fontSize: '15px', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddAmenity}
                disabled={!newAmenityName.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white min-h-[44px] disabled:opacity-40"
                style={{ backgroundColor: '#0F1F3D' }}
              >
                Add Amenity
              </button>
            </div>
          </div>
        )}

        {/* Existing Amenities */}
        {amenities.length > 0 && (
          <div>
            <h2 className="text-[18px] font-bold mb-3" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
              Current Amenities
            </h2>

            {/* Date Selector */}
            <div className="mb-3">
              <div className="text-[12px] uppercase font-semibold mb-1.5" style={{ color: '#374151', letterSpacing: '0.08em' }}>Select Date for Maintenance</div>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {dateOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedDate(opt.date)}
                    className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-colors min-h-[44px]"
                    style={{
                      backgroundColor: format(selectedDate, 'yyyy-MM-dd') === opt.value ? '#0F1F3D' : '#FFFFFF',
                      color: format(selectedDate, 'yyyy-MM-dd') === opt.value ? '#FFFFFF' : '#6B7280',
                      border: '1px solid',
                      borderColor: format(selectedDate, 'yyyy-MM-dd') === opt.value ? '#0F1F3D' : '#E5E7EB',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {amenities.map((amenity) => (
              <div
                key={amenity.id}
                className="bg-white rounded-2xl mb-3 border border-gray-100"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-extrabold" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                      {amenity.name}
                    </div>
                    <div className="text-[13px] capitalize mt-0.5" style={{ color: '#4B5563' }}>{amenity.amenityType}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedAmenity(selectedAmenity === amenity.id ? '' : amenity.id)}
                      className="px-3 py-2 rounded-xl text-xs font-bold min-h-[44px] transition-colors"
                      style={{
                        backgroundColor: selectedAmenity === amenity.id ? '#0F1F3D' : '#F3F4F6',
                        color: selectedAmenity === amenity.id ? '#FFFFFF' : '#6B7280',
                      }}
                    >
                      {selectedAmenity === amenity.id ? 'Hide Slots' : 'Time Slots'}
                    </button>
                    <button
                      onClick={() => handleRemoveAmenity(amenity.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl"
                      style={{ backgroundColor: '#FEF2F2' }}
                    >
                      <Trash2 className="h-4 w-4" style={{ color: '#EF4444' }} />
                    </button>
                  </div>
                </div>

                {selectedAmenity === amenity.id && (
                  <div className="px-4 pb-4">
                    <div className="text-[12px] uppercase font-semibold mb-2" style={{ color: '#374151', letterSpacing: '0.08em' }}>
                      Time Slots — {format(selectedDate, 'EEE, MMM d')}
                    </div>
                    {timeSlots.length === 0 ? (
                      <div className="text-[14px] text-center py-4" style={{ color: '#4B5563' }}>No slots available</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {timeSlots.map((slot) => {
                          const startTime = new Date(slot.start);
                          const endTime = new Date(slot.end);
                          const isMaintenance = slot.status === AmenityStatus.MAINTENANCE;
                          const colors = slotBg(slot.status);
                          return (
                            <div
                              key={slot.id}
                              className="p-2.5 rounded-xl flex flex-col gap-1"
                              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
                            >
                              <div className="text-[12px] font-bold" style={{ color: colors.text }}>
                                {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} –{' '}
                                {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div className="text-[11px] uppercase font-semibold" style={{ color: '#4B5563', letterSpacing: '0.08em' }}>
                                {slot.status === AmenityStatus.AVAILABLE && 'Available'}
                                {slot.status === AmenityStatus.BOOKED && 'Booked'}
                                {slot.status === AmenityStatus.MAINTENANCE && 'Maintenance'}
                              </div>
                              {slot.status !== AmenityStatus.BOOKED && (
                                <button
                                  onClick={() => handleMaintenanceToggle(slot.id, !isMaintenance)}
                                  className="text-[10px] font-bold py-1 rounded-lg mt-0.5 min-h-[32px]"
                                  style={{
                                    backgroundColor: isMaintenance ? '#F3F4F6' : '#FFFBEB',
                                    color: isMaintenance ? '#6B7280' : '#B45309',
                                  }}
                                >
                                  {isMaintenance ? 'Make Available' : 'Set Maintenance'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {amenities.length === 0 && !showAddForm && (
          <div className="text-center py-10">
            <div className="text-[15px] font-semibold mb-1" style={{ color: '#0F1F3D' }}>No amenities yet</div>
            <div className="text-[14px]" style={{ color: '#4B5563' }}>Tap above to add your first amenity.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCourts;
