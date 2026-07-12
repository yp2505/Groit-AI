import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ToolStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface ToolState {
  status: ToolStatus;
  token: string;
  errorMsg?: string;
  detail?: string;
  meta?: Record<string, string>;
}

export type ToolName = 'github' | 'jira' | 'slack' | 'sheets';

export interface ToolsContextType {
  tools: Record<ToolName, ToolState>;
  connect: (tool: ToolName, credentialsJson: string) => Promise<void>;
  reset: (tool: ToolName) => void;
  allConnected: boolean;
  refreshFromBackend: () => Promise<void>;
}

const DEFAULT: ToolState = { status: 'idle', token: '' };
const API_BASE = '/api';

const ToolsContext = createContext<ToolsContextType | null>(null);

// ─── Real Backend Verification ────────────────────────────────────────
// Each validator calls the backend /integrations/verify/{tool} endpoint.
// Credentials entered by the user (if any) are sent as the body.
// The backend ALWAYS falls back to .env values, so pre-configured tools
// will verify successfully even without user input.

async function callBackendVerify(
  tool: ToolName,
  extraBody: Record<string, string> = {},
): Promise<{ ok: boolean; detail: string; meta?: Record<string, string> }> {
  try {
    const res = await fetch(`${API_BASE}/integrations/verify/${tool}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extraBody),
    });
    if (!res.ok) {
      return { ok: false, detail: `Server error ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return {
      ok: data.ok === true,
      detail: data.detail ?? (data.ok ? 'Connected successfully' : 'Verification failed'),
      meta: data,
    };
  } catch (e) {
    return {
      ok: false,
      detail: `Cannot reach backend. Make sure the server is running on port 8000. (${String(e)})`,
    };
  }
}

async function validateGitHub(
  creds: Record<string, string>,
): Promise<{ ok: boolean; detail: string; meta?: Record<string, string> }> {
  const body: Record<string, string> = {};
  if (creds.password) body.token = creds.password;
  if (creds.username) body.username = creds.username;
  return callBackendVerify('github', body);
}

async function validateSlack(
  creds: Record<string, string>,
): Promise<{ ok: boolean; detail: string; meta?: Record<string, string> }> {
  const body: Record<string, string> = {};
  if (creds.token) body.token = creds.token;
  // Slack uses pre-configured bot token from .env — no user-provided token needed
  return callBackendVerify('slack', body);
}

async function validateJira(
  creds: Record<string, string>,
): Promise<{ ok: boolean; detail: string; meta?: Record<string, string> }> {
  const body: Record<string, string> = {};
  if (creds.domain)   body.base_url = creds.domain.startsWith('http') ? creds.domain : `https://${creds.domain}`;
  if (creds.email)    body.email    = creds.email;
  if (creds.password) body.token    = creds.password;
  return callBackendVerify('jira', body);
}

async function validateSheets(
  creds: Record<string, string>,
): Promise<{ ok: boolean; detail: string; meta?: Record<string, string> }> {
  const body: Record<string, string> = {};
  if (creds.sheet_id) body.sheet_id = creds.sheet_id;
  if (creds.token) body.token = creds.token;
  return callBackendVerify('sheets', body);
}

const VALIDATORS: Record<
  ToolName,
  (creds: Record<string, string>) => Promise<{ ok: boolean; detail: string; meta?: Record<string, string> }>
> = {
  github: validateGitHub,
  slack:  validateSlack,
  jira:   validateJira,
  sheets: validateSheets,
};

// ─── Provider ─────────────────────────────────────────────────────────

export const ToolsProvider = ({ children }: { children: ReactNode }) => {
  const [tools, setTools] = useState<Record<ToolName, ToolState>>({
    github: { ...DEFAULT },
    jira:   { ...DEFAULT },
    slack:  { ...DEFAULT },
    sheets: { ...DEFAULT },
  });

  // On mount: check which tools are pre-configured in the backend .env
  // and auto-verify them so the dashboard shows them as "connected" immediately.
  const refreshFromBackend = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/status`);
      if (!res.ok) return;
      const status = await res.json();

      // For each tool that's pre-configured, kick off a background verify
      const toolNames: ToolName[] = ['github', 'slack', 'jira', 'sheets'];
      await Promise.all(
        toolNames.map(async (tool) => {
          if (status[tool]?.configured) {
            // Mark as connecting first
            setTools((prev) => ({
              ...prev,
              [tool]: { status: 'connecting', token: 'env-configured' },
            }));
            const result = await callBackendVerify(tool, {});
            setTools((prev) => ({
              ...prev,
              [tool]: {
                status: result.ok ? 'connected' : 'error',
                token: 'env-configured',
                detail: result.detail,
                errorMsg: result.ok ? undefined : result.detail,
                meta: result.meta,
              },
            }));
          }
        }),
      );
    } catch {
      // Backend not reachable yet — silently ignore, user can connect manually
    }
  };

  useEffect(() => {
    refreshFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async (tool: ToolName, credentialsJson: string) => {
    setTools((p) => ({ ...p, [tool]: { status: 'connecting', token: credentialsJson } }));

    let creds: Record<string, string> = {};
    try { creds = JSON.parse(credentialsJson); } catch { creds = { token: credentialsJson }; }

    const result = await VALIDATORS[tool](creds);

    setTools((p) => ({
      ...p,
      [tool]: {
        status: result.ok ? 'connected' : 'error',
        token: credentialsJson,
        detail: result.detail,
        errorMsg: result.ok ? undefined : result.detail,
        meta: result.meta,
      },
    }));
  };

  const reset = (tool: ToolName) => {
    setTools((p) => ({ ...p, [tool]: { ...DEFAULT } }));
  };

  const allConnected = Object.values(tools).every((t) => t.status === 'connected');

  return (
    <ToolsContext.Provider value={{ tools, connect, reset, allConnected, refreshFromBackend }}>
      {children}
    </ToolsContext.Provider>
  );
};

export const useTools = () => {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error('useTools must be used within ToolsProvider');
  return ctx;
};
