/* eslint-disable @typescript-eslint/no-explicit-any */
import { RefObject } from 'react';
import { Box, Typography } from '@mui/material';
import { CheckCircle2 as CheckCircleIcon, MessageSquare, Github, Kanban, BarChart, Settings, ExternalLink, ShieldAlert, XCircle } from 'lucide-react';

// ── Tool visual helpers (same as developer side) ─────────────────────
const TOOL_ICONS: Record<string, JSX.Element> = {
  slack: <MessageSquare size={16} />, github: <Github size={16} />, jira: <Kanban size={16} />, sheets: <BarChart size={16} />, generic: <Settings size={16} />,
};
const TOOL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  slack:   { bg: '#f5f3ff', border: '#7c3aed', text: '#6d28d9' },
  github:  { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  jira:    { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
  sheets:  { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' },
  generic: { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280' },
};

// ── Status badge ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; dot: string }> = {
    done:    { bg: '#f0fdf4', color: '#166534', dot: '#22c55e' },
    success: { bg: '#f0fdf4', color: '#166534', dot: '#22c55e' },
    failed:  { bg: '#fef2f2', color: '#991b1b', dot: '#ef4444' },
    running: { bg: '#eff6ff', color: '#1e40af', dot: '#3b82f6' },
    pending: { bg: '#f9fafb', color: '#6b7280', dot: '#9ca3af' },
    skipped: { bg: '#f9fafb', color: '#6b7280', dot: '#9ca3af' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: c.bg, color: c.color, fontSize: 11,
      padding: '2px 8px', borderRadius: 99, fontFamily: 'monospace',
      border: `1px solid ${c.dot}22`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
      {status}
    </span>
  );
}

// ── Thinking dots ────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
          animation: `mgr-pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.7,
        }} />
      ))}
      <style>{`@keyframes mgr-pulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
    </div>
  );
}

// ── DAG Node ─────────────────────────────────────────────────────────
function DAGNode({ label, sublabel, server, left, top, status, tool }: any) {
  const isSuccess = status === 'done' || status === 'success';
  const isFailed = status === 'failed';
  const tc = TOOL_COLORS[tool] || TOOL_COLORS.generic;
  return (
    <div style={{
      position: 'absolute', left, top,
      background: '#ffffff',
      border: `1.5px solid ${isSuccess ? tc.border : isFailed ? '#ef4444' : '#e5e7eb'}`,
      borderRadius: 12, padding: '10px 14px', width: 175, fontSize: 12, color: '#111827',
      boxShadow: isSuccess ? `0 2px 12px ${tc.border}22` : '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.4s',
    }}>
      <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {TOOL_ICONS[tool] || <Settings size={16} />} {server}
      </div>
      <div style={{ fontFamily: 'monospace', color: tc.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 8 }}>{sublabel}</div>
      <StatusBadge status={status} />
    </div>
  );
}

