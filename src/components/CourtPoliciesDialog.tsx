
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
  amenityName?: string;
  amenityType?: string;
}

const CourtPoliciesDialog: React.FC<CourtPoliciesDialogProps> = ({
  isOpen,
  onClose,
  onAgree,
  amenityName = 'Court',
  amenityType = 'tennis'
}) => {
  const [agreedToPolicies, setAgreedToPolicies] = React.useState(false);

  // Different policies based on amenity type
  const getPolicies = () => {
    const basePolicies = [
      {
        title: "Appropriate Attire Required",
        description: "All users must wear suitable clothing appropriate for the activity."
      },
      {
        title: "No Pets Permitted",
        description: "Pets are strictly prohibited within the area and immediate vicinity for safety and hygiene reasons."
      },
      {
        title: "Equipment Responsibility",
        description: "All furniture and equipment must be returned to their designated positions after use."
      }
    ];

    if (amenityType === 'tennis' || amenityType === 'pickleball') {
      return [
        ...basePolicies,
        {
          title: "Proper Footwear Mandatory",
          description: "Non-marking court shoes with appropriate sole grip must be worn at all times during play."
        },
        {
          title: "Court Transition Policy",
          description: "When another reservation follows yours, you may continue playing until the next reserved party arrives and requests the court."
        }
      ];
    }

    if (amenityType === 'pool' || amenityType === 'jacuzzi') {
      return [
        ...basePolicies,
        {
          title: "Shower Before Entry",
          description: "All swimmers must shower before entering the pool or spa area."
        },
        {
          title: "No Glass Containers",
          description: "Glass containers are strictly prohibited in the pool area for safety reasons."
        },
        {
          title: "Children Supervision",
          description: "Children under 14 must be accompanied by an adult at all times."
        }
      ];
    }

    if (amenityType === 'clubhouse' || amenityType === 'barbecue') {
      return [
        ...basePolicies,
        {
          title: "Clean-Up Required",
          description: "The area must be cleaned and returned to its original state after use."
        },
        {
          title: "Noise Policy",
          description: "Music and noise levels must be kept at a reasonable level, especially after 10 PM."
        }
      ];
    }

    return basePolicies;
  };

  const policies = getPolicies();

  const handleAgree = () => {
    if (agreedToPolicies) {
      onAgree();
      setAgreedToPolicies(false); // Reset for next time
    }
  };

  const handleClose = () => {
    setAgreedToPolicies(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {amenityName} Usage Policies & Guidelines
          </DialogTitle>
          <DialogDescription>
            Please review and agree to the following policies before booking your reservation.
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
            I have read, understood, and agree to abide by all policies and guidelines listed above.
          </Label>
        </div>
        
        <DialogFooter className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleClose} style={{ color: '#0F1F3D', fontSize: '15px', fontWeight: 500, textDecoration: 'underline' }}>
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
