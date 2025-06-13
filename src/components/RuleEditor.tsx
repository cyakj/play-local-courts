import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Clock, Users, Calendar, Shield } from 'lucide-react';
import { Amenity } from '../types';
import { useAmenityRules } from '../hooks/useAmenityRules';
import { useToast } from '@/hooks/use-toast';
import RuleSummary from './RuleSummary';

interface RuleEditorProps {
  amenity: Amenity;
  onBack: () => void;
}

const RuleEditor = ({ amenity, onBack }: RuleEditorProps) => {
  const { rules, loading, saveRules } = useAmenityRules(amenity.id);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    booking_start_time: '07:00',
    booking_end_time: '21:00',
    singles_duration_minutes: 60,
    doubles_duration_minutes: 90,
    family_duration_minutes: 120,
    group_duration_minutes: 120,
    max_reservations_per_day: 1,
    max_reservations_per_week: 3,
    min_time_between_reservations: 0,
    advance_booking_days: 7,
    allow_guests: true,
    checkin_required_minutes: 15,
    min_cancellation_hours: 24,
    max_no_shows: 3,
    no_show_restriction_days: 30,
    enable_peak_hours: false,
    peak_start_time: '17:00',
    peak_end_time: '19:00',
    peak_singles_duration_minutes: 30,
    peak_doubles_duration_minutes: 45,
    peak_family_duration_minutes: 60,
    peak_group_duration_minutes: 60,
    requires_admin_approval: false,
    security_deposit_required: false,
    security_deposit_amount: 0,
    max_guest_count: 4,
    requires_cleanup_agreement: false,
    allow_ball_machine: false,
    singles_only: false,
    doubles_only: false,
    requires_power_outlet: false,
    no_lifeguard_acknowledgment: false,
    custom_rules: ''
  });

  useEffect(() => {
    if (rules) {
      setFormData({
        booking_start_time: rules.booking_start_time || '07:00',
        booking_end_time: rules.booking_end_time || '21:00',
        singles_duration_minutes: rules.singles_duration_minutes || 60,
        doubles_duration_minutes: rules.doubles_duration_minutes || 90,
        family_duration_minutes: rules.family_duration_minutes || 120,
        group_duration_minutes: rules.group_duration_minutes || 120,
        max_reservations_per_day: rules.max_reservations_per_day || 1,
        max_reservations_per_week: rules.max_reservations_per_week || 3,
        min_time_between_reservations: rules.min_time_between_reservations || 0,
        advance_booking_days: rules.advance_booking_days || 7,
        allow_guests: rules.allow_guests ?? true,
        checkin_required_minutes: rules.checkin_required_minutes || 15,
        min_cancellation_hours: rules.min_cancellation_hours || 24,
        max_no_shows: rules.max_no_shows || 3,
        no_show_restriction_days: rules.no_show_restriction_days || 30,
        enable_peak_hours: rules.enable_peak_hours ?? false,
        peak_start_time: rules.peak_start_time || '17:00',
        peak_end_time: rules.peak_end_time || '19:00',
        peak_singles_duration_minutes: rules.peak_singles_duration_minutes || 30,
        peak_doubles_duration_minutes: rules.peak_doubles_duration_minutes || 45,
        peak_family_duration_minutes: rules.peak_family_duration_minutes || 60,
        peak_group_duration_minutes: rules.peak_group_duration_minutes || 60,
        requires_admin_approval: rules.requires_admin_approval ?? false,
        security_deposit_required: rules.security_deposit_required ?? false,
        security_deposit_amount: rules.security_deposit_amount || 0,
        max_guest_count: rules.max_guest_count || 4,
        requires_cleanup_agreement: rules.requires_cleanup_agreement ?? false,
        allow_ball_machine: rules.allow_ball_machine ?? false,
        singles_only: rules.singles_only ?? false,
        doubles_only: rules.doubles_only ?? false,
        requires_power_outlet: rules.requires_power_outlet ?? false,
        no_lifeguard_acknowledgment: rules.no_lifeguard_acknowledgment ?? false,
        custom_rules: rules.custom_rules || ''
      });
    }
  }, [rules]);

  const handleSave = async () => {
    try {
      await saveRules(formData);
      toast({
        title: "Rules saved successfully",
        description: `Rules for ${amenity.name} have been updated.`
      });
    } catch (error) {
      toast({
        title: "Error saving rules",
        description: "Failed to save the amenity rules. Please try again.",
        variant: "destructive"
      });
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Amenities
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configure Rules</h1>
          <p className="text-muted-foreground">{amenity.name} • {amenity.amenityType}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Booking Time Windows */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Booking Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={formData.booking_start_time}
                    onChange={(e) => updateField('booking_start_time', e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={formData.booking_end_time}
                    onChange={(e) => updateField('booking_end_time', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Duration Limits by Play Type */}
          <Card>
            <CardHeader>
              <CardTitle>Duration Limits by Play Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(amenity.amenityType === 'tennis' || amenity.amenityType === 'pickleball') && (
                <>
                  <div>
                    <Label>Singles Duration (minutes): {formData.singles_duration_minutes}</Label>
                    <Slider
                      value={[formData.singles_duration_minutes]}
                      onValueChange={([value]) => updateField('singles_duration_minutes', value)}
                      max={240}
                      min={15}
                      step={15}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Doubles Duration (minutes): {formData.doubles_duration_minutes}</Label>
                    <Slider
                      value={[formData.doubles_duration_minutes]}
                      onValueChange={([value]) => updateField('doubles_duration_minutes', value)}
                      max={240}
                      min={15}
                      step={15}
                      className="mt-2"
                    />
                  </div>
                </>
              )}
              
              {(amenity.amenityType === 'pool' || amenity.amenityType === 'barbecue' || amenity.amenityType === 'jacuzzi' || amenity.amenityType === 'clubhouse') && (
                <>
                  <div>
                    <Label>Family Duration (minutes): {formData.family_duration_minutes}</Label>
                    <Slider
                      value={[formData.family_duration_minutes]}
                      onValueChange={([value]) => updateField('family_duration_minutes', value)}
                      max={480}
                      min={15}
                      step={15}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Group Duration (minutes): {formData.group_duration_minutes}</Label>
                    <Slider
                      value={[formData.group_duration_minutes]}
                      onValueChange={([value]) => updateField('group_duration_minutes', value)}
                      max={480}
                      min={15}
                      step={15}
                      className="mt-2"
                    />
                  </div>
                </>
              )}
              
              {amenity.amenityType === 'gym' && (
                <>
                  <div>
                    <Label>Singles Duration (minutes): {formData.singles_duration_minutes}</Label>
                    <Slider
                      value={[formData.singles_duration_minutes]}
                      onValueChange={([value]) => updateField('singles_duration_minutes', value)}
                      max={240}
                      min={15}
                      step={15}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Group Duration (minutes): {formData.group_duration_minutes}</Label>
                    <Slider
                      value={[formData.group_duration_minutes]}
                      onValueChange={([value]) => updateField('group_duration_minutes', value)}
                      max={240}
                      min={15}
                      step={15}
                      className="mt-2"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Frequency Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Booking Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max per Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.max_reservations_per_day}
                    onChange={(e) => updateField('max_reservations_per_day', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Max per Week</Label>
                  <Input
                    type="number"
                    min="1"
                    max="14"
                    value={formData.max_reservations_per_week}
                    onChange={(e) => updateField('max_reservations_per_week', parseInt(e.target.value))}
                  />
                </div>
              </div>
              
              <div>
                <Label>Advance Booking (days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={formData.advance_booking_days}
                  onChange={(e) => updateField('advance_booking_days', parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Guest Policies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Guest & Check-in Policies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Allow Guests</Label>
                <Switch
                  checked={formData.allow_guests}
                  onCheckedChange={(checked) => updateField('allow_guests', checked)}
                />
              </div>
              
              {formData.allow_guests && (
                <div>
                  <Label>Maximum Guest Count</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.max_guest_count}
                    onChange={(e) => updateField('max_guest_count', parseInt(e.target.value))}
                  />
                </div>
              )}
              
              <div>
                <Label>Check-in Required (minutes after start time)</Label>
                <Input
                  type="number"
                  min="5"
                  max="60"
                  value={formData.checkin_required_minutes}
                  onChange={(e) => updateField('checkin_required_minutes', parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Peak Hours */}
          <Card>
            <CardHeader>
              <CardTitle>Peak Hour Restrictions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Peak Hour Restrictions</Label>
                <Switch
                  checked={formData.enable_peak_hours}
                  onCheckedChange={(checked) => updateField('enable_peak_hours', checked)}
                />
              </div>
              
              {formData.enable_peak_hours && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Peak Start Time</Label>
                      <Input
                        type="time"
                        value={formData.peak_start_time}
                        onChange={(e) => updateField('peak_start_time', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Peak End Time</Label>
                      <Input
                        type="time"
                        value={formData.peak_end_time}
                        onChange={(e) => updateField('peak_end_time', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {(amenity.amenityType === 'tennis' || amenity.amenityType === 'pickleball') && (
                    <>
                      <div>
                        <Label>Peak Singles Duration (minutes): {formData.peak_singles_duration_minutes}</Label>
                        <Slider
                          value={[formData.peak_singles_duration_minutes]}
                          onValueChange={([value]) => updateField('peak_singles_duration_minutes', value)}
                          max={120}
                          min={15}
                          step={15}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Peak Doubles Duration (minutes): {formData.peak_doubles_duration_minutes}</Label>
                        <Slider
                          value={[formData.peak_doubles_duration_minutes]}
                          onValueChange={([value]) => updateField('peak_doubles_duration_minutes', value)}
                          max={120}
                          min={15}
                          step={15}
                          className="mt-2"
                        />
                      </div>
                    </>
                  )}
                  
                  {(amenity.amenityType === 'pool' || amenity.amenityType === 'barbecue' || amenity.amenityType === 'jacuzzi' || amenity.amenityType === 'clubhouse') && (
                    <>
                      <div>
                        <Label>Peak Family Duration (minutes): {formData.peak_family_duration_minutes}</Label>
                        <Slider
                          value={[formData.peak_family_duration_minutes]}
                          onValueChange={([value]) => updateField('peak_family_duration_minutes', value)}
                          max={240}
                          min={15}
                          step={15}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Peak Group Duration (minutes): {formData.peak_group_duration_minutes}</Label>
                        <Slider
                          value={[formData.peak_group_duration_minutes]}
                          onValueChange={([value]) => updateField('peak_group_duration_minutes', value)}
                          max={240}
                          min={15}
                          step={15}
                          className="mt-2"
                        />
                      </div>
                    </>
                  )}
                  
                  {amenity.amenityType === 'gym' && (
                    <>
                      <div>
                        <Label>Peak Singles Duration (minutes): {formData.peak_singles_duration_minutes}</Label>
                        <Slider
                          value={[formData.peak_singles_duration_minutes]}
                          onValueChange={([value]) => updateField('peak_singles_duration_minutes', value)}
                          max={120}
                          min={15}
                          step={15}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Peak Group Duration (minutes): {formData.peak_group_duration_minutes}</Label>
                        <Slider
                          value={[formData.peak_group_duration_minutes]}
                          onValueChange={([value]) => updateField('peak_group_duration_minutes', value)}
                          max={120}
                          min={15}
                          step={15}
                          className="mt-2"
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Amenity-Specific Rules */}
          {(amenity.amenityType === 'tennis' || amenity.amenityType === 'pickleball') && (
            <Card>
              <CardHeader>
                <CardTitle>Court-Specific Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Allow Ball Machine</Label>
                  <Switch
                    checked={formData.allow_ball_machine}
                    onCheckedChange={(checked) => updateField('allow_ball_machine', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Singles Only</Label>
                  <Switch
                    checked={formData.singles_only}
                    onCheckedChange={(checked) => updateField('singles_only', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Doubles Only</Label>
                  <Switch
                    checked={formData.doubles_only}
                    onCheckedChange={(checked) => updateField('doubles_only', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {amenity.amenityType === 'clubhouse' && (
            <Card>
              <CardHeader>
                <CardTitle>Clubhouse Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Security Deposit Required</Label>
                  <Switch
                    checked={formData.security_deposit_required}
                    onCheckedChange={(checked) => updateField('security_deposit_required', checked)}
                  />
                </div>
                {formData.security_deposit_required && (
                  <div>
                    <Label>Security Deposit Amount ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.security_deposit_amount}
                      onChange={(e) => updateField('security_deposit_amount', parseFloat(e.target.value))}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label>Power Outlet Access</Label>
                  <Switch
                    checked={formData.requires_power_outlet}
                    onCheckedChange={(checked) => updateField('requires_power_outlet', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {(amenity.amenityType === 'pool' || amenity.amenityType === 'barbecue') && (
            <Card>
              <CardHeader>
                <CardTitle>{amenity.amenityType === 'pool' ? 'Pool' : 'BBQ'} Area Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Cleanup Agreement Required</Label>
                  <Switch
                    checked={formData.requires_cleanup_agreement}
                    onCheckedChange={(checked) => updateField('requires_cleanup_agreement', checked)}
                  />
                </div>
                {amenity.amenityType === 'pool' && (
                  <div className="flex items-center justify-between">
                    <Label>No Lifeguard Acknowledgment</Label>
                    <Switch
                      checked={formData.no_lifeguard_acknowledgment}
                      onCheckedChange={(checked) => updateField('no_lifeguard_acknowledgment', checked)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Admin Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Administrative Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Require Admin Approval</Label>
                <Switch
                  checked={formData.requires_admin_approval}
                  onCheckedChange={(checked) => updateField('requires_admin_approval', checked)}
                />
              </div>
              
              <div>
                <Label>Minimum Cancellation Hours</Label>
                <Input
                  type="number"
                  min="1"
                  max="168"
                  value={formData.min_cancellation_hours}
                  onChange={(e) => updateField('min_cancellation_hours', parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Custom Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <Label>Additional Rules & Notes</Label>
              <Textarea
                placeholder="Enter any additional rules or special instructions for this amenity..."
                value={formData.custom_rules}
                onChange={(e) => updateField('custom_rules', e.target.value)}
                className="mt-2"
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Rule Summary Sidebar */}
        <div className="lg:col-span-1">
          <RuleSummary amenity={amenity} rules={formData} />
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Rules
        </Button>
      </div>
    </div>
  );
};

export default RuleEditor;
