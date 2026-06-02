import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/Auth/AuthProvider";
import { AuthGate } from "./components/Auth/AuthGate";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { RootRoute } from "./components/Auth/RootRoute";
import { LoginRoute } from "./components/Auth/LoginRoute";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import QRMenu from "./pages/QRMenu";
import Inventory from "./pages/Inventory";
import Staff from "./pages/Staff";
import Attendance from "./pages/Attendance";
import Accounting from "./pages/Accounting";
import CRM from "./pages/CRM";
import MultiBranch from "./pages/MultiBranch";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import MenuItems from "./pages/MenuItems";
import Orders from "./pages/Orders";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AuthGate>
            <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<LoginRoute />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <POS />
              </ProtectedRoute>
            }
          />
          <Route
            path="/qr-menu"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <QRMenu />
              </ProtectedRoute>
            }
          />
          <Route
            path="/menu-items"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <MenuItems />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Staff />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Attendance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Accounting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <CRM />
              </ProtectedRoute>
            }
          />
          <Route
            path="/branches"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <MultiBranch />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <NotFound />
              </ProtectedRoute>
            }
          />
            </Routes>
          </AuthGate>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
