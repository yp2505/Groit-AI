import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

import { useAppUser } from "@/hooks/useAppUser";
import { ToolsProvider } from "@/context/ToolsContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Landing from "./pages/Landing";
import PricingPage from "./pages/PricingPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";

import AgenticChatUI from "./AgenticChatUI";
import ManagerLayout from "./components/manager/ManagerLayout";
import NotFound from "./pages/NotFound";
import Logs from "./pages/Logs";

/** Handles the OAuth redirect callback from Google / GitHub.
 *  Clerk exchanges the token and then redirects to /dashboard. */
const SsoCallback = () => (
  <div style={{
    height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#0d1117", color: "#7d8590", fontFamily: "system-ui, sans-serif",
    flexDirection: "column", gap: 16,
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: "50%",
      border: "3px solid #4ade8033", borderTopColor: "#4ade80",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <span style={{ fontSize: 14 }}>Completing sign-in…</span>
    <AuthenticateWithRedirectCallback
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    />
  </div>
);


const queryClient = new QueryClient();

const MuiThemeWrapper = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const theme = useMemo(() => createTheme({
    palette: { mode: resolvedTheme === "light" ? "light" : "dark" },
    typography: { fontFamily: "Inter, system-ui, sans-serif" },
  }), [resolvedTheme]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

/** Role-aware dashboard: Manager → separate layout | Developer → full Agentic Chat */
const RoleRouter = () => {
  const { user } = useAppUser();
  if (user?.role === 'manager') {
    return <ManagerLayout />;
  }
  return <AgenticChatUI />;
};

const App = () => (
  <NextThemesProvider defaultTheme="dark" attribute="class">
    <MuiThemeWrapper>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ToolsProvider>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Landing />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/login/*" element={<LoginPage />} />
                <Route path="/sign-up/*" element={<SignUpPage />} />
                
                {/* Redirect old clerk routes to new custom UI routes */}
                <Route path="/sign-in/*" element={<Navigate to="/login" replace />} />
                <Route path="/signup/*" element={<Navigate to="/sign-up" replace />} />

                {/* Redirect connect-tools to dashboard */}
                <Route path="/connect-tools" element={<Navigate to="/dashboard" replace />} />

                {/* ── OAuth SSO Callback — MUST be registered or Clerk hits 404 ── */}
                <Route path="/sso-callback" element={<SsoCallback />} />
                <Route path="/sso-callback/*" element={<SsoCallback />} />

                {/* Protected — role-aware dashboard */}
                <Route path="/dashboard" element={
                  <ProtectedRoute><RoleRouter /></ProtectedRoute>
                } />
                <Route path="/dashboard/:id" element={
                  <ProtectedRoute><RoleRouter /></ProtectedRoute>
                } />

                {/* Protected — developer routes */}
                <Route path="/logs" element={
                  <ProtectedRoute><Logs /></ProtectedRoute>
                } />

                <Route path="*" element={<NotFound />} />

              </Routes>
            </ToolsProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MuiThemeWrapper>
  </NextThemesProvider>
);

export default App;
