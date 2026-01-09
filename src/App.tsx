
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationContainer } from "@/components/ui/notification-banner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ActiveHOAProvider } from "./contexts/ActiveHOAContext";
import { DataProvider } from "./contexts/DataContext";
import AuthLayout from "./components/layouts/AuthLayout";
import MainLayout from "./components/layouts/MainLayout";
import ReviewerLayout from "./components/layouts/ReviewerLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CompleteProfile from "./pages/CompleteProfile";
import Dashboard from "./pages/Dashboard";
import CoachDashboard from "./pages/CoachDashboard";
import CoachSchedule from "./pages/CoachSchedule";
import CoachClients from "./pages/CoachClients";
import CoachReviews from "./pages/CoachReviews";
import ReserveCourt from "./pages/ReserveCourt";
import ReserveFacilities from "./pages/ReserveFacilities";
import MyReservations from "./pages/MyReservations";
import Upcoming from "./pages/Upcoming";
import ManageCourts from "./pages/ManageCourts";
import PendingRequests from "./pages/PendingRequests";
import AmenityRules from "./pages/AmenityRules";
import AdminHub from "./pages/AdminHub";
import MyLocker from "./pages/MyLocker";
import LeaguesLadders from "./pages/LeaguesLadders";
import ManageLadders from "./pages/ManageLadders";
import EmailSettings from "./pages/EmailSettings";
import MaintenanceReports from "./pages/MaintenanceReports";
import UpgradeToCoach from "./pages/UpgradeToCoach";
import UserProfile from "./pages/UserProfile";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import HOAApplication from "./pages/HOAApplication";
import PlatformReviewerLogin from "./pages/PlatformReviewerLogin";
import PlatformReviewerDashboard from "./pages/PlatformReviewerDashboard";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationContainer />
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <ActiveHOAProvider>
              <DataProvider>
                <Routes>
                <Route element={<AuthLayout />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/complete-profile" element={<CompleteProfile />} />
                  <Route path="/reviewer/login" element={<PlatformReviewerLogin />} />
                </Route>
                {/* Platform Reviewer Routes - Separate layout with no player navigation */}
                <Route element={<ReviewerLayout />}>
                  <Route path="/reviewer/dashboard" element={<PlatformReviewerDashboard />} />
                </Route>
                {/* Main App Routes */}
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/coach-dashboard" element={<CoachDashboard />} />
                  <Route path="/coach-schedule" element={<CoachSchedule />} />
                  <Route path="/coach-clients" element={<CoachClients />} />
                  <Route path="/coach-reviews" element={<CoachReviews />} />
                  <Route path="/reserve-court" element={<ReserveCourt />} />
                  <Route path="/reserve-facilities" element={<ReserveFacilities />} />
                  <Route path="/my-reservations" element={<MyReservations />} />
                  <Route path="/upcoming" element={<Upcoming />} />
                  <Route path="/manage-amenities" element={<ManageCourts />} />
                  <Route path="/admin" element={<AdminHub />} />
                  <Route path="/admin/maintenance" element={<MaintenanceReports />} />
                  <Route path="/pending-requests" element={<PendingRequests />} />
                  <Route path="/amenity-rules" element={<AmenityRules />} />
                  <Route path="/my-locker" element={<MyLocker />} />
                  <Route path="/leagues-ladders" element={<LeaguesLadders />} />
                  <Route path="/manage-ladders" element={<ManageLadders />} />
                  <Route path="/email-settings" element={<EmailSettings />} />
                  <Route path="/upgrade-to-coach" element={<UpgradeToCoach />} />
                  <Route path="/profile/:id" element={<UserProfile />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/hoa-application" element={<HOAApplication />} />
                </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </DataProvider>
            </ActiveHOAProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
