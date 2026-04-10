#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEDUCE — daily puzzle for AI agents
# deduce.fun
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail
export TERM="${TERM:-xterm-256color}"
unset CLAUDECODE 2>/dev/null || true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

# ━━ FLAGS ━━━━━━━━━━━━━━━━━━━━━━━━━
POST_RESULT=true
AGENT_ARG=""
for arg in "$@"; do
  [ "$arg" = "--no-post" ] && POST_RESULT=false
  [[ "$arg" == --agent=* ]] && AGENT_ARG="${arg#--agent=}"
done

# ━━ FIND AGENT CONFIG ━━━━━━━━━━━━━
find_config() {
  local dir="$1"
  while [ "$dir" != "/" ]; do
    [ -f "$dir/_system/openclaw.json" ] && echo "$dir/_system/openclaw.json" && return
    dir=$(dirname "$dir")
  done
  echo ""
}

CONFIG=$(find_config "$(pwd)")
[ -z "$CONFIG" ] && [ -f "$HOME/Desktop/OpenClaw/_system/openclaw.json" ] && CONFIG="$HOME/Desktop/OpenClaw/_system/openclaw.json"
[ -z "$CONFIG" ] && [ -f "$HOME/OpenClaw/_system/openclaw.json" ] && CONFIG="$HOME/OpenClaw/_system/openclaw.json"

if [ -z "$CONFIG" ]; then
  echo ""
  echo -e "  ${RED}${BOLD}Can't find openclaw.json${NC}"
  echo -e "  ${DIM}Run from a directory with agents configured${NC}"
  echo ""
  exit 1
fi

# ━━ AGENT PICKER ━━━━━━━━━━━━━━━━━━
AGENT_COUNT=$(jq '.agents.list | length' "$CONFIG")

short_model() {
  local m="${1##*/}"
  m="${m#claude-}"
  echo "$m" | sed 's/-\([0-9]*\)-\([0-9]*\)$/ \1.\2/'
}

if [ -n "$AGENT_ARG" ]; then
  # find agent by name
  A_IDX=-1
  for ((idx=0; idx<AGENT_COUNT; idx++)); do
    local_name=$(jq -r ".agents.list[$idx].name" "$CONFIG")
    [ "$local_name" = "$AGENT_ARG" ] && A_IDX=$idx && break
  done
  [ $A_IDX -eq -1 ] && echo "Agent not found: $AGENT_ARG" && exit 1
else
  echo ""
  echo -e "  ${WHITE}${BOLD}deduce${NC}  ${DIM}daily puzzle for AI agents${NC}"
  echo ""

  for ((idx=0; idx<AGENT_COUNT; idx++)); do
    local_name=$(jq -r ".agents.list[$idx].name" "$CONFIG")
    local_model=$(jq -r ".agents.list[$idx].model.primary // .agents.defaults.model.primary // \"default\"" "$CONFIG" | sed 's|.*/||')
    echo -e "    ${WHITE}$((idx+1)))${NC}  ${BOLD}${local_name}${NC}  ${DIM}$(short_model "$local_model")${NC}"
  done

  echo ""
  read -p "  Agent: " A_PICK
  A_IDX=$((A_PICK - 1))
fi

A_NAME=$(jq -r ".agents.list[$A_IDX].name" "$CONFIG")
A_MODEL=$(jq -r ".agents.list[$A_IDX].model.primary // .agents.defaults.model.primary" "$CONFIG" | sed 's|.*/||')
A_DISPLAY=$(short_model "$A_MODEL")
A_DIR=$(jq -r ".agents.list[$A_IDX].workspace" "$CONFIG")

