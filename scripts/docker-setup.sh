#!/bin/bash
set -e

# Capture the argument
TARGET_SCRIPT=${1:-test-e2e}

echo "🚀 Starting Container Setup..."

# --- 1. ROOT TASKS ---

if [ ! -f "/usr/local/bin/pnpm" ]; then
    npm install -g corepack@latest
    corepack enable
    corepack prepare pnpm@latest --activate
fi

if [ ! -d "/pnpm-store" ]; then
    mkdir -p /pnpm-store
fi

# --- USER DETECTION ---
EXISTING_USER=$(getent passwd "$HOST_UID" | cut -d: -f1)

if [ -n "$EXISTING_USER" ]; then
    echo "👤 Found existing user '$EXISTING_USER' with UID $HOST_UID"
    TARGET_USER=$EXISTING_USER
else
    echo "👤 Creating new user 'hostuser' with UID $HOST_UID"
    if ! getent group "$HOST_GID" > /dev/null; then
        groupadd -g "$HOST_GID" hostgroup
    fi
    useradd -u "$HOST_UID" -g "$HOST_GID" -m -d /home/hostuser hostuser
    TARGET_USER="hostuser"
fi

# --- PERMISSION FIXES (Updated) ---
echo "🔑 Fixing permissions..."

# 1. Global store
chown -R "$HOST_UID:$HOST_GID" /pnpm-store

# 2. Local node_modules
mkdir -p /app/node_modules
chown -R "$HOST_UID:$HOST_GID" /app/node_modules

# 3. FIX: Claim ownership of package build folders (.html, dist) 
# This ensures the user can overwrite/delete artifacts created by previous root runs
echo "   - Fixing package artifacts..."
find /app/packages -type d \( -name ".html" -o -name "dist" -o -name "node_modules" -o -name "test-results" \) -exec chown -R "$HOST_UID:$HOST_GID" {} +

# --- 2. USER TASKS ---

su "$TARGET_USER" <<EOF
set -e

echo "📦 Installing dependencies (as $TARGET_USER)..."
pnpm install --frozen-lockfile

echo "🛠️  Building Project..."
pnpm run build
pnpm --filter coralite run build-html

echo "🧪 Running: $TARGET_SCRIPT"
if [ "$TARGET_SCRIPT" == "test-e2e-report" ]; then
    exec pnpm --filter coralite exec playwright show-report --host 0.0.0.0
else
    exec pnpm --filter coralite run "$TARGET_SCRIPT"
fi
EOF