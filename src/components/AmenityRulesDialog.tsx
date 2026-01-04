import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Calendar, Users, Info } from 'lucide-react';

interface Amenity {
  id: string;
  name: string;
  amenityType: string;
}

interface AmenityRulesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amenities: Amenity[];
}

interface AmenityRules {
  booking_start_time?: string;
  booking_end_time?: string;
  max_reservations_per_day?: number;
  max_reservations_per_week?: number;
  advance_booking_days?: number;
  singles_duration_minutes?: number;
  doubles_duration_minutes?: number;
  allow_guests?: boolean;
  max_guest_count?: number;
  custom_rules?: string;
}

const AmenityRulesDialog: React.FC<AmenityRulesDialogProps> = ({
  isOpen,
  onClose,
  amenities
}) => {
  const [rulesData, setRulesData] = useState<Record<string, AmenityRules>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && amenities.length > 0) {
      fetchAllRules();
    }
  }, [isOpen, amenities]);

  const fetchAllRules = async () => {
    setLoading(true);
    try {
      const amenityIds = amenities.map(a => a.id);
      const { data, error } = await supabase
        .from('amenity_rules')
        .select('*')
        .in('amenity_id', amenityIds);

      if (!error && data) {
        const rulesMap: Record<string, AmenityRules> = {};
        data.forEach((rule: any) => {
          rulesMap[rule.amenity_id] = rule;
        });
        setRulesData(rulesMap);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time?: string) => {
    if (!time) return 'Not set';
    const [hours, minutes] = time.split(':').map(Number);
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    const amPm = hours < 12 ? 'AM' : 'PM';
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${amPm}`;
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'Not set';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${mins} minutes`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Info className="h-5 w-5" />
            Amenity Rules & Guidelines
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading rules...</div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {amenities.map((amenity) => {
                const rules = rulesData[amenity.id];
                
                return (
                  <AccordionItem key={amenity.id} value={amenity.id}>
                    <AccordionTrigger className="text-sm font-medium">
                      {amenity.name}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        {/* Operating Hours */}
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">Operating Hours</p>
                            <p className="text-muted-foreground">
                              {formatTime(rules?.booking_start_time)} - {formatTime(rules?.booking_end_time)}
                            </p>
                          </div>
                        </div>

                        {/* Booking Limits */}
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">Booking Limits</p>
                            <p className="text-muted-foreground">
                              Max {rules?.max_reservations_per_day || 2} per day, {rules?.max_reservations_per_week || 7} per week
                            </p>
                            <p className="text-muted-foreground">
                              Book up to {rules?.advance_booking_days || 7} days in advance
                            </p>
                          </div>
                        </div>

                        {/* Duration */}
                        {(rules?.singles_duration_minutes || rules?.doubles_duration_minutes) && (
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">Max Duration</p>
                              {rules?.singles_duration_minutes && (
                                <p className="text-muted-foreground">
                                  Singles: {formatDuration(rules.singles_duration_minutes)}
                                </p>
                              )}
                              {rules?.doubles_duration_minutes && (
                                <p className="text-muted-foreground">
                                  Doubles: {formatDuration(rules.doubles_duration_minutes)}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Guest Policy */}
                        <div className="flex items-start gap-2">
                          <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">Guest Policy</p>
                            <p className="text-muted-foreground">
                              {rules?.allow_guests 
                                ? `Guests allowed (max ${rules.max_guest_count || 2} per reservation)` 
                                : 'Guests not allowed'}
                            </p>
                          </div>
                        </div>

                        {/* Custom Rules */}
                        {rules?.custom_rules && (
                          <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium mb-1">Additional Rules</p>
                            <p className="text-muted-foreground whitespace-pre-wrap text-xs">
                              {rules.custom_rules}
                            </p>
                          </div>
                        )}

                        {!rules && (
                          <p className="text-muted-foreground italic">
                            No specific rules configured for this amenity.
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AmenityRulesDialog;
