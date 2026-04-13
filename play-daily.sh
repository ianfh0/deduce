#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEDUCE — daily agent runner
# runs all registered agents against today's puzzle
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/ianhumes/.local/bin:$PATH"
export TZ=UTC
unset CLAUDECODE 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/$(date +%Y-%m-%d).log"

log() {
  echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "━━━ deduce daily run ━━━"

# wait for puzzle to be available (generation runs at 00:05 UTC)
# retry up to 10 times with 30s gaps
for i in $(seq 1 10); do
  RESP=$(curl -s --max-time 10 "https://deduce.fun/today" 2>/dev/null)
  BRIEFING=$(echo "$RESP" | jq -r '.briefing // empty' 2>/dev/null)
  if [ -n "$BRIEFING" ]; then
    log "puzzle ready: ${BRIEFING:0:60}..."
    break
  fi
  log "waiting for puzzle (attempt $i/10)..."
  sleep 30
done

if [ -z "${BRIEFING:-}" ]; then
  log "no puzzle available — aborting"
  exit 1
fi

# agents to run — add/remove as needed
# format: "name model soul_path"
AGENTS=(
  "Elo claude-opus-4-6 /Users/ianhumes/Desktop/OpenClaw/Elo/SOUL.md"
  "Ara claude-haiku-4-5 /Users/ianhumes/Desktop/OpenClaw/Ara/SOUL.md"
)

TOTAL=${#AGENTS[@]}
CRACKED=0
FAILED=0

for entry in "${AGENTS[@]}"; do
  read -r name model soul <<< "$entry"

  log "running ${name} (${model})..."

  # build flags
  FLAGS="--agent=${name} --model=${model}"
  if [ -f "$soul" ]; then
    FLAGS="${FLAGS} --soul=${soul}"
  fi

  # run deduce.sh (5 min max per agent via perl alarm)
  AGENT_LOG="${LOG_DIR}/$(date +%Y-%m-%d)-${name}.log"
  perl -e 'alarm 300; exec @ARGV' bash "${SCRIPT_DIR}/deduce.sh" ${FLAGS} > "$AGENT_LOG" 2>&1
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    # check if cracked from the log
    if grep -q "cracked" "$AGENT_LOG"; then
      log "  ${name}: CRACKED ✓"
      CRACKED=$((CRACKED + 1))
    elif grep -q "already played" "$AGENT_LOG"; then
      log "  ${name}: already played today"
    else
      log "  ${name}: FAILED ✗"
      FAILED=$((FAILED + 1))
    fi
  else
    log "  ${name}: error (exit ${EXIT_CODE})"
    FAILED=$((FAILED + 1))
  fi

  # small delay between agents
  sleep 5
done

log "━━━ results: ${CRACKED} cracked, ${FAILED} failed out of ${TOTAL} ━━━"
log ""
