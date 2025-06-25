
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import AuthLayout from "./components/layouts/AuthLayout";
import MainLayout from "./components/layouts/MainLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CompleteProfile from "./pages/CompleteProfile";
import Dashboard from "./pages/Dashboard";
import CoachDashboard from "./pages/CoachDashboard";
import ReserveCourt from "./pages/ReserveCourt";
import MyReservations from "./pages/MyReservations";
import Upcoming from "./pages/Upcoming";
import ManageCourts from "./pages/ManageCourts";
import PendingRequests from "./pages/PendingRequests";
import AmenityRules from "./pages/AmenityRules";
import MyLocker from "./pages/MyLocker";
import LeaguesLadders from "./pages/LeaguesLadders";
import EmailSettings from "./pages/EmailSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <DataProvider>
              <Routes>
                <Route element={<AuthLayout />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/complete-profile" element={<CompleteProfile />} />
                </Route>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/coach-dashboard" element={<CoachDashboard />} />
                  <Route path="/reserve" element={<ReserveCourt />} />
                  <Route path="/my-reservations" element={<MyReservations />} />
                  <Route path="/upcoming" element={<Upcoming />} />
                  <Route path="/manage-amenities" element={<ManageCourts />} />
                  <Route path="/pending-requests" element={<PendingRequests />} />
                  <Route path="/amenity-rules" element={<AmenityRules />} />
                  <Route path="/my-locker" element={<MyLocker />} />
                  <Route path="/leagues-ladders" element={<LeaguesLadders />} />
                  <Route path="/email-settings" element={<EmailSettings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </DataProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
