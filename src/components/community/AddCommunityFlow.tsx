import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, X } from 'lucide-react';
import { JoinExistingHOA } from './JoinExistingHOA';

interface AddCommunityFlowProps {
  onClose: () => void;
}

export const AddCommunityFlow = ({ onClose }: AddCommunityFlowProps) => {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-4 w-4 text-blue-600" />
          <h3 className="font-medium">Find Your Community</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 ml-auto"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <JoinExistingHOA onSuccess={onClose} />
      </CardContent>
    </Card>
  );
};