// ── Workflow Visualization ───────────────────────────────────────────
function WorkflowVisualization({ dagData, nodeDetails }: { dagData: any; nodeDetails: any[] }) {
  if (!dagData || !dagData.nodes || dagData.nodes.length === 0) return null;
  const NODE_W = 175; const NODE_H = 100; const GAP = 50;
  const nodes = dagData.nodes as any[];
  const canvasW = nodes.length * (NODE_W + GAP) - GAP;
  const canvasH = NODE_H + 24;

  const cleanAction = (str: string) => {
    if (!str) return 'Task';
    return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getOutputSummary = (nodeId: string) => {
    const d = nodeDetails?.find(d => d.node_id === nodeId);
    if (!d?.output) return null;
    const o = d.output;
    if (o.key || o.issue_id) return `Ticket created: ${o.key || o.issue_id}`;
    if (o.branch_name) return `Branch: ${o.branch_name}`;
    if (o.ts || o.channel) return 'Message sent';
    if (o.message_text) return o.message_text.slice(0, 60);
    if (o.summary) return o.summary.replace('Action', '').replace('completed successfully.', 'done').trim();
    return null;
  };

  return (
    <div style={{ marginTop: 16, marginBottom: 4 }}>
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ position: 'relative', width: canvasW, height: canvasH, minWidth: canvasW }}>
          <svg style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: 'none' }}>
            {nodes.slice(0, -1).map((_: any, i: number) => {
              const x1 = i * (NODE_W + GAP) + NODE_W;
              const x2 = (i + 1) * (NODE_W + GAP);
              const y = NODE_H / 2 + 12;
              return (
                <g key={i}>
                  <line x1={x1} y1={y} x2={x2 - 8} y2={y} stroke="#22c55e44" strokeWidth={2} strokeDasharray="4 3" />
                  <polygon points={`${x2},${y} ${x2 - 8},${y - 5} ${x2 - 8},${y + 5}`} fill="#22c55e44" />
                </g>
              );
            })}
          </svg>
          {nodes.map((n: any, i: number) => (
            <DAGNode
              key={n.id}
              left={i * (NODE_W + GAP)} top={12}
              label={cleanAction(n.action)}
              sublabel={`${n.tool} · ${n.action}`}
              server={`${n.tool?.toUpperCase()} SERVER`}
              status={n.status || 'pending'} tool={n.tool}
            />
          ))}
        </div>
      </div>

      {/* Live Platform Results */}
      {nodeDetails && nodeDetails.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 10 }}>
            Live Platform Results
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {nodeDetails.map((node: any, i: number) => {
              const isOk = node.status === 'success' || node.status === 'done';
              const isFailed = node.status === 'failed';
              const tc = TOOL_COLORS[node.tool] || TOOL_COLORS.generic;
              const summary = getOutputSummary(node.node_id);
              const links = Object.values(node.output || {}).filter((v: any) => typeof v === 'string' && v.startsWith('http')) as string[];
              return (
                <div key={i} style={{
                  background: '#ffffff', border: `1.5px solid ${isOk ? tc.border : isFailed ? '#ef4444' : '#e5e7eb'}`,
                  borderRadius: 12, padding: '12px 16px',
                  boxShadow: isOk ? `0 2px 10px ${tc.border}15` : '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{TOOL_ICONS[node.tool] || <Settings size={16} />}</span>
                      <div>
                        <span style={{ fontSize: 12, color: tc.text, fontWeight: 600 }}>{node.tool?.toUpperCase()}</span>
                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>· {node.action}</span>
                      </div>
                    </div>
                    <StatusBadge status={node.status || 'pending'} />
                  </div>
                  {summary && <div style={{ fontSize: 13, color: '#111827', marginBottom: links.length > 0 ? 8 : 0 }}>{summary}</div>}
                  {links.map((url, li) => (
                    <a key={li} href={url} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12, color: '#3b82f6', textDecoration: 'none',
                        border: '1px solid #3b82f622', borderRadius: 6,
                        padding: '3px 10px', marginTop: 4, background: '#eff6ff',
                      }}><span className="flex items-center gap-1"><ExternalLink size={14} /> Open live link</span></a>
                  ))}
                  {isFailed && node.error && (
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                      {node.error.length > 120 ? node.error.slice(0, 120) + '…' : node.error}
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

// ── Single Chat Message ──────────────────────────────────────────────
function ChatMessage({ msg, onApprove, onReject }: { msg: any; onApprove?: () => void; onReject?: () => void }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{
          background: '#22c55e', borderRadius: '18px 18px 4px 18px',
          padding: '10px 16px', color: '#ffffff', fontSize: 14, lineHeight: 1.6,
          maxWidth: '75%', boxShadow: '0 2px 8px rgba(34,197,94,0.2)',
        }}>{msg.content}</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#166534', fontWeight: 700, flexShrink: 0,
          border: '1px solid #22c55e',
        }}>G</div>
        <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>Griot AI</span>
      </div>

      <div style={{ paddingLeft: 38 }}>
        {/* Thinking status line */}
        {msg.thinking && (
          <div style={{
            color: '#6b7280', fontSize: 13, fontStyle: 'italic', marginBottom: 10,
            padding: '8px 14px', background: '#f9fafb',
            borderLeft: '3px solid #e5e7eb', borderRadius: '0 8px 8px 0',
          }}>{msg.thinking}</div>
        )}

        {/* HITL Approval Card */}
        {msg.hitlPending && msg.hitlNodes && (
          <div style={{
            background: '#fffbeb', border: '1px solid #f59e0b',
            borderRadius: 12, padding: 16, marginBottom: 12,
            boxShadow: '0 2px 8px rgba(245,158,11,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}><ShieldAlert size={18} /></span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#b45309', letterSpacing: 0.3 }}>
                HUMAN-IN-THE-LOOP APPROVAL REQUIRED
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>
              The following actions require your explicit approval before execution:
            </div>
            {msg.hitlNodes.map((n: any, i: number) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#fff7ed', border: '1px solid #fed7aa',
                borderRadius: 8, padding: '8px 12px', marginBottom: 6,
              }}>
                <span style={{ fontSize: 16 }}>{TOOL_ICONS[n.tool] || <Settings size={16} />}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2328', fontFamily: 'monospace' }}>{n.tool}.{n.action}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {Object.entries(n.params || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'No params'}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={onApprove} style={{
                flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8,
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 0 12px rgba(34,197,94,0.3)',
              }}><span className="flex items-center gap-2"><CheckCircleIcon size={16} /> Approve & Execute</span></button>
              <button onClick={onReject} style={{
                flex: 1, padding: '10px 16px', border: '1px solid #dc2626',
                borderRadius: 8, background: '#fef2f2',
                color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}><span className="flex items-center gap-2"><XCircle size={16} /> Reject</span></button>
            </div>
          </div>
        )}

        {/* Main content or spinner */}
        {msg.isThinking ? (
          <ThinkingDots />
        ) : (
          <>
            {/* Clean summary card for completed workflows */}
            {msg.dagData ? (() => {
              const nodes = msg.dagData?.nodes || [];
              const succeeded = nodes.filter((n: any) => n.status === 'done' || n.status === 'success').length;
              const failed = nodes.filter((n: any) => n.status === 'failed').length;
              const allOk = failed === 0 && succeeded > 0;
              return (
                <div style={{
                  background: allOk ? '#f0fdf4' : '#fef2f2',
                  border: `1.5px solid ${allOk ? '#22c55e' : '#ef4444'}`,
                  borderRadius: 14, padding: '16px 20px', marginBottom: 8,
                  boxShadow: `0 2px 12px ${allOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>{allOk ? <CheckCircleIcon size={24} /> : <XCircle size={24} />}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: allOk ? '#166534' : '#991b1b' }}>
                        {allOk ? 'Task Completed Successfully' : 'Task Failed'}
                      </div>
                      <div style={{ fontSize: 12, color: allOk ? '#15803d' : '#b91c1c', marginTop: 2 }}>
                        {succeeded} of {nodes.length} step{nodes.length !== 1 ? 's' : ''} completed
                        {failed > 0 ? ` · ${failed} failed` : ''}
                      </div>
                    </div>
                  </div>
                  {msg.content && (
                    <div style={{ fontSize: 13, color: allOk ? '#166534' : '#991b1b', lineHeight: 1.6 }}>
                      {msg.content}
                    </div>
                  )}
                </div>
              );
            })() : (
              /* Regular text content (conversational, errors, etc.) */
              msg.content && (
                <div style={{ color: '#111827', fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
                  {msg.content}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────
interface Props {
  messages: any[];
  chatStarted: boolean;
  isLoading: boolean;
  bottomRef: RefObject<HTMLDivElement>;
  suggestedPrompts: string[];
  onSuggestionClick: (text: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

// ── Main Component ───────────────────────────────────────────────────
export default function ManagerDashboardPanel({
  messages, chatStarted, isLoading, bottomRef,
  suggestedPrompts, onSuggestionClick, onApprove, onReject,
}: Props) {
  // ── Welcome screen (no chat yet) ──────────────────────────────────
  if (!chatStarted) {
    return (
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', px: 4, pb: 12,
      }}>
        {/* Green circular check icon */}
        <Box sx={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          mb: 3, boxShadow: '0 8px 32px rgba(34,197,94,0.25), 0 2px 8px rgba(34,197,94,0.15)',
          animation: 'pulse-glow 2.5s ease-in-out infinite',
          '@keyframes pulse-glow': {
            '0%, 100%': { boxShadow: '0 8px 32px rgba(34,197,94,0.25), 0 2px 8px rgba(34,197,94,0.15)' },
            '50%': { boxShadow: '0 8px 40px rgba(34,197,94,0.35), 0 2px 12px rgba(34,197,94,0.25)' },
          },
        }}>
          <CheckCircleIcon size={36} color="#ffffff" />
        </Box>

        <Typography variant="h4" sx={{
          fontWeight: 800, color: '#111827', letterSpacing: '-0.02em',
          mb: 1.5, fontSize: { xs: '1.6rem', md: '2rem' },
        }}>
          Griot AI Command Center
        </Typography>

        <Typography sx={{
          color: '#6b7280', fontSize: '0.95rem', fontWeight: 500,
          maxWidth: 420, lineHeight: 1.6, mb: 4,
        }}>
          Describe a task and the AI will route it to the right tools automatically.
        </Typography>

        {/* Suggestion chips */}
        <Box sx={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5,
          maxWidth: 640, width: '100%',
        }}>
          {suggestedPrompts.map((p, i) => (
            <Box
              key={i}
              onClick={() => onSuggestionClick(p)}
              sx={{
                background: '#ffffff', border: '1px solid #e5e7eb',
                borderRadius: '12px', padding: '12px 14px',
                cursor: 'pointer', color: '#374151', fontSize: '0.82rem',
                textAlign: 'left', lineHeight: 1.5,
                transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                '&:hover': {
                  borderColor: '#22c55e', transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(34,197,94,0.12)',
                },
              }}
            >
              {p}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // ── Chat messages view ────────────────────────────────────────────
  return (
    <Box sx={{ flex: 1, overflowY: 'auto', py: 3 }}>
      <Box sx={{ maxWidth: 780, mx: 'auto', px: 3 }}>
        {messages.map((msg: any) => (
          <ChatMessage key={msg.id} msg={msg} onApprove={onApprove} onReject={onReject} />
        ))}
        <div ref={bottomRef as any} />
      </Box>
    </Box>
  );
}
