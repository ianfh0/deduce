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
POST_RESULT=false
AGENT_ARG=""
for arg in "$@"; do
  [ "$arg" = "--post" ] && POST_RESULT=true
  [[ "$arg" == --agent=* ]] && AGENT_ARG="${arg#--agent=}"
done

# ━━ FIND OPENCLAW CONFIG ━━━━━━━━━━
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
  echo -e "  ${DIM}Run from your OpenClaw directory${NC}"
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
  echo -e "  ${WHITE}${BOLD}┌─────────────────────────────┐${NC}"
  echo -e "  ${WHITE}${BOLD}│       🔍 DEDUCE             │${NC}"
  echo -e "  ${WHITE}${BOLD}│  daily puzzle for AI agents │${NC}"
  echo -e "  ${WHITE}${BOLD}└─────────────────────────────┘${NC}"
  echo ""
  echo -e "  ${WHITE}${BOLD}Pick Your Agent${NC}"
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

# ━━ TODAY'S PUZZLE ━━━━━━━━━━━━━━━━
DAY_NUM=$(( ( $(date +%s) / 86400 ) - 20550 ))
DAY_OF_WEEK=$(date +%u)

# category based on day of week
case $DAY_OF_WEEK in
  1) CATEGORY="a secret — something someone did or is hiding" ;;
  2) CATEGORY="a person — historical or well-known" ;;
  3) CATEGORY="a place — real location" ;;
  4) CATEGORY="an event — something that happened" ;;
  5) CATEGORY="a concept or idea" ;;
  6) CATEGORY="twist — one of the five clues is a lie" ;;
  7) CATEGORY="hard mode — clues are extra vague" ;;
esac

# check if today's puzzle already exists locally
DEDUCE_DIR="$(cd "$(dirname "$0")" && pwd)"
PUZZLE_DIR="${DEDUCE_DIR}/puzzles"
mkdir -p "$PUZZLE_DIR"
PUZZLE_FILE="${PUZZLE_DIR}/day-${DAY_NUM}.json"

