import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Wrench, Zap, Droplets, TreePine, Building2, ShieldAlert, Camera, Loader2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiStepReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amenities: Array<{ id: string; name: string; amenityType: string }>;
}

const issueTypes = [
  { value: 'amenities_equipment', label: 'Amenities & Equipment', icon: Wrench },
  { value: 'lighting_electrical', label: 'Lighting & Electrical', icon: Zap },
  { value: 'water_plumbing', label: 'Water & Plumbing', icon: Droplets },
  { value: 'grounds_landscaping', label: 'Grounds & Landscaping', icon: TreePine },
  { value: 'buildings_structures', label: 'Buildings & Structures', icon: Building2 },
  { value: 'safety_other', label: 'Safety / Other', icon: ShieldAlert },
];

const severityLabels: Record<number, string> = {
  0: 'Low',
  25: 'Low',
  50: 'Moderate',
  75: 'High',
  100: 'Critical',
};

const getSeverityLabel = (value: number): string => {
  if (value <= 25) return 'Low';
  if (value <= 50) return 'Moderate';
  if (value <= 75) return 'High';
  return 'Critical';
};

export const MultiStepReportDialog: React.FC<MultiStepReportDialogProps> = ({
  open,
  onOpenChange,
  amenities
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [issueType, setIssueType] = useState('');
  const [selectedAmenity, setSelectedAmenity] = useState('');
  const [severity, setSeverity] = useState([50]);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setStep(1);
    setIssueType('');
    setSelectedAmenity('');
    setSeverity([50]);
    setDescription('');
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!currentUser || !issueType || !selectedAmenity || !description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let photoUrl = null;

      if (photo) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(`maintenance/${fileName}`, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(`maintenance/${fileName}`);
        
        photoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('maintenance_reports')
        .insert({
          hoa_id: currentUser.hoaId!,
          amenity_id: selectedAmenity,
          reporter_id: currentUser.id,
          category: issueType,
          description: `[Severity: ${getSeverityLabel(severity[0])}] ${description}`,
          photo_url: photoUrl,
          status: 'open'
        });

      if (error) throw error;

      toast({
        title: "Issue Reported",
        description: "Your maintenance request has been submitted successfully."
      });

      handleClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: "Error",
        description: "Failed to submit maintenance report",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = issueType && selectedAmenity;
  const canProceedStep2 = description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
        {/* Header with pill indicator */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-primary mb-2">Report Issue</h2>
          <p className="text-muted-foreground text-sm">
            {step === 1 && "Please provide details about the problem"}
            {step === 2 && "Describe the issue in detail"}
            {step === 3 && "Review and submit your report"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-primary">STEP {step} OF 3</span>
            <span className="text-muted-foreground">
              {step === 1 && "Issue Details"}
              {step === 2 && "Description"}
              {step === 3 && "Review"}
            </span>
          </div>
          <div className="flex gap-1">
            <div className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              step >= 1 ? "bg-primary" : "bg-muted"
            )} />
            <div className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              step >= 2 ? "bg-primary" : "bg-muted"
            )} />
            <div className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              step >= 3 ? "bg-primary" : "bg-muted"
            )} />
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Step 1: Issue Type, Amenity, Severity */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">What type of issue is this?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {issueTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = issueType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setIssueType(type.value)}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all",
                          isSelected 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5 mb-1",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "text-xs font-medium text-center leading-tight",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Which amenity is affected?</Label>
                <Select value={selectedAmenity} onValueChange={setSelectedAmenity}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select an amenity" />
                  </SelectTrigger>
                  <SelectContent>
                    {amenities.map((amenity) => (
                      <SelectItem key={amenity.id} value={amenity.id}>
                        {amenity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Severity Level</Label>
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full",
                    severity[0] <= 25 && "bg-green-100 text-green-700",
                    severity[0] > 25 && severity[0] <= 50 && "bg-yellow-100 text-yellow-700",
                    severity[0] > 50 && severity[0] <= 75 && "bg-orange-100 text-orange-700",
                    severity[0] > 75 && "bg-red-100 text-red-700"
                  )}>
                    {getSeverityLabel(severity[0])}
                  </span>
                </div>
                <Slider
                  value={severity}
                  onValueChange={setSeverity}
                  max={100}
                  step={25}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Description and Photo */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Describe the issue *</Label>
                <Textarea
                  placeholder="Please describe the issue in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="rounded-xl resize-none"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Add a photo (optional)</Label>
                {photoPreview ? (
                  <div className="relative">
                    <img 
                      src={photoPreview} 
                      alt="Preview" 
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Tap to add photo</span>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Issue Type</span>
                  <span className="text-sm font-medium">{issueTypes.find(t => t.value === issueType)?.label || issueType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amenity</span>
                  <span className="text-sm font-medium">
                    {amenities.find(a => a.id === selectedAmenity)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Severity</span>
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full",
                    severity[0] <= 25 && "bg-green-100 text-green-700",
                    severity[0] > 25 && severity[0] <= 50 && "bg-yellow-100 text-yellow-700",
                    severity[0] > 50 && severity[0] <= 75 && "bg-orange-100 text-orange-700",
                    severity[0] > 75 && "bg-red-100 text-red-700"
                  )}>
                    {getSeverityLabel(severity[0])}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Description</span>
                <p className="text-sm bg-muted/50 rounded-xl p-3">{description}</p>
              </div>

              {photoPreview && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Photo</span>
                  <img 
                    src={photoPreview} 
                    alt="Preview" 
                    className="w-full h-32 object-cover rounded-xl"
                  />
                </div>
              )}

              {/* Status Preview */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-4">
                <p className="text-sm font-medium text-primary mb-3">What happens next?</p>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">1</div>
                    <span className="mt-1 text-muted-foreground">Submitted</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-border mx-1" />
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">2</div>
                    <span className="mt-1 text-muted-foreground">In Review</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-border mx-1" />
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">3</div>
                    <span className="mt-1 text-muted-foreground">In Progress</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-border mx-1" />
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">4</div>
                    <span className="mt-1 text-muted-foreground">Resolved</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex flex-col gap-3 mt-8">
            {step < 3 ? (
              <Button 
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                className="w-full rounded-xl h-12"
              >
                Next Step
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={loading}
                className="w-full rounded-xl h-12"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            )}
            
            {step > 1 ? (
              <Button 
                variant="outline" 
                onClick={() => setStep(step - 1)}
                className="w-full rounded-xl h-12"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="w-full rounded-xl h-12"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
