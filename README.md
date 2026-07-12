# 👾 Groit AI

### **Retro-Futuristic AI Agent Workspace & MCP Orchestrator**

**Groit AI** is a premium, retro-themed agentic workspace that enables you to execute complex multi-step workflows across your daily apps (GitHub, Slack, Jira, Gmail, Google Sheets, etc.) using natural language commands. 

Built with a highly responsive user interface and robust backend orchestration, Groit AI acts as your all-in-one terminal for managing external software context effortlessly.

---

## 🌟 Key Features

* **👾 Retro-Futuristic UI:** A pixel-art inspired terminal dashboard with neon styling, interactive sidebar, responsive chat flow, and dedicated voice control integration.
* **🧠 Decoupled Dual-LLM Planning:** 
  1. **Planner LLM:** Translates natural language requests into topological workflow plans (DAGs) using high-level abstractions.
  2. **Execution Router:** Scope-resolves planned steps to live integrations using real-time API schemas fetched from the gateway.
* **🧩 Universal Integration Hub:** Managed toolkit connections for over 15+ essential applications powered by **Composio** and the **Model Context Protocol (MCP)**.
* **⚡ Topology-Aware Executor:** Executes multiple independent actions in parallel, tracks execution states, and recovers with automated retry loops.
* **🔒 Human-in-the-Loop (HITL):** Built-in approval gates that pause execution and prompt the user for confirmation before carrying out high-risk actions (e.g., merging PRs, modifying production worksheets).
* **📡 Real-Time SSE Streams:** Full visibility into execution cycles via Server-Sent Events (SSE), providing live execution logs right in the dashboard.

---

## 📁 Repository Structure

```text
groit/
├── backend/                       # Python FastAPI Service
│   ├── main.py                    # Entry point & server configuration
│   ├── requirements.txt           # Backend dependencies
│   ├── .env.example               # Backend environment variables template
│   ├── routers/                   # API routes (execute, plan, integrations)
│   ├── services/                  # Business logic (LLM planning, execution engine)
│   │   └── integrations/          # Composio, Slack, Sheets, Jira integrations
│   └── prompts/                   # LLM system prompts
│
├── frontend/                      # React + Vite Client
│   ├── src/                       # Frontend source code
│   │   ├── components/            # UI components (Sidebar, DAGViewer, ToolCard)
│   │   ├── pages/                 # Views (Landing, LoginPage, ManagerDashboard)
│   │   └── hooks/                 # React custom hooks
│   ├── package.json               # Frontend dependencies
│   ├── vite.config.ts             # Vite build settings
│   └── .env.example               # Frontend environment variables template
```

---

## 🚀 Quick Start

### 1. Clone & Setup Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Edit the `backend/.env` with your API credentials:
```env
GROQ_API_KEY=gsk_your_groq_api_key
COMPOSIO_API_KEY=ak_your_composio_api_key
MONGODB_URI=your_mongodb_connection_string
```

Start the backend server:
```bash
python main.py
```

### 2. Setup Frontend

```bash
cd ../frontend
npm install
cp .env.example .env
```

Edit the `frontend/.env` with your Clerk credentials:
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
```

Start the local development server:
```bash
npm run dev
```

---

## 🛡️ License

Built for Groit Agentic Workspaces. All rights reserved.
