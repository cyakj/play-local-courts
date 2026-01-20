import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  TrendingDown,
  Clock,
  AlertTriangle,
  Target,
  Calendar,
  CalendarX,
  Bell,
  XCircle,
  Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data for the weekly performance dashboard
const mockPerformanceData = {
  potentialRevenue: {
    value: 2625,
    helper: 'Max revenue if fully booked',
  },
  bookedRevenue: {
    value: 2362.50,
    helper: 'Scheduled sessions this week',
  },
  revenueLeftOnTable: {
    value: 262.50,
    status: 'High Risk',
  },
  utilization: {
    value: 90,
    status: 'Optimal',
  },
  scheduledHours: {
    value: 31.5,
    helper: 'Booked this week',
  },
  unscheduledHours: {
    value: 3.5,
    helper: 'Available capacity',
  },
  averageYield: {
    value: 75,
    helper: 'Revenue per booked hour',
  },
  cancellations: {
    rate: 12,
    today: 2,
    thisWeek: 3,
  },
  noShows: {
    thisWeek: 2,
  },
  revenueCapture: {
    percentage: 90,
    captured: 2362.50,
    potential: 2625,
    mix: {
      private: 50,
      semiPrivate: 30,
      clinic: 20,
    },
  },
};

interface KPICardProps {
  title: string;
  value: string | number;
  helper?: string;
  status?: string;
  statusType?: 'success' | 'warning' | 'danger';
  icon: React.ReactNode;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  helper,
  status,
  statusType = 'success',
  icon,
}) => {
  const statusColors = {
    success: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-red-600 bg-red-50',
  };

  const borderColors = {
    success: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    danger: 'border-l-red-500',
  };

  return (
    <Card className={cn('border-l-4', borderColors[statusType])}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
            {status && (
              <div className={cn(
                'inline-flex items-center text-xs font-medium px-2 py-1 rounded-full',
                statusColors[statusType]
              )}>
                {status}
              </div>
            )}
          </div>
          <div className={cn(
            'p-3 rounded-xl',
            statusType === 'success' && 'bg-emerald-100 text-emerald-600',
            statusType === 'warning' && 'bg-amber-100 text-amber-600',
            statusType === 'danger' && 'bg-red-100 text-red-600'
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const PerformanceTab: React.FC = () => {
  const data = mockPerformanceData;

  return (
    <div className="space-y-8">
      {/* Primary KPI Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-foreground">Weekly Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Potential Revenue"
            value={`$${data.potentialRevenue.value.toLocaleString()}`}
            helper={data.potentialRevenue.helper}
            statusType="success"
            icon={<Banknote className="h-6 w-6" />}
          />
          <KPICard
            title="Booked Revenue"
            value={`$${data.bookedRevenue.value.toLocaleString()}`}
            helper={data.bookedRevenue.helper}
            statusType="success"
            icon={<DollarSign className="h-6 w-6" />}
          />
          <KPICard
            title="Left on Table"
            value={`$${data.revenueLeftOnTable.value.toLocaleString()}`}
            status={data.revenueLeftOnTable.status}
            statusType="danger"
            icon={<TrendingDown className="h-6 w-6" />}
          />
          <KPICard
            title="Utilization"
            value={`${data.utilization.value}%`}
            status={data.utilization.status}
            statusType="success"
            icon={<Target className="h-6 w-6" />}
          />
        </div>
      </div>

      {/* Capacity Metrics (Secondary KPIs) */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-foreground">Capacity Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            title="Scheduled Hours"
            value={`${data.scheduledHours.value} hrs`}
            helper={data.scheduledHours.helper}
            statusType="success"
            icon={<Calendar className="h-6 w-6" />}
          />
          <KPICard
            title="Unscheduled Hours"
            value={`${data.unscheduledHours.value} hrs`}
            helper={data.unscheduledHours.helper}
            statusType="warning"
            icon={<Clock className="h-6 w-6" />}
          />
          <KPICard
            title="Avg Yield"
            value={`$${data.averageYield.value}/hr`}
            helper={data.averageYield.helper}
            statusType="success"
            icon={<DollarSign className="h-6 w-6" />}
          />
        </div>
      </div>

      {/* Cancellations & No-Shows Section */}
      <Card className="border-2 border-red-200 bg-red-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Bell className="h-5 w-5 text-red-600" />
            Cancellations & No-Shows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CalendarX className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-muted-foreground">Cancellation Rate</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{data.cancellations.rate}%</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-muted-foreground">Cancellations Today</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{data.cancellations.today}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-muted-foreground">Cancellations This Week</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{data.cancellations.thisWeek}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-muted-foreground">No-Shows This Week</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{data.noShows.thisWeek}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Capture Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Revenue Capture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Circular Progress */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(data.revenueCapture.percentage / 100) * 440} 440`}
                    strokeLinecap="round"
                    className="text-emerald-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{data.revenueCapture.percentage}%</span>
                  <span className="text-sm text-muted-foreground">Captured</span>
                </div>
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">${data.revenueCapture.captured.toLocaleString()}</span>
                {' of '}
                <span className="font-semibold text-foreground">${data.revenueCapture.potential.toLocaleString()}</span>
              </p>
            </div>

            {/* Revenue Mix */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Session Mix Breakdown</h4>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>Private</span>
                    <span className="font-medium">{data.revenueCapture.mix.private}%</span>
                  </div>
                  <Progress value={data.revenueCapture.mix.private} className="h-3 bg-blue-100" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>Semi-Private</span>
                    <span className="font-medium">{data.revenueCapture.mix.semiPrivate}%</span>
                  </div>
                  <Progress value={data.revenueCapture.mix.semiPrivate} className="h-3 bg-sky-100" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>Clinic</span>
                    <span className="font-medium">{data.revenueCapture.mix.clinic}%</span>
                  </div>
                  <Progress value={data.revenueCapture.mix.clinic} className="h-3 bg-indigo-100" />
                </div>
              </div>

              {/* Mix visualization bar */}
              <div className="mt-6">
                <div className="h-4 rounded-full flex overflow-hidden">
                  <div
                    className="bg-blue-500"
                    style={{ width: `${data.revenueCapture.mix.private}%` }}
                  />
                  <div
                    className="bg-sky-400"
                    style={{ width: `${data.revenueCapture.mix.semiPrivate}%` }}
                  />
                  <div
                    className="bg-indigo-400"
                    style={{ width: `${data.revenueCapture.mix.clinic}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Private
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-sky-400" />
                    Semi-Private
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    Clinic
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceTab;
