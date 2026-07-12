
import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';

const API_BASE = '/api'; // Proxied through Vite → localhost:8000

interface LogEntry {
  level: string;
  msg: string;
  time: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);

  // Poll backend for real workflow status and convert to logs
  useEffect(() => {
    let active = true;
    const seenMessages = new Set<string>();

    const pollLogs = async () => {
      while (active) {
        try {
          // Fetch all active workflows status to generate real logs
          const res = await fetch(`${API_BASE}/active-workflows`);
          if (res.ok) {
            const data = await res.json();
            setConnected(true);
            const now = new Date().toISOString().split('T')[1].slice(0, -1);
            
            if (data.workflows && Array.isArray(data.workflows)) {
              for (const wf of data.workflows) {
                for (const node of (wf.nodes || [])) {
                  const key = `${wf.workflow_id}-${node.id}-${node.status}`;
                  if (!seenMessages.has(key)) {
                    seenMessages.add(key);
                    
                    let level = 'INFO';
                    let msg = '';
                    
                    switch (node.status) {
                      case 'pending':
                        level = 'DEBUG';
                        msg = `[${wf.workflow_id}] Node "${node.title}" queued (${node.description})`;
                        break;
                      case 'running':
                        level = 'INFO';
                        msg = `[${wf.workflow_id}] Executing "${node.title}" → ${node.description}`;
                        break;
                      case 'success':
                        level = 'INFO';
                        msg = `[${wf.workflow_id}] ✅ "${node.title}" completed successfully`;
                        break;
                      case 'failed':
                        level = 'ERROR';
                        msg = `[${wf.workflow_id}] ❌ "${node.title}" FAILED`;
                        break;
                      case 'skipped':
                        level = 'WARN';
                        msg = `[${wf.workflow_id}] ⏭ "${node.title}" skipped (upstream failure)`;
                        break;
                      case 'waiting_approval':
                        level = 'WARN';
                        msg = `[${wf.workflow_id}] 🔒 "${node.title}" waiting for HITL approval`;
                        break;
                      default:
                        msg = `[${wf.workflow_id}] "${node.title}" status: ${node.status}`;
                    }

                    setLogs(prev => [...prev, { level, msg, time: now }]);
                  }
                }
              }
            }
          } else {
            setConnected(false);
          }
        } catch {
          setConnected(false);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    };

    pollLogs();
    return () => { active = false; };
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (level: string) => {
    switch (level) {
      case 'INFO': return 'text-cyan-400';
      case 'ERROR': return 'text-red-400';
      case 'DEBUG': return 'text-gray-400';
      case 'WARN': return 'text-yellow-400';
      case 'RETRY': return 'text-purple-400';
      default: return 'text-white';
    }
  };

  return (
    <Layout>
    <div className="flex flex-col h-full min-h-0 p-8 w-full max-w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-outfit font-bold tracking-tight text-white mb-2 flex items-center gap-3">
            <Terminal className="text-cyan-400" /> System Logs
          </h1>
          <p className="text-gray-400">Live orchestration execution logs from active workflows</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          </span>
          <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex-1 bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden relative shadow-2xl">
        <div className="bg-[#18181b] border-b border-[#27272a] px-4 py-3 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-gray-400 font-mono ml-2">tail -f /var/log/mcp-gateway.log</span>
          <span className="text-xs text-gray-500 ml-auto">{logs.length} entries</span>
        </div>
        
        <div 
          ref={scrollRef}
          className="p-4 overflow-y-auto h-[calc(100%-48px)] font-mono text-sm space-y-1.5"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500">Waiting for workflow logs... Run a workflow from the Dashboard to see live output here.</div>
          ) : (
            logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-4 hover:bg-[#18181b] px-2 py-1 rounded transition-colors"
              >
                <span className="text-gray-500 shrink-0 select-none">[{log.time}]</span>
                <span className={`font-semibold shrink-0 w-16 ${getLogColor(log.level)}`}>
                  [{log.level}]
                </span>
                <span className="text-gray-300 break-all">{log.msg}</span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
    </Layout>
  );
}
