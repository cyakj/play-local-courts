import React, { useState } from 'react';
import { format } from 'date-fns';

interface BookingSlot {
  time: string;
  endTime: string;
  displayStart: string;
  displayEnd: string;
  bookingId?: string;
  unitNumber?: string;
  playType?: string;
  userId?: string;
  state: string;
}

interface BookingDetailSheetProps {
  slot: BookingSlot;
  amenityName: string;
  selectedDate: Date;
  onClose: () => void;
  onCancel: (slot: BookingSlot) => void;
}

const BookingDetailSheet: React.FC<BookingDetailSheetProps> = ({
  slot,
  amenityName,
  selectedDate,
  onClose,
  onCancel,
}) => {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    await onCancel(slot);
    setCancelling(false);
  };

  const details = [
    { label: 'Unit', value: slot.unitNumber || 'Unknown' },
    { label: 'Time', value: `${slot.displayStart} – ${slot.displayEnd}` },
    { label: 'Type', value: slot.playType === 'doubles' ? 'Doubles' : 'Singles' },
    { label: 'Duration', value: '1 hr' },
    { label: 'Status', value: 'Confirmed', isStatus: true },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white"
        style={{ borderRadius: '20px 20px 0 0', padding: '20px 20px 36px' }}
      >
        {/* Handle */}
        <div className="flex justify-center mb-5">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#E5E7EB' }} />
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#00B4D8' }}>
              Booking Detail
            </div>
            <div className="text-lg font-extrabold" style={{ color: '#1A1A2E' }}>{amenityName}</div>
          </div>
          <div
            onClick={onClose}
            className="flex items-center justify-center cursor-pointer"
            style={{ width: 32, height: 32, borderRadius: 99, backgroundColor: '#F0F4F8' }}
          >
            <span className="text-base" style={{ color: '#9CA3AF' }}>✕</span>
          </div>
        </div>

        {/* Detail rows */}
        {details.map((d, i) => (
          <div
            key={d.label}
            className="flex justify-between"
            style={{
              paddingBottom: i < details.length - 1 ? 12 : 0,
              marginBottom: i < details.length - 1 ? 12 : 0,
              borderBottom: i < details.length - 1 ? '1px solid #E5E7EB' : 'none',
            }}
          >
            <span className="text-[13px]" style={{ color: '#9CA3AF' }}>{d.label}</span>
            <span className="text-[13px] font-bold" style={{ color: d.isStatus ? '#2DD4BF' : '#1A1A2E' }}>
              {d.value}
            </span>
          </div>
        ))}

        {/* Cancel section */}
        <div className="mt-5">
          {!confirming ? (
            <div
              onClick={() => setConfirming(true)}
              className="text-center cursor-pointer text-sm font-extrabold"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1.5px solid #EF4444',
                color: '#EF4444',
                borderRadius: 12,
                padding: 13,
              }}
            >
              Cancel This Booking
            </div>
          ) : (
            <div>
              <div className="text-[13px] text-center mb-3 leading-relaxed" style={{ color: '#4B5563' }}>
                Are you sure? {slot.unitNumber} will be notified their booking was cancelled.
              </div>
              <div className="flex gap-2.5">
                <div
                  onClick={() => setConfirming(false)}
                  className="flex-1 text-center cursor-pointer text-[13px] font-bold"
                  style={{
                    border: '1.5px solid #E5E7EB',
                    color: '#4B5563',
                    borderRadius: 12,
                    padding: 13,
                  }}
                >
                  Keep It
                </div>
                <div
                  onClick={cancelling ? undefined : handleCancel}
                  className="flex-1 text-center cursor-pointer text-[13px] font-extrabold text-white"
                  style={{
                    backgroundColor: '#EF4444',
                    borderRadius: 12,
                    padding: 13,
                    opacity: cancelling ? 0.6 : 1,
                  }}
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BookingDetailSheet;
