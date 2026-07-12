import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { useUser } from "@clerk/clerk-react";
import { useAppUser } from "@/hooks/useAppUser";
import { useTools } from "./context/ToolsContext";
import { connectComposioToolkit, API_BASE, fetchWithRetry } from "./lib/api";
import ReactMarkdown from "react-markdown";

const SUGGESTED_PROMPTS = [
  "Critical bug in Jira → create GitHub branch → notify #all-daiict on Slack",
  "Send a message to #all-daiict on Slack: 'System is live!'",
  "Fetch latest GitHub commits and post a summary to Slack #all-daiict",
  "Create Jira ticket → append row to Google Sheets → notify Slack #all-daiict",
];

const CONNECTED_TOOLS = [
  { name: "GitHub Integration", path: "/connect-tools" },
  { name: "Jira Integration", path: "/connect-tools" },
  { name: "Slack Integration", path: "/connect-tools" },
  { name: "Google Sheets", path: "/connect-tools" },
];

const COMPOSIO_TOOLS = [
  { tool: 'gmail', label: 'Gmail', description: 'Emails & drafts', icon: '📧' },
  { tool: 'googlecalendar', label: 'Calendar', description: 'Meetings & events', icon: '📅' },
  { tool: 'googledrive', label: 'Drive', description: 'Docs & files', icon: '📁' },
  { tool: 'slack', label: 'Slack', description: 'Team messaging', icon: '💬' },
  { tool: 'github', label: 'GitHub', description: 'Code & branches', icon: '🐙' },
  { tool: 'jira', label: 'Jira', description: 'Agile & boards', icon: '🔵' },
  { tool: 'notion', label: 'Notion', description: 'Notes & docs', icon: '📝' },
  { tool: 'linear', label: 'Linear', description: 'Issue tracking', icon: '🎯' },
  { tool: 'asana', label: 'Asana', description: 'Team projects', icon: '📋' },
  { tool: 'hubspot', label: 'HubSpot', description: 'CRM & marketing', icon: '📈' },
  { tool: 'discord', label: 'Discord', description: 'Community chat', icon: '🎮' },
  { tool: 'trello', label: 'Trello', description: 'Kanban boards', icon: '📋' },
  { tool: 'zoom', label: 'Zoom', description: 'Video calls', icon: '📹' },
  { tool: 'figma', label: 'Figma', description: 'Design tools', icon: '🎨' },
  { tool: 'zendesk', label: 'Zendesk', description: 'Customer support', icon: '🎧' },
];

const TOOL_ICONS: Record<string, string> = {
  slack: "💬",
  github: "🐙",
  jira: "🔵",
  sheets: "📊",
  generic: "⚙️",
};

const TOOL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  slack:   { bg: "#1a0f2e", border: "#4a1a7a", text: "#a78bfa" },
  github:  { bg: "#0d1117", border: "#2ea043", text: "#56d364" },
  jira:    { bg: "#0a1a3a", border: "#1e6fd6", text: "#79c0ff" },
  sheets:  { bg: "#0a2a1a", border: "#1a7a4a", text: "#4ade80" },
  generic: { bg: "#161b22", border: "#30363d", text: "#8b949e" },
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; dot: string }> = {
    done:    { bg: "#0d3320", color: "#4ade80", dot: "#4ade80" },
    success: { bg: "#0d3320", color: "#4ade80", dot: "#4ade80" },
    failed:  { bg: "#3d1117", color: "#f85149", dot: "#f85149" },
    running: { bg: "#0d2744", color: "#58a6ff", dot: "#58a6ff" },
    pending: { bg: "#1c1c1c", color: "#7d8590", dot: "#7d8590" },
    skipped: { bg: "#212121", color: "#8b949e", dot: "#8b949e" },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: c.bg, color: c.color, fontSize: 11,
      padding: "2px 8px", borderRadius: 99, fontFamily: "monospace",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {status}
    </span>
  );
}

