import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Search, Plus, X, ArrowLeft } from 'lucide-react';
import { JoinExistingHOA } from './JoinExistingHOA';
import { useNavigate } from 'react-router-dom';

interface AddCommunityFlowProps {
  onClose: () => void;
}

type FlowStep = 'choose' | 'join' | 'create';

export const AddCommunityFlow = ({ onClose }: AddCommunityFlowProps) => {
  const [step, setStep] = useState<FlowStep>('choose');
  const navigate = useNavigate();

  const handleCreateNew = () => {
    // Navigate to HOA application page for verification
    navigate('/hoa-application');
  };

  if (step === 'join') {
    return (
      <Card className="border-2 border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setStep('choose')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-medium">Join an Existing Community</h3>
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
  }

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Add Community
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-4 bg-white hover:bg-blue-50"
            onClick={() => setStep('join')}
          >
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Search className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium">Join an Existing Community</p>
              <p className="text-xs text-muted-foreground">Search for your HOA, apartment, or club</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-4 bg-white hover:bg-green-50"
            onClick={handleCreateNew}
          >
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Plus className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium">Request to Create a New Community</p>
              <p className="text-xs text-muted-foreground">Set up your own HOA and become admin (requires verification)</p>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
