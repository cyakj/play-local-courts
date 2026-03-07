import React, { useState } from 'react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { CMStatusPill, CMPriorityBadge } from '@/components/condo-manager/CMStatusBadge';
import { MOCK_REPORTS, MOCK_COMMUNITIES } from '@/components/condo-manager/mockData';

const CMReports = () => {
  const [communityFilter, setCommunityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');

  const communityOptions = ['All', ...MOCK_COMMUNITIES.map((c) => c.name)];

  const filtered = MOCK_REPORTS.filter(
    (r) =>
      (communityFilter === 'All' || r.community === communityFilter) &&
      (statusFilter === 'All' || r.status === statusFilter) &&
      (categoryFilter === 'All Categories' || r.category === categoryFilter)
  );
  const openCount = filtered.filter((r) => r.status === 'Open').length;
  const inProgCount = filtered.filter((r) => r.status === 'In Progress').length;

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xl font-extrabold">Maintenance Reports</div>
            <div className="text-xs opacity-65">
              {communityFilter === 'All' ? 'All communities' : communityFilter} · real time
            </div>
          </div>
          <div className="flex gap-2">
            <div
              className="rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{ background: openCount > 0 ? 'hsl(var(--cm-danger))' : 'rgba(255,255,255,0.12)' }}
            >
              {openCount} Open
            </div>
            <div
              className="rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{ background: inProgCount > 0 ? 'hsl(var(--cm-warning))' : 'rgba(255,255,255,0.12)' }}
            >
              {inProgCount} In Prog
            </div>
          </div>
        </div>
      </CMHeader>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Community filter chips */}
        <div className="px-4 pt-3">
          <CMChips options={communityOptions} value={communityFilter} onChange={setCommunityFilter} light />
        </div>

        {/* Dropdowns */}
        <div className="px-4 py-2.5 flex gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 px-2.5 py-2 rounded-[10px] border border-cm-border text-xs bg-white text-cm-text"
          >
            {['All', 'Open', 'In Progress', 'Assigned', 'Resolved'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 px-2.5 py-2 rounded-[10px] border border-cm-border text-xs bg-white text-cm-text"
          >
            {[
              'All Categories',
              'Grounds & Landscaping',
              'Water & Plumbing',
              'Amenities & Equipment',
              'Lighting & Electrical',
              'Buildings & Structures',
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>

        {/* Report cards */}
        <div className="px-4">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-[14px] p-3.5 mb-2.5 border border-cm-border">
              <div className="flex justify-between mb-2">
                <div>
                  <div className="text-sm font-extrabold text-cm-text">{r.amenity}</div>
                  <div className="text-[11px] text-cm-cyan font-semibold mt-0.5">{r.community}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <CMStatusPill status={r.status} />
                  <CMPriorityBadge priority={r.priority} />
                </div>
              </div>
              <span className="text-[10px] bg-cm-app-bg text-cm-text-light px-2 py-0.5 rounded-full">{r.category}</span>
              <div className="text-xs text-cm-text my-2">{r.description}</div>
              <div className="flex justify-between">
                <div className="text-[11px] text-cm-text-light">👤 {r.reporter} · {r.date}</div>
                <div className="text-[11px] text-cm-cyan font-bold cursor-pointer">View Details →</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-cm-text-light">No reports match your filters</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CMReports;
