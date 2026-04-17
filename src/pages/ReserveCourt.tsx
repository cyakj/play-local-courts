import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useActiveHOA } from '../contexts/ActiveHOAContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Wrench, Heart, Clock, ChevronRight, FileText, BookOpen, AlertCircle } from 'lucide-react';
import TimeSelector from '../components/TimeSelector';
import CourtPoliciesDialog from '../components/CourtPoliciesDialog';
import AmenityRulesDialog from '../components/AmenityRulesDialog';
import { MultiStepReportDialog } from '../components/maintenance/MultiStepReportDialog';
import { useAmenityRules } from '../hooks/useAmenityRules';
import { AmenityStatus } from '../types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface MaintenanceReport {
  id: string;
  category: string;
  status: string;
  created_at: string;
  description: string;
}

interface PolicyAgreement {
  amenity_id: string;
  rules_version: string;
}

const ReserveCourt = () => {
  const { currentUser } = useAuth();
  const { activeHOA, isHOAUser, loading: hoaLoading } = useActiveHOA();
  const { 
    amenities, 
    bookAmenity,
    hasBookingForDate 
  } = useData();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedAmenity, setSelectedAmenity] = useState<string>('');
  const [playType, setPlayType] = useState<'singles' | 'doubles' | 'family' | 'group'>('singles');
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [selectedEndTime, setSelectedEndTime] = useState<string>('');
  const [showPoliciesDialog, setShowPoliciesDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [myReports, setMyReports] = useState<MaintenanceReport[]>([]);
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [policyAgreements, setPolicyAgreements] = useState<PolicyAgreement[]>([]);
  const [pendingBooking, setPendingBooking] = useState(false);
  
  const { rules, loading: rulesLoading } = useAmenityRules(selectedAmenity);

  // Fetch user's policy agreements
  useEffect(() => {
    const fetchPolicyAgreements = async () => {
      if (!currentUser) return;
      
      const { data, error } = await supabase
        .from('amenity_policy_agreements')
        .select('amenity_id, rules_version')
        .eq('user_id', currentUser.id);
      
      if (!error && data) {
        setPolicyAgreements(data);
      }
    };
    
    fetchPolicyAgreements();
  }, [currentUser]);

  // Fetch user's maintenance reports for active HOA only
  useEffect(() => {
    const fetchMyReports = async () => {
      if (!currentUser || !activeHOA?.hoaId) {
        setMyReports([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('maintenance_reports')
        .select('id, category, status, created_at, description')
        .eq('reporter_id', currentUser.id)
        .eq('hoa_id', activeHOA.hoaId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (!error && data) {
        setMyReports(data);
      }
    };
    
    fetchMyReports();
  }, [currentUser, activeHOA?.hoaId, showReportDialog]);

  // Block access if user is not part of any HOA - AFTER all hooks
  if (!hoaLoading && !isHOAUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold">Community Membership Required</h2>
              <p className="text-muted-foreground">
                You need to be a member of a community to access amenity reservations.
              </p>
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/my-home?tab=community">Join a Community</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const today = new Date();
  const tomorrow = addDays(today, 1);
  
  const dateOptions = [
    { value: format(today, 'yyyy-MM-dd'), label: `Today (${format(today, 'MMMM d')})`, date: today },
    { value: format(tomorrow, 'yyyy-MM-dd'), label: `Tomorrow (${format(tomorrow, 'MMMM d')})`, date: tomorrow }
  ];

  // Get unique amenity types for filter tabs
  const amenityTypes = ['all', ...new Set(amenities.map(a => a.amenityType))];

  // Filter amenities based on active filter
  const filteredAmenities = activeFilter === 'all' 
    ? amenities 
    : amenities.filter(a => a.amenityType === activeFilter);

  const amenityTypeConfig: Record<string, { label: string; basePlayTypes: string[]; description: string }> = {
    tennis: { label: 'Courts', basePlayTypes: ['singles', 'doubles'], description: 'Professional grade courts with night lighting' },
    pickleball: { label: 'Courts', basePlayTypes: ['singles', 'doubles'], description: 'Dedicated pickleball courts' },
    pool: { label: 'Pools', basePlayTypes: ['family', 'group'], description: 'Heated pool with dedicated lap lanes' },
    barbecue: { label: 'Dining', basePlayTypes: ['family', 'group'], description: 'Outdoor BBQ and dining areas' },
    clubhouse: { label: 'Dining', basePlayTypes: ['family', 'group'], description: 'Perfect for events and gatherings' },
    gym: { label: 'Gym', basePlayTypes: ['singles', 'group'], description: 'Fully equipped fitness center' },
    jacuzzi: { label: 'Pools', basePlayTypes: ['family', 'group'], description: 'Relaxation spa' }
  };

  // Mock status for amenities - in production this would come from real-time data
  const getAmenityStatus = (amenityId: string) => {
    const statuses = ['open', 'low', 'closed'];
    const hash = amenityId.charCodeAt(0) % 3;
    return statuses[hash];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="text-white border-0" style={{ background: '#00D4FF' }}>Open Now</Badge>;
      case 'low':
        return <Badge className="text-white border-0" style={{ background: '#F59E0B' }}>Low Availability</Badge>;
      case 'closed':
        return <Badge className="text-white border-0" style={{ background: '#EF4444' }}>Closed</Badge>;
      default:
        return null;
    }
  };

  const getNextAvailable = (status: string) => {
    if (status === 'open') return null;
    if (status === 'low') return 'Next: 2:00 PM';
    return 'Opens: 9:00 AM';
  };

  const toggleFavorite = (amenityId: string) => {
    setFavorites(prev => 
      prev.includes(amenityId) 
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  const getBookedSlots = (amenityId: string, date: string) => {
    // Return empty array - real bookings come from Supabase through DataContext
    return [];
  };
  
  const getMaintenanceSlots = (amenityId: string, date: string) => {
    // Return empty array - real maintenance comes from Supabase through DataContext
    return [];
  };
  
  const handleTimeSelect = (startTime: string, endTime: string) => {
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
  };

  const handleClearSelection = () => {
    setSelectedStartTime('');
    setSelectedEndTime('');
  };
  
  // Check if user needs to agree to policies for this amenity
  const needsPolicyAgreement = (amenityId: string): boolean => {
    if (!currentUser) return true;
    
    // Check if user has agreed to this amenity's policies
    const agreement = policyAgreements.find(a => a.amenity_id === amenityId);
    if (!agreement) return true;
    
    // Check if rules have been updated since agreement
    // We use the amenity_rules updated_at timestamp as the version
    if (rules?.updated_at) {
      const rulesVersion = new Date(rules.updated_at).getTime();
      const agreementVersion = new Date(agreement.rules_version).getTime();
      return rulesVersion > agreementVersion;
    }
    
    return false;
  };
  
  const handleBookAmenity = () => {
    if (!currentUser || !selectedAmenity || !selectedStartTime || !selectedEndTime) {
      toast.error("Please select an amenity and time slot");
      return;
    }
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (currentUser && hasBookingForDate(currentUser.id, dateStr)) {
      toast.error("You already have a booking for this date");
      return;
    }
    
    // Check if policy agreement is needed
    if (needsPolicyAgreement(selectedAmenity)) {
      setShowPoliciesDialog(true);
    } else {
      // Skip policy dialog and book directly
      setPendingBooking(true);
      completeBooking();
    }
  };
  
  const completeBooking = async () => {
    if (!currentUser || !selectedAmenity) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const amenity = amenities.find(a => a.id === selectedAmenity);
    
    if (amenity) {
      const timeSlot = {
        id: `${selectedAmenity}-${dateStr}-${selectedStartTime}`,
        start: new Date(`${dateStr}T${selectedStartTime}:00`).toISOString(),
        end: new Date(`${dateStr}T${selectedEndTime}:00`).toISOString(),
        status: AmenityStatus.AVAILABLE
      };
      
      await bookAmenity(
        currentUser.id,
        currentUser.fullName,
        amenity.id,
        amenity.name,
        dateStr,
        timeSlot,
        playType
      );
      
      setSelectedStartTime('');
      setSelectedEndTime('');
      setSelectedAmenity('');
      setPendingBooking(false);
    }
  };
  
  const handlePoliciesAgreed = async () => {
    if (!currentUser || !selectedAmenity) return;
    
    try {
      // Save policy agreement with current rules version
      const rulesVersion = rules?.updated_at || new Date().toISOString();
      
      await supabase
        .from('amenity_policy_agreements')
        .upsert({
          user_id: currentUser.id,
          amenity_id: selectedAmenity,
          rules_version: rulesVersion,
          agreed_at: new Date().toISOString()
        }, { onConflict: 'user_id,amenity_id' });
      
      // Update local state
      setPolicyAgreements(prev => {
        const filtered = prev.filter(a => a.amenity_id !== selectedAmenity);
        return [...filtered, { amenity_id: selectedAmenity, rules_version: rulesVersion }];
      });
      
      setShowPoliciesDialog(false);
      
      // Complete the booking
      await completeBooking();
    } catch (error) {
      console.error('Error saving policy agreement:', error);
      toast.error('Failed to save agreement. Please try again.');
    }
  };

  const getPlayTypeOptions = (amenityType: string) => {
    const config = amenityTypeConfig[amenityType];
    let availablePlayTypes = config?.basePlayTypes || ['singles'];

    if (rules) {
      if (rules.singles_only) {
        availablePlayTypes = availablePlayTypes.filter(type => type === 'singles');
      } else if (rules.doubles_only) {
        availablePlayTypes = availablePlayTypes.filter(type => type === 'doubles');
      }
    }

    return availablePlayTypes;
  };

  const getMaxDuration = (): number => {
    if (!rules) {
      switch (playType) {
        case 'singles': return 60;
        case 'doubles': return 90;
        case 'family':
        case 'group': return 120;
        default: return 60;
      }
    }
    // Use play-type specific durations from rules
    switch (playType) {
      case 'singles': return rules.singles_duration_minutes || 60;
      case 'doubles': return rules.doubles_duration_minutes || 90;
      case 'family': return rules.family_duration_minutes || 120;
      case 'group': return rules.group_duration_minutes || 120;
      default: return 60;
    }
  };

  const getDurationOptions = () => {
    const maxDuration = getMaxDuration();
    const options = [];
    
    for (let duration = 30; duration <= maxDuration; duration += 30) {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      
      let label = '';
      if (hours > 0) {
        label += `${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) label += ` ${minutes} min`;
      } else {
        label = `${minutes} min`;
      }
      
      options.push({ value: duration, label });
    }
    
    return options;
  };

  const getFilterLabel = (type: string) => {
    if (type === 'all') return 'All';
    const config = amenityTypeConfig[type];
    return config?.label || type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navy Header */}
      <div className="text-white px-5 pt-[50px] pb-5" style={{ backgroundColor: '#0F1F3D' }}>
        <div className="text-xl font-extrabold">Book Amenity</div>
        <div className="text-xs opacity-65 mt-0.5">Reserve your spot instantly</div>
      </div>

      {/* Check Availability CTA */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl p-4 text-center" style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #0091B5 100%)' }}>
          <div className="text-base font-extrabold text-white mb-1">Check Availability</div>
          <div className="text-xs text-white/85 mb-3">Pick a date and time to see what's open</div>
          <button
            onClick={() => document.getElementById('amenity-grid')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-white text-primary rounded-[10px] px-5 py-2.5 text-[13px] font-extrabold inline-block"
          >
            📅 Select Date & Time
          </button>
        </div>
      </div>

      {/* My Reports Bubble - moved to Reports tab */}
      {/* 
      {myReports.length > 0 && (
        <div className="px-4 pb-3">
          ... reports bubble content removed, now in /my-reports ...
        </div>
      )}
      */}

      {/* Filter Tabs */}
      <div id="amenity-grid" className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {amenityTypes.map((type) => (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                activeFilter === type
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {getFilterLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Discover Amenities */}
      <div className="px-4 pb-6">
        <h2 className="text-lg font-semibold mb-4">Discover Amenities</h2>
        
        <div className="space-y-4">
          {filteredAmenities.map((amenity) => {
            const status = getAmenityStatus(amenity.id);
            const nextAvailable = getNextAvailable(status);
            const isSelected = selectedAmenity === amenity.id;
            const config = amenityTypeConfig[amenity.amenityType];
            const isFavorite = favorites.includes(amenity.id);
            
            return (
              <Card 
                key={amenity.id} 
                className={cn(
                  "overflow-hidden transition-all",
                  isSelected && "ring-2 ring-primary"
                )}
              >
                {/* Compact horizontal layout */}
                <div className="flex">
                  {/* Thumbnail */}
                  <div className="relative w-24 h-24 flex-shrink-0 bg-muted">
                    <img 
                      src="/placeholder.svg" 
                      alt={amenity.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1">
                      {getStatusBadge(status)}
                    </div>
                  </div>
                  
                  <CardContent className="flex-1 p-3 flex flex-col justify-between">
                    {/* Info row */}
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-primary text-sm truncate">{amenity.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {nextAvailable && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {nextAvailable}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 -mr-1 -mt-1"
                        onClick={() => toggleFavorite(amenity.id)}
                      >
                        <Heart className={cn(
                          "h-4 w-4",
                          isFavorite && "fill-red-500 text-red-500"
                        )} />
                      </Button>
                    </div>
                    
                    {/* Action Button */}
                    <div className="mt-2">
                      {status === 'open' ? (
                        <Button 
                          size="sm"
                          className="w-full h-7 text-xs rounded-full"
                          onClick={() => {
                            setSelectedAmenity(amenity.id);
                            const availableTypes = getPlayTypeOptions(amenity.amenityType);
                            if (availableTypes.length > 0) {
                              setPlayType(availableTypes[0] as typeof playType);
                            }
                          }}
                        >
                          Book Now
                        </Button>
                      ) : status === 'low' ? (
                        <Button variant="outline" size="sm" className="w-full h-7 text-xs rounded-full">
                          View Schedule
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="w-full h-7 text-xs rounded-full">
                          Join Waitlist
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </div>
                  
                {/* Booking Form (when selected) - Redesigned to match screenshot */}
                {isSelected && !rulesLoading && (
                  <div className="border-t bg-background">
                    
                    <div className="p-4 space-y-4">
                      {/* Date and Type Row */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Date Selection */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Select Date</Label>
                          <Select 
                            value={format(selectedDate, 'yyyy-MM-dd')}
                            onValueChange={(value) => {
                              const date = dateOptions.find(d => d.value === value)?.date;
                              if (date) setSelectedDate(date);
                            }}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select a date" />
                            </SelectTrigger>
                            <SelectContent>
                              {dateOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Play Type Selection - Radio buttons style */}
                        {getPlayTypeOptions(amenity.amenityType).length > 1 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Type of Use</Label>
                            <RadioGroup 
                              value={playType} 
                              onValueChange={(value) => {
                                setPlayType(value as typeof playType);
                                setSelectedStartTime('');
                                setSelectedEndTime('');
                              }}
                              className="flex gap-3 pt-1"
                            >
                              {getPlayTypeOptions(amenity.amenityType).map(option => (
                                <div key={option} className="flex items-center space-x-1.5">
                                  <RadioGroupItem value={option} id={`${amenity.id}-${option}`} className="h-4 w-4" />
                                  <Label htmlFor={`${amenity.id}-${option}`} className="capitalize text-sm cursor-pointer">
                                    {option}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                      
                      {/* Duration Selection */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Duration</Label>
                        <Select 
                          value={selectedDuration.toString()} 
                          onValueChange={(value) => {
                            setSelectedDuration(parseInt(value));
                            setSelectedStartTime('');
                            setSelectedEndTime('');
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            {getDurationOptions().map(option => (
                              <SelectItem key={option.value} value={option.value.toString()}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Time Selector */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium text-muted-foreground">Select Time</Label>
                          <span className="text-[10px] text-muted-foreground">Your timezone: EST</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Available slots are shown in white. Selected slot is green.
                        </p>
                        <TimeSelector
                          selectedDate={selectedDate}
                          onTimeSelect={handleTimeSelect}
                          onClearSelection={handleClearSelection}
                          maxDurationMinutes={selectedDuration}
                          amenityRules={rules}
                          bookedSlots={getBookedSlots(amenity.id, format(selectedDate, 'yyyy-MM-dd'))}
                          maintenanceSlots={getMaintenanceSlots(amenity.id, format(selectedDate, 'yyyy-MM-dd'))}
                          selectedStartTime={selectedStartTime}
                          selectedEndTime={selectedEndTime}
                        />
                      </div>
                      
                      {/* Confirm Button - Full width gradient at bottom */}
                      <Button 
                        onClick={handleBookAmenity} 
                        disabled={!selectedStartTime || !selectedEndTime}
                        className="w-full h-11 rounded-xl mt-2"
                      >
                        {selectedStartTime ? (() => {
                          const [h, m] = selectedStartTime.split(':').map(Number);
                          const displayHour = h % 12 === 0 ? 12 : h % 12;
                          const amPm = h < 12 ? 'AM' : 'PM';
                          return `Confirm Booking for ${displayHour}:${m.toString().padStart(2, '0')} ${amPm}`;
                        })() : 'Select a time slot'} →
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        
        {filteredAmenities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No amenities available in this category</p>
          </div>
        )}
      </div>
      
      {/* Rules Button at Bottom */}
      <div className="px-4 pb-8">
        <Button
          variant="outline"
          className="w-full h-11 rounded-xl"
          onClick={() => setShowRulesDialog(true)}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          View Amenity Rules & Guidelines
        </Button>
      </div>
      
      <CourtPoliciesDialog
        isOpen={showPoliciesDialog}
        onClose={() => setShowPoliciesDialog(false)}
        onAgree={handlePoliciesAgreed}
        amenityName={amenities.find(a => a.id === selectedAmenity)?.name}
        amenityType={amenities.find(a => a.id === selectedAmenity)?.amenityType}
      />
      
      <AmenityRulesDialog
        isOpen={showRulesDialog}
        onClose={() => setShowRulesDialog(false)}
        amenities={amenities.map(a => ({ id: a.id, name: a.name, amenityType: a.amenityType }))}
      />
      
      <MultiStepReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        amenities={amenities.map(a => ({ id: a.id, name: a.name, amenityType: a.amenityType }))}
      />
    </div>
  );
};

export default ReserveCourt;
