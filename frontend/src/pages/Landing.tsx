import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Landing = () => {
  const navigate = useNavigate();

  const theme = {
    bg: '#0D1115',
    accent: '#4ADE80',
    cardBg: '#13181D',
    cardBorder: '#1F2933',
    textMain: '#FFFFFF',
    textMuted: '#8B949E'
  };

  return (
    <div style={{
      minHeight: "100vh", background: theme.bg, color: theme.textMain,
      fontFamily: "'Inter', system-ui, sans-serif",
      position: "relative", overflow: "hidden"
    }}>
      <style>
        {`
          @keyframes wave-move {
            0% { transform: translate3d(-90px, 0, 0); }
            100% { transform: translate3d(85px, 0, 0); }
          }
          .landing-waves > use {
            animation: wave-move 20s linear infinite;
          }
          .landing-waves > use:nth-child(1) { animation-delay: -2s; animation-duration: 14s; }
          .landing-waves > use:nth-child(2) { animation-delay: -3s; animation-duration: 20s; }
          .landing-waves > use:nth-child(3) { animation-delay: -4s; animation-duration: 26s; }
          .landing-waves > use:nth-child(4) { animation-delay: -5s; animation-duration: 40s; }
        `}
      </style>

      {/* Grid Background */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)',
        pointerEvents: "none", zIndex: 0
      }} />

      {/* Animated Waves Background (Horizontal on Bottom) */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1, height: "40vh", pointerEvents: "none" }}>
        <svg 
          viewBox="0 24 150 28" 
          preserveAspectRatio="none" 
          style={{ width: "100%", height: "100%", opacity: 0.8 }}
        >
          <defs>
            <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
          </defs>
          <g className="landing-waves">
            <use href="#gentle-wave" x="48" y="0" fill="rgba(74, 222, 128, 0.05)" />
            <use href="#gentle-wave" x="48" y="3" fill="rgba(74, 222, 128, 0.03)" />
            <use href="#gentle-wave" x="48" y="5" fill="rgba(74, 222, 128, 0.01)" />
            <use href="#gentle-wave" x="48" y="7" fill="rgba(74, 222, 128, 0.08)" />
          </g>
        </svg>
      </div>

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

      {/* Navigation */}
      <nav className="landing-nav" style={{
        position: "relative", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 48px", width: "100%", maxWidth: 1400, margin: "0 auto"
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 18 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.accent }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2E3640' }} />
          </div>
          Groit AI
        </div>

        {/* Top Right Action */}
        <div className="landing-nav-actions" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => navigate('/pricing')}
            style={{
              padding: "8px 20px", borderRadius: 30, background: "transparent", color: theme.textMain,
              fontWeight: 600, fontSize: 14, border: "1px solid #2E3640", cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#1F2933"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Pricing
          </button>
          
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: "8px 20px", borderRadius: 30, background: theme.accent, color: "#000",
              fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, transition: "transform 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            Sign In ↗
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ 
        display: "flex", flexDirection: "column", alignItems: "center", 
        paddingTop: "80px", position: "relative", zIndex: 10 
      }}>
        
        {/* Floating Cards (Background) */}
        <motion.div
          className="landing-float-card"
          initial={{ opacity: 0, x: -50, rotate: -15, y: 0 }}
          animate={{ opacity: 1, x: 0, rotate: -10, y: [0, -25, 0] }}
          transition={{ 
            opacity: { duration: 0.8 }, 
            x: { duration: 0.8 }, 
            rotate: { duration: 0.8 },
            y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0 } 
          }}
          style={{
            position: "absolute", left: "8%", top: "120px",
            background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
            borderRadius: 16, padding: 24, width: 220,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: 1, marginBottom: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accent }} />
            ACTIVE AGENTS
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
            12<span style={{ fontSize: 16, color: theme.textMuted }}>/15</span>
          </div>
          <svg width="100%" height="30" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M0 25 Q 25 5, 50 15 T 100 10" fill="none" stroke={theme.accent} strokeWidth="2" />
          </svg>
          <div style={{ fontSize: 12, color: theme.accent, marginTop: 12, fontWeight: 600 }}>+3 in queue</div>
        </motion.div>

        <motion.div
          className="landing-float-card"
          initial={{ opacity: 0, x: 50, rotate: 15, y: 0 }}
          animate={{ opacity: 1, x: 0, rotate: 10, y: [0, -25, 0] }}
          transition={{ 
            opacity: { duration: 0.8, delay: 0.1 }, 
            x: { duration: 0.8, delay: 0.1 }, 
            rotate: { duration: 0.8, delay: 0.1 },
            y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 } 
          }}
          style={{
            position: "absolute", right: "8%", top: "140px",
            background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
            borderRadius: 16, padding: 24, width: 220,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: 1, marginBottom: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accent }} />
            TASKS COMPLETED
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
            24.8<span style={{ fontSize: 16, color: theme.textMuted }}>k</span>
          </div>
          <svg width="100%" height="30" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M0 20 Q 25 25, 50 15 T 100 5" fill="none" stroke={theme.accent} strokeWidth="2" />
          </svg>
          <div style={{ fontSize: 12, color: theme.accent, marginTop: 12, fontWeight: 600 }}>+8.5%</div>
        </motion.div>

        {/* Hero Copy */}
        <motion.div
          className="landing-hero"
          style={{ maxWidth: 840, textAlign: "center", position: "relative", zIndex: 20, padding: "0 20px" }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: [30, 0, -15, 0, -15, 0] }}
          transition={{ 
            opacity: { duration: 0.6 },
            y: { duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1, times: [0, 0.1, 0.55, 1] } 
          }}
        >
          <h1 style={{ 
            fontSize: "clamp(32px, 7vw, 64px)", fontWeight: 700, lineHeight: 1.1, 
            letterSpacing: "-1.5px", marginBottom: 32, color: theme.textMain 
          }}>
            Experience seamless<br />
            orchestration with smart<br />
            agents<br />
            made for <span style={{ 
              background: theme.accent, color: "#000", 
              padding: "4px 20px", borderRadius: 999, display: "inline-block",
              transform: "translateY(4px)"
            }}>modern teams</span>
          </h1>

          <p style={{ fontSize: "clamp(14px, 2vw, 18px)", color: theme.textMuted, lineHeight: 1.6, maxWidth: 640, margin: "0 auto 48px" }}>
            The next-generation AI orchestration engine. Run parallel, multi-agent workflows across your entire tech stack with intelligent DAG execution and real-time observability.
          </p>

          <div className="landing-hero-buttons" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: "16px 32px", borderRadius: 30, background: theme.accent, color: "#000",
                fontSize: 16, fontWeight: 600, border: "none", cursor: "pointer",
                transition: "transform 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              Get Started →
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: "16px 32px", borderRadius: 30, background: "transparent", color: theme.textMain,
                fontSize: 16, fontWeight: 600, border: `1px solid #2E3640`, cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1F2933"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              See How It Works
            </button>
          </div>
        </motion.div>

      </main>
    </div>
  );
};

export default Landing;

