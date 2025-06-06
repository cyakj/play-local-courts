
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface CourtPoliciesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
}

const CourtPoliciesDialog: React.FC<CourtPoliciesDialogProps> = ({
  isOpen,
  onClose,
  onAgree
}) => {
  const [agreedToPolicies, setAgreedToPolicies] = React.useState(false);

  const policies = [
    {
      title: "Appropriate Attire Required",
      description: "All players must wear suitable athletic clothing appropriate for court activities."
    },
    {
      title: "No Pets Permitted",
      description: "Pets are strictly prohibited within the court area and immediate vicinity for safety and hygiene reasons."
    },
    {
      title: "Proper Footwear Mandatory",
      description: "Non-marking court shoes with appropriate sole grip must be worn at all times during play."
    },
    {
      title: "Court Transition Policy",
      description: "When another reservation follows yours, you may continue playing until the next reserved party arrives and requests the court."
    },
    {
      title: "Equipment Responsibility",
      description: "All court furniture and equipment must be returned to their designated positions after use."
    }
  ];

  const handleAgree = () => {
    if (agreedToPolicies) {
      onAgree();
      setAgreedToPolicies(false); // Reset for next time
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Court Usage Policies & Guidelines
          </DialogTitle>
          <DialogDescription>
            Please review and agree to the following policies before booking your court reservation.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {policies.map((policy, index) => (
            <div key={index} className="border-l-4 border-primary pl-4 py-2">
              <h4 className="font-medium text-sm text-foreground mb-1">
                {index + 1}. {policy.title}
              </h4>
              <p className="text-sm text-muted-foreground">
                {policy.description}
              </p>
            </div>
          ))}
        </div>
        
        <div className="flex items-center space-x-2 py-4 border-t">
          <Checkbox 
            id="agree-policies" 
            checked={agreedToPolicies}
            onCheckedChange={(checked) => setAgreedToPolicies(checked as boolean)}
          />
          <Label 
            htmlFor="agree-policies" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I have read, understood, and agree to abide by all court policies and guidelines listed above.
          </Label>
        </div>
        
        <DialogFooter className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAgree} 
            disabled={!agreedToPolicies}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Agree & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CourtPoliciesDialog;
