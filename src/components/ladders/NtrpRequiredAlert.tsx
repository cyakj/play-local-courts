import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NtrpRequiredAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NtrpRequiredAlert = ({ open, onOpenChange }: NtrpRequiredAlertProps) => {
  const navigate = useNavigate();

  const handleGoToProfile = () => {
    onOpenChange(false);
    // Navigate to My Locker with profile tab active
    navigate('/my-locker?tab=profile');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            NTRP Rating Required
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              To join a ladder with skill requirements, you need to add your NTRP rating to your profile.
            </p>
            <p className="text-sm">
              Your NTRP (National Tennis Rating Program) rating helps match you with players of similar skill levels and ensures fair competition.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleGoToProfile}>
            <User className="h-4 w-4 mr-2" />
            Go to My Profile
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default NtrpRequiredAlert;
