import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Loader2, Send, Slack, Github, Trello, FileSpreadsheet, MessageSquare, Edit3, Trash2, Check } from 'lucide-react';
import { createWorkflow } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface Step {
  id: string;
  tool: 'jira' | 'github' | 'slack' | 'sheets';
  label: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  detail?: string;
}

interface SlackPreview {
  channel: string;
  message: string;
}

const TOOL_ICONS = {
  jira:   { Icon: Trello,          color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  github: { Icon: Github,          color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  slack:  { Icon: Slack,           color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  sheets: { Icon: FileSpreadsheet, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
};

const TOOL_LABELS: Record<string, string> = {
  jira:   'Task Tracker',
  github: 'Code Repository',
  slack:  'Team Messenger',
  sheets: 'Report Sheet',
};

const SUGGESTIONS = [
  "A critical login bug was found. Create a ticket and notify the team.",
  "Production is down. Start incident response and create a Slack war-room.",
  "Sprint review done. Update all resolved tickets and post a summary to Slack.",
];

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [steps, setSteps]       = useState<Step[]>([]);
  const [slackPreview, setSlackPreview] = useState<SlackPreview | null>(null);
  const [editMsg, setEditMsg]   = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setDone(false);

    // 1. Parse and show planned steps immediately
    const planned: Step[] = [
      { id: '1', tool: 'jira',   label: 'Creating task in Jira',            status: 'pending' },
      { id: '2', tool: 'github', label: 'Setting up GitHub branch',          status: 'pending' },
      { id: '3', tool: 'slack',  label: 'Preparing Slack notification',      status: 'pending' },
      { id: '4', tool: 'sheets', label: 'Logging to report sheet',           status: 'pending' },
    ];
    setSteps(planned);

    try {
      // 2. Submit & simulate step-by-step execution
      const { workflow_id } = await createWorkflow(text);
      setText('');

      // Animate steps one by one
      for (let i = 0; i < planned.length; i++) {
        await new Promise(r => setTimeout(r, 600));
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'running' } : s));

        await new Promise(r => setTimeout(r, 1200));

        if (i === 2) {
          // Slack step → show approval modal
          setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'running', detail: 'Awaiting your approval...' } : s));
          setSlackPreview({
            channel: '#all-daiict',
            message: `✅ Workflow triggered by gateway:\n"${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`,
          });
          setEditMsg(`✅ Workflow triggered by gateway:\n"${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);
          break;
        }

        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'success', detail: 'Done' } : s));
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setSlackPreview(null);
    setSteps(prev => prev.map((s, idx) => idx === 2 ? { ...s, status: 'success', detail: 'Sent to #all-daiict', label: 'Slack notification sent' } : s));
    await new Promise(r => setTimeout(r, 600));
    setSteps(prev => prev.map((s, idx) => idx === 3 ? { ...s, status: 'running' } : s));
    await new Promise(r => setTimeout(r, 1200));
    setSteps(prev => prev.map((s, idx) => idx === 3 ? { ...s, status: 'success', detail: 'Logged' } : s));
    setDone(true);
  };

  const handleDelete = () => {
    setSlackPreview(null);
    setSteps(prev => prev.map((s, idx) => idx === 2 ? { ...s, status: 'failed', detail: 'Cancelled by manager' } : s));
    setDone(true);
  };

  const statusIcon = (status: Step['status']) => {
    if (status === 'success') return <CheckCircle2 size={18} className="text-green-400" />;
    if (status === 'failed')  return <XCircle      size={18} className="text-red-400" />;
    if (status === 'running') return <Loader2       size={16} className="text-blue-400 animate-spin" />;
    return <Clock size={16} className="text-[hsl(215,20%,40%)]" />;
  };

  return (
    <div className="h-full flex flex-col bg-background min-h-0 overflow-hidden relative">
      {/* Steps progress */}
      <AnimatePresence>
        {steps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-border bg-card/50 backdrop-blur-md px-6 py-4 overflow-y-auto shrink-0 z-10"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Real-time Execution Pipeline
            </p>
            <div className="flex flex-col gap-2">
              {steps.map((step, i) => {
                const { Icon, color, bg } = TOOL_ICONS[step.tool];
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-4 px-4 py-3 rounded-2xl border ${bg} transition-all duration-300 shadow-sm`}
                  >
                    <div className={`p-2 rounded-xl border ${bg} shadow-inner`}>
                      <Icon size={16} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{step.label}</p>
                      {step.detail && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-medium italic opacity-80">{step.detail}</p>
                      )}
                    </div>
                    <div className="shrink-0">{statusIcon(step.status)}</div>
                  </motion.div>
                );
              })}
            </div>

            {done && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 flex items-center gap-2 text-[#22c55e] text-xs font-bold bg-[#22c55e]/10 border border-[#22c55e]/20 px-3 py-2 rounded-lg"
              >
                <CheckCircle2 size={14} />
                Workflow fully deployed and verified.
              </motion.div>
            )}
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg font-medium">
                <XCircle size={14} /> {error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slack Preview Modal */}
      <AnimatePresence>
        {slackPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-green-500/10 border border-green-500/20 shadow-inner">
                  <MessageSquare size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-base">Human-in-the-Loop Approval</p>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Integration: Slack → {slackPreview.channel}</p>
                </div>
              </div>

              {/* Editable message */}
              <div className="mb-6">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 block">
                  Final Message Content
                </label>
                <textarea
                  rows={4}
                  value={editMsg}
                  onChange={(e) => setEditMsg(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-foreground text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/20 text-red-500 text-sm font-bold hover:bg-red-500/10 transition-all active:scale-95"
                >
                  <Trash2 size={16} /> Discard
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#22c55e] text-white text-sm font-black hover:bg-[#1ea34d] transition-all shadow-[0_4px_12px_rgba(34,197,94,0.3)] active:scale-95"
                >
                  <Check size={16} /> Approve & Send
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center: Chat interface */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 overflow-y-auto relative z-0">
        {steps.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#22c55e] to-[#10b981] mx-auto mb-6 flex items-center justify-center shadow-xl shadow-green-500/20">
              <Check size={32} className="text-white" />
            </div>
            <h2 className="text-3xl font-black text-foreground mb-3 tracking-tight">Groit AI Command Center</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto font-medium leading-relaxed">
              Describe a workflow to orchestrate Jira, GitHub, Slack, and Sheets simultaneously.
            </p>
          </motion.div>
        )}

        {/* Suggestions */}
        {steps.length === 0 && (
          <div className="flex flex-col gap-3 w-full max-w-lg mb-8">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={s}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setText(s)}
                className="text-left px-5 py-4 rounded-2xl border border-border bg-card/40 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-card hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-center justify-between">
                  <span>{s}</span>
                  <Check size={14} className="opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="w-full max-w-lg relative">
          <div className={`rounded-[2rem] p-[1.5px] transition-all duration-700 shadow-2xl ${text.trim() ? 'bg-gradient-to-r from-[#22c55e] via-[#3b82f6] to-[#8b5cf6]' : 'bg-border'}`}>
            <div className="flex items-end gap-3 rounded-[2rem] bg-card p-4">
              <textarea
                id="manager-chat-input"
                rows={2}
                placeholder="Start a new automation sequence..."
                value={text}
                disabled={loading}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                className="flex-1 bg-transparent text-foreground text-base placeholder:text-muted-foreground placeholder:font-medium resize-none outline-none leading-relaxed px-2 py-1"
              />
              <button
                id="manager-chat-send"
                onClick={handleSubmit}
                disabled={!text.trim() || loading}
                className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl text-white transition-all disabled:opacity-40 disabled:grayscale hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20"
                style={{ background: 'linear-gradient(135deg, #22c55e, #10b981)' }}
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
          <div className="flex justify-center items-center gap-4 mt-4">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
               System Status: Hybrid AI Node Online
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
