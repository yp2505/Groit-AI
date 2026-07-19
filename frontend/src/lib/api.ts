import type { WorkflowStatus } from './types';
import { getMockWorkflowStatus, resetSimulation } from './mockData';

// ─── Configuration ───────────────────────────────────────────────────────────
// In development: Vite proxy forwards /api → localhost:8000
// In production: VITE_API_URL env var OR hardcoded Railway backend URL
const PRODUCTION_BACKEND = 'https://groit-backend-production-e2cc.up.railway.app';
const IS_DEV = import.meta.env.DEV;
export const API_BASE = import.meta.env.VITE_API_URL || (IS_DEV ? '/api' : PRODUCTION_BACKEND);
export const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.host}`;
const USE_MOCK = false;

// ─── Retry Helper ─────────────────────────────────────────────────────────────
// Retries on network-level errors (e.g. backend still starting after restart).
// HTTP error codes (4xx/5xx) are NOT retried — only thrown TypeError/fetch failures.

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxAttempts = 5,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      // Only retry on network errors (TypeError), not logical HTTP errors
      if (!(err instanceof TypeError)) throw err;
      if (attempt < maxAttempts) {
        // Exponential backoff: 500ms, 1s, 2s, 4s
        const delay = Math.min(500 * 2 ** (attempt - 1), 4000);
        console.warn(`[api] Fetch attempt ${attempt} failed, retrying in ${delay}ms…`, url);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new Error(
    `Backend is unreachable after ${maxAttempts} attempts. Make sure the server is running on port 8000.`
  );
}

// In-memory status store to adapt synchronous backend to async polling frontend
const inMemoryStatus: Record<string, WorkflowStatus> = {};

export async function createWorkflow(
  input: string,
  credentials?: Record<string, any>
): Promise<{ workflow_id: string }> {
  let resolvedId = `wf-${Date.now()}`;

  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1500));
    resetSimulation(resolvedId);
  } else {
    // Set initial running state
    inMemoryStatus[resolvedId] = {
      workflow_id: resolvedId,
      title: input,
      nodes: [{ id: 'parser', title: 'Parsing Intention', status: 'running', tool: 'system' }],
      edges: []
    };

    // Execute the backend call asynchronously so we don't block the UI
    fetch(`${API_BASE}/v3/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_input: input })
    })
    .then(async res => {
      if (!res.ok) throw new Error(`Execution failed: ${res.statusText}`);
      const data = await res.json();
      
      const nodes = [];
      const edges = [];
      
      if (data.dag && data.dag.nodes) {
        data.dag.nodes.forEach((node: any) => {
          const result = data.execution?.results?.[node.id] || {};
          nodes.push({
            id: node.id,
            title: `${node.tool} - ${node.action}`,
            status: result.status === 'success' ? 'success' : (result.status === 'error' ? 'failed' : 'pending'),
            tool: node.tool.toLowerCase(),
            result: result.output ? JSON.stringify(result.output) : undefined,
            error: result.error
          });
          
          if (node.depends_on) {
            node.depends_on.forEach((dep: string) => {
              edges.push({ source: dep, target: node.id });
            });
          }
        });
      }
      
      inMemoryStatus[resolvedId] = {
        workflow_id: resolvedId,
        title: data.dag?.workflow_name || input,
        nodes,
        edges
      };
    })
    .catch(err => {
      inMemoryStatus[resolvedId].nodes = [{
        id: 'error',
        title: 'Execution Error',
        status: 'failed',
        tool: 'system',
        error: err.message
      }];
    });
  }

  const history = JSON.parse(localStorage.getItem('workflow_history') || '[]');
  history.unshift({ id: resolvedId, name: input.substring(0, 40) + '...', timestamp: Date.now() });
  localStorage.setItem('workflow_history', JSON.stringify(history));

  return { workflow_id: resolvedId };
}

export async function getWorkflowStatus(id: string): Promise<WorkflowStatus> {
  if (USE_MOCK) {
    return getMockWorkflowStatus(id);
  }

  if (inMemoryStatus[id]) {
    return inMemoryStatus[id];
  }
  
  throw new Error(`Workflow "${id}" not found in memory (server might have restarted)`);
}

export async function getActiveWorkflows(): Promise<WorkflowStatus[]> {
  return Object.values(inMemoryStatus).filter(wf => 
    wf.nodes.some(n => n.status === 'running' || n.status === 'pending')
  );
}

export async function approveNode(
  workflowId: string,
  nodeId: string,
  approved: boolean = true,
): Promise<{ success: boolean }> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    return { success: true };
  }

  const res = await fetchWithRetry(`${API_BASE}/execute/approve/${workflowId}/${nodeId}?approved=${approved}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to approve node: ${res.statusText}`);
  return res.json();
}

// ─── Composio Toolkit Connect ─────────────────────────────────────────────────

/**
 * Kicks off a Composio OAuth connect flow for the given toolkit + user.
 * Returns { ok, redirect_url } — frontend opens redirect_url in a new tab.
 *
 * Never throws on HTTP errors — always resolves with { ok: false, detail } so
 * callers get the real backend message instead of a raw "Internal Server Error".
 */
export async function connectComposioToolkit(
  toolkit: string,
  userId: string,
  extraFields: Record<string, string> = {},
) {
  try {
    const res = await fetchWithRetry(`${API_BASE}/integrations/composio/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolkit, user_id: userId, extra_fields: extraFields }),
    });
    // Always parse the JSON body — even on 4xx/5xx the backend returns a detail field
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        detail: data.detail || data.message || `Server error ${res.status}: ${res.statusText}`,
      };
    }
    return data;
  } catch (err) {
    // Network-level failure (backend down, DNS, etc.)
    return {
      ok: false,
      detail: 'Cannot reach the backend server. Is it running on port 8000?',
    };
  }
}


export async function disconnectComposioToolkit(
  toolkit: string,
  userId: string,
): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetchWithRetry(`${API_BASE}/integrations/composio/disconnect/${toolkit}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userId },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, detail: data.detail || `Server error ${res.status}` };
    }
    return data;
  } catch (err) {
    return { ok: false, detail: 'Network error or backend unreachable.' };
  }
}