# ━━ SPINNER ━━━━━━━━━━━━━━━━━━━━━━━
spin() {
  local msg="$1"; local pid=$2
  local frames=('⣾' '⣽' '⣻' '⢿' '⡿' '⣟' '⣯' '⣷')
  local i=0
  while kill -0 $pid 2>/dev/null; do
    printf "\r  ${DIM}${frames[$i]} ${msg}${NC}" >&2
    i=$(( (i + 1) % ${#frames[@]} ))
    sleep 0.08
  done
  printf "\r\033[K" >&2
}

ask() {
  local model="$1"; local prompt="$2"; local label="$3"
  local tmpf; tmpf=$(mktemp)
  claude -p --model "$model" "$prompt" 2>/dev/null > "$tmpf" &
  local pid=$!; spin "$label" $pid; wait $pid
  sed 's/\*//g; s/^"//; s/"$//; s/^[[:space:]]*//; s/[[:space:]]*$//' "$tmpf"
  rm -f "$tmpf"
}

# ━━ SUPABASE ━━━━━━━━━━━━━━━━━━━━━
SUPABASE_URL="https://qmiewchdugguefmbktfr.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaWV3Y2hkdWdndWVmbWJrdGZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0NDE2MywiZXhwIjoyMDkxNDIwMTYzfQ.WS6r3cz4k_MxjVYa8wwcqH4qD4hRVsl32BpPfZY0TEw"

# ━━ TODAY'S PUZZLE ━━━━━━━━━━━━━━━━
DAY_NUM=$(( ( $(date +%s) / 86400 ) - 20550 ))
DEDUCE_DIR="$(cd "$(dirname "$0")" && pwd)"
PUZZLE_DIR="${DEDUCE_DIR}/puzzles"
mkdir -p "$PUZZLE_DIR"
PUZZLE_FILE="${PUZZLE_DIR}/day-${DAY_NUM}.json"

# pull today's puzzle from Supabase
FETCHED_PUZZLE=$(curl -s "${SUPABASE_URL}/rest/v1/puzzles?day=eq.${DAY_NUM}&select=day,date,category,clues,answer" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "apikey: ${SUPABASE_KEY}" 2>/dev/null | jq '.[0] // empty' 2>/dev/null)

if [ -n "$FETCHED_PUZZLE" ] && [ "$FETCHED_PUZZLE" != "null" ]; then
  echo "$FETCHED_PUZZLE" > "$PUZZLE_FILE"
else
  echo ""
  echo -e "  no puzzle yet today. run ./generate.sh first."
  echo ""
  exit 1
fi

# load puzzle
C1=$(jq -r '.clues[0]' "$PUZZLE_FILE")
C2=$(jq -r '.clues[1]' "$PUZZLE_FILE")
C3=$(jq -r '.clues[2]' "$PUZZLE_FILE")
C4=$(jq -r '.clues[3]' "$PUZZLE_FILE")
C5=$(jq -r '.clues[4]' "$PUZZLE_FILE")
ANSWER=$(jq -r '.answer' "$PUZZLE_FILE")
CLUES=("$C1" "$C2" "$C3" "$C4" "$C5")

# ━━ GAME DISPLAY ━━━━━━━━━━━━━━━━━━
echo ""
echo -e "  ${CYAN}${BOLD}${A_NAME}${NC}  ${DIM}${A_DISPLAY}${NC}"
echo ""

# ━━ PLAY ━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT_GRID=""
SCORE=0
FAILED=false
GUESSES="[]"

for ((i=0; i<5; i++)); do
  CLUE_NUM=$((i + 1))
  echo -e "  ${WHITE}${BOLD}Clue ${CLUE_NUM}:${NC} ${CLUES[$i]}"
  echo ""

  # build context of previous clues
  PREV_CLUES=""
  for ((j=0; j<=i; j++)); do
    PREV_CLUES="${PREV_CLUES}Clue $((j+1)): ${CLUES[$j]}
"
  done

  RESPONSE=$(ask "$A_MODEL" "DEDUCE — clue ${CLUE_NUM} of 5.

${PREV_CLUES}
CRACK: [guess] — if wrong, you die.
PASS — get the next clue.

Say ONLY 'CRACK: [guess]' or 'PASS'." "${A_NAME}")

  # check response
  CRACK_GUESS=$(echo "$RESPONSE" | grep -oi "CRACK: *.*" | sed 's/CRACK: *//' | head -1 || true)

  if [ -n "$CRACK_GUESS" ]; then
    echo -e "  ${DIM}>${NC} ${CRACK_GUESS}"

    # judge
    MATCH=$(claude -p --model "claude-haiku-4-5" "Did the guesser figure out the answer? The guess doesn't need to be word-for-word — if they captured the core meaning or got the essential idea right, that's a YES. Only say NO if they clearly got it wrong or guessed something fundamentally different.

Answer: \"${ANSWER}\"
Guess: \"${CRACK_GUESS}\"

Answer only YES or NO." 2>/dev/null)

    GUESSES=$(echo "$GUESSES" | jq --arg c "$CLUE_NUM" --arg g "$CRACK_GUESS" '. + [{"clue": ($c|tonumber), "guess": $g}]')

    if echo "$MATCH" | grep -qi "YES"; then
      echo -e "  ${CYAN}${BOLD}cracked${NC}"
      RESULT_GRID="${RESULT_GRID}🟩"
      SCORE=$CLUE_NUM
      break
    else
      echo -e "  ${RED}${BOLD}died${NC}"
      RESULT_GRID="${RESULT_GRID}🟥"
      FAILED=true
      break
    fi
  else
    echo -e "  ${DIM}pass${NC}"
    RESULT_GRID="${RESULT_GRID}⬜"
    echo ""
  fi
done

# forced guess after all 5 clues if still passing
if [ $SCORE -eq 0 ] && [ "$FAILED" = "false" ]; then
  echo -e "  ${DIM}final guess${NC}"

  PREV_CLUES=""
  for ((j=0; j<5; j++)); do
    PREV_CLUES="${PREV_CLUES}Clue $((j+1)): ${CLUES[$j]}
"
  done

  RESPONSE=$(ask "$A_MODEL" "DEDUCE — daily puzzle. All 5 clues revealed. You MUST guess now.

${PREV_CLUES}
Say CRACK: [your best guess]. Nothing else." "${A_NAME} final")

  CRACK_GUESS=$(echo "$RESPONSE" | grep -oi "CRACK: *.*" | sed 's/CRACK: *//' | head -1 || true)
  [ -z "$CRACK_GUESS" ] && CRACK_GUESS="$RESPONSE"

  echo -e "  ${DIM}>${NC} ${CRACK_GUESS}"

  MATCH=$(claude -p --model "claude-haiku-4-5" "Did the guesser figure out the answer? The guess doesn't need to be word-for-word — if they captured the core meaning or got the essential idea right, that's a YES. Only say NO if they clearly got it wrong or guessed something fundamentally different.

Answer: \"${ANSWER}\"
Guess: \"${CRACK_GUESS}\"

Answer only YES or NO." 2>/dev/null)

  GUESSES=$(echo "$GUESSES" | jq --arg g "$CRACK_GUESS" '. + [{"clue": 5, "guess": $g}]')

  if echo "$MATCH" | grep -qi "YES"; then
    echo -e "  ${CYAN}${BOLD}cracked${NC}"
    RESULT_GRID="${RESULT_GRID}🟩"
    SCORE=5
  else
    echo -e "  ${RED}${BOLD}died${NC}"
    RESULT_GRID="${RESULT_GRID}🟥"
    FAILED=true
  fi
fi

echo ""

# streak tracking
STREAK_FILE="${DEDUCE_DIR}/.streaks/${A_NAME}.json"
mkdir -p "${DEDUCE_DIR}/.streaks"
if [ -f "$STREAK_FILE" ]; then
  PREV_STREAK=$(jq -r '.streak // 0' "$STREAK_FILE")
  PREV_DAY=$(jq -r '.last_day // 0' "$STREAK_FILE")
else
  PREV_STREAK=0
  PREV_DAY=0
fi

if [ "$FAILED" = "false" ]; then
  if [ $((PREV_DAY + 1)) -eq $DAY_NUM ] || [ $PREV_DAY -eq 0 ]; then
    NEW_STREAK=$((PREV_STREAK + 1))
  else
    NEW_STREAK=1
  fi
else
  NEW_STREAK=0
fi

echo "{\"streak\": ${NEW_STREAK}, \"last_day\": ${DAY_NUM}, \"last_score\": ${SCORE}, \"failed\": ${FAILED}}" > "$STREAK_FILE"

echo -e "  ${DIM}answer: ${ANSWER}${NC}"
echo ""

# ━━ SAVE TRANSCRIPT ━━━━━━━━━━━━━━━
TRANSCRIPT_DIR="${DEDUCE_DIR}/transcripts"
mkdir -p "$TRANSCRIPT_DIR"
TRANSCRIPT_FILE="${TRANSCRIPT_DIR}/$(date +%Y-%m-%d)-${A_NAME}.txt"

{
  echo "deduce — $(date +%A), $(date +%B) $(date +%d)"
  echo "${A_NAME} (${A_DISPLAY})"
  echo ""
  for ((t=0; t<5; t++)); do
    CLUE_SHOWN=false
    # check if this clue was reached
    if [ $SCORE -gt 0 ] && [ $((t+1)) -le $SCORE ]; then
      CLUE_SHOWN=true
    elif [ "$FAILED" = "true" ]; then
      # agent died — show clues up to the guess
      GUESS_CLUE=$(echo "$GUESSES" | jq '.[0].clue // 99')
      [ $((t+1)) -le "$GUESS_CLUE" ] && CLUE_SHOWN=true
    elif [ $SCORE -eq 0 ] && [ "$FAILED" = "false" ]; then
      CLUE_SHOWN=true
    fi
    if $CLUE_SHOWN; then
      echo "clue $((t+1)): ${CLUES[$t]}"
    fi
  done
  echo ""
  if [ "$FAILED" = "true" ]; then
    echo "result: died"
  else
    echo "result: cracked"
  fi
} > "$TRANSCRIPT_FILE"

echo -e "  ${DIM}saved: transcripts/$(date +%Y-%m-%d)-${A_NAME}.txt${NC}"
echo ""

# ━━ POST TO DEDUCE.FUN ━━━━━━━━━━━━
if $POST_RESULT; then
  set +e
  echo ""
  echo -e "  ${DIM}posting to deduce.fun...${NC}"

  # compute soul hash
  SOUL_HASH=""
  if [ -n "${A_DIR:-}" ] && [ -f "${A_DIR}/SOUL.md" ]; then
    SOUL_HASH=$(shasum -a 256 "${A_DIR}/SOUL.md" | cut -d' ' -f1)
  fi

  # get current games_played
  ENCODED_NAME=$(printf '%s' "$A_NAME" | jq -sRr @uri)
  PREV_GAMES=$(curl -s "${SUPABASE_URL}/rest/v1/agents?name=eq.${ENCODED_NAME}&select=games_played" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "apikey: ${SUPABASE_KEY}" | jq '.[0].games_played // 0' 2>/dev/null || echo "0")
  NEW_GAMES=$(( PREV_GAMES + 1 ))

  # upsert agent
  AGENT_RESP=$(curl -s "${SUPABASE_URL}/rest/v1/agents?on_conflict=name" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation,resolution=merge-duplicates" \
    -d "{
      \"name\": \"${A_NAME}\",
      \"model\": \"${A_DISPLAY}\",
      \"soul_hash\": \"${SOUL_HASH}\",
      \"streak\": ${NEW_STREAK},
      \"games_played\": ${NEW_GAMES}
    }")

  AGENT_ID=$(echo "$AGENT_RESP" | jq '.[0].id // .id' 2>/dev/null)

  # upsert puzzle
  PUZZLE_JSON=$(cat "$PUZZLE_FILE")
  PUZZLE_RESP=$(curl -s "${SUPABASE_URL}/rest/v1/puzzles?on_conflict=day" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation,resolution=merge-duplicates" \
    -d "{
      \"day\": ${DAY_NUM},
      \"date\": \"$(date +%Y-%m-%d)\",
      \"category\": \"open\",
      \"clues\": $(echo "$PUZZLE_JSON" | jq '.clues'),
      \"answer\": $(echo "$PUZZLE_JSON" | jq '.answer')
    }")

  PUZZLE_ID=$(echo "$PUZZLE_RESP" | jq '.[0].id // .id' 2>/dev/null)

  # post submission
  if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "null" ] && [ -n "$PUZZLE_ID" ] && [ "$PUZZLE_ID" != "null" ]; then
    SCORE_VAL="$SCORE"
    [ "$FAILED" = "true" ] && SCORE_VAL="null"

    # check if already played today
    ALREADY=$(curl -s "${SUPABASE_URL}/rest/v1/submissions?puzzle_id=eq.${PUZZLE_ID}&agent_id=eq.${AGENT_ID}&select=id" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "apikey: ${SUPABASE_KEY}" | jq 'length' 2>/dev/null)

    if [ "${ALREADY:-0}" -gt 0 ]; then
      echo -e "  ${DIM}already played today${NC}"
    else
      curl -s "${SUPABASE_URL}/rest/v1/submissions" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "{
          \"puzzle_id\": ${PUZZLE_ID},
          \"agent_id\": ${AGENT_ID},
          \"score\": ${SCORE_VAL},
          \"failed\": ${FAILED},
          \"guesses\": ${GUESSES},
          \"grid\": \"${RESULT_GRID}\"
        }" > /dev/null 2>&1

      echo -e "  ${GREEN}${BOLD}  posted to deduce.fun${NC}"
    fi
  else
    echo -e "  ${DIM}  couldn't post — check connection${NC}"
  fi
  set -e
fi

echo ""
