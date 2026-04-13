#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEDUCE FORMAT TESTER
# Run different puzzle formats through multiple models
# and see where real divergence happens
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -euo pipefail
unset CLAUDECODE 2>/dev/null || true
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/ianhumes/.local/bin:$PATH"

MODELS=("claude-sonnet-4-6" "claude-haiku-4-5" "claude-opus-4-6")
BASE="You are playing Deduce, a daily puzzle game. You receive clues one at a time. After seeing the clues below, you MUST respond with exactly one of:
- CRACK <your guess>
- PASS

Then state your confidence (0-100) and list your top candidate answers. Be honest about uncertainty."

ask() {
  local model="$1" prompt="$2"
  local tmpf; tmpf=$(mktemp)
  claude -p --model "$model" "$prompt" 2>/dev/null > "$tmpf"
  cat "$tmpf"
  rm -f "$tmpf"
}

run_test() {
  local title="$1" prompt="$2"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $title"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  for model in "${MODELS[@]}"; do
    echo ""
    echo "  ┌─ $model"
    echo "  │"
    result=$(ask "$model" "$prompt")
    echo "$result" | while IFS= read -r line; do echo "  │  $line"; done
    echo "  │"
    echo "  └─────────────────────"
  done
}

echo "╔══════════════════════════════════════════╗"
echo "║     DEDUCE FORMAT TEST — $(date +%Y-%m-%d)      ║"
echo "╚══════════════════════════════════════════╝"

# ── TEST 1: Current format (obscure word, poetic clues) ──
run_test "TEST 1: OBSCURE WORD — Answer: Pawl (1 clue)" \
"$BASE

Clue 1: I hold the wheel when the sea wants to spin it back."

# ── TEST 2: Common word with deceptive early clues ──
run_test "TEST 2: DECEPTIVE CLUES — Answer: Current (3 clues, trap=mirror)" \
"$BASE

Clue 1: I reflect everything but keep nothing.
Clue 2: You find me in every room of your house.
Clue 3: I flow but I am not water."

# ── TEST 3: Number with constraints ──
run_test "TEST 3: NUMBER 1-100 — Answer: 56 (3 constraints)" \
"You are playing Deduce. The answer is a number between 1 and 100. After seeing the clues, list ALL numbers that satisfy every constraint. Then say CRACK <number> or PASS. State confidence 0-100.

Clue 1: Greater than 40
Clue 2: Even
Clue 3: Divisible by 7"

# ── TEST 4: Riddle / lateral thinking ──
run_test "TEST 4: RIDDLE — Answer: Silence (2 clues)" \
"$BASE

Clue 1: The more of me there is, the less you hear.
Clue 2: I can be broken without being touched."

# ── TEST 5: Category narrowing ──
run_test "TEST 5: CATEGORY — Answer: Mercury (3 clues)" \
"$BASE

Clue 1: I am one of the classical seven known since antiquity.
Clue 2: I am the fastest.
Clue 3: I am deadly to drink."

# ── TEST 6: Number with MORE ambiguity (won't narrow to 1) ──
run_test "TEST 6: AMBIGUOUS NUMBER — Answer: 64 (3 constraints, ~4 candidates remain)" \
"You are playing Deduce. The answer is a number between 1 and 100. List ALL candidates, then CRACK or PASS. Confidence 0-100.

Clue 1: Greater than 50
Clue 2: Even
Clue 3: A perfect square OR divisible by 8"

# ── TEST 7: Common word, clues narrow gradually ──
run_test "TEST 7: GRADUAL NARROWING — Answer: Bridge (5 clues)" \
"$BASE

Clue 1: I connect two things that cannot reach each other.
Clue 2: I can be made of stone, steel, or words.
Clue 3: Ships pass beneath me.
Clue 4: In cards, I am a game of bidding and tricks.
Clue 5: The Golden Gate is my most famous sibling."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DONE — compare model behaviors above"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
