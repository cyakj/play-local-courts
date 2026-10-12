import { StatusPill } from '@/components/ui/StatusPill';
import { statusDisplay } from '@/lib/reservations';

// One mapping from booking status → pill so the list, detail and admin screens agree.
const VARIANT = {
  pending: 'pending',
  confirmed: 'optimal',
  rejected: 'declined',
  cancelled: 'expired',
} as const;

export function ReservationStatusPill({ status }: { status: string }) {
  const variant = VARIANT[status as keyof typeof VARIANT] ?? 'needs-attention';
  return <StatusPill status={variant} label={statusDisplay(status).label} />;
}
