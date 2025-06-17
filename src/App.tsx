
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";

// Layouts
import AuthLayout from "./components/layouts/AuthLayout";
import MainLayout from "./components/layouts/MainLayout";

// Auth Pages
import Login from "./pages/Login";
import Register from "./pages/Register";

// App Pages
import Dashboard from "./pages/Dashboard";
import ReserveCourt from "./pages/ReserveCourt";
import MyReservations from "./pages/MyReservations";
import PendingRequests from "./pages/PendingRequests";
import ManageCourts from "./pages/ManageCourts";
import AmenityRules from "./pages/AmenityRules";
import MyLocker from "./pages/MyLocker";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <DataProvider>
          <Routes>
            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            
            {/* Protected Routes */}
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/reserve" element={<ReserveCourt />} />
              <Route path="/my-reservations" element={<MyReservations />} />
              <Route path="/my-locker" element={<MyLocker />} />
              <Route path="/pending-requests" element={<PendingRequests />} />
              <Route path="/manage-amenities" element={<ManageCourts />} />
              <Route path="/amenity-rules" element={<AmenityRules />} />
            </Route>
            
            {/* Catch-all Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
