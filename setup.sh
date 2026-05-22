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
  --pass <password>   Password (required on first run)
  --port <port>       Server port (default: $DEFAULT_PORT)
  --host <host>       Server host (default: $DEFAULT_HOST)
  --no-install        Skip npm install
  --no-start          Don't start the server after setup
  --start             Start the server after setup (default if user exists)
  -h, --help          Show this help

Examples:
  ./setup.sh --user alice --pass mypassword
  ./setup.sh --user admin --pass secret --port 8080 --host 0.0.0.0
  ./setup.sh --start   # just start the server
EOF
  exit 0
}

log() { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[setup]${NC} $*"; }
err() { echo -e "${RED}[setup]${NC} $*" >&2; }

# Parse args
USERNAME="$DEFAULT_USER"
PASSWORD="$DEFAULT_PASS"
PORT="$DEFAULT_PORT"
HOST="$DEFAULT_HOST"
SKIP_INSTALL=false
SKIP_START=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) USERNAME="$2"; shift 2 ;;
    --pass) PASSWORD="$2"; shift 2 ;;
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

# Step 3: Create user if password is provided
if [[ -n "$PASSWORD" ]]; then
  log "Creating user '$USERNAME'..."

  node -e "
    import('./server/lib/auth/user_manage.js')
      .then(async ({ createUser }) => {
        try {
          await createUser(import.meta.dirname, '$USERNAME', '$PASSWORD');
          console.log('User created: $USERNAME');
        } catch (e) {
          if (e.message.includes('already exists')) {
            console.log('User already exists: $USERNAME');
          } else {
            console.error('Failed to create user:', e.message);
            process.exit(1);
          }
        }
      })
      .catch(e => {
        console.error('Failed to load auth module:', e.message);
        process.exit(1);
      });
  " 2>&1

  log "User setup complete."
else
  warn "No --pass provided. You can create a user later with:"
  warn "  ./setup.sh --user <name> --pass <password>"
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
