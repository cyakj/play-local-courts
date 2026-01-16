import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaveChangesFooterProps {
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

const SaveChangesFooter: React.FC<SaveChangesFooterProps> = ({
  hasChanges,
  saving,
  onSave,
  onDiscard
}) => {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out",
        hasChanges 
          ? "translate-y-0 opacity-100" 
          : "translate-y-full opacity-0 pointer-events-none"
      )}
    >
      <div className="bg-background/95 backdrop-blur-lg border-t shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            You have unsaved changes
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onDiscard}
              disabled={saving}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Discard
            </Button>
            <Button
              onClick={onSave}
              disabled={saving}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveChangesFooter;
