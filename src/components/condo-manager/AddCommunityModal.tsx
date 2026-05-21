import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AMENITY_OPTIONS = ['Tennis Court', 'Pool', 'Gym', 'Clubhouse', 'Barbecue', 'Jacuzzi', 'Pickleball'];

interface AddCommunityModalProps {
  communities: any[];
  currentUserId?: string;
  onClose: () => void;
  onCreated: () => void;
}

const AddCommunityModal = ({ communities, currentUserId, onClose, onCreated }: AddCommunityModalProps) => {
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newUnits, setNewUnits] = useState('');
  const [newAmenities, setNewAmenities] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const toggleAmenity = (a: string) => {
    setNewAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !currentUserId) return;
    setCreating(true);

    const { data: hoa, error } = await supabase.from('hoas').insert({
      name: newName.trim(),
      address: newAddress.trim() || null,
      admin_id: currentUserId,
    }).select('id').single();

    if (error || !hoa) {
      toast.error('Failed to create community');
      setCreating(false);
      return;
    }

    await supabase.from('hoa_memberships').insert({
      hoa_id: hoa.id,
      user_id: currentUserId,
      role: 'admin',
      status: 'approved',
      is_primary: communities.length === 0,
    });

    if (newAmenities.length > 0) {
      const amenityRows = newAmenities.map(name => ({
        hoa_id: hoa.id,
        name,
        court_type: name.toLowerCase().replace(/\s+/g, '_'),
      }));
      await supabase.from('courts').insert(amenityRows);
    }

    toast.success('Community created');
    onClose();
    setCreating(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-4 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="text-lg font-extrabold text-foreground mb-4">Add Community</div>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Community Name"
          className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-3"
        />
        <input
          value={newAddress}
          onChange={e => setNewAddress(e.target.value)}
          placeholder="Address"
          className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-3"
        />
        <input
          type="number"
          value={newUnits}
          onChange={e => setNewUnits(e.target.value)}
          placeholder="Total Units"
          min="1"
          className="w-full px-3 py-2.5 rounded-xl border border-border text-sm mb-3"
        />
        <div className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">Amenities</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {AMENITY_OPTIONS.map(a => (
            <div
              key={a}
              onClick={() => toggleAmenity(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border min-h-[44px] flex items-center transition-colors ${
                newAmenities.includes(a)
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-gray-50 text-muted-foreground border-border'
              }`}
            >
              {a}
            </div>
          ))}
        </div>
        <button
          onClick={!creating ? handleCreate : undefined}
          disabled={creating}
          className="w-full bg-emerald-700 text-white rounded-xl py-3 text-sm font-bold min-h-[44px] disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Community'}
        </button>
        <div
          onClick={onClose}
          className="text-center mt-3 cursor-pointer underline"
          style={{ color: '#0F1F3D', fontSize: '15px', fontWeight: 500 }}
        >
          Cancel
        </div>
      </div>
    </div>
  );
};

export default AddCommunityModal;
