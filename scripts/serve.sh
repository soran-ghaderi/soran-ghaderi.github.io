#!/usr/bin/env bash
#
# Dev server that ALSO restarts when _config.yml changes.
#
# Jekyll's --watch deliberately ignores _config.yml: site config is read once at
# boot, so editing _config.yml normally needs a manual stop/restart. This wrapper
# runs `jekyll serve --livereload` and watches _config.yml itself (mtime poll, no
# extra system deps). When it changes, it restarts Jekyll and nudges LiveReload so
# the open browser tab reloads with the new config.
#
# Usage:  scripts/serve.sh [extra jekyll serve args]
#         e.g. scripts/serve.sh --host 0.0.0.0 --port 4001 --drafts
#
# Stop with Ctrl-C (the Jekyll child is cleaned up on exit).

set -uo pipefail
cd "$(dirname "$0")/.."

# Activate rbenv if bundle/ruby aren't already on PATH (matches CLAUDE.md).
if ! command -v bundle >/dev/null 2>&1; then
  eval "$(rbenv init - bash)" 2>/dev/null || true
fi

CONFIG="_config.yml"
PORT=4000

# Don't pass --livereload twice if the caller already asked for it; and pick up a
# custom --port so the readiness probe targets the right port.
LR="--livereload"
prev=""
for a in "$@"; do
  [[ "$a" == "--livereload" || "$a" == "-l" ]] && LR=""
  [[ "$prev" == "--port" || "$prev" == "-P" ]] && PORT="$a"
  prev="$a"
done

JEKYLL_PID=""

start() {
  bundle exec jekyll serve $LR "$@" &
  JEKYLL_PID=$!
}

stop() {
  [[ -n "$JEKYLL_PID" ]] || return 0
  kill "$JEKYLL_PID" 2>/dev/null || true
  wait "$JEKYLL_PID" 2>/dev/null || true
  JEKYLL_PID=""
}

# Block until the dev server accepts connections (so the LiveReload nudge below
# lands on the new process, not the dying one).
wait_until_up() {
  for _ in $(seq 1 120); do
    (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && { exec 3>&- 3<&-; return 0; }
    sleep 0.5
  done
  return 1
}

mtime() { stat -c %Y "$CONFIG" 2>/dev/null || stat -f %m "$CONFIG"; }

cleanup() { stop; exit 0; }
trap cleanup INT TERM

echo "==> jekyll serve $LR (watching $CONFIG for restarts) — Ctrl-C to stop"
start "$@"
last="$(mtime)"

while true; do
  sleep 1
  # If Jekyll died on its own (e.g. a fatal config/build error), surface it.
  if [[ -n "$JEKYLL_PID" ]] && ! kill -0 "$JEKYLL_PID" 2>/dev/null; then
    echo "==> Jekyll exited; stopping wrapper."
    exit 1
  fi
  now="$(mtime)"
  if [[ "$now" != "$last" ]]; then
    last="$now"
    echo ""
    echo "==> $CONFIG changed — restarting Jekyll..."
    stop
    start "$@"
    # A fresh restart does a full rebuild but does NOT push a reload to already-
    # connected LiveReload clients. Touching a watched source file once the server
    # is back up triggers a regenerate, which pushes the reload to the browser.
    if [[ -n "$LR" ]] && wait_until_up; then
      touch index.md
    fi
  fi
done
