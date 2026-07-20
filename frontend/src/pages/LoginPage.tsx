import React, { useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useSignIn, useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { useWindowWidth } from '@/hooks/useWindowWidth';

const theme = {
  bg: '#0D1115',
  cardBg: '#13181D',
  accent: '#4ADE80',
  accentHover: '#2EA043',
  textMain: '#FFFFFF',
  textMuted: '#8B949E',
  border: '#1F2933',
  inputBg: '#161B22',
  buttonBg: '#12161A',
};

const inputStyle = (isMobile: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '12px 16px',
  borderRadius: 12,
  background: theme.inputBg,
  border: `1px solid ${theme.border}`,
  color: theme.textMain,
  fontSize: isMobile ? 16 : 14, // 16px prevents iOS zoom
  outline: 'none',
  boxSizing: 'border-box',
});

const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const { signIn, setActive } = useSignIn();
  const from = location.state?.from?.pathname || '/dashboard';
  const width = useWindowWidth();
  const isMobile = width <= 640;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isLoaded) return null;
  if (isSignedIn) return <Navigate to={from} replace />;

  const handleOAuth = async (strategy: 'oauth_github' | 'oauth_google') => {
    if (!signIn) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn || !email || !password) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        navigate(from);
      } else {
        setError('Further steps required. Please use OAuth.');
      }
    } catch (err: any) {
      if (err.errors?.[0]?.code === 'form_identifier_not_found') {
        // User doesn't exist, seamlessly move them to sign up
        navigate('/sign-up', { state: { email, password, from } });
      } else {
        setError(err.errors?.[0]?.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: isMobile ? '24px 16px' : '40px 20px',
      background: theme.bg,
      color: theme.textMain,
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Grid Background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{ position: 'absolute', top: '20%', left: '30%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(46,160,67,0.06) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 440 }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: theme.accent }} />
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#2E3640' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: theme.textMain, letterSpacing: '-0.5px' }}>Groit AI</h1>
        </div>

        {/* Card */}
        <div style={{
          background: theme.cardBg,
          borderRadius: isMobile ? 16 : 24,
          padding: isMobile ? '24px 20px' : '32px 40px',
          border: `1px solid ${theme.border}40`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}>
          <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 600, margin: '0 0 8px', textAlign: 'center' }}>Welcome back</h2>
          <p style={{ color: theme.textMuted, fontSize: 13, margin: '0 0 24px', textAlign: 'center' }}>
            Sign in to access your workspace.
          </p>


          {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: theme.textMain, marginBottom: 8 }}>
                Email address
              </label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                style={inputStyle(isMobile)}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: theme.textMain, marginBottom: 8 }}>
                Password
              </label>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                style={inputStyle(isMobile)}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 12,
                background: theme.accent, color: '#000',
                fontSize: 14, fontWeight: 600, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'background 0.2s',
                boxShadow: `0 0 20px ${theme.accent}40`,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = theme.accentHover; }}
              onMouseLeave={e => e.currentTarget.style.background = theme.accent}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ fontSize: 13, color: theme.textMuted }}>Don't have an account? </span>
            <span onClick={() => navigate('/sign-up')} style={{ fontSize: 13, color: theme.accent, cursor: 'pointer', fontWeight: 600 }}>
              Sign up
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
