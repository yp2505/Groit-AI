import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      height: "100vh", background: "#0d1117", color: "#e6edf3",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden"
    }}>
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
        style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 24px", maxWidth: 720 }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo */}
        <motion.div
          style={{
            width: 64, height: 64, borderRadius: 16,
            background: "#0d3320", border: "1px solid #2ea043",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 28, fontSize: 28, fontWeight: 700, color: "#4ade80",
            boxShadow: "0 0 40px rgba(46,160,67,0.15)"
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >G</motion.div>

        {/* Badge */}
        <motion.div
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 14px", borderRadius: 99,
            border: "1px solid #21262d", background: "#161b22",
            fontSize: 12, fontWeight: 600, color: "#4ade80", marginBottom: 24
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span style={{ position: "relative", width: 8, height: 8 }}>
            <span style={{
              position: "absolute", width: "100%", height: "100%", borderRadius: "50%",
              background: "#4ade80", opacity: 0.5,
              animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite"
            }} />
            <span style={{ position: "relative", display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#2ea043" }} />
          </span>
          Gateway Active · Groit AI Orchestration
        </motion.div>
        <style>{`@keyframes ping { 75%,100%{transform:scale(2);opacity:0} }`}</style>

        {/* Title */}
        <motion.h1
          style={{ fontSize: 52, fontWeight: 700, margin: "0 0 12px", lineHeight: 1.1, color: "#e6edf3", letterSpacing: "-1px" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          Groit AI
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          style={{ color: "#7d8590", fontSize: 16, lineHeight: 1.7, maxWidth: 520, margin: "0 0 40px" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          The next-generation AI orchestration engine. Run parallel, multi-agent workflows across Jira, GitHub & Slack with intelligent DAG execution and real-time observability.
        </motion.p>

        {/* CTAs */}
        <motion.div
          style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <button
            onClick={() => navigate('/login')}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "14px 28px", borderRadius: 12, border: "none",
              background: "#2ea043", color: "#fff",
              fontSize: 15, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s", boxShadow: "0 0 20px rgba(46,160,67,0.25)"
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 30px rgba(46,160,67,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(46,160,67,0.25)"; }}
          >
            ▶ Start Workflow →
          </button>

          <button
            onClick={() => navigate('/login')}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "14px 28px", borderRadius: 12,
              border: "1px solid #30363d", background: "#161b22",
              color: "#e6edf3", fontSize: 15, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#2ea043"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            ⊞ Sign In
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div
          style={{
            display: "flex", gap: 48, marginTop: 56, paddingTop: 32,
            borderTop: "1px solid #21262d", width: "100%", justifyContent: "center"
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          {[
            { label: "DAG Nodes", value: "50+" },
            { label: "Tool Integrations", value: "4" },
            { label: "Execution Mode", value: "Parallel" },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#4ade80" }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "#7d8590", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Landing;
