export type NodeStatus = 'pending' | 'running' | 'done' | 'success' | 'skipped' | 'failed' | 'waiting_approval';

export type MCPTool = 'jira' | 'github' | 'slack' | 'sheets' | 'discord' | 'aws' | 'trello' | 'airtable' | 'generic' | 'system';

export interface WorkflowNode {
  id: string;
  title: string;
  description?: string;
  status: NodeStatus;
  tool?: MCPTool;
  timestamp?: string;
  duration?: string;
  result?: string;
  error?: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
}

export interface WorkflowEdge {
  source: string;
  target: string;
}

export interface WorkflowStatus {
  workflow_id: string;
  title?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface AuditEntry {
  node_id: string;
  title: string;
  status: NodeStatus;
  timestamp: string;
  duration?: string;
  tool?: MCPTool;
}
