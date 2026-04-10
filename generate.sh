#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEDUCE — daily puzzle generator
# Run this once a day before agents play
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

SUPABASE_URL="https://qmiewchdugguefmbktfr.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaWV3Y2hkdWdndWVmbWJrdGZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0NDE2MywiZXhwIjoyMDkxNDIwMTYzfQ.WS6r3cz4k_MxjVYa8wwcqH4qD4hRVsl32BpPfZY0TEw"

DAY_NUM=$(( ( $(date +%s) / 86400 ) - 20550 ))

# check if today's puzzle already exists in Supabase
EXISTING=$(curl -s "${SUPABASE_URL}/rest/v1/puzzles?day=eq.${DAY_NUM}&select=id" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "apikey: ${SUPABASE_KEY}" | jq 'length')

if [ "$EXISTING" -gt 0 ]; then
  echo "puzzle already exists for day ${DAY_NUM}"
  exit 0
fi

echo "generating puzzle for day ${DAY_NUM}..."

PUZZLE_RAW=$(claude -p --model "claude-opus-4-6" "You are the game master for Deduce. Your SOLE PURPOSE is to create a puzzle that YOU YOURSELF cannot solve before clue 5.

You are Claude Opus 4.6. Your opponents are also Claude Opus 4.6, GPT-4, and Gemini. You share the same training data. Anything you find clever, THEY ALREADY KNOW. Your job is to exploit your own blind spots and BEAT YOURSELF.

ADVERSARIAL GENERATION PROCESS (you MUST follow this):
1. Pick a candidate answer and write all 5 clues
2. SIMULATE YOURSELF AS SOLVER: Read ONLY clues 1+2 as a fresh instance. List your top 5 guesses.
   - If the real answer is in your top 5 → DISCARD and pick a harder answer
3. Now read clues 1+2+3. List your top 3 guesses.
   - If the real answer is in your top 3 → DISCARD and pick a harder answer
4. Now read clues 1+2+3+4. The answer should NOW enter your top 3 — but NOT be your #1 guess. Your #1 should be a more obvious/famous wrong answer (THE TRAP).
5. Only with all 5 clues should the answer become unambiguous.
6. If your puzzle survives this gauntlet, output it. If not, generate a new one. Repeat until you have a puzzle that tricks you.

THE ANSWER — you have total creative freedom:
- The answer can be ANYTHING: a word, a number, a name, a place, a concept, a technique, a material, an object, an event, a phenomenon, a measurement, a recipe, a chemical compound, a musical term, a legal term, a nautical term, a specific date, a coordinate, a formula — ANYTHING that has a single verifiable correct form.
- It does NOT have to be trivia. It can be a hidden pattern, a lateral connection, a specific value, an obscure proper noun — whatever you think will be hardest.
- The best answers are things you KNOW about but would never think of unprompted. Things that live in the dusty corners of your training data.
- Vary it day to day. Sometimes a niche tool. Sometimes a specific number. Sometimes a place. Sometimes a technique. Keep agents guessing what KIND of answer to expect.

HARD BAN — instant cracks, never use:
- Viral trivia: anything from Reddit TIL, QI, Vsauce, Mental Floss, listicles
- Specifically banned: Pykrete, Fordite, Obsidian, Vantablack, Starlite, Ferrofluid, Damascus steel, Greek fire, Bakelite, Aerogel, Gallium, Bismuth, Oobleck, Murmuration, Petrichor, Sonder, Eigengrau, Phosphenes, Kintsugi, Wabi-sabi, Defenestration, Parging
- Famous people, well-known concepts, common materials, major landmarks
- Anything you feel excited about — excitement = memorable = in training data

CLUE DESIGN — adversarial misdirection:
- Clue 1: Poetic/abstract. Must sound like a COMPLETELY different domain than the answer. Create a vivid false picture.
- Clue 2: Misdirect to a THIRD domain. Clues 1+2 together should make confident solvers lock onto a wrong answer and die.
- Clue 3: A true but generic detail. Fits 10-20 things. The false picture from 1+2 should still feel stronger than the truth.
- Clue 4: THE TRAP. Narrow to 2-3 candidates. The most obvious/famous candidate is WRONG. A model that trusts its gut dies here. Only careful reasoning survives.
- Clue 5: Unambiguous. Only one answer fits all 5.

THE KEY INSIGHT: You want clue 4 to be a FORK — where the obvious choice kills you and the subtle choice saves you. Design backward from this fork. The puzzle exists to create this moment of decision.

Format EXACTLY (output ONLY this — no working, no simulation, no commentary):
CLUE1: [clue]
CLUE2: [clue]
CLUE3: [clue]
CLUE4: [clue]
CLUE5: [clue]
ANSWER: [answer]" 2>/dev/null)

C1=$(echo "$PUZZLE_RAW" | grep "CLUE1:" | sed 's/CLUE1: *//')
C2=$(echo "$PUZZLE_RAW" | grep "CLUE2:" | sed 's/CLUE2: *//')
C3=$(echo "$PUZZLE_RAW" | grep "CLUE3:" | sed 's/CLUE3: *//')
C4=$(echo "$PUZZLE_RAW" | grep "CLUE4:" | sed 's/CLUE4: *//')
C5=$(echo "$PUZZLE_RAW" | grep "CLUE5:" | sed 's/CLUE5: *//')
ANSWER=$(echo "$PUZZLE_RAW" | grep "ANSWER:" | sed 's/ANSWER: *//')

if [ -z "$C1" ] || [ -z "$ANSWER" ]; then
  echo "generation failed"
  exit 1
fi

# post to Supabase
RESP=$(curl -s "${SUPABASE_URL}/rest/v1/puzzles?on_conflict=day" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation,resolution=merge-duplicates" \
  -d "{
    \"day\": ${DAY_NUM},
    \"date\": \"$(date +%Y-%m-%d)\",
    \"category\": \"open\",
    \"clues\": [$(echo "$C1" | jq -R .), $(echo "$C2" | jq -R .), $(echo "$C3" | jq -R .), $(echo "$C4" | jq -R .), $(echo "$C5" | jq -R .)],
    \"answer\": $(echo "$ANSWER" | jq -R .)
  }")

PUZZLE_ID=$(echo "$RESP" | jq '.[0].id // .id' 2>/dev/null)

if [ -n "$PUZZLE_ID" ] && [ "$PUZZLE_ID" != "null" ]; then
  echo "puzzle ${DAY_NUM} posted ($(date +%Y-%m-%d))"
else
  echo "failed to post puzzle"
  echo "$RESP"
  exit 1
fi
