import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ToolCard from '@/components/ToolCard';
import { useTools } from '@/context/ToolsContext';
import { useAppUser } from '@/hooks/useAppUser';
import { connectComposioToolkit, API_BASE, fetchWithRetry } from '@/lib/api';
import { Target, FileText, ClipboardList, Gamepad2, TrendingUp, Github, MessageSquare, BarChart, AlertTriangle, ExternalLink, X, Loader2, CheckCircle2, Link as LinkIcon } from "lucide-react";


const COMPOSIO_TOOLS = [
  { tool: 'linear', label: 'Linear', description: 'Issue tracking & agile project management', icon: <Target size={24} /> },
  { tool: 'notion', label: 'Notion', description: 'All-in-one workspace for notes & docs', icon: <FileText size={24} /> },
  { tool: 'asana', label: 'Asana', description: 'Manage team projects and tasks', icon: <ClipboardList size={24} /> },
  { tool: 'discord', label: 'Discord', description: 'Community chat and notifications', icon: <Gamepad2 size={24} /> },
  { tool: 'hubspot', label: 'HubSpot', description: 'CRM and marketing automation', icon: <TrendingUp size={24} /> },
];

const TOOLS = [
  {
    tool: 'github',
    label: 'GitHub',
    description: 'Code repository & branch management',
    icon: <Github size={24} />,
    fields: [
      { key: 'username', label: 'GitHub Username', placeholder: 'your-username (optional — uses .env)', type: 'text' },
      { key: 'password', label: 'Personal Access Token', placeholder: 'ghp_xxxxxxxxxxxx (optional — uses .env)', type: 'password' },
    ],
  },
  {
    tool: 'jira',
    label: 'Jira',
    description: 'Issue tracking & project management',
    icon: <ClipboardList size={24} />,
    fields: [
      { key: 'domain', label: 'Jira Workspace URL', placeholder: 'team.atlassian.net', type: 'text', value: '' },
      { key: 'email', label: 'Atlassian Email', placeholder: 'you@yourteam.com', type: 'email', value: '' },
      { key: 'password', label: 'API Token', placeholder: 'ATATT3x...', type: 'password', value: '' },
    ],
  },
  {
    tool: 'slack',
    label: 'Slack',
    description: 'Team communication & notifications',
    icon: <MessageSquare size={24} />,
    fields: [
      { key: 'token', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password', value: '' },
    ],
  },
  {
    tool: 'sheets',
    label: 'Google Sheets',
    description: 'Automated reporting & logging',
    icon: <BarChart size={24} />,
    fields: [
      { key: 'sheet_id', label: 'Spreadsheet ID', placeholder: '1NZ0DljGTjF2RsEU...', type: 'text', value: '' },
    ],
  },
];

const ConnectTools = () => {
  const navigate = useNavigate();
  const { tools, allConnected, refreshFromBackend } = useTools();
  const { user } = useAppUser();
  const [composioStatus, setComposioStatus] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<{ slug: string; url: string } | null>(null);

  useEffect(() => {
    if (user?.email) {
      fetchWithRetry(`${API_BASE}/integrations/composio/status/${user?.email || 'anonymous'}`)
        .then(r => r.json())
        .then(d => { if (d.ok && d.connected) setComposioStatus(d.connected); })
        .catch(console.error);
    }
  }, [user]);

  const handleConnectComposio = async (toolSlug: string) => {
    const userId = user?.email || 'anonymous';
    if (!userId || userId === 'anonymous') {
      alert('Please log in before connecting a toolkit.');
      return;
    }
    setIsConnecting(toolSlug);
    setFallbackUrl(null);

    // ── Synchronous popup: open BEFORE any await so the browser treats it
    //    as a direct user gesture and won't block it.
    //    Do NOT pass noopener/noreferrer — those flags prevent us from later
    //    setting popup.location.href from this same script. ──
    const popup = window.open('', '_blank');

    try {
      const res = await connectComposioToolkit(toolSlug, userId);
      if (res.ok && res.redirect_url) {
        if (popup && !popup.closed) {
          popup.location.href = res.redirect_url;
        } else {
          // Popup was blocked by an aggressive browser policy — offer a fallback link
          setFallbackUrl({ slug: toolSlug, url: res.redirect_url });
        }
      } else {
        popup?.close();
        alert('Could not initiate connection: ' + (res.detail || 'unknown error'));
      }
    } catch (err) {
      popup?.close();
      alert('Error connecting: ' + err.message);
    } finally {
      setIsConnecting(null);
    }
  };

  const connectedCount = Object.values(tools).filter(t => t.status === 'connected').length + composioStatus.length;
  const total = TOOLS.length + COMPOSIO_TOOLS.length;
  const progressPct = Math.round((connectedCount / total) * 100);
  const isLoading = Object.values(tools).some(t => t.status === 'connecting');

  return (
    <div style={{
      height: "100vh", background: "#0d1117", color: "#e6edf3",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden", position: "relative"
    }}>
      {/* Glow */}
      <div style={{ position: "absolute", top: "15%", left: "25%", width: 400, height: 400, background: "radial-gradient(circle, rgba(46,160,67,0.04) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px", borderBottom: "1px solid #21262d",
        background: "#010409", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "#0d3320", border: "1px solid #2ea043",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#4ade80", fontSize: 12, fontWeight: 700
          }}>G</div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Groit AI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ color: "#e6edf3", fontWeight: 600 }}>{user?.name}</span>
          <span style={{
            padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.5,
            background: user?.role === "developer" ? "#0d3320" : "#1c1c3a",
            color: user?.role === "developer" ? "#4ade80" : "#a78bfa",
            border: `1px solid ${user?.role === "developer" ? "#2ea04350" : "#a78bfa30"}`
          }}>{user?.role}</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: 580, margin: "0 auto", padding: "32px 16px 100px" }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", marginBottom: 28 }}
          >
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>Connect Your Tools</h1>
            <p style={{ color: "#7d8590", fontSize: 14, margin: 0, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
              Pre-configured integrations are verified automatically from your server environment.
              You can also enter custom credentials below to override them.
            </p>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            style={{ marginBottom: 20 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#7d8590" }}>{connectedCount} of {total} tools connected</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{progressPct}%</span>
                <button
                  onClick={refreshFromBackend}
                  disabled={isLoading}
                  style={{
                    background: "none", border: "1px solid #30363d", borderRadius: 6,
                    color: "#7d8590", cursor: isLoading ? "default" : "pointer",
                    fontSize: 11, padding: "3px 8px", transition: "all 0.2s",
                    opacity: isLoading ? 0.5 : 1
                  }}
                  onMouseEnter={e => { if (!isLoading) e.currentTarget.style.borderColor = "#4ade80"; e.currentTarget.style.color = "#4ade80"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#7d8590"; }}
                >
                  {isLoading ? "⏳ Verifying…" : "↺ Re-verify"}
                </button>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "#21262d", overflow: "hidden" }}>
              <motion.div
                style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #2ea043, #4ade80)" }}
                initial={{ width: "0%" }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </motion.div>

          {/* Fallback link banner — shown when popup is blocked by the browser */}
          {fallbackUrl && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: 16, padding: '12px 16px', borderRadius: 10,
                background: '#2d2000', border: '1px solid #f59e0b55',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
              }}
            >
              <span style={{ fontSize: 13, color: '#e6c870' }}>
                <AlertTriangle size={16} className="text-yellow-500 inline mr-2"/> Popup was blocked. Click below to connect <strong>{fallbackUrl.slug}</strong>:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a
                  href={fallbackUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 13, fontWeight: 700, color: '#4ade80',
                    textDecoration: 'none', padding: '6px 14px',
                    background: '#0d3320', border: '1px solid #2ea043',
                    borderRadius: 8
                  }}
                >
                  <span className="flex items-center gap-2"><ExternalLink size={14} /> Open OAuth Page</span>
                </a>
                <button
                  onClick={() => setFallbackUrl(null)}
                  style={{ background: 'none', border: 'none', color: '#7d8590', cursor: 'pointer', fontSize: 16 }}
                ><X size={18} /></button>
              </div>
            </motion.div>
          )}

          {/* Pre-configured note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              marginBottom: 20, padding: "10px 14px", borderRadius: 10,
              background: "#0d3320", border: "1px solid #2ea04330",
              fontSize: 12, color: "#4ade80", display: "flex", alignItems: "center", gap: 8
            }}
          >
            <span>ℹ️</span>
            <span style={{ color: "#7d8590" }}>
              Integrations marked <span style={{ color: "#4ade80", fontWeight: 600 }}>Connected</span> are using
              pre-configured credentials from the server <code style={{ background: "#0d1117", padding: "1px 5px", borderRadius: 4 }}>.env</code> file.
              Leave fields empty to use them, or enter custom credentials to override.
            </span>
          </motion.div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {TOOLS.map((t, i) => (
                <motion.div
                  key={t.tool}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                >
                  <ToolCard {...t} />
                </motion.div>
              ))}
            </div>

            {/* Composio Toolkits Section */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{ marginTop: 40 }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#e6edf3" }}>Extra Integrations</h2>
              <p style={{ color: "#7d8590", fontSize: 13, margin: "0 0 20px" }}>
                Connect these popular apps securely via Composio's OAuth flow.
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {COMPOSIO_TOOLS.map((t, i) => {
                  const isConnected = composioStatus.includes(t.tool);
                  const connecting = isConnecting === t.tool;
                  return (
                    <motion.div
                      key={t.tool}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.06 }}
                      style={{
                        background: "#0d1117", border: `1px solid ${isConnected ? "#2ea04350" : "#30363d"}`,
                        borderRadius: 12, padding: 16, display: "flex", flexDirection: "column",
                        gap: 12, position: "relative", overflow: "hidden"
                      }}
                    >
                      {isConnected && (
                        <div style={{ position: "absolute", top: -20, right: -20, width: 40, height: 40, background: "#2ea04320", borderRadius: "50%", filter: "blur(10px)" }} />
                      )}
                      
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ fontSize: 24 }}>{t.icon}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#e6edf3", marginBottom: 2 }}>{t.label}</div>
                          <div style={{ fontSize: 11, color: "#7d8590", lineHeight: 1.4 }}>{t.description}</div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleConnectComposio(t.tool)}
                        disabled={connecting || isConnected}
                        style={{
                          marginTop: "auto", padding: "8px", borderRadius: 8, border: "none",
                          fontSize: 12, fontWeight: 600, cursor: isConnected ? "default" : (connecting ? "wait" : "pointer"),
                          background: isConnected ? "#0d3320" : "#161b22",
                          color: isConnected ? "#4ade80" : "#c9d1d9",
                          borderTop: `1px solid ${isConnected ? "#2ea04340" : "#30363d"}`,
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={e => {
                          if (!isConnected && !connecting) {
                            e.currentTarget.style.background = "#21262d";
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isConnected && !connecting) {
                            e.currentTarget.style.background = "#161b22";
                          }
                        }}
                      >
                        {connecting ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Connecting...</span> : isConnected ? <span className="flex items-center gap-2"><CheckCircle2 size={16} /> Connected</span> : <span className="flex items-center gap-2"><LinkIcon size={16} /> Connect</span>}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>

      {/* Sticky footer */}
      <div style={{
        borderTop: "1px solid #21262d", background: "#010409",
        padding: "14px 24px", flexShrink: 0
      }}>
        <div style={{ maxWidth: 580, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: "none", border: "none", color: "#7d8590", cursor: "pointer", fontSize: 13, transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#e6edf3"}
            onMouseLeave={e => e.currentTarget.style.color = "#7d8590"}
          >Skip for now</button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px", borderRadius: 10, border: "none",
              background: allConnected ? "#2ea043" : "#1a7f37",
              color: "#fff",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(46,160,67,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            {allConnected ? <span className="flex items-center gap-2"><CheckCircle2 size={16} /> All Connected — Go to Dashboard</span> : "Go to Dashboard →"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectTools;
