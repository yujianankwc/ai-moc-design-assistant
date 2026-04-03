#!/usr/bin/env bash

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
PM2_NAME="${PM2_NAME:-ai-moc-design-assistant}"
FORCE_SYNC=0
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000/}"
HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-10}"
HEALTHCHECK_INTERVAL_SECONDS="${HEALTHCHECK_INTERVAL_SECONDS:-3}"
HEALTHCHECK_TIMEOUT_SECONDS="${HEALTHCHECK_TIMEOUT_SECONDS:-15}"

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [--force-sync]

Options:
  --force-sync  Reset the server worktree to origin/main and remove untracked files,
                while keeping env.local, .env.local, and .env.local.bak.
  -h, --help    Show this help message.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --force-sync)
      FORCE_SYNC=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd npm
require_cmd node
require_cmd pm2
require_cmd curl

healthcheck() {
  curl -I -sS --max-time "$HEALTHCHECK_TIMEOUT_SECONDS" "$HEALTHCHECK_URL"
}

cd "$APP_DIR"

git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

echo "==> Fetching latest code from origin/$BRANCH"
git fetch origin "$BRANCH"

status_output="$(git status --porcelain)"
disallowed_changes=""

if [[ -n "$status_output" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    path="${line:3}"
    case "$path" in
      env.local|.env.local|.env.local.bak)
        ;;
      *)
        disallowed_changes+="$line"$'\n'
        ;;
    esac
  done <<< "$status_output"
fi

if [[ -n "$disallowed_changes" && "$FORCE_SYNC" -ne 1 ]]; then
  echo "Working tree is not clean. Review these changes first:" >&2
  printf '%s' "$disallowed_changes" >&2
  echo >&2
  echo "Re-run with ./deploy.sh --force-sync if you want to discard them." >&2
  exit 1
fi

if [[ "$FORCE_SYNC" -eq 1 ]]; then
  echo "==> Force syncing worktree to origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
  git clean -fd -e env.local -e .env.local -e .env.local.bak
else
  echo "==> Fast-forwarding local branch"
  git pull --ff-only origin "$BRANCH"
fi

echo "==> Installing dependencies"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "==> Building production bundle"
npm run build

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  echo "==> Restarting PM2 app: $PM2_NAME"
  pm2 restart "$PM2_NAME" --update-env
else
  echo "==> Starting PM2 app: $PM2_NAME"
  pm2 start npm --name "$PM2_NAME" -- start -- --port 3000
fi

echo "==> PM2 status"
pm2 show "$PM2_NAME" | sed -n '1,40p'

echo "==> Local health check"
healthcheck_output=""

for attempt in $(seq 1 "$HEALTHCHECK_ATTEMPTS"); do
  if healthcheck_output="$(healthcheck)"; then
    printf '%s\n' "$healthcheck_output" | head -n 5
    echo "==> Health check passed on attempt $attempt/$HEALTHCHECK_ATTEMPTS"
    echo "==> Done"
    echo "Deployed commit: $(git rev-parse --short HEAD)"
    exit 0
  fi

  echo "Health check attempt $attempt/$HEALTHCHECK_ATTEMPTS failed for $HEALTHCHECK_URL" >&2
  if [[ "$attempt" -lt "$HEALTHCHECK_ATTEMPTS" ]]; then
    sleep "$HEALTHCHECK_INTERVAL_SECONDS"
  fi
done

echo "Health check failed after $HEALTHCHECK_ATTEMPTS attempts." >&2
echo "Recent PM2 logs:" >&2
pm2 logs "$PM2_NAME" --lines 40 --nostream >&2 || true
exit 1
