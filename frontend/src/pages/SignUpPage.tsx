import React, { useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useSignUp, useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';

const theme = {
  bg: '#0D1115',
  cardBg: '#13181D',
  accent: '#4ADE80',
  accentHover: '#2EA043',
  textMain: '#FFFFFF',
  textMuted: '#8B949E',
  border: '#1F2933',
  inputBg: '#161B22',
  buttonBg: '#12161A'
};

const SignUpPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const { signUp, setActive } = useSignUp();
  const from = location.state?.from?.pathname || '/dashboard';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isLoaded) return null;
  if (isSignedIn) return <Navigate to={from} replace />;

  const handleOAuth = async (strategy: 'oauth_github' | 'oauth_google') => {
    if (!signUp) return;
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp || !email || !password) return;
    setLoading(true);
    setError('');
    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      console.error(err);
      setError(err.errors?.[0]?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp || !code) return;
    setLoading(true);
    setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate(from);
      } else {
        setError("Verification incomplete.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.errors?.[0]?.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-outer" style={{
      minHeight: "100vh", padding: "40px 20px", background: theme.bg, color: theme.textMain,
      fontFamily: "'Inter', system-ui, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden"
    }}>
      {/* Grid Background */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)',
        pointerEvents: "none", zIndex: 0
      }} />

      {/* Subtle radial glow */}
      <div style={{
        position: "absolute", top: "20%", left: "30%", width: 500, height: 500,
        background: "radial-gradient(circle, rgba(46,160,67,0.06) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute", bottom: "15%", right: "20%", width: 400, height: 400,
        background: "radial-gradient(circle, rgba(121,192,255,0.04) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none"
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 440 }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: theme.accent }} />
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#2E3640' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: theme.textMain, letterSpacing: "-0.5px" }}>Groit AI</h1>
        </div>

        {/* Custom Auth Card */}
        <div className="auth-card" style={{
          background: theme.cardBg, borderRadius: 24, padding: "32px 40px",
          border: `1px solid ${theme.border}40`, boxShadow: `0 20px 40px rgba(0,0,0,0.5)`
        }}>
          {pendingVerification ? (
            <form onSubmit={handleVerify}>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px", textAlign: "center" }}>Verify your email</h2>
              <p style={{ color: theme.textMuted, fontSize: 13, margin: "0 0 24px", textAlign: "center" }}>
                We sent a verification code to {email}.
              </p>
              {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</div>}
              
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: theme.textMain, marginBottom: 8 }}>
                  Verification Code
                </label>
                <input 
                  type="text" 
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12,
                    background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.textMain,
                    fontSize: 16, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: 4
                  }}
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "12px", borderRadius: 12, background: theme.accent, color: "#000000",
                  fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
                  transition: "background 0.2s", boxShadow: `0 0 20px ${theme.accent}40`
                }}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          ) : (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px", textAlign: "center" }}>Create your account</h2>
              <p style={{ color: theme.textMuted, fontSize: 13, margin: "0 0 24px", textAlign: "center" }}>
                Sign up to start orchestrating workflows.
              </p>

              {/* OAuth Buttons */}
              <div className="auth-oauth-buttons" style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                <button 
                  type="button"
                  onClick={() => handleOAuth('oauth_google')}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, background: theme.buttonBg, border: `1px solid ${theme.border}`, color: theme.textMain, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.border}
                  onMouseLeave={e => e.currentTarget.style.background = theme.buttonBg}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
                <button 
                  type="button"
                  onClick={() => handleOAuth('oauth_github')}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, background: theme.buttonBg, border: `1px solid ${theme.border}`, color: theme.textMain, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.border}
                  onMouseLeave={e => e.currentTarget.style.background = theme.buttonBg}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                  GitHub
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1, height: 1, background: theme.border }} />
                <div style={{ fontSize: 12, color: theme.textMuted }}>or email</div>
                <div style={{ flex: 1, height: 1, background: theme.border }} />
              </div>

              {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: theme.textMain, marginBottom: 8 }}>
                      First name
                    </label>
                    <input 
                      type="text" 
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      style={{
                        width: "100%", padding: "12px 16px", borderRadius: 12,
                        background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.textMain,
                        fontSize: 14, outline: "none", boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: theme.textMain, marginBottom: 8 }}>
                      Last name
                    </label>
                    <input 
                      type="text" 
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      style={{
                        width: "100%", padding: "12px 16px", borderRadius: 12,
                        background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.textMain,
                        fontSize: 14, outline: "none", boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: theme.textMain, marginBottom: 8 }}>
                    Email address
                  </label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%", padding: "12px 16px", borderRadius: 12,
                      background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.textMain,
                      fontSize: 14, outline: "none", boxSizing: "border-box"
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: theme.textMain, marginBottom: 8 }}>
                    Password
                  </label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%", padding: "12px 16px", borderRadius: 12,
                      background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.textMain,
                      fontSize: 14, outline: "none", boxSizing: "border-box"
                    }}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 12, background: theme.accent, color: "#000000",
                    fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
                    transition: "background 0.2s", boxShadow: `0 0 20px ${theme.accent}40`
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.accentHover}
                  onMouseLeave={e => e.currentTarget.style.background = theme.accent}
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </form>
              
              <div style={{ textAlign: "center", marginTop: 24 }}>
                <span style={{ fontSize: 13, color: theme.textMuted }}>Already have an account? </span>
                <span onClick={() => navigate('/login')} style={{ fontSize: 13, color: theme.accent, cursor: "pointer", fontWeight: 600 }}>Sign in</span>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SignUpPage;
