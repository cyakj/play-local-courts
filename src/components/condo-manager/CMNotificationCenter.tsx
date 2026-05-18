import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Wrench,
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  BarChart2,
  Megaphone,
  ClipboardList,
} from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { useCondoManagerNotifications } from '@/hooks/useCondoManagerData';

const NOTIF_ICON: Record<string, React.ElementType> = {
  report_submitted: Wrench,
  report_status_changed: Wrench,
  report_unresolved: Wrench,
  member_application: Users,
  member_approved: CheckCircle,
  member_rejected: XCircle,
  booking_confirmed: Calendar,
  booking_cancelled: Calendar,
  booking_reminder: Calendar,
  health_score_alert: BarChart2,
  announcement: Megaphone,
  survey_published: BarChart2,
  survey_reminder: BarChart2,
  event_created: Calendar,
  event_reminder: Calendar,
};
const NOTIF_COLOR: Record<string, string> = {
  report_submitted: '#EF4444', report_status_changed: '#F59E0B', report_unresolved: '#EF4444',
  member_application: '#00D4FF', member_approved: '#00D4FF', member_rejected: '#EF4444',
  booking_confirmed: '#00D4FF', booking_cancelled: '#EF4444', booking_reminder: '#00D4FF',
  health_score_alert: '#F59E0B', announcement: '#00D4FF',
  survey_published: '#00D4FF', survey_reminder: '#F59E0B',
  event_created: '#00D4FF', event_reminder: '#00D4FF',
};

interface CMNotificationCenterProps {
  onClose: () => void;
}

const CMNotificationCenter = ({ onClose }: CMNotificationCenterProps) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const { notifications, unreadCount, markAllRead, markRead } = useCondoManagerNotifications();

  const filtered = notifications.filter(
    (n) =>
      filter === 'All' ||
      (!n.read && filter === 'Unread') ||
      (n.type.startsWith('report') && filter === 'Reports') ||
      (n.type.startsWith('member') && filter === 'Members') ||
      (n.type.startsWith('booking') && filter === 'Bookings')
  );

  const handleNotifClick = async (notif: any) => {
    await markRead(notif.id);
    const meta = notif.metadata || {};
    const hoaId = notif.hoa_id;

    if (notif.type === 'report_submitted' || notif.type === 'report_status_changed' || notif.type === 'report_message' || notif.type === 'report_unresolved') {
      navigate(meta.report_id ? `/cm/reports?reportId=${meta.report_id}` : '/cm/reports');
    } else if (notif.type === 'member_application' || notif.type === 'member_approved' || notif.type === 'member_rejected') {
      navigate('/cm');
    } else if (notif.type === 'booking_confirmed' || notif.type === 'booking_cancelled' || notif.type === 'booking_reminder') {
      navigate('/cm/calendar');
    } else if (notif.type === 'survey_published' || notif.type === 'survey_closed' || notif.type === 'survey_reminder') {
      navigate(hoaId ? `/cm/community/${hoaId}/surveys` : '/cm');
    } else if (notif.type === 'announcement') {
      navigate(hoaId ? `/cm/community/${hoaId}` : '/cm');
    } else if (notif.type === 'event_created' || notif.type === 'event_reminder') {
      navigate('/cm/calendar');
    } else if (notif.type === 'health_score_alert') {
      navigate(hoaId ? `/cm/community/${hoaId}` : '/cm');
    } else {
      navigate('/cm');
    }
    onClose();
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cm-app-bg">
      <CMHeader compact>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div
              onClick={onClose}
              className="bg-white/[0.12] rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-extrabold">Notifications</div>
              <div className="text-xs opacity-65">{unreadCount} unread</div>
            </div>
          </div>
          <div onClick={markAllRead} className="text-xs text-cm-cyan font-bold cursor-pointer">Mark all read</div>
        </div>
      </CMHeader>

      <div className="bg-white border-b border-cm-border px-4 py-2.5 flex-shrink-0">
        <CMChips
          options={['All', 'Unread', 'Reports', 'Members', 'Bookings']}
          value={filter}
          onChange={setFilter}
          light
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-28">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-cm-text-light">No notifications</div>
        )}
        {filtered.map((n) => {
          const color = NOTIF_COLOR[n.type] || '#9CA3AF';
          const IconComponent = NOTIF_ICON[n.type] || ClipboardList;
          return (
            <div
              key={n.id}
              onClick={() => handleNotifClick(n)}
              className="bg-white rounded-[14px] p-3.5 mb-2.5 cursor-pointer"
              style={{ border: `1px solid ${n.read ? 'hsl(var(--cm-border))' : `${color}44`}` }}
            >
              <div className="flex gap-2.5">
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18` }}
                >
                  <IconComponent className="w-5 h-5" style={{ color: '#00D4FF' }} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <div
                      className="text-[13px] flex-1 pr-2"
                      style={{ fontWeight: n.read ? 600 : 800, color: 'hsl(var(--cm-text))' }}
                    >
                      {n.title}
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-cm-cyan mt-1" />}
                  </div>
                  {n.community_name && (
                    <div className="text-[11px] text-cm-cyan font-semibold mt-0.5">{n.community_name}</div>
                  )}
                  <div className="text-xs text-cm-text-mid mt-1">{n.body}</div>
                  <div className="text-[11px] text-cm-text-light mt-1">{formatTime(n.created_at)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CMNotificationCenter;
