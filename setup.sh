#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Defaults
DEFAULT_PORT=3000
DEFAULT_HOST="127.0.0.1"
DEFAULT_USER="admin"
DEFAULT_PASS=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  cat <<EOF
Space Agent Lite — Setup Script

Usage: ./setup.sh [options]

Options:
  --user <name>       Username (default: $DEFAULT_USER)
  --port <port>       Server port (default: $DEFAULT_PORT)
  --host <host>       Server host (default: $DEFAULT_HOST)
  --no-install        Skip npm install
  --no-start          Don't start the server after setup
  --start             Start the server after setup (default if user exists)
  -h, --help          Show this help

Environment:
  SPACE_INITIAL_PASSWORD  Password for initial user (preferred for non-interactive/CI use)
  SPACE_INITIAL_USER       Username for initial user (default: $DEFAULT_USER)

Examples:
  SPACE_INITIAL_PASSWORD=secret ./setup.sh --user alice
  ./setup.sh --user admin  # interactive password prompt
EOF
  exit 0
}

log() { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[setup]${NC} $*"; }
err() { echo -e "${RED}[setup]${NC} $*" >&2; }

# Parse args
USERNAME="${SPACE_INITIAL_USER:-$DEFAULT_USER}"
PASSWORD="$DEFAULT_PASS"
PORT="$DEFAULT_PORT"
HOST="$DEFAULT_HOST"
SKIP_INSTALL=false
SKIP_START=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) USERNAME="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    --no-install) SKIP_INSTALL=true; shift ;;
    --no-start) SKIP_START=true; shift ;;
    --start) SKIP_START=false; shift ;;
    -h|--help) usage ;;
    *) err "Unknown option: $1"; usage ;;
  esac
done

# Step 1: npm install
if [[ "$SKIP_INSTALL" == false ]]; then
  log "Installing dependencies..."
  npm install --omit=optional 2>&1 | tail -5
  log "Dependencies installed."
else
  warn "Skipping npm install (--no-install)"
fi

# Step 2: Create .env if it doesn't exist
if [[ ! -f .env ]]; then
  log "Creating .env with defaults..."
  cat > .env <<EOF
PORT=$PORT
HOST=$HOST
SINGLE_USER_APP=true
LOGIN_ALLOWED=true
EOF
  log ".env created."
else
  log ".env already exists, skipping."
fi

# Step 3: Resolve password — env var preferred, TTY prompt fallback
if [[ -n "$SPACE_INITIAL_PASSWORD" ]]; then
  PASSWORD="$SPACE_INITIAL_PASSWORD"
elif [[ -t 0 ]]; then
  log "Prompting for password (no --pass flag or SPACE_INITIAL_PASSWORD set)..."
  read -rsp "Enter password for '$USERNAME': " PASSWORD
  echo ""
else
  warn "No password configured. To create the initial user, either:"
  warn "  1. Set SPACE_INITIAL_PASSWORD env var: SPACE_INITIAL_PASSWORD=secret ./setup.sh"
  warn "  2. Run interactively: ./setup.sh (will prompt)"
  warn "Skipping user creation."
  PASSWORD=""
fi

# Step 3b: Create user if password is available
if [[ -n "$PASSWORD" ]]; then
  log "Creating user '$USERNAME'..."

  log "Creating user '$USERNAME'..."

  # Write password to a secure temp file to avoid passing it via command line.
  # This prevents the password from appearing in `ps aux` output.
  TMPPASS=$(mktemp)
  chmod 600 "$TMPPASS"
  printf '%s' "$PASSWORD" > "$TMPPASS"

  node --input-type=module < "$TMPPASS" \
    -e "
      import { readFileSync } from 'node:fs';
      import { createUser } from './server/lib/auth/user_manage.js';
      const password = readFileSync('/dev/stdin', 'utf8').trim();
      try {
        await createUser(import.meta.dirname, '$USERNAME', password);
        console.log('User created: $USERNAME');
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log('User already exists: $USERNAME');
        } else {
          console.error('Failed to create user:', e.message);
          process.exit(1);
        }
      }
    " 2>&1; RESULT=$?

  shred -u "$TMPPASS" 2>/dev/null || rm -f "$TMPPASS"

  if [[ $RESULT -ne 0 ]]; then
    err "User setup failed."
    exit 1
  fi

  log "User setup complete."
else
  warn "You can create a user later with: SPACE_INITIAL_PASSWORD=secret ./setup.sh --user <name>"
fi

# Step 4: Start server
if [[ "$SKIP_START" == false ]]; then
  log "Starting Space Agent Lite on http://$HOST:$PORT ..."
  log "Press Ctrl+C to stop."
  echo ""
  exec node space serve "PORT=$PORT" "HOST=$HOST"
else
  log "Setup complete. Start the server with:"
  log "  node space serve"
fi
