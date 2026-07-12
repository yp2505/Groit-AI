import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Github, Kanban, Clock, ExternalLink, GitCommit, Ticket, Package } from 'lucide-react';

interface ActivityItem {
  id: string;
  title: string;
  author?: string;
  status?: string;
  date: string;
  url: string;
}

interface IntegrationData {
  github: { items: ActivityItem[]; error?: string };
  jira: { items: ActivityItem[]; error?: string };
}

const API_BASE = '/api';

export default function IntegrationOverview() {
  const [data, setData] = useState<IntegrationData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/data`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Failed to fetch integration data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) return (
    <div className="flex flex-col gap-4 animate-pulse px-4">
      <div className="h-32 bg-secondary/50 rounded-2xl" />
      <div className="h-32 bg-secondary/50 rounded-2xl" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-4 max-w-4xl mx-auto w-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-2">
        <Package className="text-primary" size={20} />
        <h2 className="text-xl font-bold text-foreground">Integrated Activity</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GitHub Activity */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Github size={18} className="text-purple-400" />
              <span className="font-semibold text-sm">Latest Commits</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {data?.github.items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No GitHub activity found</p>
            ) : (
              data?.github.items.map(item => (
                <a 
                  key={item.id} 
                  href={item.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="group flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 hover:border-purple-500/30 transition-all"
                >
                  <GitCommit size={14} className="mt-1 text-purple-400/60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground line-clamp-1 group-hover:text-purple-400 transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{item.author}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">{item.id}</span>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </motion.div>

        {/* Jira Activity */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Kanban size={18} className="text-blue-400" />
              <span className="font-semibold text-sm">Latest Issues</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {data?.jira.items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No Jira issues found</p>
            ) : (
              data?.jira.items.map(item => (
                <a 
                  key={item.id} 
                  href={item.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="group flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 hover:border-blue-500/30 transition-all"
                >
                  <Ticket size={14} className="mt-1 text-blue-400/60" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-blue-400">{item.id}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        item.status?.toLowerCase() === 'done' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground line-clamp-1 group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
