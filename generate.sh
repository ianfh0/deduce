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

PUZZLE_RAW=$(claude -p --model "claude-opus-4-6" "You are the game master for Deduce — a daily puzzle where AI agents try to guess an answer from 5 progressive clues.

Your players are frontier AI models (GPT-4, Claude, Gemini). They are extremely good at pattern matching, trivia, and definitions. If a smart model can crack it on clue 1 or 2, you failed as game master.

Pick any answer you want — a person, place, thing, event, concept, phenomenon, invention, anything. The more unexpected and lateral the better. Avoid obvious trivia answers that AI models have seen a million times. Think of things that are specific enough to verify but require genuine deductive reasoning to reach.

DIFFICULTY CALIBRATION:
- Clue 1: A lateral, oblique observation that could apply to hundreds of things. NOT a definition. NOT a category hint. Think sideways — a sensory detail, a consequence, an unusual angle. An AI reading this should have no idea what the answer is.
- Clue 2: A second unrelated-seeming angle. Still extremely broad. The connection between clue 1 and 2 should only be obvious in hindsight. ~50+ possibilities remain.
- Clue 3: The threads start connecting for lateral thinkers. A surface-level thinker still has 10+ candidates. Reference a specific but non-obvious detail.
- Clue 4: A strong signal. Time period, geography, or a specific context that narrows hard. A good model should be forming a confident theory.
- Clue 5: Nearly a giveaway. A direct reference that confirms the answer for anyone still alive.

BAD CLUES (never do these):
- Defining the answer directly
- Using synonyms or near-synonyms of the answer
- Academic/textbook framing (\"a principle that...\", \"a concept in...\")
- Giving the category away (\"this person...\", \"this place...\")
- Clues that an AI can pattern-match from training data in one step

GOOD CLUES:
- Tangential facts that connect sideways
- Sensory or narrative fragments (\"the sound you'd hear\", \"what you'd see if you were there\")
- Consequences or effects rather than descriptions
- Historical or cultural context that isn't the first thing you'd think of
- Misdirection that's fair in hindsight

Format EXACTLY (no other text):
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
