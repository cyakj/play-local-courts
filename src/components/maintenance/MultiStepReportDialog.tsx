import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Wrench, Zap, Droplets, TreePine, Building2, ShieldAlert, Camera, Loader2, ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

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

const getSeverityLabel = (value: number): string => {
  if (value <= 25) return 'Low';
  if (value <= 50) return 'Moderate';
  if (value <= 75) return 'High';
  return 'Critical';
};

const getSeverityColor = (value: number): string => {
  if (value <= 33) return '#00D4FF';
  if (value <= 66) return '#F97066';
  return '#EF4444';
};

const getSeverityPill = (value: number) => {
  if (value <= 33) return { bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF' };
  if (value <= 66) return { bg: '#FFF5F5', text: '#C0392B', border: '#F97066' };
  return { bg: '#FEF2F2', text: '#991B1B', border: '#EF4444' };
};

export const MultiStepReportDialog: React.FC<MultiStepReportDialogProps> = ({
  open,
  onOpenChange,
  amenities
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [selectedAmenity, setSelectedAmenity] = useState('');
  const [locationText, setLocationText] = useState('');
  const [severity, setSeverity] = useState([50]);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Array<{ file: File; preview: string }>>([]);

  const isAmenityCategory = category === 'amenities_equipment';

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 3 - photos.length;
    Array.from(files).slice(0, remaining).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos((prev) => [...prev, { file, preview: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setStep(1);
    setCategory('');
    setSelectedAmenity('');
    setLocationText('');
    setSeverity([50]);
    setDescription('');
    setPhotos([]);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    if (!currentUser?.id) return null;

    const fileExt = file.name.split('.').pop() ?? 'jpg';
    const fileName = `${currentUser.id}/maintenance/${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!currentUser || !category || !description.trim()) {
      toast({ title: "Missing Information", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    if (isAmenityCategory && !selectedAmenity) {
      toast({ title: "Missing Information", description: "Please select an amenity", variant: "destructive" });
      return;
    }

    if (!isAmenityCategory && !locationText.trim()) {
      toast({ title: "Missing Information", description: "Please enter a location", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (!currentUser.hoaId) {
        toast({ title: "Error", description: "No active community found for this report", variant: "destructive" });
        return;
      }

      let photoUrl = null;
      if (photos.length > 0) {
        try {
          photoUrl = await uploadPhoto(photos[0].file);
        } catch (uploadError) {
          console.error('Error uploading maintenance photo:', uploadError);
        }
      }

      const { data, error } = await (supabase.rpc as any)('create_maintenance_report', {
        _hoa_id: currentUser.hoaId,
        _category: category,
        _description: `[Severity: ${getSeverityLabel(severity[0])}] ${description}`,
        _photo_url: photoUrl,
        _report_type: isAmenityCategory ? 'amenity' : 'location',
        _amenity_id: isAmenityCategory ? selectedAmenity : null,
        _location_text: isAmenityCategory ? null : locationText.trim(),
        _status: 'open',
      });

      if (error) throw error;
      if (!data) throw new Error('Report submission did not return a confirmation.');

      toast({ title: "✅ Issue Reported!", description: "Your maintenance request has been submitted successfully." });
      handleClose();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting report:', error);
      const message = error instanceof Error ? error.message : "Failed to submit maintenance report";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const locationFilled = isAmenityCategory ? !!selectedAmenity : locationText.trim().length > 0;
  const canProceedStep1 = !!category && locationFilled;
  const canSubmit = description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden" aria-describedby={undefined}>
        <VisuallyHidden><DialogTitle>Report Issue</DialogTitle></VisuallyHidden>
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-primary mb-2">Report Issue</h2>
          <p className="text-muted-foreground text-sm">
            {step === 1 && "Please provide details about the problem"}
            {step === 2 && "Describe the issue in detail"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-primary">STEP {step} OF 2</span>
            <span className="text-muted-foreground">
              {step === 1 && "Issue Details"}
              {step === 2 && "Description & Photos"}
            </span>
          </div>
          <div className="flex gap-1">
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 1 ? "bg-primary" : "bg-muted")} />
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 2 ? "bg-primary" : "bg-muted")} />
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Step 1: Category, Smart Location, Severity */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Category grid */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">What type of issue is this?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {issueTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = category === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          setCategory(type.value);
                          // Reset location fields when switching category type
                          if (type.value === 'amenities_equipment') {
                            setLocationText('');
                          } else {
                            setSelectedAmenity('');
                          }
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all min-h-[80px]",
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 mb-1", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-xs font-medium text-center leading-tight", isSelected ? "text-primary" : "text-muted-foreground")}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smart location field — only show after category selected */}
              {category && (
                <div className="space-y-3">
                  {isAmenityCategory ? (
                    <>
                      <Label className="text-sm font-semibold">Which amenity is affected?</Label>
                      <Select value={selectedAmenity} onValueChange={setSelectedAmenity}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select an amenity" />
                        </SelectTrigger>
                        <SelectContent>
                          {amenities.map((amenity) => (
                            <SelectItem key={amenity.id} value={amenity.id}>{amenity.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <Label className="text-sm font-semibold">Where is the issue?</Label>
                      <Input
                        value={locationText}
                        onChange={(e) => setLocationText(e.target.value)}
                        placeholder="e.g. Parking Lot B near entrance, Building 3 mailbox area"
                        className="rounded-xl"
                      />
                    </>
                  )}
                </div>
              )}

              {/* Severity slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Severity Level</Label>
                  {(() => {
                    const pill = getSeverityPill(severity[0]);
                    return (
                      <span style={{
                        background: pill.bg,
                        color: pill.text,
                        border: `1px solid ${pill.border}`,
                        borderRadius: 99,
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'inline-block',
                        fontFamily: 'Inter, sans-serif',
                      }}>
                        {getSeverityLabel(severity[0])}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ '--slider-color': getSeverityColor(severity[0]) } as React.CSSProperties}>
                  <Slider value={severity} onValueChange={setSeverity} max={100} step={25} className="w-full" />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Description and Photos */}
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
                <Label className="text-sm font-semibold">Add photos (optional)</Label>
                {photos.length > 0 && (
                  <div className="flex gap-2 mb-2">
                    {photos.map((p, i) => (
                      <div key={i} className="relative w-20 h-20">
                        <img src={p.preview} alt="" className="w-full h-full object-cover rounded-xl" />
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {photos.length < 3 && (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Tap to add photos</span>
                    <Input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col gap-3 mt-8">
            {step === 1 ? (
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full rounded-xl h-12">
                Next Step
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading || !canSubmit} className="w-full rounded-xl h-12">
                {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>) : 'Submit Report'}
              </Button>
            )}

            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(1)} className="w-full rounded-xl h-12">
                <ChevronLeft className="h-4 w-4 mr-1" />Back
              </Button>
            ) : (
              <Button variant="outline" onClick={handleClose} className="w-full rounded-xl h-12">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
