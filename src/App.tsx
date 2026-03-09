
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationContainer } from "@/components/ui/notification-banner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ActiveHOAProvider } from "./contexts/ActiveHOAContext";
import { DataProvider } from "./contexts/DataContext";
import AuthLayout from "./components/layouts/AuthLayout";
import MainLayout from "./components/layouts/MainLayout";
import ReviewerLayout from "./components/layouts/ReviewerLayout";
import CondoManagerLayout from "./components/layouts/CondoManagerLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import CompleteProfile from "./pages/CompleteProfile";
import Dashboard from "./pages/Dashboard";
import CoachDashboard from "./pages/CoachDashboard";
import CoachSchedule from "./pages/CoachSchedule";
import CoachClients from "./pages/CoachClients";
import CoachReviews from "./pages/CoachReviews";
import BookAmenity from "./pages/BookAmenity";
import BookingFlow from "./pages/BookingFlow";
import BookingConfirmed from "./pages/BookingConfirmed";
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
import MyReports from "./pages/MyReports";
import UpgradeToCoach from "./pages/UpgradeToCoach";
import UserProfile from "./pages/UserProfile";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import HOAApplication from "./pages/HOAApplication";
import PlatformReviewerLogin from "./pages/PlatformReviewerLogin";
import PlatformReviewerDashboard from "./pages/PlatformReviewerDashboard";
import Settings from "./pages/Settings";
import EditProfile from "./pages/EditProfile";
import JoinCommunity from "./pages/JoinCommunity";
import FAQ from "./pages/FAQ";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import CMPortfolio from "./pages/CMPortfolio";
import CMCommunityDashboard from "./pages/CMCommunityDashboard";
import CMReports from "./pages/CMReports";
import CMCalendar from "./pages/CMCalendar";
import CMAlerts from "./pages/CMAlerts";
import CMDocuments from "./pages/CMDocuments";
import CMSurveys from "./pages/CMSurveys";
import CMAmenityRules from "./pages/CMAmenityRules";
import ResidentCalendar from "./pages/ResidentCalendar";
import DocumentLibrary from "./pages/DocumentLibrary";
import SurveyResponse from "./pages/SurveyResponse";
import { TENNIS_FEATURES_ENABLED } from "./config/featureFlags";

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
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/reviewer/login" element={<PlatformReviewerLogin />} />
                  </Route>
                  {/* Platform Reviewer Routes */}
                  <Route element={<ReviewerLayout />}>
                    <Route path="/reviewer/dashboard" element={<PlatformReviewerDashboard />} />
                  </Route>
                  {/* Condo Manager Routes */}
                  <Route element={<CondoManagerLayout />}>
                    <Route path="/cm" element={<CMPortfolio />} />
                    <Route path="/cm/community/:id" element={<CMCommunityDashboard />} />
                    <Route path="/cm/reports" element={<CMReports />} />
                    <Route path="/cm/calendar" element={<CMCalendar />} />
                    <Route path="/cm/alerts" element={<CMAlerts />} />
                    <Route path="/cm/community/:id/documents" element={<CMDocuments />} />
                    <Route path="/cm/community/:id/surveys" element={<CMSurveys />} />
                    <Route path="/cm/community/:id/amenity/:amenityId/rules" element={<CMAmenityRules />} />
                  </Route>
                  {/* Main App Routes */}
                  <Route element={<MainLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    {TENNIS_FEATURES_ENABLED ? (
                      <>
                        <Route path="/coach-dashboard" element={<CoachDashboard />} />
                        <Route path="/coach-schedule" element={<CoachSchedule />} />
                        <Route path="/coach-clients" element={<CoachClients />} />
                        <Route path="/coach-reviews" element={<CoachReviews />} />
                        <Route path="/upgrade-to-coach" element={<UpgradeToCoach />} />
                        <Route path="/leagues-ladders" element={<LeaguesLadders />} />
                        <Route path="/manage-ladders" element={<ManageLadders />} />
                      </>
                    ) : (
                      <>
                        <Route path="/coach-dashboard" element={<Navigate to="/" replace />} />
                        <Route path="/coach-schedule" element={<Navigate to="/" replace />} />
                        <Route path="/coach-clients" element={<Navigate to="/" replace />} />
                        <Route path="/coach-reviews" element={<Navigate to="/" replace />} />
                        <Route path="/upgrade-to-coach" element={<Navigate to="/" replace />} />
                        <Route path="/leagues-ladders" element={<Navigate to="/" replace />} />
                        <Route path="/manage-ladders" element={<Navigate to="/" replace />} />
                      </>
                    )}
                    <Route path="/book" element={<BookAmenity />} />
                    <Route path="/book/:amenityId" element={<BookingFlow />} />
                    <Route path="/book/:amenityId/confirmed" element={<BookingConfirmed />} />
                    <Route path="/reserve-court" element={<Navigate to="/book" replace />} />
                    <Route path="/reserve-facilities" element={<Navigate to="/book" replace />} />
                    <Route path="/my-reservations" element={<MyReservations />} />
                    <Route path="/upcoming" element={<Upcoming />} />
                    <Route path="/manage-amenities" element={<ManageCourts />} />
                    <Route path="/manage-courts" element={<ManageCourts />} />
                    <Route path="/admin" element={<AdminHub />} />
                    <Route path="/admin/maintenance" element={<MaintenanceReports />} />
                    <Route path="/my-reports" element={<MyReports />} />
                    <Route path="/pending-requests" element={<PendingRequests />} />
                    <Route path="/amenity-rules" element={<AmenityRules />} />
                    <Route path="/my-home" element={<MyLocker />} />
                    <Route path="/my-locker" element={<Navigate to="/my-home" replace />} />
                    <Route path="/email-settings" element={<EmailSettings />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/edit-profile" element={<EditProfile />} />
                    <Route path="/join-community" element={<JoinCommunity />} />
                    <Route path="/profile/:id" element={<UserProfile />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/hoa-application" element={<HOAApplication />} />
                    <Route path="/community-calendar" element={<ResidentCalendar />} />
                    <Route path="/documents" element={<DocumentLibrary />} />
                    <Route path="/surveys/:surveyId" element={<SurveyResponse />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
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

