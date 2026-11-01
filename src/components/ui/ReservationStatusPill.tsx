import { ReservationBadge } from '@/components/ui/ReservationBadge';
import { reservationKind } from '@/lib/reservationState';

/**
 * Status badge for a stored booking row. Pass the row's date/times so a confirmed booking that is over reads
 * "Completed" and a never-approved request that has passed reads "Request expired"; without times only the stored
 * approval status is shown.
 */
export function ReservationStatusPill({ status, date, start_time, end_time, now, timeZone }: {
  status: string; date?: string; start_time?: string; end_time?: string; now?: Date; timeZone?: string;
}) {
  const kind = date && start_time && end_time
    ? reservationKind({ status, date, start_time, end_time }, now, timeZone)
    : reservationKind({ status, date: '2999-01-01', start_time: '00:00', end_time: '01:00' });
  return <ReservationBadge kind={kind} />;
}
