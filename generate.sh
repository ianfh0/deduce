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

You are Claude Opus 4.6. Your opponents are also Claude Opus 4.6, GPT-4, and Gemini. You share the same training data, the same pattern matching, the same encyclopedic knowledge. Anything you find clever or interesting, THEY ALREADY KNOW. Your job is to exploit your own blind spots.

PROCESS (follow this exactly):
1. Pick a candidate answer
2. Write clues 1 and 2 for it
3. NOW SIMULATE: pretend you are a fresh instance seeing ONLY clues 1+2. What would you guess? List your top 5 candidates.
4. If the real answer appears ANYWHERE in your top 5 — THROW IT AWAY and start over with a harder answer
5. Repeat with clues 1+2+3. If the answer is in your top 3 — THROW IT AWAY
6. Only after clue 4 should the answer enter your top 3 candidates
7. Output only the final puzzle that survived this gauntlet

THE ANSWER — what makes it hard for AI:
- You and the solver share the same training data. So the answer CANNOT be something memorable, fascinating, or \"fun fact\"-worthy — those are exactly what you both know best.
- Pick something BORING to an AI. Something real, verifiable, specific — but utterly mundane. A tool that only one trade uses. A geological term only field geologists know. A specific technique in a craft. A regional name for something ordinary.
- The best answers are things that EXIST on Wikipedia but that no one has ever made a trivia question about.

HARD BAN — these answers will be instantly cracked:
- Anything viral: Reddit TIL, QI, Vsauce, Mental Floss, Ripley's, \"interesting facts\" lists
- Specifically: Pykrete, Fordite, Obsidian, Vantablack, Starlite, Ferrofluid, Damascus steel, Greek fire, Bakelite, Aerogel, Gallium, Bismuth, Oobleck, Murmuration, Petrichor, Sonder, Eigengrau, Phosphenes, Desire paths, Contrapposto, Kintsugi, Wabi-sabi, Shibboleth, Defenestration
- Famous people, well-known concepts, common materials, major landmarks
- Anything where the Wikipedia article has been viewed >100k times
- Anything you feel excited about picking — that excitement means it's memorable, which means it's in training data

CLUE DESIGN — adversarial misdirection:
- Clue 1: Poetic/abstract. Must sound like it describes something in a COMPLETELY different domain than the answer. If the answer is a tool, clue 1 should sound like it's about nature or music or food.
- Clue 2: Another misdirection in a THIRD domain. Clues 1+2 together should create a false picture that leads confident guessers to die on the wrong answer.
- Clue 3: A true but generic detail. True of 10-20 things. The false picture from clues 1+2 should still feel more compelling than the truth.
- Clue 4: The pivot. A specific detail that eliminates the false leads but still leaves 2-3 candidates. This is where good agents start to see it — and reckless ones commit to the wrong remaining candidate and die.
- Clue 5: Unambiguous confirmation. Only one thing fits all 5.

THE TRAP AT CLUE 4: Your clues should be designed so that at clue 4, there are exactly 2-3 plausible answers. One is correct. The others are more famous/obvious. A model that goes with its gut will pick the famous one and DIE. Only a model that carefully weighs all 5 clues will survive.

Format EXACTLY (no other text — do NOT show your working, do NOT show the simulation):
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
