
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Shield } from 'lucide-react';

interface AdminControlsSectionProps {
  requiresAdminApproval: boolean;
  minCancellationHours: number;
  onUpdate: (field: string, value: any) => void;
}

const AdminControlsSection = ({ requiresAdminApproval, minCancellationHours, onUpdate }: AdminControlsSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Administrative Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Require Admin Approval</Label>
          <Switch
            checked={requiresAdminApproval}
            onCheckedChange={(checked) => onUpdate('requires_admin_approval', checked)}
          />
        </div>
        
        <div>
          <Label>Minimum Cancellation Hours</Label>
          <Input
            type="number"
            min="1"
            max="168"
            value={minCancellationHours}
            onChange={(e) => onUpdate('min_cancellation_hours', parseInt(e.target.value))}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminControlsSection;
