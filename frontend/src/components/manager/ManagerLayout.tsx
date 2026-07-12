import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import ManagerSidebar from './ManagerSidebar';
import ManagerDashboardPanel from './ManagerDashboard';
import ManagerInputBar from './ManagerInputBar';
import ManagerRightPanel from './ManagerRightPanel';
import { useTools } from '@/context/ToolsContext';

// ── Suggested prompts for the welcome screen ─────────────────────────
const SUGGESTED_PROMPTS = [
  "Critical bug in Jira → create GitHub branch → notify #all-daiict on Slack",
  "Send a message to #all-daiict on Slack: 'System is live!'",
  "Fetch latest GitHub commits and post a summary to Slack #all-daiict",
  "Create Jira ticket → append row to Google Sheets → notify Slack #all-daiict",
];

export default function ManagerLayout() {
  const navigate = useNavigate();
  const { tools } = useTools();

  // ── Chat / workflow state ────────────────────────────────────────────
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [chatStarted, setChatStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Collect credentials from ToolsContext + localStorage ────────────
  const gatherCredentials = (): Record<string, any> => {
    const jiraToken = localStorage.getItem('jira_access_token');
    const jiraCloudId = localStorage.getItem('jira_cloud_id');
    const slackToken = localStorage.getItem('slack_access_token');
    const googleToken = localStorage.getItem('google_access_token');
    const googleSheetId = localStorage.getItem('google_sheets_id');

    const creds: Record<string, any> = {};
    if (jiraToken && jiraCloudId) creds.jira = { access_token: jiraToken, cloud_id: jiraCloudId };
    if (slackToken) creds.slack = { access_token: slackToken };
    if (googleToken) {
      creds.sheets = { access_token: googleToken, spreadsheet_id: googleSheetId };
      creds.google = { access_token: googleToken };
    }
    Object.entries(tools).forEach(([name, state]: [string, any]) => {
      if (state.status === 'connected' && state.token && !creds[name]) {
        try { creds[name] = JSON.parse(state.token); } catch { creds[name] = { token: state.token }; }
      }
    });
    return creds;
  };

  // ── Build a chat_history array fromMessages ───────────────────────
  const buildChatHistory = (extraUser?: string) => {
    const items = messages
      .filter(m => !m.isThinking && m.content)
      .map(m => ({ role: m.role, content: m.content }));
    if (extraUser) items.push({ role: 'user', content: extraUser });
    return items;
  };

  // ── Main send handler (mirrors developer side logic exactly) ───────
  const handleSend = async (text?: string) => {
    const content = (text || input).trim();
    if (!content) return;

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content }]);
    setInput('');
    setChatStarted(true);
    setIsLoading(true);

    const thinkingId = Date.now() + 1;
    setMessages(prev => [...prev, {
      id: thinkingId, role: 'assistant',
      thinking: '🧠 Generating execution plan via LLM…',
      content: '', isThinking: true,
    }]);

    try {
      const chatHistory = buildChatHistory(content);

      // ── Plan ────────────────────────────────────────────────────────
      const planRes = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: content, chat_history: chatHistory }),
      });

      if (!planRes.ok) {
        const errData = await planRes.json().catch(() => ({}));
        let errorMessage = 'Planning failed: ' + planRes.status;
        if (errData.detail) {
          errorMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        }
        throw new Error(errorMessage);
      }

      const planData = await planRes.json();

      // If LLM returned pure conversational text (no DAG)
      if (!planData.success || !planData.dag) {
        if (planData.raw_llm_output && !planData.raw_llm_output.includes('```json')) {
          setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
            ...m, isThinking: false, content: planData.raw_llm_output, thinking: undefined,
          } : m));
          setIsLoading(false);
          return;
        }
        throw new Error(planData.errors?.join(', ') || 'Failed to generate execution plan');
      }

      const dag = planData.dag;

      // ── HITL check ──────────────────────────────────────────────────
      const approvalNodes = (dag.nodes || []).filter((n: any) => n.requires_approval);
      if (approvalNodes.length > 0) {
        setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
          ...m,
          thinking: `⏸️ HITL — ${approvalNodes.length} step(s) require your approval before execution`,
          content: '', isThinking: false,
          hitlPending: true, hitlNodes: approvalNodes,
        } : m));
        setPendingApproval({ dag, thinkingId, userCredentials: gatherCredentials(), chatHistory });
        setIsLoading(false);
        return;
      }

      // ── Execute directly ────────────────────────────────────────────
      setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
        ...m, thinking: '✅ Plan ready — executing workflow…',
      } : m));

      await executeDag(dag, thinkingId, chatHistory);
    } catch (e: any) {
      console.error('Workflow Engine Error:', e);
      setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
        id: thinkingId, role: 'assistant',
        content: '⚠️ Integration Error: ' + (e.message || String(e)),
        isThinking: false,
      } : m));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Execute a DAG ──────────────────────────────────────────────────
  const executeDag = async (dag: any, thinkingId: number, chatHistory: any[]) => {
    const userCredentials = gatherCredentials();

    const execRes = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dag, auto_approve: true, dry_run: false,
        credentials: userCredentials, chat_history: chatHistory,
      }),
    });

    if (!execRes.ok) {
      const errData = await execRes.json().catch(() => ({}));
      throw new Error(errData.detail || 'Execution failed: ' + execRes.status);
    }

    const execData = await execRes.json();

    const dagData = {
      nodes: (execData.results || []).map((r: any) => ({
        id: r.node_id, tool: r.tool || 'generic',
        action: r.action || r.name, status: r.status, output: r.output,
      })),
    };
    const nodeDetails = (execData.results || []).map((r: any) => ({ ...r, output: r.output || {} }));
    const auditLogStrings: string[] = (execData.audit_log || []).map((log: any) => {
      if (log.event_type === 'tool_success') return `${log.tool || log.details?.tool} → ${log.action || log.details?.action} [success]`;
      if (log.event_type === 'tool_failure') return `${log.tool || log.details?.tool} → ${log.action || log.details?.action} [failed: ${log.details?.error || log.error}]`;
      return log.message || JSON.stringify(log);
    });
    const fallbackAudit = (execData.results || []).map((r: any) => `${r.tool} → ${r.action} [${r.status}]`);

    const allOk = execData.failed === 0 && execData.succeeded > 0;
    const summary = allOk
      ? `✅ All ${execData.total_nodes} step${execData.total_nodes !== 1 ? 's' : ''} executed on live platforms.`
      : `⚠️ Workflow done — ${execData.succeeded}/${execData.total_nodes} succeeded${execData.failed > 0 ? `, ${execData.failed} failed` : ''}.`;

    setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
      id: thinkingId, role: 'assistant',
      thinking: '', content: summary,
      dagData, nodeDetails,
      audit: auditLogStrings.length > 0 ? auditLogStrings : fallbackAudit,
      isThinking: false,
    } : m));
    setIsLoading(false);
  };

  // ── HITL Approve / Reject ──────────────────────────────────────────
  const handleHITLApprove = async () => {
    if (!pendingApproval) return;
    const { dag, thinkingId, chatHistory } = pendingApproval;
    setPendingApproval(null);
    setIsLoading(true);

    setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
      ...m,
      thinking: `✅ Approved — Dispatching ${dag.nodes?.length || 0} steps to live platforms…`,
      content: '', isThinking: true,
      hitlPending: false, hitlNodes: undefined,
    } : m));

    try {
      await executeDag(dag, thinkingId, chatHistory);
    } catch (e: any) {
      setMessages(prev => prev.map((m: any) => m.id === thinkingId ? {
        id: thinkingId, role: 'assistant',
        content: '⚠️ Integration Error: ' + (e.message || String(e)),
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
      thinking: '❌ Workflow rejected by user (HITL)',
      content: '🚫 Execution cancelled — no actions were performed.',
      isThinking: false, hitlPending: false, hitlNodes: undefined,
    } : m));
  };

  // ── Handle suggestion chip click ──────────────────────────────────
  const handleSuggestion = (text: string) => {
    setInput(text);
    setChatStarted(true);
  };

  // ── New Workflow (reset) ────────────────────────────────────────
  const handleNewWorkflow = () => {
    setMessages([]);
    setInput('');
    setChatStarted(false);
    setPendingApproval(null);
    setIsLoading(false);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        bgcolor: '#f5f5f5',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* A. Left Sidebar */}
      <ManagerSidebar onNewWorkflow={handleNewWorkflow} />

      {/* B. Main Center Panel + C. Bottom Input Bar */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <ManagerDashboardPanel
          messages={messages}
          chatStarted={chatStarted}
          isLoading={isLoading}
          bottomRef={bottomRef}
          suggestedPrompts={SUGGESTED_PROMPTS}
          onSuggestionClick={handleSuggestion}
          onApprove={handleHITLApprove}
          onReject={handleHITLReject}
        />
        <ManagerInputBar
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isLoading={isLoading}
        />
      </Box>

      {/* D. Right Slide Bar */}
      <ManagerRightPanel />
    </Box>
  );
}
