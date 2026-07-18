import { createContext, useContext, useState, ReactNode } from 'react';

export type ToolStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface ToolState {
  status: ToolStatus;
  token: string;
  errorMsg?: string;
  detail?: string;
}

// ToolName now only used for Sidebar display status via Composio
export type ToolName = 'github' | 'jira' | 'slack' | 'sheets';

export interface ToolsContextType {
  tools: Record<ToolName, ToolState>;
  setToolConnected: (tool: ToolName) => void;
  setToolDisconnected: (tool: ToolName) => void;
  allConnected: boolean;
}

const DEFAULT: ToolState = { status: 'idle', token: '' };

const ToolsContext = createContext<ToolsContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────

export const ToolsProvider = ({ children }: { children: ReactNode }) => {
  const [tools, setTools] = useState<Record<ToolName, ToolState>>({
    github: { ...DEFAULT },
    jira:   { ...DEFAULT },
    slack:  { ...DEFAULT },
    sheets: { ...DEFAULT },
  });

  const setToolConnected = (tool: ToolName) => {
    setTools((p) => ({ ...p, [tool]: { status: 'connected', token: 'composio' } }));
  };

  const setToolDisconnected = (tool: ToolName) => {
    setTools((p) => ({ ...p, [tool]: { ...DEFAULT } }));
  };

  const allConnected = Object.values(tools).every((t) => t.status === 'connected');

  return (
    <ToolsContext.Provider value={{ tools, setToolConnected, setToolDisconnected, allConnected }}>
      {children}
    </ToolsContext.Provider>
  );
};

export const useTools = () => {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error('useTools must be used within ToolsProvider');
  return ctx;
};
