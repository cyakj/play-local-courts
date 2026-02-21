import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isTennisEnabled } from "../contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface HOA {
  id: string;
  name: string;
  community_type: string;
  address?: string;
}

const Register = () => {
  // In HOA MVP, only "resident" and "hoa_manager" are shown.
  // "coach" is archived until isTennisEnabled = true.
  type RoleType = "resident" | "hoa_manager" | "coach";
  const [userRole, setUserRole] = useState<RoleType>("resident");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [selectedHOA, setSelectedHOA] = useState("");

  // Coach fields (archived only shown when isTennisEnabled)
  const [businessName, setBusinessName] = useState("");
  const [credentials, setCredentials] = useState<"USPTA" | "PTR" | "None">("None");
  const [yearsExperience, setYearsExperience] = useState<number>(0);
  const [sportsOffered, setSportsOffered] = useState<string[]>([]);
  const [homeBase, setHomeBase] = useState("");
  const [willingToTravel, setWillingToTravel] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>();
  const [bio, setBio] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hoas, setHOAs] = useState<HOA[]>([]);
  const [loadingHOAs, setLoadingHOAs] = useState(false);

  const { register, registerCoach } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole === "resident" || userRole === "hoa_manager") {
      loadHOAs();
    }
  }, [userRole]);

  const loadHOAs = async () => {
    setLoadingHOAs(true);
    try {
      const { data, error } = await supabase
        .from("hoas")
        .select("id, name, community_type, address")
        .order("name");
      if (error) throw error;
      setHOAs(data || []);
    } catch (error) {
      console.error("Error loading HOAs:", error);
      toast.error("Failed to load communities");
    } finally {
      setLoadingHOAs(false);
    }
  };

  const handleSportChange = (sport: string, checked: boolean) => {
    if (checked) setSportsOffered([...sportsOffered, sport]);
    else setSportsOffered(sportsOffered.filter(s => s !== sport));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (userRole === "coach") {
        await registerCoach(fullName, email, password, {
          businessName, credentials, yearsExperience, sportsOffered, homeBase, willingToTravel, hourlyRate, bio,
        });
      } else if (userRole === "hoa_manager") {
        await register(fullName, email, password, phoneNumber, dateOfBirth, "");
        toast.success("Account created! Now submit your HOA verification.");
        navigate("/hoa-application");
      } else {
        // Resident
        await register(fullName, email, password, phoneNumber, dateOfBirth, selectedHOA || "");
      }
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled =
    isLoading ||
    (userRole === "resident" && !selectedHOA) ||
    (userRole === "coach" && (!homeBase || sportsOffered.length === 0));

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>Join your HOA community</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="userRole">I am a <span className="text-red-500">*</span></Label>
            <Select value={userRole} onValueChange={(value: RoleType) => setUserRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resident">HOA Resident</SelectItem>
                <SelectItem value="hoa_manager">HOA Manager (requires verification)</SelectItem>
                {/* Coach registration archived re-enable when isTennisEnabled = true */}
                {isTennisEnabled && (
                  <SelectItem value="coach">Coach</SelectItem>
                )}
              </SelectContent>
            </Select>
            {userRole === "hoa_manager" && (
              <p className="text-sm text-muted-foreground mt-2">
                After creating your account, you will be guided to submit verification documents to prove your HOA management authority.
              </p>
            )}
          </div>

          {/* HOA Selection for Residents */}
          {userRole === "resident" && (
            <div className="space-y-2">
              <Label htmlFor="hoa">Select Your Community <span className="text-red-500">*</span></Label>
              <Select value={selectedHOA} onValueChange={setSelectedHOA} disabled={loadingHOAs || isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingHOAs ? "Loading communities..." : "Choose your HOA"} />
                </SelectTrigger>
                <SelectContent>
                  {hoas.map((hoa) => (
                    <SelectItem key={hoa.id} value={hoa.id}>
                      {hoa.name}{hoa.address ? ` — ${hoa.address}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Do not see your community? Contact your HOA manager.
              </p>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
            <Input id="fullName" type="text" placeholder="Jane Smith" value={fullName}
              onChange={(e) => setFullName(e.target.value)} required disabled={isLoading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
            <Input id="email" type="email" placeholder="jane.smith@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
            <Input id="password" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
          </div>

          {/* Common resident fields */}
          {userRole !== "coach" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input id="phoneNumber" type="tel" placeholder="(555) 123-4567" value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input id="dateOfBirth" type="date" value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)} disabled={isLoading} />
              </div>
            </>
          )}

          {/* Coach fields archived shown only when isTennisEnabled */}
          {isTennisEnabled && userRole === "coach" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="businessName">Coaching Business Name (optional)</Label>
                <Input id="businessName" type="text" placeholder="Elite Tennis Coaching" value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credentials">Coaching Credentials <span className="text-red-500">*</span></Label>
                <Select value={credentials} onValueChange={(value: "USPTA" | "PTR" | "None") => setCredentials(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USPTA">USPTA Certified</SelectItem>
                    <SelectItem value="PTR">PTR Certified</SelectItem>
                    <SelectItem value="None">No Formal Certification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Years of Experience <span className="text-red-500">*</span></Label>
                <Input id="yearsExperience" type="number" min="0" value={yearsExperience}
                  onChange={(e) => setYearsExperience(parseInt(e.target.value) || 0)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label>Sports Offered <span className="text-red-500">*</span></Label>
                <div className="flex flex-wrap gap-4">
                  {["Tennis", "Pickleball", "Padel"].map((sport) => (
                    <div key={sport} className="flex items-center space-x-2">
                      <Checkbox id={sport} checked={sportsOffered.includes(sport)}
                        onCheckedChange={(checked) => handleSportChange(sport, checked as boolean)} />
                      <Label htmlFor={sport}>{sport}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="homeBase">Home Base (City or Club) <span className="text-red-500">*</span></Label>
                <Input id="homeBase" type="text" placeholder="San Francisco, CA" value={homeBase}
                  onChange={(e) => setHomeBase(e.target.value)} required disabled={isLoading} />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="willingToTravel" checked={willingToTravel}
                  onCheckedChange={(checked) => setWillingToTravel(checked as boolean)} />
                <Label htmlFor="willingToTravel">Willing to travel to HOAs</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Preferred Hourly Rate (USD, optional)</Label>
                <Input id="hourlyRate" type="number" min="0" step="0.01" placeholder="75.00"
                  value={hourlyRate || ""} onChange={(e) => setHourlyRate(parseFloat(e.target.value) || undefined)}
                  disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio (optional)</Label>
                <Textarea id="bio" placeholder="Tell potential students about your coaching philosophy..."
                  value={bio} onChange={(e) => setBio(e.target.value)} disabled={isLoading} />
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
            {isLoading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-center w-full">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </CardFooter>
    </Card>
  );
};

export default Register;
