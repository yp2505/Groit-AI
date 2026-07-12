#!/usr/bin/env bash
# start.sh — Cleanly start both servers, killing any stale processes first.
# Usage: bash start.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8000
FRONTEND_PORT=8080

# ── Kill stale processes on port 8000 ────────────────────────────────────────
echo "🔍 Checking for stale processes on port $BACKEND_PORT..."
PIDS=$(lsof -ti tcp:$BACKEND_PORT 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "⚡ Killing stale PID(s): $PIDS"
  echo "$PIDS" | xargs kill -9
  sleep 1
fi

# ── Kill stale processes on port 8080 ────────────────────────────────────────
echo "🔍 Checking for stale processes on port $FRONTEND_PORT..."
FPIDS=$(lsof -ti tcp:$FRONTEND_PORT 2>/dev/null || true)
if [ -n "$FPIDS" ]; then
  echo "⚡ Killing stale PID(s): $FPIDS"
  echo "$FPIDS" | xargs kill -9
  sleep 1
fi

# ── Activate venv ─────────────────────────────────────────────────────────────
VENV="$PROJECT_ROOT/.venv/bin/activate"
if [ -f "$VENV" ]; then
  source "$VENV"
else
  echo "⚠️  No .venv found at $PROJECT_ROOT/.venv — using system Python"
fi

# ── Start backend ─────────────────────────────────────────────────────────────
echo ""
echo "🚀 Starting backend on http://localhost:$BACKEND_PORT ..."
cd "$PROJECT_ROOT/backend"
python main.py > backend.log 2>&1 &
BACKEND_PID=$!

# ── Wait for backend to be healthy ───────────────────────────────────────────
echo "⏳ Waiting for backend to be ready..."
MAX_WAIT=30
ELAPSED=0
until curl -sf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "❌ Backend did not start within ${MAX_WAIT}s. Check for errors above."
    kill $BACKEND_PID 2>/dev/null
    exit 1
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done
echo "✅ Backend is healthy!"

# ── Start frontend ────────────────────────────────────────────────────────────
echo ""
echo "🎨 Starting frontend on http://localhost:$FRONTEND_PORT ..."
cd "$PROJECT_ROOT/frontend"
export PATH="$PATH:/opt/homebrew/bin"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Both servers are running!"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Press Ctrl+C to stop both."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Keep script alive; kill both on Ctrl+C
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