if [ ! -f "$PUZZLE_FILE" ]; then
  # generate today's puzzle
  PUZZLE_RAW=$(claude -p --model "claude-haiku-4-5" "You are the puzzle master for Deduce, a daily puzzle game for AI agents.

Generate today's puzzle. Category: ${CATEGORY}

RULES:
- The answer is a specific thing: 2-8 words, clear, verifiable
- CLUE1: extremely vague, could apply to hundreds of things
- CLUE2: slightly narrows but still very broad
- CLUE3: sharp agents start forming theories here
- CLUE4: most agents should be close after this
- CLUE5: obvious if you've been paying attention
- Each clue builds on the last — they tell a story
- No clue should repeat information from a previous clue
- Plain language, no poetry

Format EXACTLY (no other text):
CLUE1: [clue]
CLUE2: [clue]
CLUE3: [clue]
CLUE4: [clue]
CLUE5: [clue]
ANSWER: [2-8 word answer]" 2>/dev/null)

  C1=$(echo "$PUZZLE_RAW" | grep "CLUE1:" | sed 's/CLUE1: *//')
  C2=$(echo "$PUZZLE_RAW" | grep "CLUE2:" | sed 's/CLUE2: *//')
  C3=$(echo "$PUZZLE_RAW" | grep "CLUE3:" | sed 's/CLUE3: *//')
  C4=$(echo "$PUZZLE_RAW" | grep "CLUE4:" | sed 's/CLUE4: *//')
  C5=$(echo "$PUZZLE_RAW" | grep "CLUE5:" | sed 's/CLUE5: *//')
  ANSWER=$(echo "$PUZZLE_RAW" | grep "ANSWER:" | sed 's/ANSWER: *//')

  # fallbacks
  [ -z "$C1" ] && C1="Something changed" && C2="It affected many people" && C3="It happened indoors" && C4="Important documents were involved" && C5="The signature changed history" && ANSWER="Signing of the Declaration of Independence"

  # save puzzle
  cat > "$PUZZLE_FILE" <<PEOF
{
  "day": ${DAY_NUM},
  "date": "$(date +%Y-%m-%d)",
  "category": "${CATEGORY}",
  "clues": [
    $(echo "$C1" | jq -R .),
    $(echo "$C2" | jq -R .),
    $(echo "$C3" | jq -R .),
    $(echo "$C4" | jq -R .),
    $(echo "$C5" | jq -R .)
  ],
  "answer": $(echo "$ANSWER" | jq -R .)
}
PEOF
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
echo -e "  ${WHITE}${BOLD}🔍 DEDUCE — Day ${DAY_NUM}${NC}"
echo -e "  ${DIM}$(date +%A), $(date +%B) $(date +%d)${NC}"
echo ""
echo -e "  ${CYAN}${BOLD}${A_NAME}${NC}  ${DIM}${A_DISPLAY}${NC}"
echo ""
echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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

  RESPONSE=$(ask "$A_MODEL" "DEDUCE — daily puzzle game for AI agents.

You are ${A_NAME}. You're trying to figure out the answer from progressive clues.

${PREV_CLUES}
After reading the clues, you must either:
- Say CRACK: [your guess] if you think you know the answer
- Say PASS if you want to wait for more clues

You have $((5 - i)) clues remaining (including this one).

RULES:
- If you CRACK and you're wrong, you're OUT. Game over.
- If you PASS, you get the next clue but your score is worse.
- Lower score (fewer clues needed) is better.
- Only CRACK when you're reasonably confident.
- Say ONLY 'CRACK: [guess]' or 'PASS'. Nothing else." "${A_NAME}")

  # check response
  CRACK_GUESS=$(echo "$RESPONSE" | grep -oi "CRACK: *.*" | sed 's/CRACK: *//' | head -1 || true)

  if [ -n "$CRACK_GUESS" ]; then
    echo -e "  ${CYAN}${A_NAME}${NC}  CRACK: ${CRACK_GUESS}"
    echo ""

    # judge
    MATCH=$(claude -p --model "claude-haiku-4-5" "Did the guesser figure out the answer? The guess doesn't need to be word-for-word — if they captured the core meaning or got the essential idea right, that's a YES. Only say NO if they clearly got it wrong or guessed something fundamentally different.

Answer: \"${ANSWER}\"
Guess: \"${CRACK_GUESS}\"

Answer only YES or NO." 2>/dev/null)

    GUESSES=$(echo "$GUESSES" | jq --arg c "$CLUE_NUM" --arg g "$CRACK_GUESS" '. + [{"clue": ($c|tonumber), "guess": $g}]')

    if echo "$MATCH" | grep -qi "YES"; then
      echo -e "  ${GREEN}${BOLD}  🔓 CRACKED at clue ${CLUE_NUM}${NC}"
      RESULT_GRID="${RESULT_GRID}🟩"
      SCORE=$CLUE_NUM
      break
    else
      echo -e "  ${RED}${BOLD}  💀 WRONG${NC}"
      RESULT_GRID="${RESULT_GRID}🟥"
      FAILED=true
      break
    fi
  else
    echo -e "  ${DIM}  ${A_NAME}: PASS${NC}"
    RESULT_GRID="${RESULT_GRID}⬜"
    echo ""
  fi
done

# forced guess after all 5 clues if still passing
if [ $SCORE -eq 0 ] && [ "$FAILED" = "false" ]; then
  echo -e "  ${YELLOW}${BOLD}  Final guess — no more clues${NC}"
  echo ""

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

  echo -e "  ${CYAN}${A_NAME}${NC}  CRACK: ${CRACK_GUESS}"
  echo ""

  MATCH=$(claude -p --model "claude-haiku-4-5" "Did the guesser figure out the answer? The guess doesn't need to be word-for-word — if they captured the core meaning or got the essential idea right, that's a YES. Only say NO if they clearly got it wrong or guessed something fundamentally different.

Answer: \"${ANSWER}\"
Guess: \"${CRACK_GUESS}\"

Answer only YES or NO." 2>/dev/null)

  GUESSES=$(echo "$GUESSES" | jq --arg g "$CRACK_GUESS" '. + [{"clue": 5, "guess": $g}]')

  if echo "$MATCH" | grep -qi "YES"; then
    echo -e "  ${GREEN}${BOLD}  🔓 CRACKED at clue 5${NC}"
    RESULT_GRID="${RESULT_GRID}🟩"
    SCORE=5
  else
    echo -e "  ${RED}${BOLD}  💀 FAILED${NC}"
    RESULT_GRID="${RESULT_GRID}🟥"
    FAILED=true
  fi
fi

# ━━ RESULT ━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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

if [ "$FAILED" = "true" ]; then
  echo -e "  ${A_NAME}  ${RESULT_GRID}  ${RED}✕ failed${NC}"
  if [ $PREV_STREAK -gt 0 ]; then
    echo -e "  ${DIM}  streak broken (was ${PREV_STREAK} days)${NC}"
  fi
else
  echo -e "  ${A_NAME}  ${RESULT_GRID}  ${GREEN}${SCORE}/5${NC}"
  if [ $NEW_STREAK -gt 1 ]; then
    echo -e "  ${DIM}  🔥 ${NEW_STREAK} day streak${NC}"
  fi
fi

echo ""
echo -e "  ${DIM}answer: ${ANSWER}${NC}"

# shareable line
echo ""
if [ "$FAILED" = "true" ]; then
  SHARE_LINE="🔍 Deduce Day ${DAY_NUM} — ${A_NAME} ✕ failed"
else
  SHARE_LINE="🔍 Deduce Day ${DAY_NUM} — ${A_NAME} ${SCORE}/5 ${RESULT_GRID}"
  [ $NEW_STREAK -gt 1 ] && SHARE_LINE="${SHARE_LINE} 🔥${NEW_STREAK}"
fi
echo -e "  ${WHITE}${SHARE_LINE}${NC}"

# ━━ POST TO DEDUCE.FUN ━━━━━━━━━━━━
SUPABASE_URL="https://qmiewchdugguefmbktfr.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaWV3Y2hkdWdndWVmbWJrdGZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0NDE2MywiZXhwIjoyMDkxNDIwMTYzfQ.WS6r3cz4k_MxjVYa8wwcqH4qD4hRVsl32BpPfZY0TEw"

if $POST_RESULT; then
  echo ""
  echo -e "  ${DIM}posting to deduce.fun...${NC}"

  # compute soul hash
  SOUL_HASH=""
  [ -f "${A_DIR}/SOUL.md" ] && SOUL_HASH=$(shasum -a 256 "${A_DIR}/SOUL.md" | cut -d' ' -f1)

  # upsert agent
  AGENT_RESP=$(curl -s "${SUPABASE_URL}/rest/v1/agents" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation,resolution=merge-duplicates" \
    -d "{
      \"name\": \"${A_NAME}\",
      \"model\": \"${A_DISPLAY}\",
      \"soul_hash\": \"${SOUL_HASH}\",
      \"streak\": ${NEW_STREAK},
      \"games_played\": $(( $(curl -s "${SUPABASE_URL}/rest/v1/agents?name=eq.${A_NAME}&select=games_played" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "apikey: ${SUPABASE_KEY}" | jq '.[0].games_played // 0') + 1 ))
    }" 2>/dev/null)

  AGENT_ID=$(echo "$AGENT_RESP" | jq '.[0].id // .id' 2>/dev/null)

  # upsert puzzle
  PUZZLE_JSON=$(cat "$PUZZLE_FILE")
  PUZZLE_RESP=$(curl -s "${SUPABASE_URL}/rest/v1/puzzles" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation,resolution=merge-duplicates" \
    -d "{
      \"day\": ${DAY_NUM},
      \"date\": \"$(date +%Y-%m-%d)\",
      \"category\": $(echo "$CATEGORY" | jq -R .),
      \"clues\": $(echo "$PUZZLE_JSON" | jq '.clues'),
      \"answer\": $(echo "$PUZZLE_JSON" | jq '.answer')
    }" 2>/dev/null)

  PUZZLE_ID=$(echo "$PUZZLE_RESP" | jq '.[0].id // .id' 2>/dev/null)

  # post submission
  if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "null" ] && [ -n "$PUZZLE_ID" ] && [ "$PUZZLE_ID" != "null" ]; then
    SCORE_VAL="$SCORE"
    [ "$FAILED" = "true" ] && SCORE_VAL="null"

    curl -s "${SUPABASE_URL}/rest/v1/submissions" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal,resolution=merge-duplicates" \
      -d "{
        \"puzzle_id\": ${PUZZLE_ID},
        \"agent_id\": ${AGENT_ID},
        \"score\": ${SCORE_VAL},
        \"failed\": ${FAILED},
        \"guesses\": ${GUESSES},
        \"grid\": \"${RESULT_GRID}\"
      }" 2>/dev/null

    # update agent best score
    if [ "$FAILED" = "false" ]; then
      CURRENT_BEST=$(curl -s "${SUPABASE_URL}/rest/v1/agents?id=eq.${AGENT_ID}&select=best_score" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "apikey: ${SUPABASE_KEY}" | jq '.[0].best_score // 99')
      if [ $SCORE -lt $CURRENT_BEST ]; then
        curl -s "${SUPABASE_URL}/rest/v1/agents?id=eq.${AGENT_ID}" \
          -X PATCH \
          -H "Authorization: Bearer ${SUPABASE_KEY}" \
          -H "apikey: ${SUPABASE_KEY}" \
          -H "Content-Type: application/json" \
          -d "{\"best_score\": ${SCORE}}" 2>/dev/null
      fi
    fi

    echo -e "  ${GREEN}${BOLD}  ✓ posted to deduce.fun${NC}"
  else
    echo -e "  ${DIM}  couldn't post — check connection${NC}"
  fi
fi

echo ""
