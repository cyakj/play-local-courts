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
import { Wrench, Zap, Droplets, TreePine, Building2, ShieldAlert, Camera, Loader2, ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiStepReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amenities: Array<{ id: string; name: string; amenityType: string }>;
}

type ReportType = 'amenity' | 'location' | null;

const issueTypes = [
  { value: 'amenities_equipment', label: 'Amenities & Equipment', icon: Wrench },
  { value: 'lighting_electrical', label: 'Lighting & Electrical', icon: Zap },
  { value: 'water_plumbing', label: 'Water & Plumbing', icon: Droplets },
  { value: 'grounds_landscaping', label: 'Grounds & Landscaping', icon: TreePine },
  { value: 'buildings_structures', label: 'Buildings & Structures', icon: Building2 },
  { value: 'safety_other', label: 'Safety / Other', icon: ShieldAlert },
];

const locationIssueTypes = [
  { value: 'lighting', label: 'Lighting', icon: Zap },
  { value: 'parking', label: 'Parking', icon: Building2 },
  { value: 'landscaping', label: 'Landscaping', icon: TreePine },
  { value: 'gate_entrance', label: 'Gate & Entrance', icon: ShieldAlert },
  { value: 'structural', label: 'Structural', icon: Wrench },
  { value: 'other', label: 'Other', icon: Droplets },
];

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
  const [reportType, setReportType] = useState<ReportType>(null);
  const [step, setStep] = useState(1);
  const [locStep, setLocStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Amenity form state
  const [issueType, setIssueType] = useState('');
  const [selectedAmenity, setSelectedAmenity] = useState('');
  const [severity, setSeverity] = useState([50]);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Location form state
  const [locationText, setLocationText] = useState('');
  const [locationCategory, setLocationCategory] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [locationPhotos, setLocationPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const [locSeverity, setLocSeverity] = useState([50]);

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

  const handleLocationPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 3 - locationPhotos.length;
    const toAdd = Array.from(files).slice(0, remaining);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocationPhotos((prev) => [...prev, { file, preview: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeLocationPhoto = (index: number) => {
    setLocationPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setReportType(null);
    setStep(1);
    setIssueType('');
    setSelectedAmenity('');
    setSeverity([50]);
    setDescription('');
    setPhoto(null);
    setPhotoPreview(null);
    setLocationText('');
    setLocationCategory('');
    setLocationDescription('');
    setLocationPhotos([]);
    setLocSeverity([50]);
    setLocStep(1);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(`maintenance/${fileName}`, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(`maintenance/${fileName}`);
    return publicUrl;
  };

  const handleSubmitAmenity = async () => {
    if (!currentUser || !issueType || !selectedAmenity || !description) {
      toast({ title: "Missing Information", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let photoUrl = null;
      if (photo) photoUrl = await uploadPhoto(photo);

      const { error } = await supabase
        .from('maintenance_reports')
        .insert({
          hoa_id: currentUser.hoaId!,
          amenity_id: selectedAmenity,
          reporter_id: currentUser.id,
          category: issueType,
          description: `[Severity: ${getSeverityLabel(severity[0])}] ${description}`,
          photo_url: photoUrl,
          status: 'open',
          report_type: 'amenity',
        } as any);

      if (error) throw error;
      toast({ title: "Issue Reported", description: "Your maintenance request has been submitted successfully." });
      handleClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({ title: "Error", description: "Failed to submit maintenance report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLocation = async () => {
    if (!currentUser || !locationText || !locationCategory || !locationDescription) {
      toast({ title: "Missing Information", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let photoUrl = null;
      if (locationPhotos.length > 0) {
        photoUrl = await uploadPhoto(locationPhotos[0].file);
      }

      const { error } = await supabase
        .from('maintenance_reports')
        .insert({
          hoa_id: currentUser.hoaId!,
          amenity_id: null,
          reporter_id: currentUser.id,
          category: locationCategory,
          description: `[Severity: ${getSeverityLabel(locSeverity[0])}] ${locationDescription}`,
          photo_url: photoUrl,
          status: 'open',
          report_type: 'location',
          location_text: locationText,
        } as any);

      if (error) throw error;
      toast({ title: "Issue Reported", description: "Your location report has been submitted successfully." });
      handleClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({ title: "Error", description: "Failed to submit report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = issueType && selectedAmenity;
  const canProceedStep2 = description.trim().length > 0;

  // ── TYPE SELECTION SCREEN ──
  if (!reportType) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
          {/* Navy header */}
          <div className="px-5 pt-12 pb-5" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #1A2A4A 100%)' }}>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={handleClose}
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)' }}
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
              <div>
                <div className="text-xl font-extrabold text-white">Report an Issue</div>
                <div className="text-xs text-white/60 mt-0.5">What kind of issue are you reporting?</div>
              </div>
            </div>
          </div>

          <div className="px-5 py-6">
            <div className="grid grid-cols-2 gap-3">
              {/* Amenity Issue card */}
              <button
                onClick={() => setReportType('amenity')}
                className="flex flex-col items-center text-center p-5 rounded-2xl border transition-all hover:shadow-md"
                style={{ borderColor: '#E5E7EB', background: '#FFFFFF' }}
              >
                <span className="text-3xl mb-3">🏊</span>
                <span className="text-base font-bold" style={{ color: '#1A1A2E' }}>Amenity Issue</span>
                <span className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Something broken or wrong at a specific amenity</span>
              </button>

              {/* Location Issue card */}
              <button
                onClick={() => setReportType('location')}
                className="flex flex-col items-center text-center p-5 rounded-2xl border transition-all hover:shadow-md"
                style={{ borderColor: '#E5E7EB', background: '#FFFFFF' }}
              >
                <span className="text-3xl mb-3">📍</span>
                <span className="text-base font-bold" style={{ color: '#1A1A2E' }}>Location Issue</span>
                <span className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Something in the community not tied to an amenity</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── LOCATION ISSUE FORM ──
  if (reportType === 'location') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
          {/* Navy header */}
          <div className="px-5 pt-12 pb-5" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #1A2A4A 100%)' }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setReportType(null)}
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)' }}
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
              <div>
                <div className="text-xl font-extrabold text-white">📍 Location Issue</div>
                <div className="text-xs text-white/60 mt-0.5">Report a community issue</div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Location */}
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#4B5563' }}>Location *</label>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g. Parking Lot B near the entrance, Street corner of Oak & Main"
                className="w-full text-sm"
                style={{
                  borderRadius: 10,
                  border: '1px solid #E5E7EB',
                  padding: '12px 14px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#4B5563' }}>Category *</label>
              <Select value={locationCategory} onValueChange={setLocationCategory}>
                <SelectTrigger className="rounded-[10px]">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {locationCategories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#4B5563' }}>Description *</label>
              <Textarea
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                rows={4}
                className="rounded-[10px] resize-none"
              />
            </div>

            {/* Photos */}
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#4B5563' }}>Photos (optional)</label>
              {locationPhotos.length > 0 && (
                <div className="flex gap-2 mb-2">
                  {locationPhotos.map((p, i) => (
                    <div key={i} className="relative w-20 h-20">
                      <img src={p.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button
                        onClick={() => removeLocationPhoto(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: '#EF4444' }}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {locationPhotos.length < 3 && (
                <label
                  className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-xs" style={{ color: '#9CA3AF' }}>Tap to add photos</span>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleLocationPhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="px-5 pb-6 pt-2">
            <button
              onClick={handleSubmitLocation}
              disabled={loading || !locationText || !locationCategory || !locationDescription}
              className="w-full py-3.5 rounded-xl text-white text-[15px] font-extrabold disabled:opacity-50"
              style={{ background: '#0A1628' }}
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── EXISTING AMENITY REPORT FLOW (unchanged) ──
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
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 1 ? "bg-primary" : "bg-muted")} />
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 2 ? "bg-primary" : "bg-muted")} />
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 3 ? "bg-primary" : "bg-muted")} />
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

              <div className="space-y-3">
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
                <Slider value={severity} onValueChange={setSeverity} max={100} step={25} className="w-full" />
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
                    <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                    <Button type="button" variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => { setPhoto(null); setPhotoPreview(null); }}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Tap to add photo</span>
                    <Input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
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
                  <span className="text-sm font-medium">{amenities.find(a => a.id === selectedAmenity)?.name}</span>
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
                  <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
                </div>
              )}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-4">
                <p className="text-sm font-medium text-primary mb-3">What happens next?</p>
                <div className="flex items-center justify-between text-xs">
                  {['Submitted', 'In Review', 'In Progress', 'Resolved'].map((label, i) => (
                    <React.Fragment key={label}>
                      {i > 0 && <div className="flex-1 h-0.5 bg-border mx-1" />}
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                          i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>{i + 1}</div>
                        <span className="mt-1 text-muted-foreground">{label}</span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex flex-col gap-3 mt-8">
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={step === 1 ? !canProceedStep1 : !canProceedStep2} className="w-full rounded-xl h-12">
                Next Step
              </Button>
            ) : (
              <Button onClick={handleSubmitAmenity} disabled={loading} className="w-full rounded-xl h-12">
                {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>) : 'Submit Report'}
              </Button>
            )}
            
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="w-full rounded-xl h-12">
                <ChevronLeft className="h-4 w-4 mr-1" />Back
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setReportType(null)} className="w-full rounded-xl h-12">
                Back
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
