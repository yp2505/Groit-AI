import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useAppUser } from "@/hooks/useAppUser";
import { useTools } from "./context/ToolsContext";
import { connectComposioToolkit, disconnectComposioToolkit, API_BASE, fetchWithRetry } from "./lib/api";
import ReactMarkdown from "react-markdown";
import { Sidebar as SidebarIcon, Sun, Moon, Plus, User, LogOut, Settings, Blocks, Clock, Puzzle, Library, Lock, Edit2, X, Check, Pencil, Trash2, Copy, ShieldAlert, Plug, Mic, Send, Terminal, ChevronRight, ChevronDown, Play, Square, CircleDashed, MoreHorizontal, AlertCircle, CheckCircle2, Activity, FileCode2, Database, Cpu, Globe, Key, FileText, Download, Upload, RefreshCw, MessageSquare, Search, Bookmark, MoreVertical } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "Critical bug in Jira → create GitHub branch → notify #all-daiict on Slack",
  "Send a message to #all-daiict on Slack: 'System is live!'",
  "Fetch latest GitHub commits and post a summary to Slack #all-daiict",
  "Create Jira ticket → append row to Google Sheets → notify Slack #all-daiict",
];



const COMPOSIO_TOOLS = [
  { tool: 'gmail', label: 'Gmail', description: 'Emails & drafts', domain: 'mail.google.com' },
  { tool: 'googlecalendar', label: 'Calendar', description: 'Meetings & events', domain: 'calendar.google.com', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg' },
  { tool: 'slack', label: 'Slack', description: 'Team messaging', domain: 'slack.com' },
  { tool: 'github', label: 'GitHub', description: 'Code & branches', domain: 'github.com' },
  { tool: 'jira', label: 'Jira', description: 'Agile & boards', domain: 'atlassian.com' },
  { tool: 'sheets', label: 'Google Sheets', description: 'Automated reporting', domain: 'google.com', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg' },
  { tool: 'notion', label: 'Notion', description: 'Notes & docs', domain: 'notion.so', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png' },
  { tool: 'linear', label: 'Linear', description: 'Issue tracking', domain: 'linear.app' },
  { tool: 'asana', label: 'Asana', description: 'Team projects', domain: 'asana.com' },
  { tool: 'hubspot', label: 'HubSpot', description: 'CRM & marketing', domain: 'hubspot.com' },
  { tool: 'discord', label: 'Discord', description: 'Community chat', domain: 'discord.com' },
  { tool: 'trello', label: 'Trello', description: 'Kanban boards', domain: 'trello.com' },
  { tool: 'zoom', label: 'Zoom', description: 'Video calls', domain: 'zoom.us' },
  { tool: 'figma', label: 'Figma', description: 'Design tools', domain: 'figma.com' },
  { tool: 'zendesk', label: 'Zendesk', description: 'Customer support', domain: 'zendesk.com' },
];

const TOOL_ICONS: Record<string, string> = {
  slack: "💬",
  github: "🐙",
  jira: "🔵",
  sheets: "📊",
  generic: "⚙️",
};

const TOOL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  slack: { bg: "#1a0f2e", border: "#4a1a7a", text: "#a78bfa" },
  github: { bg: "#0d1117", border: "#2ea043", text: "#56d364" },
  jira: { bg: "#0a1a3a", border: "#1e6fd6", text: "#79c0ff" },
  sheets: { bg: "#0a2a1a", border: "#1a7a4a", text: "#4ade80" },
  generic: { bg: "#161b22", border: "#30363d", text: "#8b949e" },
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; dot: string }> = {
    done: { bg: "#0d3320", color: "#4ade80", dot: "#4ade80" },
    success: { bg: "#0d3320", color: "#4ade80", dot: "#4ade80" },
    failed: { bg: "#3d1117", color: "#f85149", dot: "#f85149" },
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
  const isFailed = status === "failed";
  const tc = TOOL_COLORS[tool] || TOOL_COLORS.generic;
  const borderColor = isSuccess ? tc.border : isFailed ? "#f85149" : "#30363d";
  const bgColor = isSuccess ? tc.bg : isFailed ? "#2d1117" : "#161b22";
  return (
    <div style={{
      position: "absolute", left, top,
      background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: 10, padding: "10px 14px", width: 175, fontSize: 12, color: "#e6edf3",
      boxShadow: isSuccess ? `0 0 12px ${tc.border}44` : "none",
      transition: "box-shadow 0.4s",
    }}>
      <div style={{ color: "#7d8590", fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {TOOL_ICONS[tool] || "🔧"} {tool ? tool.toUpperCase() : "TOOL"}
      </div>
      <div style={{ fontWeight: 600, color: "#e6edf3", fontSize: 13, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ color: tc.text, fontSize: 10, marginBottom: 8, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {sublabel}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function WorkflowVisualization({ dagData, nodeDetails }: { dagData: any, nodeDetails: any[] }) {
  if (!dagData || !dagData.nodes || dagData.nodes.length === 0) return null;

  const NODE_W = 175;
  const NODE_H = 100;
  const GAP = 50;
  const nodes = dagData.nodes as any[];

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
              const y = NODE_H / 2 + 12;
              return (
                <g key={i}>
                  <line x1={x1} y1={y} x2={x2 - 8} y2={y} stroke="#2ea04366" strokeWidth={2} strokeDasharray="4 3" />
                  <polygon points={`${x2},${y} ${x2 - 8},${y - 5} ${x2 - 8},${y + 5}`} fill="#2ea04366" />
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
              sublabel={n.action ? n.action.toLowerCase().replace(/_/g, " ") : ""}
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
              const isOk = node.status === "success" || node.status === "done";
              const isFailed = node.status === "failed";
              const tc = TOOL_COLORS[node.tool] || TOOL_COLORS.generic;
              const summary = getOutputSummary(node.node_id);
              const links = Object.values(node.output || {}).filter((v: any) => typeof v === "string" && v.startsWith("http")) as string[];

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
                          · {cleanAction(node.action)}
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
                    const isError = entry.includes("[failed") || entry.includes("error");
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
  const clerk = useClerk();
  const clerkUserId = clerkUser?.id ?? "anonymous";
  const isDark = resolvedTheme === "dark";

  // ── Mobile detection ─────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Profile modal state ───────────────────────────────────────────
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [profileSaveMsg, setProfileSaveMsg] = useState('');

  // GitHub Theme Mapping
  const T = {
    bg: isDark ? "#0d1117" : "#f6f8fa",
    sidebar: isDark ? "#010409" : "#ffffff",
    card: isDark ? "#161b22" : "#ffffff",
    border: isDark ? "#30363d" : "#d0d7de",
    text: isDark ? "#e6edf3" : "#1f2328",
    secondary: isDark ? "#7d8590" : "#656d76",
    accent: isDark ? "#2ea043" : "#0969da",
    muted: isDark ? "#161b22" : "#f3f4f6",
    input: isDark ? "#0d1117" : "#ffffff",
    shadow: isDark ? "transparent" : "0 1px 3px rgba(0,0,0,0.12)",
  };


  const [execModel, setExecModel] = useState("GPT-4o");
  const [execMode, setExecMode] = useState("Auto");
  const [maxRetries, setMaxRetries] = useState(2);
  const [privateMode, setPrivateMode] = useState(false);
  const [activeTab, setActiveTab] = useState("Active Workflow");

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [editingMsg, setEditingMsg] = useState(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [slackMsg, setSlackMsg] = useState("");
  const [slackSending, setSlackSending] = useState(false);
  const [slackResult, setSlackResult] = useState<{ ok: boolean; text: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  const [composioStatus, setComposioStatus] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [showToolkitModal, setShowToolkitModal] = useState(false);
  const [connectedApps, setConnectedApps] = useState<any[]>([]);

  const fetchConnections = async () => {
    const userId = clerkUser?.primaryEmailAddress?.emailAddress || clerkUserId;
    if (!userId || userId === "anonymous") return;
    try {
      const res = await fetch(`${API_BASE}/integrations/connections`, {
        headers: { "X-User-Id": userId }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setConnectedApps(data.connections);
      }
    } catch (e) { }
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
      // Jira requires a subdomain to initiate the Composio OAuth flow
      const extraFields: Record<string, string> = {};
      if (toolSlug === 'jira') {
        const jiraBaseUrl = import.meta.env.VITE_JIRA_BASE_URL || '';
        const subdomain = jiraBaseUrl
          .replace('https://', '')
          .replace('http://', '')
          .replace('.atlassian.net', '')
          .replace(/\/$/, '')
          .trim();
        if (subdomain) extraFields['subdomain'] = subdomain;
      }

      const res = await connectComposioToolkit(toolSlug, userId, extraFields);

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

  const handleDisconnectComposio = async (toolSlug: string) => {
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    const userId = email || clerkUserId;
    if (!userId || userId === 'anonymous') return;

    if (!confirm(`Are you sure you want to disconnect ${toolSlug}?`)) return;

    try {
      const res = await disconnectComposioToolkit(toolSlug, userId);
      if (res.ok) {
        setComposioStatus(prev => prev.filter(t => t !== toolSlug));
        fetchConnections();
      } else {
        alert('Could not disconnect: ' + (res.detail || 'unknown error'));
      }
    } catch (err: any) {
      alert('Error disconnecting: ' + err.message);
    }
  };
  // ─── HITL Approval State ──────────────────────────────────────────
  const [pendingApproval, setPendingApproval] = useState<any>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();
  const [history, setHistory] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('agentic_chats') || '[]');
      return stored;
    } catch { 
      return []; 
    }
  });
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('agentic_saved_workflows') || '[]'); } catch { return []; }
  });
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);

  // Auto-close sidebar on mobile when page loads
  useEffect(() => { if (isMobile) setLeftSidebarOpen(false); }, [isMobile]);

  // Chat History Handlers
  const loadChat = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      setMessages(chat.messages || []);
      setCurrentChatId(chatId);
      setChatStarted(true);
      setActiveNav("dashboard");
    }
  };

  const handleRenameChat = (chatId: string, newTitle: string) => {
    setChats(prev => {
      const newChats = prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c);
      localStorage.setItem('agentic_chats', JSON.stringify(newChats));
      return newChats;
    });
    setEditingChatId(null);
  };

  const handleDeleteChat = (chatId: string) => {
    setChats(prev => {
      const newChats = prev.filter(c => c.id !== chatId);
      localStorage.setItem('agentic_chats', JSON.stringify(newChats));
      return newChats;
    });
    if (currentChatId === chatId) {
      setMessages([]);
      setCurrentChatId(null);
      setChatStarted(false);
    }
  };

  const handleSaveWorkflow = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    // Find last assistant message with dagData
    const lastSummary = [...(chat.messages || [])].reverse().find(m => m.role === 'assistant' && m.dagData);
    if (lastSummary) {
      setSavedWorkflows(prev => {
        const newWf = { id: `wf_${Date.now()}`, name: chat.title || "Saved Workflow", dagData: lastSummary.dagData, created_at: Date.now() };
        const updated = [newWf, ...prev];
        localStorage.setItem('agentic_saved_workflows', JSON.stringify(updated));
        return updated;
      });
      alert(`Workflow "${chat.title}" saved successfully!`);
    } else {
      alert("No completed workflow found in this chat to save.");
    }
    setActiveMenuId(null);
  };
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Auto-close right panel on mobile when page loads
  useEffect(() => { if (isMobile) setRightPanelOpen(false); }, [isMobile]);


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
        const historyData = JSON.parse(localStorage.getItem('workflow_history') || '[]');
        setHistory(historyData);
      } catch (_err) { /* non-critical */ }
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

  const handleMicClick = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true; // Use interim results for smoother UX
    recognition.continuous = true; // Keep listening until explicitly stopped
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => setIsListening(true);
    
    let finalTranscript = "";
    
    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let newFinal = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (newFinal) {
        setInput(prev => {
          const space = prev.endsWith(" ") || prev === "" ? "" : " ";
          return prev + space + newFinal;
        });
      }
      // If you want to show interim results, we would need a separate state, 
      // but for simplicity we just append final results continuously to the input.
    };
    
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };
    
    try {
      recognition.start();
    } catch (e) {
      console.error("Mic start failed", e);
    }
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  useEffect(() => {
    autoResize();
  }, [input]);

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
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = "34px";
    }

    abortControllerRef.current = new AbortController();

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

      // Credentials are handled by Composio OAuth — no local credentials needed

      const res = await fetch(`${API_BASE}/v3/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": clerkUser?.primaryEmailAddress?.emailAddress || clerkUserId || "anonymous"
        },
        body: JSON.stringify({
          user_input: content,
          chat_history: currentChatHistory,
          credentials: {}
        }),
        signal: abortControllerRef.current?.signal,
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

      if (!data.execution && !data.dag) {
        throw new Error(data.error || "Failed to execute workflow");
      }

      // ── Conversational reply (non-workflow messages like "hi") ──────────────
      const chatReply = data.execution?.chat_reply;
      if (chatReply) {
        setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
          id: thinkingId,
          role: "assistant",
          content: chatReply,
          dagData: null,
          nodeDetails: null,
          audit: undefined,
          isThinking: false,
        } : m));
        return;
      }

      const dagNodes = data.dag?.nodes || [];
      const execution = data.execution?.results || {};

      const dagData = {
        nodes: dagNodes.map((n: any) => ({
          id: n.id,
          tool: n.tool,
          action: n.action,
          status: execution[n.id]?.status || "pending",
          output: execution[n.id]?.output,
        }))
      };

      const nodeDetails = dagNodes.map((n: any) => ({
        node_id: n.id,
        tool: n.tool,
        action: n.action,
        status: execution[n.id]?.status || "pending",
        output: execution[n.id]?.output,
        error: execution[n.id]?.error,
      }));

      const auditLogStrings = dagNodes.map((n: any) => {
        const st = execution[n.id]?.status || "pending";
        return `${n.tool} → ${n.action} [${st}]`;
      });

      const allSuccess = dagNodes.every((n: any) => execution[n.id]?.status === 'success');
      const outMsg = allSuccess ? "Workflow Completed Successfully." : "Workflow executed with some errors.";

      setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
        id: thinkingId,
        role: "assistant",
        thinking: "",
        content: outMsg,
        dagData: dagNodes.length > 0 ? dagData : null,
        nodeDetails: dagNodes.length > 0 ? nodeDetails : null,
        audit: auditLogStrings.length > 0 ? auditLogStrings : undefined,
        isThinking: false,
      } : m));

    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
          id: thinkingId, role: "assistant", content: "🚫 Execution stopped by user.", isThinking: false
        } : m));
      } else {
        console.error("Workflow Engine Error:", e);
        const errorMsg = e.message
          ? (typeof e.message === "object" ? JSON.stringify(e.message) : e.message)
          : String(e);

        setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
          id: thinkingId,
          role: "assistant",
          content: "❌ Integration Error: " + errorMsg,
          isThinking: false,
        } : m));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
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
      const execRes = await fetch("/api/v3/execute", {
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
      const res = await fetch("/api/v3/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dag: {
            workflow_name: "Slack Quick Message",
            nodes: [{
              id: "node_1",
              tool: "slack",
              action: "SEND_MESSAGE",
              params: { channel: "all-groit", text: text },
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

  // System Status: all tool connections come from Composio
  const mergedApps = connectedApps;


  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", height: "100vh", background: T.bg,
      fontFamily: "'Segoe UI', system-ui, sans-serif", color: T.text,
      overflow: "hidden", transition: "background 0.3s, color 0.3s",
      position: "relative"
    }}>
      {/* ── SIDEBAR ── */}
      {/* Mobile backdrop — tap to close sidebar */}
      {isMobile && leftSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setLeftSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 199, backdropFilter: "blur(2px)"
          }}
        />
      )}
      <div
        className={isMobile && leftSidebarOpen ? "sidebar-mobile-overlay" : ""}
        style={{
          width: leftSidebarOpen ? 260 : 0, flexShrink: 0, background: T.sidebar,
          backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
          borderRight: leftSidebarOpen ? `1px solid ${T.border}` : "none", display: "flex",
          flexDirection: "column", overflow: "hidden",
          zIndex: isMobile ? 200 : 10, transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
        <div style={{ width: 260, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Workspace Header & Theme Toggle */}
        <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div 
            onClick={() => navigate("/")}
            style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 18, color: T.text, cursor: "pointer" }}
            title="Go to Landing Page"
          >
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.accent }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: isDark ? '#2E3640' : '#D1D5DB' }} />
            </div>
            Groit AI
          </div>

          <div style={{ display: "flex", gap: 2 }}>
            <button
              onClick={() => setLeftSidebarOpen(false)}
              title="Close Sidebar"
              style={{
                border: "none", cursor: "pointer",
                width: 28, height: 28, borderRadius: 6, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: T.secondary, transition: "all 0.2s", background: "transparent"
              }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <SidebarIcon size={16} />
            </button>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                width: 28, height: 28, borderRadius: 6, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: T.secondary, transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 20px" }}>
          <button
            onClick={() => { setMessages([]); setChatStarted(false); setInput(""); setEditingMsg(null); setCurrentChatId(null); navigate("/dashboard"); }}
            style={{
              width: "100%", padding: "10px", background: T.accent,
              border: "none", borderRadius: 8, color: "#000", fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontWeight: 600, transition: "all 0.2s", marginBottom: 16
            }}
          >
            <Plus size={16} strokeWidth={2.5} /> New Chat
          </button>

          {/* Search Bar */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: T.secondary }} />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8,
                background: isDark ? "rgba(0,0,0,0.2)" : "#fff",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb"}`,
                color: T.text, fontSize: 12, outline: "none"
              }}
            />
          </div>

          {/* Navigation Links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 24 }}>
            <button
              onClick={() => setActiveNav("logs")}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                borderRadius: 8, border: "none", cursor: "pointer",
                background: activeNav === "logs" ? (isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb") : "transparent",
                color: activeNav === "logs" ? (isDark ? "#ffffff" : T.text) : (isDark ? "#a1a1aa" : T.secondary),
                fontWeight: activeNav === "logs" ? 600 : 500, transition: "all 0.2s", textAlign: "left"
              }}
              onMouseEnter={e => { if (activeNav !== "logs") e.currentTarget.style.color = isDark ? "#ffffff" : T.text; }}
              onMouseLeave={e => { if (activeNav !== "logs") e.currentTarget.style.color = isDark ? "#a1a1aa" : T.secondary; }}
            >
              <Terminal size={16} /> System Logs
            </button>
            <button
              onClick={() => setActiveNav("saved_workflows")}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                borderRadius: 8, border: "none", cursor: "pointer",
                background: activeNav === "saved_workflows" ? (isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb") : "transparent",
                color: activeNav === "saved_workflows" ? (isDark ? "#ffffff" : T.text) : (isDark ? "#a1a1aa" : T.secondary),
                fontWeight: activeNav === "saved_workflows" ? 600 : 500, transition: "all 0.2s", textAlign: "left"
              }}
              onMouseEnter={e => { if (activeNav !== "saved_workflows") e.currentTarget.style.color = isDark ? "#ffffff" : T.text; }}
              onMouseLeave={e => { if (activeNav !== "saved_workflows") e.currentTarget.style.color = isDark ? "#a1a1aa" : T.secondary; }}
            >
              <Library size={16} /> Saved Workflows
            </button>
          </div>

          {/* Chat History */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.secondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Recent Chats
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {chats.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).map((chat: any) => (
                <div key={chat.id} style={{
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px", borderRadius: 6, cursor: "pointer",
                  background: currentChatId === chat.id ? (isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb") : "transparent",
                }}
                  onMouseEnter={e => { if (currentChatId !== chat.id) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"; }}
                  onMouseLeave={e => { if (currentChatId !== chat.id) e.currentTarget.style.background = "transparent"; }}
                  onClick={() => loadChat(chat.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", overflow: "hidden", flex: 1, paddingLeft: 8 }}>
                    {editingChatId === chat.id ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onBlur={() => handleRenameChat(chat.id, editingTitle)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameChat(chat.id, editingTitle); }}
                        onClick={e => e.stopPropagation()}
                        style={{ flex: 1, background: "transparent", border: `1px solid ${T.accent}`, color: T.text, fontSize: 12, outline: "none", padding: "0 4px", borderRadius: 4 }}
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: isDark ? "#ffffff" : T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {chat.title}
                      </span>
                    )}
                  </div>

                  <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === chat.id ? null : chat.id)}
                      style={{ background: "transparent", border: "none", color: T.secondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = T.text}
                      onMouseLeave={e => e.currentTarget.style.color = T.secondary}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {activeMenuId === chat.id && (
                      <div style={{
                        position: "absolute", right: 0, top: 24, zIndex: 100, width: 140,
                        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
                        boxShadow: T.shadow, padding: 4, display: "flex", flexDirection: "column", gap: 2
                      }}>
                        <button onClick={() => { setEditingChatId(chat.id); setEditingTitle(chat.title); setActiveMenuId(null); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: T.text, fontSize: 12, padding: "6px 8px", borderRadius: 4, cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <Edit2 size={12} /> Rename
                        </button>
                        <button onClick={() => handleSaveWorkflow(chat.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: T.text, fontSize: 12, padding: "6px 8px", borderRadius: 4, cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <Bookmark size={12} /> Save Workflow
                        </button>
                        <div style={{ height: 1, background: T.border, margin: "2px 0" }} />
                        <button onClick={() => handleDeleteChat(chat.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: "#f85149", fontSize: 12, padding: "6px 8px", borderRadius: 4, cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(248,81,73,0.1)" : "#fee2e2"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <Trash2 size={12} /> Delete Chat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>



        {/* User Profile at bottom — click to open profile modal */}
        <div style={{ padding: "16px", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#e5e7eb"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={() => { setEditingProfileName(clerkUser?.fullName || clerkUser?.firstName || ''); setProfileSaveMsg(''); setShowProfileModal(true); }}
            title="Edit Profile"
            style={{
              display: "flex", alignItems: "center", gap: 10, overflow: "hidden",
              background: "transparent", border: "none", cursor: "pointer", flex: 1,
              padding: 0, borderRadius: 8, transition: "background 0.2s", textAlign: "left"
            }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            {clerkUser?.imageUrl ? (
              <img src={clerkUser.imageUrl} alt="Profile" style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${T.accent}`, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${T.accent}33, ${T.accent}66)`, display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, border: `2px solid ${T.accent}44`, flexShrink: 0 }}>
                <User size={16} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {clerkUser?.fullName || clerkUser?.firstName || "Groit User"}
              </span>
              <span style={{ fontSize: 11, color: T.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {clerkUser?.primaryEmailAddress?.emailAddress || "user@groit.ai"}
              </span>
            </div>
          </button>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            title="Sign Out"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: T.secondary, padding: 6, borderRadius: 6, display: "flex",
              alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? "rgba(255,0,0,0.1)" : "#fee2e2"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.secondary; }}
          >
            <LogOut size={16} />
          </button>
        </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
        background: isDark ? "radial-gradient(circle at center, rgba(74, 222, 128, 0.05) 0%, transparent 80%)" : "transparent"
      }}>
        {!leftSidebarOpen && (
          <div style={{ position: "absolute", top: 18, left: 16, zIndex: 50, display: "flex", gap: 8 }}>
            <button
              onClick={() => setLeftSidebarOpen(true)}
              title="Open Sidebar"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: T.secondary, display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: 6,
              }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <SidebarIcon size={20} />
            </button>
          </div>
        )}
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
                      {TOOL_ICONS[n.tool] || <Settings size={16} />} [{n.status?.toUpperCase()}] {n.tool || "generic"} → {n.action || n.title}
                    </div>
                  ))}
                </div>
              ))}
              {history.length === 0 && <div style={{ color: "#7d8590" }}>Waiting for workflow executions…</div>}
            </div>
          </div>
        ) : activeNav === "saved_workflows" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, overflow: "hidden" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: T.text }}>Saved Workflows</h2>
            <p style={{ color: T.secondary, fontSize: 14, margin: "0 0 20px" }}>Your saved templates and automations</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, overflowY: "auto" }}>
              {savedWorkflows.length === 0 ? (
                <div style={{ color: T.secondary, fontStyle: "italic", padding: 16 }}>No saved workflows yet. Start a chat and save a workflow to see it here!</div>
              ) : (
                savedWorkflows.map((wf: any) => (
                  <div key={wf.id} style={{
                    background: isDark ? "rgba(255,255,255,0.03)" : "#fff", border: `1px solid ${T.border}`, borderRadius: 12, padding: 16,
                    display: "flex", flexDirection: "column", gap: 12, boxShadow: T.shadow
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: T.text, fontSize: 15 }}>
                      <Bookmark size={16} color={T.accent} /> {wf.name}
                    </div>
                    <div style={{ fontSize: 12, color: T.secondary }}>Created: {new Date(wf.created_at).toLocaleString()}</div>
                    <button
                      onClick={() => {
                        setMessages([{ role: "assistant", text: "Workflow loaded and ready to execute.", dagData: wf.dagData, id: Date.now().toString() }]);
                        setActiveNav("dashboard");
                        setChatStarted(true);
                      }}
                      style={{
                        background: T.accent, color: "#000", border: "none", padding: "8px",
                        borderRadius: 6, fontWeight: 600, cursor: "pointer", marginTop: "auto", transition: "opacity 0.2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                    >
                      Use Template
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Scrollable messages or home screen */}
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
              {!chatStarted ? (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%",
                  padding: isMobile ? "0 16px" : "0 24px",
                  position: "relative", zIndex: 10
                }}>
                  <div style={{
                    fontSize: isMobile ? 22 : 32, fontWeight: 700, color: T.text, marginBottom: 12,
                    textAlign: "center", letterSpacing: "-0.5px",
                    lineHeight: 1.2,
                  }}>
                    Hii {clerkUser?.firstName || "User"} ,{" "}
                    <span style={{ color: T.accent }}>Groit AI</span> Here
                  </div>
                  <div style={{ color: T.secondary, fontSize: isMobile ? 14 : 16, textAlign: "center", maxWidth: 600 }}>
                    What workflow would you like to run today?
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: 960, margin: "0 auto", width: "100%", padding: isMobile ? "16px" : "24px", display: "flex", flexDirection: "column", gap: isMobile ? 20 : 32 }}>
                  <div style={{ fontSize: 12, color: T.secondary, fontWeight: 600, letterSpacing: 0.5, marginBottom: -8 }}>Today</div>
                  {messages.map((msg: any) => (
                    <ChatMessage key={msg.id} msg={msg} onEdit={handleEdit} onApprove={handleHITLApprove} onReject={handleHITLReject} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* ── FLOATING INPUT BOX ── */}
            <div style={{ padding: isMobile ? "0 10px 20px" : "0 24px 32px", zIndex: 20 }}>
              <div style={{ maxWidth: 780, margin: "0 auto" }}>
                {editingMsg && (
                  <div style={{ fontSize: 11, color: "#f0883e", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span><span className="flex items-center gap-1"><Edit2 size={12} /> Edit</span>ing message — response will regenerate from this point</span>
                    <button
                      onClick={() => { setEditingMsg(null); setInput(""); }}
                      style={{ background: "none", border: "none", color: T.secondary, cursor: "pointer", fontSize: 12 }}
                    ><X size={14} /> cancel</button>
                  </div>
                )}
                <div
                  className="laser-border-container"
                  style={{
                    display: "flex", alignItems: "flex-end", gap: 10,
                    "--laser-bg-color": isDark ? "rgba(18, 22, 28, 0.85)" : "rgba(255, 255, 255, 0.9)",
                    "--laser-color": isDark ? "hsl(142, 71%, 45%)" : T.accent,
                    padding: "10px 20px", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.3)" : "0 4px 30px rgba(0,0,0,0.1)",
                  } as React.CSSProperties}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = isDark ? "0 12px 40px rgba(0,0,0,0.4)" : "0 8px 40px rgba(0,0,0,0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = isDark ? "0 8px 30px rgba(0,0,0,0.3)" : "0 4px 30px rgba(0,0,0,0.1)"; }}
                  onFocus={(e) => { e.currentTarget.style.boxShadow = isDark ? "0 8px 30px rgba(0,0,0,0.3)" : "0 4px 30px rgba(0,0,0,0.1)"; }}
                  onBlur={(e) => { e.currentTarget.style.boxShadow = isDark ? "0 8px 30px rgba(0,0,0,0.3)" : "0 4px 30px rgba(0,0,0,0.1)"; }}>
                  <button
                    onClick={() => setShowToolkitModal(true)}
                    title="Toolkits & Integrations"
                    style={{
                      height: 34, padding: "0 10px", flexShrink: 0,
                      background: "transparent",
                      border: "none", cursor: "pointer",
                      color: T.secondary, fontSize: 13, fontWeight: 600, display: "flex",
                      alignItems: "center", justifyContent: "center", gap: 6,
                      transition: "all 0.15s", whiteSpace: "nowrap"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
                    onMouseLeave={e => { e.currentTarget.style.color = T.secondary; }}
                  >
                    <Plus size={16} strokeWidth={2.5} /> Toolkits
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
                    placeholder="Describe your workflow..."
                    data-gramm="false"
                    data-gramm_editor="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      color: T.text, fontSize: 14, lineHeight: "22.4px", resize: "none",
                      minHeight: 34, maxHeight: 200, fontFamily: "inherit", padding: "6px 4px",
                    }}
                    rows={1}
                  />
                  <button
                    onClick={handleMicClick}
                    title="Voice Typing"
                    style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0, marginRight: 8,
                      background: isListening ? "rgba(239, 68, 68, 0.2)" : "transparent",
                      border: "none", cursor: "pointer",
                      color: isListening ? "#ef4444" : T.secondary,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                      animation: isListening ? "pulse 1.5s infinite" : "none"
                    }}
                    onMouseEnter={e => { if (!isListening) e.currentTarget.style.color = T.text; }}
                    onMouseLeave={e => { if (!isListening) e.currentTarget.style.color = T.secondary; }}
                  >
                    <Mic size={18} />
                  </button>
                  {isLoading ? (
                    <button
                      onClick={() => abortControllerRef.current?.abort()}
                      title="Stop Execution"
                      style={{
                        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                        background: "#ef4444", border: "none", cursor: "pointer",
                        color: "#fff", fontSize: 16, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s",
                        boxShadow: "0 4px 12px rgba(239,68,68,0.4)"
                      }}
                    >
                      <Square size={14} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      style={{
                        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                        background: input.trim() && !isLoading ? T.accent : isDark ? "rgba(255,255,255,0.1)" : "#d1d5db",
                        border: "none", cursor: input.trim() && !isLoading ? "pointer" : "default",
                        color: input.trim() && !isLoading ? "#000" : T.secondary, fontSize: 16, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s",
                        boxShadow: input.trim() && !isLoading ? `0 4px 12px ${T.accent}40` : "none"
                      }}
                    >
                      <Send size={16} strokeWidth={2.5} style={{ marginLeft: 2 }} />
                    </button>
                  )}
                </div>
                <p style={{ textAlign: "center", fontSize: 11, color: T.secondary, marginTop: 12 }}>
                  Groit is AI and can make mistakes.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Right Panel Toggle Handle */}
      {isMobile && !rightPanelOpen && (
        <button
          onClick={() => setRightPanelOpen(true)}
          style={{
            position: "fixed", top: "50%", right: 0, transform: "translateY(-50%)",
            background: T.card, border: `1px solid ${T.border}`, borderRight: "none",
            borderRadius: "8px 0 0 8px", padding: "12px 4px", zIndex: 100,
            boxShadow: "-2px 0 12px rgba(0,0,0,0.15)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "2px"
          }}
        >
          <div style={{ width: 3, height: 20, borderRadius: 2, background: T.secondary }} />
          <div style={{ width: 3, height: 20, borderRadius: 2, background: T.secondary }} />
        </button>
      )}

      {/* Right panel backdrop on mobile */}
      {isMobile && rightPanelOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={() => setRightPanelOpen(false)}
        />
      )}

      {/* ── RIGHT PANEL (RAIL SYSTEM) ── */}
      <div 
        className={isMobile && rightPanelOpen ? "right-panel-mobile-overlay" : isMobile ? "right-panel-hide-mobile" : ""}
        style={{
        width: isMobile ? (rightPanelOpen ? 280 : 0) : (rightPanelOpen ? 280 : 60), flexShrink: 0, background: T.sidebar,
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
              Agentic Backend Online<br />
              <span style={{ fontSize: 10, opacity: 0.7 }}>Ready to process workflows</span>
            </p>

            {mergedApps.some((app: any) => app.connected) && (
              <div style={{ marginTop: "30px" }}>
                <div style={{ fontSize: 11, color: T.secondary, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 12 }}>
                  Connected Apps
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {mergedApps.filter((app: any) => app.connected).map((app: any) => (
                    <div 
                      key={app.slug} 
                      className="group"
                      style={{ 
                        display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.text, 
                        background: T.card, padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: isDark ? "#2ea043" : T.accent,
                        boxShadow: isDark ? "0 0 5px rgba(46,160,67,0.5)" : `0 0 5px ${T.accent}80`
                      }} />
                      <span style={{ fontWeight: 600 }}>{app.name}</span>
                      {!app.connected ? (
                        <span style={{ fontSize: 11, color: T.secondary, marginLeft: "auto" }}>Unlinked</span>
                      ) : (
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDisconnectComposio(app.slug)}
                          title="Disconnect"
                          style={{ marginLeft: "auto", background: "transparent", border: "none", color: T.secondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#f85149"}
                          onMouseLeave={e => e.currentTarget.style.color = T.secondary}
                        >
                          <X size={14} />
                        </button>
                      )}
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

      {/* Toolkit Modal Overlay */}
      {showToolkitModal && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }} onClick={() => setShowToolkitModal(false)}>
          <div style={{
            background: isDark ? "rgba(20, 25, 30, 0.85)" : "rgba(255, 255, 255, 0.9)", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, borderRadius: 16,
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            width: "90%", maxWidth: 900, maxHeight: "80vh", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)", overflow: "hidden"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>Available Toolkits</h3>
                <p style={{ fontSize: 13, color: T.secondary, margin: 0 }}>Connect your favorite apps to give Groit.AI access.</p>
              </div>
              <button
                onClick={() => setShowToolkitModal(false)}
                style={{ background: "transparent", border: "none", color: T.secondary, cursor: "pointer", display: "flex" }}
              ><X size={20} /></button>
            </div>

            <div className="toolkit-grid" style={{ flex: 1, overflowY: "auto", padding: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {COMPOSIO_TOOLS.map((tool: any) => {
                const isConnected = composioStatus.includes(tool.tool.toLowerCase());
                const connecting = isConnecting === tool.tool;
                return (
                  <div key={tool.tool} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb",
                    border: `1px solid ${isConnected ? T.accent : T.border}`, borderRadius: 12,
                    boxShadow: isConnected ? `0 0 0 1px ${T.accent}` : "none",
                    transition: "all 0.2s ease"
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = isConnected
                        ? `0 4px 12px ${T.accent}40, 0 0 0 1px ${T.accent}`
                        : "0 4px 12px rgba(0,0,0,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = isConnected ? `0 0 0 1px ${T.accent}` : "none";
                    }}>
                    <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 8, overflow: "hidden", background: "transparent", position: "relative" }}>
                      <img
                        src={tool.iconUrl || `https://icon.horse/icon/${tool.domain}`}
                        alt={tool.label}
                        style={{ width: "28px", height: "28px", objectFit: "contain", mixBlendMode: "normal" }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                      <div style={{ position: "absolute", inset: 0, display: "none", alignItems: "center", justifyContent: "center", fontWeight: 700, color: T.text, fontSize: 16 }}>
                        {tool.label.charAt(0)}
                      </div>
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{tool.label}</div>
                      <div style={{ fontSize: 11, color: T.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tool.description}</div>
                    </div>
                    <button
                      onClick={() => handleConnectComposio(tool.tool)}
                      disabled={isConnected || connecting}
                      title={isConnected ? "Connected" : "Connect"}
                      style={{
                        width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        borderRadius: "50%", cursor: (isConnected || connecting) ? "default" : "pointer",
                        background: isConnected ? "transparent" : (connecting ? T.muted : T.accent),
                        border: isConnected ? `1px solid ${T.accent}` : "none",
                        color: isConnected ? T.accent : (connecting ? T.secondary : "#000"),
                        transition: "all 0.2s"
                      }}
                    >
                      {connecting ? "..." : isConnected ? <Check size={16} /> : <Plus size={16} strokeWidth={2.5} />}
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "16px 24px", background: "rgba(0,0,0,0.2)", borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.secondary, textAlign: "center" }}>
              Secure integrations powered by Composio. Your data is encrypted and private.
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE POPUP MODAL ── */}
      {showProfileModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: isDark ? "rgba(13, 17, 23, 0.97)" : "rgba(255,255,255,0.97)",
              border: `1px solid ${T.border}`,
              borderRadius: 20, width: "100%", maxWidth: 420,
              boxShadow: isDark
                ? "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)"
                : "0 24px 64px rgba(0,0,0,0.15)",
              overflow: "hidden",
              animation: "fadeInUp 0.25s ease-out both"
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px 16px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Profile Settings</div>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{ background: "transparent", border: "none", color: T.secondary, cursor: "pointer", display: "flex", padding: 4, borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <X size={18} />
              </button>
            </div>

            {/* Avatar + Name */}
            <div style={{ padding: "28px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative" }}>
                {clerkUser?.imageUrl ? (
                  <img
                    src={clerkUser.imageUrl}
                    alt="Profile"
                    style={{
                      width: 80, height: 80, borderRadius: "50%",
                      border: `3px solid ${T.accent}`,
                      boxShadow: `0 0 20px ${T.accent}44`
                    }}
                  />
                ) : (
                  <div style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${T.accent}33, ${T.accent}88)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `3px solid ${T.accent}`,
                    boxShadow: `0 0 20px ${T.accent}44`,
                    fontSize: 28, fontWeight: 700, color: T.accent
                  }}>
                    {(clerkUser?.fullName || clerkUser?.firstName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Online indicator */}
                <div style={{
                  position: "absolute", bottom: 4, right: 4,
                  width: 14, height: 14, borderRadius: "50%",
                  background: "#4ade80",
                  border: `2px solid ${isDark ? "#0d1117" : "#fff"}`,
                  boxShadow: "0 0 8px rgba(74,222,128,0.6)"
                }} />
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                  {clerkUser?.fullName || clerkUser?.firstName || "Groit User"}
                </div>
                <div style={{ fontSize: 13, color: T.secondary }}>
                  {clerkUser?.primaryEmailAddress?.emailAddress || "user@groit.ai"}
                </div>
              </div>
            </div>

            {/* Info rows */}
            <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                background: isDark ? "rgba(255,255,255,0.03)" : "#f6f8fa",
                border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: 10
              }}>
                {[
                  { label: "Username", value: clerkUser?.username || "—" },
                  { label: "Role", value: (String(clerkUser?.publicMetadata?.role || "developer")).charAt(0).toUpperCase() + (String(clerkUser?.publicMetadata?.role || "developer")).slice(1) },
                  { label: "Member since", value: clerkUser?.createdAt ? new Date(clerkUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "—" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: T.secondary }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {profileSaveMsg && (
                <div style={{ fontSize: 12, color: "#4ade80", textAlign: "center", padding: "4px 0" }}>
                  {profileSaveMsg}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => {
                    clerk.openUserProfile();
                    setShowProfileModal(false);
                    setProfileSaveMsg('');
                  }}
                  style={{
                    flex: 1, padding: "10px 16px", borderRadius: 10,
                    background: T.accent, color: "#000",
                    border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "all 0.2s",
                    boxShadow: `0 4px 12px ${T.accent}40`
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <Pencil size={14} /> Edit Profile
                </button>
                <button
                  onClick={() => { logout(); navigate("/login"); }}
                  style={{
                    flex: 1, padding: "10px 16px", borderRadius: 10,
                    background: isDark ? "rgba(248,81,73,0.12)" : "#fff1f0",
                    color: "#f85149",
                    border: `1px solid ${isDark ? "rgba(248,81,73,0.25)" : "#fecaca"}`,
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(248,81,73,0.2)" : "#fee2e2"}
                  onMouseLeave={e => e.currentTarget.style.background = isDark ? "rgba(248,81,73,0.12)" : "#fff1f0"}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Voice Assistant Overlay ── */}
      {isListening && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.4)",
          backdropFilter: "blur(4px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
          padding: "60px 20px 40px", color: isDark ? "#fff" : "#000", animation: "fadeInUp 0.3s ease-out"
        }}>
          {/* Header */}
          <div style={{ fontSize: 16, fontWeight: 500, color: isDark ? "#a1a1aa" : "#71717a", letterSpacing: 0.5, textAlign: "center", maxWidth: "80vw" }}>
            Listening...
            {input && (
              <div style={{ marginTop: 12, fontSize: 18, color: isDark ? "#fff" : "#000", wordWrap: "break-word" }}>
                {input}
              </div>
            )}
          </div>

          {/* Central Animated Orb */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="voice-orb" />
          </div>

          {/* Bottom Controls */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", maxWidth: 320, padding: "0 20px", marginBottom: 20
          }}>
            <button
              onClick={handleMicClick}
              title="End Voice Recording"
              style={{
                width: 60, height: 60, borderRadius: "50%", background: isDark ? "#27272a" : "#f4f4f5", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.1)", transition: "transform 0.2s, background 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.background = isDark ? "#3f3f46" : "#e4e4e7"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = isDark ? "#27272a" : "#f4f4f5"; }}
            >
              <Mic size={24} color={isDark ? "#fff" : "#000"} />
            </button>
            
            <button
              onClick={() => {
                if (recognitionRef.current) recognitionRef.current.stop();
                setIsListening(false);
              }}
              title="Cancel"
              style={{
                width: 60, height: 60, borderRadius: "50%", background: isDark ? "#27272a" : "#f4f4f5", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.1)", transition: "transform 0.2s, background 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.background = isDark ? "#3f3f46" : "#e4e4e7"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = isDark ? "#27272a" : "#f4f4f5"; }}
            >
              <X size={24} color={isDark ? "#fff" : "#000"} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}