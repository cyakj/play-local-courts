import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMHealthBar } from '@/components/condo-manager/CMHealthBar';
import { CMStatusBadge } from '@/components/condo-manager/CMStatusBadge';
import { CMKpiCard } from '@/components/condo-manager/CMKpiCard';
import { CMIssuesTrendChart } from '@/components/condo-manager/CMIssuesTrendChart';
import { MOCK_COMMUNITIES } from '@/components/condo-manager/mockData';

const CMCommunityDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  const c = MOCK_COMMUNITIES.find((x) => x.id === Number(id)) || MOCK_COMMUNITIES[0];

  const tabs = ['overview', 'reports', 'amenities', 'members'];

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex items-center gap-3 mb-4">
          <div
            onClick={() => navigate('/cm')}
            className="bg-white/[0.12] rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-xl font-extrabold">{c.name}</div>
            <div className="text-xs opacity-65">{c.totalUnits} units</div>
          </div>
          <CMStatusBadge status={c.status} />
        </div>

        {/* Health score bar in header */}
        <div className="bg-[rgba(0,180,216,0.12)] border border-[rgba(0,180,216,0.2)] rounded-[14px] p-3">
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="text-[13px] opacity-85 font-semibold">Community Health Score</div>
              <div className="text-[10px] opacity-55 italic mt-0.5">updated daily</div>
            </div>
            <div className="text-[28px] font-black text-cm-cyan">
              {c.health}<span className="text-sm opacity-70">/100</span>
            </div>
          </div>
          <CMHealthBar value={c.health} status={c.status} />
        </div>
      </CMHeader>

      {/* Tabs */}
      <div className="flex bg-white border-b border-cm-border flex-shrink-0">
        {tabs.map((t) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-3 px-1 text-center text-[11px] font-bold capitalize cursor-pointer transition-colors"
            style={{
              color: tab === t ? 'hsl(var(--cm-cyan))' : 'hsl(var(--cm-text-light))',
              borderBottom: tab === t ? '2px solid hsl(var(--cm-cyan))' : '2px solid transparent',
            }}
          >
            {t}
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <CMKpiCard
                label="Active Members"
                value={`${c.activeMembers}/${c.totalUnits}`}
                period="logged in last 30 days"
                color="hsl(var(--cm-cyan))"
              />
              <CMKpiCard
                label="Open Issues"
                value={c.openIssues}
                period="right now"
                color={c.openIssues > 3 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
                sub={c.openIssues > 3 ? '⚠ Needs attention' : '✓ Under control'}
                subColor={c.openIssues > 3 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
              />
              <CMKpiCard label="Today's Bookings" value={c.todayBookings} period="today" />
              <CMKpiCard
                label="Pending Approvals"
                value={c.pendingApprovals}
                period="awaiting review"
                color={c.pendingApprovals > 0 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-success))'}
                sub={c.pendingApprovals > 0 ? 'Action required' : 'All clear'}
                subColor={c.pendingApprovals > 0 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-success))'}
              />
            </div>

            <CMIssuesTrendChart />

            {/* Recent Activity */}
            <div className="bg-white rounded-[14px] p-4 mb-4 border border-cm-border">
              <div className="flex justify-between mb-3">
                <div className="text-[13px] font-extrabold text-cm-text">Recent Activity</div>
                <div className="text-[11px] text-cm-cyan font-bold">View All →</div>
              </div>
              {c.recentActivity.map((a, i) => (
                <div
                  key={i}
                  className="flex gap-2.5"
                  style={{
                    paddingBottom: i < c.recentActivity.length - 1 ? 12 : 0,
                    marginBottom: i < c.recentActivity.length - 1 ? 12 : 0,
                    borderBottom: i < c.recentActivity.length - 1 ? '1px solid hsl(var(--cm-border))' : 'none',
                  }}
                >
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: a.dot }} />
                  <div>
                    <div className="text-xs text-cm-text">{a.text}</div>
                    <div className="text-[11px] text-cm-text-light mt-0.5">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="text-[13px] font-extrabold text-cm-text mb-3">Quick Actions</div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Post Announcement', icon: '📢' },
                { label: 'Approve Members', icon: '✅' },
                { label: 'Manage Documents', icon: '📁' },
                { label: 'Create Survey', icon: '📊' },
              ].map((a, i) => (
                <div
                  key={i}
                  className="bg-white border border-cm-border rounded-[14px] p-3.5 flex items-center gap-2.5 cursor-pointer hover:shadow-sm transition-shadow min-h-[44px]"
                >
                  <span className="text-xl">{a.icon}</span>
                  <span className="text-xs font-bold text-cm-navy">{a.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'reports' && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <CMKpiCard
                label="Open Issues"
                value={c.openIssues}
                period="right now"
                color={c.openIssues > 3 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
              />
              <CMKpiCard
                label="Avg Resolution"
                value={`${c.avgResolutionDays}d`}
                period="issues closed this month"
                color={c.avgResolutionDays > 4 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
                sub={c.avgResolutionDays > 4 ? '⚠ Above 4d target' : '✓ Within target'}
                subColor={c.avgResolutionDays > 4 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
              />
            </div>
            <CMIssuesTrendChart />
            <div className="text-[13px] font-extrabold text-cm-text mb-2.5">
              Issues by Category{' '}
              <span className="text-[10px] text-cm-text-light font-normal italic">last 30 days</span>
            </div>
            {c.issuesByCategory.map((cat, i) => (
              <div key={i} className="bg-white rounded-xl p-3 mb-2 flex items-center gap-3 border border-cm-border">
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-cm-text">{cat.name}</div>
                  <div className="h-1.5 bg-cm-border rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(cat.count / 8) * 100}%`,
                        background: cat.count > 3 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-cyan))',
                      }}
                    />
                  </div>
                </div>
                <div
                  className="rounded-full px-3 py-1 text-sm font-extrabold"
                  style={{
                    background: cat.count > 3 ? 'hsl(var(--cm-danger-bg))' : 'hsl(var(--cm-cyan-light))',
                    color: cat.count > 3 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-cyan))',
                  }}
                >
                  {cat.count}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'amenities' && (
          <>
            <CMKpiCard
              label="Utilization Rate"
              value={`${c.utilization}%`}
              period="this week Mon–Sun"
              color={c.utilization > 85 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-cyan))'}
              sub={
                c.utilization > 85
                  ? '⚠ High demand'
                  : c.utilization < 30
                    ? '⚠ Low usage'
                    : '✓ Healthy (50–85% ideal)'
              }
              subColor={c.utilization > 85 || c.utilization < 30 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-success))'}
            />
            <div className="mt-4 text-[13px] font-extrabold text-cm-text mb-3">Amenities</div>
            {c.amenities.map((a, i) => (
              <div key={i} className="bg-white rounded-xl p-3.5 mb-2 flex justify-between border border-cm-border">
                <div className="text-sm font-semibold text-cm-text">{a}</div>
                <div className="text-[11px] text-cm-cyan font-bold cursor-pointer">Manage →</div>
              </div>
            ))}
          </>
        )}

        {tab === 'members' && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <CMKpiCard label="Active Members" value={c.activeMembers} period="logged in last 30 days" color="hsl(var(--cm-cyan))" />
              <CMKpiCard label="Total Units" value={c.totalUnits} period="physical units" />
              <CMKpiCard
                label="Pending Approvals"
                value={c.pendingApprovals}
                period="awaiting review"
                color={c.pendingApprovals > 0 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-success))'}
              />
              <CMKpiCard
                label="Occupancy"
                value={`${Math.round((c.activeMembers / c.totalUnits) * 100)}%`}
                period="with app login"
              />
            </div>

            {c.totalUnits - c.activeMembers > 0 && (
              <div className="bg-cm-warning-bg rounded-[14px] p-3.5 mb-4 border border-yellow-300">
                <div className="text-xs font-bold text-cm-warning">
                  {c.totalUnits - c.activeMembers} units not yet on the platform
                </div>
                <div className="mt-2.5 bg-cm-warning text-white rounded-lg py-2 px-3.5 text-xs font-bold text-center cursor-pointer min-h-[44px] flex items-center justify-center">
                  Send Invite Reminders
                </div>
              </div>
            )}

            <div className="bg-white rounded-[14px] p-4 border border-cm-border">
              <div className="bg-cm-navy text-white rounded-[10px] py-2.5 px-4 text-[13px] font-bold text-center cursor-pointer min-h-[44px] flex items-center justify-center">
                View All Members →
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CMCommunityDashboard;
