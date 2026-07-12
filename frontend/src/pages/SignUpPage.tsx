// @ts-nocheck
import { useLocation, Navigate } from 'react-router-dom';
import { SignUp, useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';

const clerkAppearance = {
  variables: {
    colorBackground: '#0d1117',
    colorInputBackground: '#161b22',
    colorInputText: '#e6edf3',
    colorText: '#e6edf3',
    colorTextSecondary: '#7d8590',
    colorPrimary: '#2ea043',
    colorDanger: '#f85149',
    borderRadius: '10px',
  },
  elements: {
    card: {
      background: '#161b22',
      border: '1px solid #30363d',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    },
    headerTitle: { color: '#e6edf3' },
    headerSubtitle: { color: '#7d8590' },
    formButtonPrimary: {
      background: '#2ea043',
      '&:hover': { background: '#238636' },
    },
    footerActionLink: { color: '#58a6ff' },
    identityPreviewEditButton: { color: '#58a6ff' },
    formFieldInput: { border: '1px solid #30363d' },
    dividerLine: { background: '#30363d' },
    dividerText: { color: '#7d8590' },
  },
};

const SignUpPage = () => {
  const location = useLocation();
  const { isSignedIn, isLoaded } = useAuth();
  const from = location.state?.from?.pathname || '/connect-tools';

  if (!isLoaded) return null;
  if (isSignedIn) return <Navigate to={from} replace />;

  return (
    <div style={{
      height: "100vh", background: "#0d1117", color: "#e6edf3",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden"
    }}>
      <div style={{ position: "absolute", top: "20%", left: "30%", width: 400, height: 400, background: "radial-gradient(circle, rgba(46,160,67,0.05) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 440, padding: "0 16px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "#0d3320", border: "1px solid #2ea043",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#4ade80", fontSize: 20, fontWeight: 700, marginBottom: 16
          }}>G</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Groit AI</h1>
          <p style={{ color: "#7d8590", fontSize: 13, margin: 0 }}>Create your account to get started</p>
        </div>

        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/login"
          fallbackRedirectUrl={from}
          appearance={clerkAppearance}
        />
      </motion.div>
    </div>
  );
};

export default SignUpPage;
