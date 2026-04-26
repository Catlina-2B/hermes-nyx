#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# Colors
G='\033[0;32m' C='\033[0;36m' R='\033[0;31m' N='\033[0m'

cleanup() {
  echo -e "\n${C}[HERMES]${N} Shutting down..."
  kill $BE_PID $FE_PID 2>/dev/null
  wait $BE_PID $FE_PID 2>/dev/null
  echo -e "${G}[HERMES]${N} Done."
}
trap cleanup EXIT INT TERM

# ── Backend venv ──
if [ ! -d "$BACKEND/venv" ]; then
  echo -e "${C}[HERMES]${N} Creating backend venv..."
  python3 -m venv "$BACKEND/venv"
  "$BACKEND/venv/bin/pip" install -q -r "$BACKEND/requirements.txt"
fi

# ── Frontend node_modules ──
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo -e "${C}[HERMES]${N} Installing frontend dependencies..."
  (cd "$FRONTEND" && npm install --silent)
fi

# ── Load Hermes .env ──
if [ -f "$HOME/.hermes/.env" ]; then
  set -a
  source "$HOME/.hermes/.env"
  set +a
fi

# ── Start backend ──
echo -e "${G}[HERMES]${N} Starting backend on :8080 ..."
(cd "$BACKEND" && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8081 --log-level info) &
BE_PID=$!

# ── Start frontend ──
echo -e "${G}[HERMES]${N} Starting frontend on :5173 ..."
(cd "$FRONTEND" && npx vite --host 0.0.0.0 --port 5173) &
FE_PID=$!

echo -e "\n${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${G}  HERMES WebUI${N}"
echo -e "${C}  Frontend${N}  http://localhost:5173"
echo -e "${C}  Backend ${N}  http://localhost:8081"
echo -e "${C}  API Docs${N}  http://localhost:8081/docs"
echo -e "${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "  Ctrl+C to stop\n"

wait
