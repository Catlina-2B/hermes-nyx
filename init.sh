#!/bin/bash
# Hermes Desktop Companion — 开发环境恢复脚本
# 任何 AI agent 接手时运行此脚本恢复环境

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=== Hermes Desktop Companion — Environment Setup ==="

# 1. Python Backend
echo ""
echo "[1/4] Setting up Python backend..."
if [ ! -d "backend/.venv" ]; then
    echo "  Creating venv..."
    python3 -m venv backend/.venv
fi
source backend/.venv/bin/activate
pip install -q -r backend/requirements.txt
deactivate
echo "  ✓ Python backend ready"

# 2. Frontend
echo ""
echo "[2/4] Setting up frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm install
fi
echo "  Building frontend..."
npx vite build --quiet
cd "$ROOT"
echo "  ✓ Frontend ready (dist built)"

# 3. Electron (if exists)
echo ""
echo "[3/4] Setting up Electron..."
if [ -f "electron/package.json" ]; then
    cd electron
    if [ ! -d "node_modules" ]; then
        echo "  Installing Electron dependencies..."
        npm install
    fi
    cd "$ROOT"
    echo "  ✓ Electron ready"
else
    echo "  ⏭ Electron not yet scaffolded (F001)"
fi

# 4. Verify
echo ""
echo "[4/4] Verification..."
echo "  Git branch: $(git branch --show-current)"
echo "  Git status: $(git status --short | wc -l | tr -d ' ') modified files"
echo "  Last commit: $(git log --oneline -1)"

# Show feature status
echo ""
echo "=== Feature Status ==="
python3 -c "
import json
with open('features.json') as f:
    d = json.load(f)
done = 0
total = 0
for phase in d['phases']:
    print(f\"  {phase['name']}:\")
    for feat in phase['features']:
        total += 1
        status = '✅' if feat['passes'] else '❌'
        if feat['passes']:
            done += 1
        print(f\"    {status} {feat['id']}: {feat['name']}\")
print(f\"\n  Progress: {done}/{total} features complete\")
"

echo ""
echo "=== Ready! ==="
echo "  Read PROGRESS.md for current status and next steps."
echo "  To start dev servers: bash start.sh"