function DAGNode({ label, sublabel, server, left, top, status, tool }: any) {
  const isSuccess = status === "done" || status === "success";
  const isFailed  = status === "failed";
  const tc = TOOL_COLORS[tool] || TOOL_COLORS.generic;
  const borderColor = isSuccess ? tc.border : isFailed ? "#f85149" : "#30363d";
  const bgColor     = isSuccess ? tc.bg     : isFailed ? "#2d1117" : "#161b22";
  return (
    <div style={{
      position: "absolute", left, top,
      background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: 10, padding: "10px 14px", width: 175, fontSize: 12, color: "#e6edf3",
      boxShadow: isSuccess ? `0 0 12px ${tc.border}44` : "none",
      transition: "box-shadow 0.4s",
    }}>
      <div style={{ color: "#7d8590", fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {TOOL_ICONS[tool] || "⚙️"} {server}
      </div>
      <div style={{ fontFamily: "monospace", color: tc.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ color: "#7d8590", fontSize: 11, marginBottom: 8 }}>{sublabel}</div>
      <StatusBadge status={status} />
    </div>
  );
}

function WorkflowVisualization({ dagData, nodeDetails }: { dagData: any, nodeDetails: any[] }) {
  if (!dagData || !dagData.nodes || dagData.nodes.length === 0) return null;

  const NODE_W = 175;
  const NODE_H = 100;
  const GAP    = 50;
  const nodes  = dagData.nodes as any[];

  // Layout: simple left-to-right chain
  const canvasW = nodes.length * (NODE_W + GAP) - GAP;
  const canvasH = NODE_H + 24;

  const cleanAction = (str: string) => {
    if (!str) return "Task";
    return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const getOutputSummary = (nodeId: string) => {
    const d = nodeDetails?.find(d => d.node_id === nodeId);
    if (!d?.output) return null;
    const o = d.output;
    if (o.key || o.issue_id) return `Ticket created: ${o.key || o.issue_id}`;
    if (o.branch_name) return `Branch: ${o.branch_name}`;
    if (o.ts || o.channel) return `Message sent`;
    if (o.message_text) return o.message_text.slice(0, 60);
    if (o.summary) return o.summary.replace("Action", "").replace("completed successfully.", "done").trim();
    return null;
  };

  return (
    <div style={{ marginTop: 16, marginBottom: 4 }}>
      {/* ── Flowchart ── */}
      <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <div style={{ position: "relative", width: canvasW, height: canvasH, minWidth: canvasW }}>
          {/* Arrow connectors */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: "none" }}>
            {nodes.slice(0, -1).map((_: any, i: number) => {
              const x1 = i * (NODE_W + GAP) + NODE_W;
              const x2 = (i + 1) * (NODE_W + GAP);
              const y  = NODE_H / 2 + 12;
              return (
                <g key={i}>
                  <line x1={x1} y1={y} x2={x2 - 8} y2={y} stroke="#2ea04366" strokeWidth={2} strokeDasharray="4 3" />
                  <polygon points={`${x2},${y} ${x2-8},${y-5} ${x2-8},${y+5}`} fill="#2ea04366" />
                </g>
              );
            })}
          </svg>
          {/* Nodes */}
          {nodes.map((n: any, i: number) => (
            <DAGNode
              key={n.id}
              left={i * (NODE_W + GAP)}
              top={12}
              label={cleanAction(n.action)}
              sublabel={`${n.tool} · ${n.action}`}
              server={`${n.tool?.toUpperCase()} SERVER`}
              status={n.status || "pending"}
              tool={n.tool}
            />
          ))}
        </div>
      </div>

      {/* ── Live Platform Results ── */}
      {nodeDetails && nodeDetails.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#484f58",
            textTransform: "uppercase", marginBottom: 10,
          }}>
            Live Platform Results
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nodeDetails.map((node: any, i: number) => {
              const isOk      = node.status === "success" || node.status === "done";
              const isFailed  = node.status === "failed";
              const tc        = TOOL_COLORS[node.tool] || TOOL_COLORS.generic;
              const summary   = getOutputSummary(node.node_id);
              const links     = Object.values(node.output || {}).filter((v: any) => typeof v === "string" && v.startsWith("http")) as string[];

              return (
                <div key={i} style={{
                  background: tc.bg,
                  border: `1px solid ${isOk ? tc.border : isFailed ? "#f85149" : "#30363d"}`,
                  borderRadius: 10, padding: "12px 16px",
                  boxShadow: isOk ? `0 0 10px ${tc.border}22` : "none",
                  transition: "box-shadow 0.3s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{TOOL_ICONS[node.tool] || "⚙️"}</span>
                      <div>
                        <span style={{ fontSize: 12, color: tc.text, fontWeight: 600 }}>
                          {node.tool?.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12, color: "#7d8590", marginLeft: 6 }}>
                          · {node.action}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={node.status || "pending"} />
                  </div>
                  {summary && (
                    <div style={{ fontSize: 13, color: "#e6edf3", marginBottom: links.length > 0 ? 8 : 0 }}>
                      {summary}
                    </div>
                  )}
                  {links.map((url, li) => (
                    <a key={li} href={url} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 12, color: "#58a6ff", textDecoration: "none",
                        border: "1px solid #58a6ff44", borderRadius: 6,
                        padding: "3px 10px", marginTop: 4,
                        background: "#0d1f38",
                      }}
                    >
                      🔗 Open live link ↗
                    </a>
                  ))}
                  {isFailed && node.error && (
                    <div style={{ fontSize: 12, color: "#f85149", marginTop: 4 }}>
                      {node.error.length > 120 ? node.error.slice(0, 120) + "…" : node.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#4ade80",
          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.7,
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
    </div>
  );
}

function ChatMessage({ msg, onEdit, onApprove, onReject }: { msg: any; onEdit: (msg: any) => void; onApprove?: () => void; onReject?: () => void }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [hovering, setHovering] = useState(false);

  if (msg.role === "user") {
    return (
      <div
        style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: "75%" }}>
          {hovering && (
            <button
              onClick={() => onEdit(msg)}
              style={{
                background: "transparent", border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`, 
                color: isDark ? "#7d8590" : "#656d76",
                borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11,
                alignSelf: "center", whiteSpace: "nowrap",
              }}
            >
              ✏️ Edit
            </button>
          )}
          <div style={{
            background: isDark ? "#21262d" : "#0969da", 
            borderRadius: "18px 18px 4px 18px",
            padding: "10px 16px", color: "#ffffff", fontSize: 14, lineHeight: 1.6,
            boxShadow: isDark ? "none" : "0 2px 5px rgba(9,105,218,0.2)"
          }}>
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: isDark ? "linear-gradient(135deg, #0d3320, #1a5c3a)" : "linear-gradient(135deg, #dcfce7, #bbf7d0)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "#166534", fontWeight: 700, flexShrink: 0,
          border: isDark ? "none" : "1px solid #22c55e"
        }}>G</div>
        <span style={{ color: isDark ? "#7d8590" : "#656d76", fontSize: 12, fontWeight: 600 }}>Groit AI</span>
      </div>
      <div style={{ paddingLeft: 38 }}>
        {/* Thinking / status line */}
        {msg.thinking && (
          <div style={{
            color: isDark ? "#7d8590" : "#656d76", fontSize: 13, fontStyle: "italic",
            marginBottom: 10, padding: "8px 14px",
            background: isDark ? "transparent" : "#f6f8fa",
            borderLeft: `3px solid ${isDark ? "#30363d" : "#d0d7de"}`,
            borderRadius: isDark ? 0 : "0 8px 8px 0"
          }}>
            {msg.thinking}
          </div>
        )}

        {/* ─── HITL Approval Card ─────────────────────────────────── */}
        {msg.hitlPending && msg.hitlNodes && (
          <div style={{
            background: isDark ? "linear-gradient(135deg, #1a1200 0%, #1c1a0e 100%)" : "#fffbeb",
            border: `1px solid ${isDark ? "#d4a72c44" : "#f59e0b"}`,
            borderRadius: 12, padding: 16, marginBottom: 12,
            boxShadow: isDark ? "0 0 20px rgba(212,167,44,0.08)" : "0 2px 8px rgba(245,158,11,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>🛡️</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#f0c040" : "#b45309", letterSpacing: 0.3 }}>
                HUMAN-IN-THE-LOOP APPROVAL REQUIRED
              </span>
            </div>
            <div style={{ fontSize: 12, color: isDark ? "#a0956c" : "#92400e", marginBottom: 12 }}>
              The following actions require your explicit approval before execution:
            </div>
            {msg.hitlNodes.map((n: any, i: number) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: isDark ? "#161b2244" : "#fff7ed",
                border: `1px solid ${isDark ? "#30363d" : "#fed7aa"}`,
                borderRadius: 8, padding: "8px 12px", marginBottom: 6,
              }}>
                <span style={{ fontSize: 16 }}>{TOOL_ICONS[n.tool] || "⚙️"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#e6edf3" : "#1f2328", fontFamily: "monospace" }}>
                    {n.tool}.{n.action}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? "#7d8590" : "#6b7280" }}>
                    {Object.entries(n.params || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "No params"}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={onApprove}
                style={{
                  flex: 1, padding: "10px 16px", border: "none", borderRadius: 8,
                  background: "linear-gradient(135deg, #238636, #2ea043)",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 0 12px rgba(46,160,67,0.3)",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                ✅ Approve & Execute
              </button>
              <button
                onClick={onReject}
                style={{
                  flex: 1, padding: "10px 16px", border: `1px solid ${isDark ? "#f8514944" : "#dc2626"}`,
                  borderRadius: 8, background: isDark ? "#3d111722" : "#fef2f2",
                  color: isDark ? "#f85149" : "#dc2626", fontWeight: 700, fontSize: 13,
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                ❌ Reject
              </button>
            </div>
          </div>
        )}

        {/* ─── Connect Toolkit Card ───────────────────────────────── */}
        {msg.connectToolkit && (
          <div style={{
            background: isDark ? "linear-gradient(135deg, #120c00 0%, #1a1200 100%)" : "#fffbeb",
            border: `1px solid ${isDark ? "#b4590044" : "#f59e0b"}`,
            borderRadius: 12, padding: 16, marginBottom: 12,
            boxShadow: isDark ? "0 0 20px rgba(180,89,0,0.08)" : "0 2px 8px rgba(245,158,11,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>🔌</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#e8a020" : "#b45309", letterSpacing: 0.3 }}>
                TOOLKIT NOT CONNECTED
              </span>
            </div>
            <div style={{ fontSize: 13, color: isDark ? "#a08040" : "#92400e", marginBottom: 14, lineHeight: 1.5 }}>
              To run this workflow, connect the{" "}
              <strong style={{ color: isDark ? "#f0a030" : "#78350f", fontFamily: "monospace" }}>
                {msg.connectToolkit}
              </strong>{" "}
              toolkit to Composio first.
            </div>
            <button
              id={`connect-toolkit-${msg.connectToolkit}`}
              onClick={async (e) => {
                // ── Synchronous popup: open BEFORE any await so browser treats
                //    it as a direct user gesture and doesn't block the popup. ──
                const popup = window.open('', '_blank');
                try {
                  const userId = msg._userId || "anonymous";
                  const result = await connectComposioToolkit(msg.connectToolkit, userId);
                  if (result.ok && result.redirect_url) {
                    if (popup && !popup.closed) {
                      popup.location.href = result.redirect_url;
                    } else {
                      // Popup was blocked — show a fallback link inside the button's parent
                      const container = e.currentTarget.closest('[data-composio-connect]') ||
                                        e.currentTarget.parentElement;
                      if (container) {
                        const a = document.createElement('a');
                        a.href = result.redirect_url;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.textContent = '🔗 Click here to connect ' + msg.connectToolkit;
                        a.style.cssText = 'display:block;margin-top:10px;color:#58a6ff;font-size:13px;font-weight:600';
                        container.appendChild(a);
                      }
                    }
                  } else {
                    popup?.close();
                    alert(`Could not start connect flow: ${result.detail || "unknown error"}`);
                  }
                } catch (err) {
                  popup?.close();
                  alert(`Connect error: ${err.message}`);
                }
              }}
              style={{
                padding: "9px 20px", border: "none", borderRadius: 8,
                background: isDark
                  ? "linear-gradient(135deg, #c47a10, #e09020)"
                  : "linear-gradient(135deg, #d97706, #f59e0b)",
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                boxShadow: "0 0 12px rgba(217,119,6,0.35)",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 6,
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
              onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              🔗 Connect {msg.connectToolkit} via Composio
            </button>
          </div>
        )}

        {/* Main content or spinner */}
        {msg.isThinking ? (
          <ThinkingDots />
        ) : (
          <>
            {msg.content && (
              <div 
                style={{ color: "#e6edf3", fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}
                className="prose prose-invert max-w-none"
              >
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}

            {/* Simple Workflow Visualization */}
            {msg.dagData && <WorkflowVisualization dagData={msg.dagData} nodeDetails={msg.nodeDetails || []} />}

            {/* Approval Block for HITL */}
            {msg.pendingApproval && (
              <div style={{ marginTop: 12, padding: 16, background: "#161b22", border: "1px solid #30363d", borderRadius: 8 }}>
                <div style={{ color: "#e6edf3", fontSize: 14, marginBottom: 12, fontWeight: 600 }}>
                  ⚠️ Do you want to proceed with this action?
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => msg.onApprove?.()} style={{ background: "#2ea043", color: "white", padding: "6px 16px", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>Approve</button>
                  <button onClick={() => msg.onCancel?.()} style={{ background: "transparent", color: "#f85149", padding: "6px 16px", border: "1px solid #f85149", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* ── Audit Log ── */}
            {msg.audit && msg.audit.length > 0 && (
              <details style={{ marginTop: 14 }} open>
                <summary style={{
                  cursor: "pointer", fontSize: 12, color: "#7d8590", userSelect: "none",
                  display: "flex", alignItems: "center", gap: 6, listStyle: "none",
                  outline: "none", marginBottom: 8,
                }}>
                  <span style={{ fontSize: 10 }}>▼</span>
                  Audit Log ({msg.audit.length} events)
                </summary>
                <div style={{
                  background: "#010409", border: "1px solid #21262d", borderRadius: 8,
                  padding: "10px 14px", fontFamily: "monospace", fontSize: 12,
                  maxHeight: 220, overflowY: "auto",
                }}>
                  {msg.audit.map((entry: string, i: number) => {
                    const isSuccess = entry.includes("[success]") || entry.includes("success");
                    const isError   = entry.includes("[failed") || entry.includes("error");
                    return (
                      <div key={i} style={{
                        color: isSuccess ? "#4ade80" : isError ? "#f85149" : "#7d8590",
                        padding: "3px 0", borderBottom: i < msg.audit.length - 1 ? "1px solid #21262d" : "none",
                        lineHeight: 1.5,
                      }}>
                        <span style={{ color: "#484f58", marginRight: 8 }}>{String(i + 1).padStart(2, "0")}</span>
                        {entry}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { logout } = useAppUser();
  const { user: clerkUser } = useUser();
  const clerkUserId = clerkUser?.id ?? "anonymous";
  const isDark = resolvedTheme === "dark";

  // GitHub Theme Mapping
  const T = {
    bg:           isDark ? "#0d1117" : "#f6f8fa",
    sidebar:      isDark ? "#010409" : "#ffffff",
    card:         isDark ? "#161b22" : "#ffffff",
    border:       isDark ? "#30363d" : "#d0d7de",
    text:         isDark ? "#e6edf3" : "#1f2328",
    secondary:    isDark ? "#7d8590" : "#656d76",
    accent:       isDark ? "#2ea043" : "#0969da",
    muted:        isDark ? "#161b22" : "#f3f4f6",
    input:        isDark ? "#0d1117" : "#ffffff",
    shadow:       isDark ? "transparent" : "0 1px 3px rgba(0,0,0,0.12)",
  };

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [editingMsg, setEditingMsg] = useState(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [slackMsg, setSlackMsg] = useState("");
  const [slackSending, setSlackSending] = useState(false);
  const [slackResult, setSlackResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [composioStatus, setComposioStatus] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [showToolkitModal, setShowToolkitModal] = useState(false);
  const [connectedApps, setConnectedApps] = useState<any[]>([]);

  const fetchConnections = async () => {
    const userId = clerkUser?.primaryEmailAddress?.emailAddress || clerkUserId;
    if (!userId || userId === "anonymous") return;
    try {
      const res = await fetch("/api/integrations/connections", {
        headers: { "X-User-Id": userId }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setConnectedApps(data.connections);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchConnections();
    const intv = setInterval(fetchConnections, 10000);
    return () => clearInterval(intv);
  }, [clerkUser, clerkUserId]);

  useEffect(() => {
    if (clerkUser?.primaryEmailAddress?.emailAddress || clerkUserId !== "anonymous") {
      const email = clerkUser?.primaryEmailAddress?.emailAddress;
      const id = email || clerkUserId;
      fetchWithRetry(`${API_BASE}/integrations/composio/status/${id}`)
        .then(r => r.json())
        .then(d => { if (d.ok && d.connected) setComposioStatus(d.connected); })
        .catch(console.error);
    }
  }, [clerkUser, clerkUserId]);

  const [fallbackConnectUrl, setFallbackConnectUrl] = useState<{ slug: string; url: string } | null>(null);

  const handleConnectComposio = async (toolSlug: string) => {
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    const userId = email || clerkUserId;
    if (!userId || userId === 'anonymous') {
      alert('Please log in before connecting a toolkit.');
      return;
    }
    setIsConnecting(toolSlug);
    setFallbackConnectUrl(null);

    // ── Synchronous popup: open BEFORE any await so the browser treats it as
    //    a direct user gesture and doesn't block it.  Do NOT pass noopener /
    //    noreferrer here — those flags prevent us from later setting
    //    popup.location.href from the same script. ──
    const popup = window.open('', '_blank');

    try {
      const res = await connectComposioToolkit(toolSlug, userId);
      if (res.ok && res.redirect_url) {
        if (popup && !popup.closed) {
          popup.location.href = res.redirect_url;
        } else {
          // Popup was blocked by an aggressive browser policy — offer a direct link
          setFallbackConnectUrl({ slug: toolSlug, url: res.redirect_url });
        }
      } else {
        popup?.close();
        alert('Could not initiate connection: ' + (res.detail || 'unknown error'));
      }
    } catch (err: any) {
      popup?.close();
      alert('Error connecting: ' + err.message);
    } finally {
      setIsConnecting(null);
    }
  };
  // ─── HITL Approval State ──────────────────────────────────────────
  const [pendingApproval, setPendingApproval] = useState<any>(null);
  const { tools } = useTools();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();
  const [history, setHistory] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('agentic_chats') || '[]'); } catch { return []; }
  });
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);


  // Capture OAuth credentials from URL on mount
  useEffect(() => {
    const jiraToken = searchParams.get("jira_token");
    const jiraCloudId = searchParams.get("jira_cloud_id");
    const slackToken = searchParams.get("slack_token");
    const googleToken = searchParams.get("google_token");

    if (jiraToken && jiraCloudId) {
      localStorage.setItem("jira_access_token", jiraToken);
      localStorage.setItem("jira_cloud_id", jiraCloudId);
    }
    if (slackToken) {
      localStorage.setItem("slack_access_token", slackToken);
    }
    if (googleToken) {
      localStorage.setItem("google_access_token", googleToken);
    }

    if (jiraToken || slackToken || googleToken) {
      setSearchParams({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentChatId && messages.length > 0) {
      setCurrentChatId(Date.now().toString());
    }
  }, [messages, currentChatId]);

  useEffect(() => {
    if (!currentChatId || messages.length === 0) return;
    setChats(prev => {
      const idx = prev.findIndex(c => c.id === currentChatId);
      const title = messages.find(m => m.role === 'user')?.content || "New Chat";
      const newChats = [...prev];
      if (idx >= 0) {
        newChats[idx] = { ...newChats[idx], title, messages };
      } else {
        newChats.unshift({ id: currentChatId, title, messages });
      }
      localStorage.setItem('agentic_chats', JSON.stringify(newChats));
      return newChats;
    });
  }, [messages, currentChatId]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/active-workflows");
        if (res.ok) {
          const data = await res.json();
          const wfs = (data.workflows || []).sort((a: any, b: any) => b.created_at - a.created_at);
          setHistory(wfs);
        }
      } catch (_err) { /* non-critical: history fetch silently ignored on error */ }
    };
    fetchHistory();
    const intv = setInterval(fetchHistory, 3000);
    return () => clearInterval(intv);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-load history from URL ID
  useEffect(() => {
    if (id && history.length > 0) {
      // Don't auto-load if we're already viewing this workflow (prevents infinite loop)
      const isAlreadyBrowsing = messages.some(m => m.thinking?.includes(id));
      const isAlreadyPlanning = messages.some(m => m.isThinking && m.thinking?.includes(id));
      
      if (!isAlreadyBrowsing && !isAlreadyPlanning) {
        const item = history.find(h => h.workflow_id === id);
        if (item) startWithHistory(item);
      }
    }
  // Intentionally omit `messages` and `startWithHistory` — adding them causes an
  // infinite re-trigger loop. The guard conditions inside prevent duplicate loads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, history]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  // ─── Main workflow execution ─────────────────────────────────────
  const handleSend = async (text?: string) => {
    const content = (text || input).trim();
    if (!content) return;

    const userMsgId = Date.now();
    const thinkingId = userMsgId + 1;
    const newUserMsg = { id: userMsgId, role: "user", content };
    const thinkingMsg = {
      id: thinkingId, role: "assistant",
      thinking: "🧠 Generating execution plan via LLM…",
      content: "", isThinking: true,
    };

    if (editingMsg) {
      const idx = messages.findIndex((m: any) => m.id === editingMsg.id);
      const sliced = messages.slice(0, idx);
      setMessages([...sliced, newUserMsg, thinkingMsg]);
      setEditingMsg(null);
    } else {
      setMessages(prev => [...prev, newUserMsg, thinkingMsg]);
    }

    setInput("");
    setChatStarted(true);
    setIsLoading(true);

    try {
      // Extract sliding window of history (last 10 messages)
      const chatHistory = messages
        .filter(m => !m.isThinking && (m.content || m.audit))
        .slice(-10)
        .map(m => {
          let text = m.content || "";
          if (m.role === "assistant" && m.audit && m.audit.length > 0) {
            text += "\n\nActions Taken:\n- " + m.audit.join("\n- ");
          }
          return { role: m.role, content: text.trim() };
        });

      const currentChatHistory = [
        ...messages.filter(m => !m.isThinking && m.content).map(m => ({ role: m.role, content: m.content })),
        { role: "user", content }
      ];

      const res = await fetch("/api/v2/execute", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Id": clerkUser?.primaryEmailAddress?.emailAddress || clerkUserId || "anonymous"
        },
        body: JSON.stringify({ 
          user_input: content,
          chat_history: currentChatHistory
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let errorMessage = "Execution failed: " + res.status;
        if (errData.detail) {
           errorMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to execute workflow");
      }

      const steps = data.intermediate_steps || [];
      const dagData = {
        nodes: steps.map((s: any, i: number) => ({
          id: `step_${i}`,
          tool: s.tool,
          action: "executed",
          status: "success",
          output: s.result,
        }))
      };

      const nodeDetails = steps.map((s: any, i: number) => ({
        node_id: `step_${i}`,
        tool: s.tool,
        action: "executed",
        status: "success",
        output: s.result,
      }));

      const auditLogStrings = steps.map((s: any) => `${s.tool} → executed [success]`);

      setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
        id: thinkingId,
        role: "assistant",
        thinking: "", 
        content: data.output || "Workflow Completed Successfully",
        dagData: steps.length > 0 ? dagData : null,
        nodeDetails: steps.length > 0 ? nodeDetails : null,
        audit: auditLogStrings.length > 0 ? auditLogStrings : undefined,
        isThinking: false,
      } : m));

    } catch (e: any) {
      console.error("Workflow Engine Error:", e);
      const errorMsg = e.message
        ? (typeof e.message === "object" ? JSON.stringify(e.message) : e.message)
        : String(e);

      setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
        id: thinkingId,
        role: "assistant",
        content: "⚠️ Integration Error: " + errorMsg,
        isThinking: false,
      } : m));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (msg: any) => {
    setEditingMsg(msg);
    setInput(msg.content);
    setChatStarted(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    setChatStarted(true);
    // Focus the input so user can immediately edit
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) { textarea.focus(); textarea.selectionStart = textarea.selectionEnd = text.length; }
    }, 50);
  };

  // ─── HITL Approval / Rejection Handlers ─────────────────────────
  const handleHITLApprove = async () => {
    if (!pendingApproval) return;
    const { dag, thinkingId, userCredentials, chatHistory } = pendingApproval;
    setPendingApproval(null);
    setIsLoading(true);

    // Update the message to show approval granted
    setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
      ...m,
      thinking: `✅ Approved — Dispatching ${dag.nodes?.length || 0} steps to live platforms…`,
      content: "",
      isThinking: true,
      hitlPending: false,
      hitlNodes: undefined,
    } : m));

    try {
      const execRes = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dag,
          auto_approve: true,
          dry_run: false,
          credentials: userCredentials,
          chat_history: chatHistory,
        }),
      });

      if (!execRes.ok) {
        const errData = await execRes.json().catch(() => ({}));
        throw new Error(errData.detail || "Execution failed: " + execRes.status);
      }

      const execData = await execRes.json();
      const dagData = {
        nodes: (execData.results || []).map((r: any) => ({
          id: r.node_id, tool: r.tool || "generic", action: r.action || r.name,
          status: r.status, output: r.output,
        })),
      };
      const nodeDetails = (execData.results || []).map((r: any) => ({ ...r, output: r.output || {} }));
      const auditLogStrings: string[] = (execData.audit_log || []).map((log: any) => {
        if (log.event_type === "tool_success") return `${log.tool || log.details?.tool} → ${log.action || log.details?.action} [success]`;
        if (log.event_type === "tool_failure") return `${log.tool || log.details?.tool} → ${log.action || log.details?.action} [failed: ${log.details?.error || log.error}]`;
        return log.message || JSON.stringify(log);
      });
      const fallbackAudit = (execData.results || []).map((r: any) => `${r.tool} → ${r.action} [${r.status}]`);
      const allOk = execData.failed === 0 && execData.succeeded > 0;
      const summary = allOk
        ? `✅ All ${execData.total_nodes} step${execData.total_nodes !== 1 ? "s" : ""} executed on live platforms.`
        : `⚠️ Workflow done — ${execData.succeeded}/${execData.total_nodes} succeeded${execData.failed > 0 ? `, ${execData.failed} failed` : ""}.`;

      setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
        id: thinkingId, role: "assistant",
        thinking: `Execution ${execData.execution_id} — ${execData.total_nodes} nodes (HITL Approved ✅)`,
        content: summary, dagData, nodeDetails,
        audit: auditLogStrings.length > 0 ? auditLogStrings : fallbackAudit,
        isThinking: false,
      } : m));
    } catch (e: any) {
      setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
        id: thinkingId, role: "assistant",
        content: "⚠️ Integration Error: " + (e.message || String(e)),
        isThinking: false,
      } : m));
    } finally {
      setIsLoading(false);
    }
  };

  const handleHITLReject = () => {
    if (!pendingApproval) return;
    const { thinkingId } = pendingApproval;
    setPendingApproval(null);
    setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
      ...m,
      thinking: "❌ Workflow rejected by user (HITL)",
      content: "🚫 Execution cancelled — no actions were performed.",
      isThinking: false,
      hitlPending: false,
      hitlNodes: undefined,
    } : m));
  };

  // ── Slack Quick-Send ──────────────────────────────────────────────
  const handleSlackQuickSend = async () => {
    const text = slackMsg.trim();
    if (!text || slackSending) return;
    setSlackSending(true);
    setSlackResult(null);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dag: {
            workflow_id: `slack-quick-${Date.now()}`,
            workflow_name: "Slack Quick Message",
            description: "Direct Slack message from dashboard",
            nodes: [{
              id: "node_1",
              name: "Send Slack Message",
              tool: "slack",
              action: "send_message",
              params: { channel: "#all-daiict", message: text },
              depends_on: [],
              requires_approval: false,
              retry: { max_attempts: 2, backoff_factor: 2, initial_delay: 1, timeout: 15 },
            }],
          },
          auto_approve: true,
          dry_run: false,
          credentials: {},
        }),
      });
      const data = await res.json();
      const nodeResult = data.results?.[0];
      const out = nodeResult?.output || {};
      if (nodeResult?.status === "success" || nodeResult?.status === "done") {
        setSlackResult({ ok: true, text: `✅ Message sent to ${out.channel || "#all-daiict"} (ts: ${out.ts || "ok"})` });
        setSlackMsg("");
      } else {
        setSlackResult({ ok: false, text: `❌ ${nodeResult?.error || data.detail || "Failed to send"}` });
      }
    } catch (e: any) {
      setSlackResult({ ok: false, text: `❌ ${e.message}` });
    } finally {
      setSlackSending(false);
    }
  };

  const startWithHistory = async (item: any) => {
    setChatStarted(true);
    setActiveNav("dashboard"); // Force back to chat if in logs
    setIsLoading(true);
    setInput("");
    setMessages([{ id: Date.now(), role: "user", content: item.title }]);
    
    // Sync URL if needed
    if (id !== item.workflow_id) {
      navigate(`/dashboard/${item.workflow_id}`);
    }

    try {
      const res = await fetch("/api/status?id=" + encodeURIComponent(item.workflow_id));
      if (res.ok) {
        const statusData = await res.json();
        const nodes = statusData.nodes || [];
        const succeeded = nodes.filter((n: any) => n.status === "done" || n.status === "success").length;
        const failed = nodes.filter((n: any) => n.status === "failed").length;

        const dagData = {
          nodes: nodes.map((n: any) => ({
            id: n.id,
            tool: n.tool || "generic",
            action: n.title || n.action || n.id,
            status: n.status || "done",
            output: n.output || n.outputs || {},
          })),
        };

        const nodeDetails = nodes.map((n: any) => ({
          node_id: n.id,
          tool: n.tool || "generic",
          action: n.action || n.title || n.id,
          status: n.status || "done",
          output: n.output || n.outputs || {},
          error: n.error,
          duration_ms: n.duration_ms || 0,
          retries: n.retries || 0,
        }));

        const audit = nodes.map((n: any) => `${n.tool || "generic"} → ${n.action || n.title} [${n.status}]`);
        const summaryMsg = {
          id: Date.now() + 1,
          role: "assistant",
          thinking: `Workflow ${item.workflow_id} — restored results`,
          content: `${succeeded}/${nodes.length} steps succeeded${failed > 0 ? `, ${failed} failed` : ""}.`,
          dagData,
          nodeDetails,
          audit,
          isThinking: false,
        };

        if (statusData.chat_history && statusData.chat_history.length > 0) {
          // Map back to our message format (adding IDs)
          const restored = statusData.chat_history.map((m: any, i: number) => ({
            id: Date.now() - 1000 + i,
            ...m
          }));
          
          // The last message in a completed workflow is usually the assistant summary.
          // We swap the generic summaryMsg in place of the last assistant message if it contains the DAG.
          setMessages([...restored.slice(0, -1), summaryMsg]);
        } else {
          // Fallback for legacy workflows
          setMessages([{ id: Date.now(), role: "user", content: item.title }, summaryMsg]);
        }
      }
    } catch (_e) { /* non-critical: history restore silently ignored on error */ }
    setIsLoading(false);
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", height: "100vh", background: T.bg,
      fontFamily: "'Segoe UI', system-ui, sans-serif", color: T.text,
      overflow: "hidden", transition: "background 0.3s, color 0.3s"
    }}>
      {/* ── SIDEBAR ── */}
      <div style={{
        width: 260, flexShrink: 0, background: T.sidebar,
        borderRight: `1px solid ${T.border}`, display: "flex",
        flexDirection: "column", overflow: "hidden", 
        boxShadow: T.shadow, zIndex: 10
      }}>
        {/* Logo & Theme Toggle */}
        <div style={{ padding: "20px 16px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: isDark ? "#0d3320" : "#dcfce7", border: "1px solid #2ea043",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#22c55e", fontSize: 14, fontWeight: 700,
            }}>G</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Groit AI</div>
              <div style={{ fontSize: 10, color: T.secondary }}>Intelligent Orchestration</div>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 4 }}>
            <button 
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              title="Toggle Services Panel"
              style={{
                border: "none", cursor: "pointer", 
                fontSize: 16, padding: 4, borderRadius: 6, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: rightPanelOpen ? T.accent : T.secondary,
                transition: "all 0.2s",
                background: rightPanelOpen ? T.muted : "transparent"
              }}
              onMouseEnter={e => { if(!rightPanelOpen) e.currentTarget.style.background = T.muted }}
              onMouseLeave={e => { if(!rightPanelOpen) e.currentTarget.style.background = "transparent" }}
            >
              ☰
            </button>
            <button 
              onClick={() => setTheme(isDark ? "light" : "dark")}
              style={{
                background: "transparent", border: "none", cursor: "pointer", 
                fontSize: 18, padding: 4, borderRadius: 6, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: T.secondary,
                transition: "transform 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.muted}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {isDark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>

        {/* New Chat */}
        <div style={{ padding: "12px 12px 8px" }}>
          <button
            onClick={() => { setMessages([]); setChatStarted(false); setInput(""); setEditingMsg(null); setCurrentChatId(null); navigate("/dashboard"); }}
            style={{
              width: "100%", padding: "8px 12px", background: T.muted,
              border: `1px solid ${T.border}`, borderRadius: 8, color: T.text,
              fontSize: 13, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 8,
              fontWeight: 500
            }}
          >
            <span style={{ fontSize: 16 }}>+</span> New workflow
          </button>
        </div>

        {/* Nav */}
        <div style={{ padding: "0 8px 8px" }}>
          {[
            { id: "dashboard", icon: "⊞", label: "Dashboard" },
            { id: "logs",      icon: "≡", label: "System Logs" },
          ].map((nav) => (
            <div
              key={nav.id}
              onClick={() => setActiveNav(nav.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                background: activeNav === nav.id ? (isDark ? "#161b22" : "#f0f2f5") : "transparent",
                color: activeNav === nav.id ? T.text : T.secondary,
                fontSize: 13, marginBottom: 2,
                fontWeight: activeNav === nav.id ? 600 : 400
              }}
            >
              <span style={{ fontSize: 14 }}>{nav.icon}</span> {nav.label}
            </div>
          ))}
        </div>


        {/* Conversations List */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px 12px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.secondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, fontWeight: 600 }}>
            Chat History
          </div>
          {chats.length === 0 ? (
            <div style={{ fontSize: 11, color: T.secondary, fontStyle: "italic", padding: "0 8px" }}>No conversations yet</div>
          ) : (
            chats.map((chat: any) => {
              const isActive = currentChatId === chat.id;
              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    setMessages(chat.messages);
                    setChatStarted(true);
                  }}
                  style={{
                    padding: "7px 8px", borderRadius: 6, cursor: "pointer",
                    fontSize: 12, marginBottom: 2,
                    lineHeight: 1.4, transition: "background 0.15s",
                    background: isActive ? T.muted : "transparent",
                    color: isActive ? T.accent : T.secondary,
                    borderLeft: isActive ? `2px solid ${T.accent}` : "none",
                    paddingLeft: isActive ? "6px" : "8px",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.muted; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ color: isActive ? T.text : T.secondary, fontWeight: isActive ? 600 : 400, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {chat.title}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>
                    {chat.messages.length} messages
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Platform Execution History */}
        <div style={{ maxHeight: "30%", overflow: "auto", padding: "8px 12px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.secondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, fontWeight: 600 }}>
            Recent Workflows
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 11, color: T.secondary, fontStyle: "italic", padding: "0 8px" }}>No active workflows</div>
          ) : (
            history.map((item: any) => {
              const date = new Date(item.created_at);
              const timeStr = isNaN(date.getTime()) ? "Pending" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const isActive = id === item.workflow_id;
              
              return (
                <div
                  key={item.workflow_id}
                  onClick={() => startWithHistory(item)}
                  style={{
                    padding: "7px 8px", borderRadius: 6, cursor: "pointer",
                    fontSize: 12, marginBottom: 2,
                    lineHeight: 1.4, transition: "background 0.15s",
                    background: isActive ? T.muted : "transparent",
                    color: isActive ? T.accent : T.secondary,
                    borderLeft: isActive ? `2px solid ${T.accent}` : "none",
                    paddingLeft: isActive ? "6px" : "8px",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.muted; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ color: isActive ? T.text : T.secondary, fontWeight: isActive ? 600 : 400, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 10, display: "flex", justifyContent: "space-between", color: T.secondary }}>
                    <span>{item.workflow_id?.slice(0, 16)}…</span>
                    <span>{timeStr}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* Logout at bottom */}
        <div style={{ padding: "12px", borderTop: `1px solid ${T.border}`, marginTop: "auto" }}>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            style={{
              width: "100%", padding: "8px", background: "transparent",
              border: `1px solid ${T.border}`, borderRadius: 8, color: "#f85149",
              fontSize: 13, cursor: "pointer", display: "flex", 
              alignItems: "center", justifyContent: "center", gap: 8,
              fontWeight: 600, transition: "background 0.2s"
            }}
            onMouseEnter={e => (e.currentTarget.style.background = isDark ? "#3d1117" : "#fff1f0")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {activeNav === "logs" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, overflow: "hidden" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: T.text }}>System Logs</h2>
            <p style={{ color: T.secondary, fontSize: 14, margin: "0 0 20px" }}>Live orchestration execution logs</p>
            <div style={{ flex: 1, background: T.sidebar, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, overflowY: "auto", fontFamily: "monospace", fontSize: 13, color: T.text }}>
              {history.map((wf: any) => (
                <div key={wf.workflow_id} style={{ marginBottom: 12 }}>
                  <div style={{ color: "#58a6ff", fontWeight: 600 }}>[{wf.workflow_id}] {wf.title}</div>
                  {(wf.nodes || []).map((n: any) => (
                    <div key={n.id} style={{
                      marginLeft: 16,
                      color: n.status === "failed" ? "#f85149" :
                        (n.status === "done" || n.status === "success") ? "#2ea043" :
                        n.status === "skipped" ? "#8b949e" : "#7d8590",
                    }}>
                      {TOOL_ICONS[n.tool] || "⚙️"} [{n.status?.toUpperCase()}] {n.tool || "generic"} → {n.action || n.title}
                    </div>
                  ))}
                </div>
              ))}
              {history.length === 0 && <div style={{ color: "#7d8590" }}>Waiting for workflow executions…</div>}
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: chatStarted ? "24px 0" : 0 }}>
              {!chatStarted ? (
                /* ── HOME SCREEN ── */
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%", padding: "0 24px",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: isDark ? "#0d3320" : "#dcfce7", border: "1px solid #2ea043",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px", color: "#22c55e", fontSize: 22, fontWeight: 700,
                  }}>A</div>

                  <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 8px", textAlign: "center", color: T.text }}>
                    Hello, Tejas 👋
                  </h1>
                  <p style={{ color: T.secondary, fontSize: 15, margin: "0 0 40px", textAlign: "center" }}>
                    What workflow would you like to run today?
                  </p>

                  {/* Suggestion chips */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 640, width: "100%", marginBottom: 24 }}>
                    {SUGGESTED_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestion(p)}
                        style={{
                          background: T.card, border: `1px solid ${T.border}`,
                          borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                          color: T.text, fontSize: 12, textAlign: "left",
                          lineHeight: 1.5, transition: "border-color 0.15s, transform 0.15s",
                          boxShadow: T.shadow
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = T.accent;
                          e.currentTarget.style.transform = "translateY(-2px)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = T.border;
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* ── Slack Quick-Send Panel ── */}
                  <div style={{
                    maxWidth: 640, width: "100%",
                    background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 12, padding: "16px 18px",
                    boxShadow: T.shadow
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 18 }}>💬</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>Slack Quick-Send</span>
                      <span style={{
                        marginLeft: "auto", fontSize: 11, color: "#4ade80",
                        background: "#0d3320", border: "1px solid #2ea04330",
                        padding: "2px 8px", borderRadius: 99, fontFamily: "monospace",
                      }}>#all-daiict</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Type a message to send to #all-daiict…"
                        value={slackMsg}
                        onChange={e => setSlackMsg(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSlackQuickSend(); }}
                        disabled={slackSending}
                        style={{
                          flex: 1, background: T.bg, border: `1px solid ${T.border}`,
                          borderRadius: 8, padding: "9px 12px", color: T.text,
                          fontSize: 13, outline: "none", fontFamily: "inherit",
                          opacity: slackSending ? 0.6 : 1,
                        }}
                        onFocus={e => (e.target.style.borderColor = T.accent)}
                        onBlur={e => (e.target.style.borderColor = T.border)}
                      />
                      <button
                        onClick={handleSlackQuickSend}
                        disabled={!slackMsg.trim() || slackSending}
                        style={{
                          padding: "9px 16px", borderRadius: 8, border: "none",
                          background: slackMsg.trim() && !slackSending ? "#2ea043" : "#21262d",
                          color: "#fff", fontSize: 13, fontWeight: 600,
                          cursor: slackMsg.trim() && !slackSending ? "pointer" : "default",
                          transition: "background 0.15s", whiteSpace: "nowrap",
                        }}
                      >
                        {slackSending ? "⏳ Sending…" : "Send ↗"}
                      </button>
                    </div>
                    {slackResult && (
                      <div style={{
                        marginTop: 10, fontSize: 12, fontFamily: "monospace",
                        color: slackResult.ok ? "#4ade80" : "#f85149",
                        background: slackResult.ok ? "#0d3320" : "#3d1117",
                        borderRadius: 6,
                        border: `1px solid ${slackResult.ok ? "#2ea04330" : "#f8514930"}`,
                      }}>
                        {slackResult.text}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── CHAT MESSAGES ── */
                <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px" }}>
                  {messages.map((msg: any) => (
                    <ChatMessage key={msg.id} msg={msg} onEdit={handleEdit} onApprove={handleHITLApprove} onReject={handleHITLReject} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* ── INPUT BOX ── */}
            <div style={{ padding: "16px 24px 20px", borderTop: chatStarted ? `1px solid ${T.border}` : "none", background: T.bg }}>
              <div style={{ maxWidth: 780, margin: "0 auto" }}>
                {editingMsg && (
                  <div style={{ fontSize: 11, color: "#f0883e", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>✏️ Editing message — response will regenerate from this point</span>
                    <button
                      onClick={() => { setEditingMsg(null); setInput(""); }}
                      style={{ background: "none", border: "none", color: T.secondary, cursor: "pointer", fontSize: 12 }}
                    >✕ cancel</button>
                  </div>
                )}
                <div style={{
                  display: "flex", alignItems: "flex-end", gap: 10,
                  background: T.card, border: `1px solid ${editingMsg ? "#f0883e" : T.border}`,
                  borderRadius: 14, padding: "12px 14px", transition: "border-color 0.2s",
                  boxShadow: T.shadow
                }}>
                  <button
                    onClick={() => setShowToolkitModal(true)}
                    title="Toolkits & Integrations"
                    style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: isDark ? "#21262d" : "#e5e7eb",
                      border: `1px solid ${T.border}`, cursor: "pointer",
                      color: T.secondary, fontSize: 16, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.color = T.secondary; e.currentTarget.style.borderColor = T.border; }}
                  >
                    🧩
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); autoResize(); }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Describe a workflow… (e.g. Create Jira ticket → GitHub branch → Slack alert)"
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      color: "#e6edf3", fontSize: 14, lineHeight: 1.6, resize: "none",
                      minHeight: 24, maxHeight: 200, fontFamily: "inherit", padding: 0,
                    }}
                    rows={1}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: input.trim() && !isLoading ? "#2ea043" : "#21262d",
                      border: "none", cursor: input.trim() && !isLoading ? "pointer" : "default",
                      color: "#fff", fontSize: 16, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      transition: "background 0.15s",
                    }}
                  >
                    ↑
                  </button>
                </div>
                <p style={{ textAlign: "center", fontSize: 11, color: "#484f58", marginTop: 8 }}>
                  Enter to send · Shift+Enter for new line · Hover messages to edit
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── TOOLKIT MODAL ── */}
      {showToolkitModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100, padding: 20,
        }}
        onClick={() => setShowToolkitModal(false)}
        >
          <div style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
            width: "100%", maxWidth: 800, maxHeight: "85vh",
            display: "flex", flexDirection: "column",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
          }}
          onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
                  🧩 Composio Toolkits
                </h2>
                <p style={{ fontSize: 13, color: T.secondary, margin: "4px 0 0" }}>Connect your daily apps to automate workflows.</p>
              </div>
              <button
                onClick={() => setShowToolkitModal(false)}
                style={{ background: "transparent", border: "none", color: T.secondary, fontSize: 18, cursor: "pointer" }}
              >✕</button>
            </div>
            
            {/* Fallback banner — shown if popup was blocked */}
            {fallbackConnectUrl && (
              <div style={{
                margin: '0 24px', marginTop: 16, padding: '12px 16px', borderRadius: 10,
                background: '#2d2000', border: '1px solid #f59e0b55',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                flexShrink: 0
              }}>
                <span style={{ fontSize: 13, color: '#e6c870' }}>
                  ⚠️ Popup blocked. Click to connect <strong>{fallbackConnectUrl.slug}</strong>:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <a
                    href={fallbackConnectUrl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 13, fontWeight: 700, color: '#4ade80',
                      textDecoration: 'none', padding: '6px 14px',
                      background: '#0d3320', border: '1px solid #2ea043', borderRadius: 8
                    }}
                  >
                    🔗 Open OAuth Page ↗
                  </a>
                  <button
                    onClick={() => setFallbackConnectUrl(null)}
                    style={{ background: 'none', border: 'none', color: T.secondary, cursor: 'pointer', fontSize: 16 }}
                  >✕</button>
                </div>
              </div>
            )}

            <div style={{ padding: 24, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {COMPOSIO_TOOLS.map(t => {
                const isConnected = composioStatus.includes(t.tool);
                const connecting = isConnecting === t.tool;
                
                return (
                  <div 
                    key={t.tool} 
                    onClick={() => {
                      if (!isConnected && !connecting) handleConnectComposio(t.tool);
                    }}
                    style={{
                      background: isConnected ? (isDark ? "#0d3320" : "#dcfce7") : (isDark ? "#0d1117" : "#f6f8fa"),
                      border: `1px solid ${isConnected ? "#2ea043" : T.border}`,
                      borderRadius: 12, padding: 16, display: "flex", flexDirection: "column",
                      gap: 12, position: "relative", overflow: "hidden",
                      cursor: isConnected ? "default" : (connecting ? "wait" : "pointer"),
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={e => {
                      if (!isConnected && !connecting) {
                        e.currentTarget.style.borderColor = T.accent;
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isConnected && !connecting) {
                        e.currentTarget.style.borderColor = T.border;
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = "none";
                      }
                    }}
                  >
                    {isConnected && (
                      <div style={{ position: "absolute", top: -20, right: -20, width: 40, height: 40, background: "#2ea04340", borderRadius: "50%", filter: "blur(10px)" }} />
                    )}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ fontSize: 24 }}>{t.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isConnected ? "#2ea043" : T.text, marginBottom: 2 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: isConnected ? "#2ea043" : T.secondary, lineHeight: 1.4, opacity: isConnected ? 0.8 : 1 }}>{t.description}</div>
                      </div>
                    </div>
                    
                    <div style={{
                      marginTop: "auto", 
                      fontSize: 12, fontWeight: 700, 
                      color: isConnected ? "#2ea043" : T.accent,
                      textAlign: "right"
                    }}>
                      {connecting ? "Connecting..." : isConnected ? "✅ Connected" : "Click to Connect ➔"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── RIGHT PANEL (RAIL SYSTEM) ── */}
      <div style={{
        width: rightPanelOpen ? 280 : 60, flexShrink: 0, background: T.sidebar,
        borderLeft: `1px solid ${T.border}`, display: "flex",
        flexDirection: "column", overflow: "hidden", 
        boxShadow: T.shadow, zIndex: 5,
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }}>
        <div style={{ 
          padding: rightPanelOpen ? "20px 16px 12px" : "20px 0 12px", 
          borderBottom: `1px solid ${T.border}`, 
          display: "flex", alignItems: "center", 
          justifyContent: rightPanelOpen ? "space-between" : "center" 
        }}>
          {rightPanelOpen ? (
            <>
              <div style={{ fontSize: 11, color: T.secondary, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
                System Status
              </div>
              <button 
                onClick={() => setRightPanelOpen(false)}
                style={{ background: "transparent", border: "none", color: T.secondary, cursor: "pointer", fontSize: 14 }}
              >✕</button>
            </>
          ) : (
            <button 
              onClick={() => setRightPanelOpen(true)}
              style={{ background: "transparent", border: "none", color: T.accent, cursor: "pointer", fontSize: 18 }}
              title="Expand Panel"
            >☰</button>
          )}
        </div>
        
        {rightPanelOpen && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", flex: 1 }}>
             <p style={{ fontSize: 13, color: T.secondary, textAlign: "center", marginTop: 20 }}>
               Agentic Backend Online<br/>
               <span style={{ fontSize: 10, opacity: 0.7 }}>Ready to process workflows</span>
             </p>

             {connectedApps.length > 0 && (
               <div style={{ marginTop: "30px" }}>
                 <div style={{ fontSize: 11, color: T.secondary, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 12 }}>
                   Connected Apps
                 </div>
                 <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                   {connectedApps.map((app: any) => (
                     <div key={app.slug} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.text, background: T.card, padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}` }}>
                       <div style={{ 
                         width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                         background: app.connected ? "#2ea043" : "#484f58",
                         boxShadow: app.connected ? "0 0 5px rgba(46,160,67,0.5)" : "none"
                       }} />
                       <span style={{ fontWeight: 600 }}>{app.name}</span>
                       {!app.connected && <span style={{ fontSize: 11, color: T.secondary, marginLeft: "auto" }}>Unlinked</span>}
                     </div>
                   ))}
                 </div>
               </div>
             )}
          </div>
        )}

        {rightPanelOpen && (
          <div style={{ marginTop: "auto", padding: "16px", borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.secondary }}>
            <p style={{ margin: 0 }}>Use the 🧩 Toolkit button next to the chat input to manage integrations.</p>
          </div>
        )}
      </div>
    </div>
  );
}