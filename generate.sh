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

YOUR PLAYERS ARE CLAUDE OPUS 4.6, GPT-4, AND GEMINI. These are the smartest AI models on earth. They have encyclopedic knowledge and insane pattern matching. Your job is to BEAT THEM. A good puzzle means most agents die or only crack it on clue 5. If any model cracks it before clue 4, your puzzle was too easy.

THE ANSWER: Pick something specific but unexpected. Not the first thing anyone would think of. Not famous-person trivia. Not a well-known concept. Think: a specific historical object, an obscure phenomenon, a niche invention, a particular place most people haven't heard of, a forgotten event. The answer must be verifiable and have a single correct form, but it should NOT be something an AI has been asked about thousands of times.

AVOID these answers — they're too easy for AI:
- Famous scientists, artists, writers, leaders
- Well-known concepts (Occam's Razor, Dunning-Kruger, etc.)
- Common materials, animals, or landmarks
- Anything that appears frequently in trivia games or Wikipedia featured articles
- Anything with an obvious \"fun fact\" that AI models have memorized
- VIRAL TRIVIA: anything that has appeared on Reddit TIL, QI, Vsauce, Ripley's, Mental Floss, or \"interesting facts\" listicles. These are EXACTLY what AI models have memorized most. Examples of what NOT to pick: Pykrete, Fordite, Obsidian, Tardigrades, Scoville scale, Dunbar's number, Bakelite, Greek fire, Damascus steel, Starlite, Vantablack, Ferrofluid. If you've seen it go viral, so has the AI.
- Anything where 2 clues would be enough for a smart person to guess it

THE REAL TEST: Before finalizing your answer, ask yourself — if I gave Claude Opus just clue 1 and clue 2, would it guess this? If yes, pick something harder. The answer should be something a model has NEVER been specifically asked about in a trivia context.

GOOD answers:
- A specific but obscure historical artifact, tool, or technique from a niche field
- A real place, tradition, or event that exists but rarely appears in English-language media
- Something from a specialized trade or craft that outsiders wouldn't know the name of
- A phenomenon or object that's real and verifiable but not \"interesting\" enough to go viral
- Regional or cultural specifics (a particular type of joint in Japanese carpentry, a specific ceremonial object, a local geological formation with a proper name)

CLUE DESIGN — your clues must actively mislead:
- Clue 1: Could describe literally thousands of things. Should feel poetic or abstract. An AI should generate 100+ candidates and have zero confidence. Actively misdirect toward a wrong category.
- Clue 2: A completely different angle that ALSO misdirects. The combination of clue 1+2 should point away from the answer, not toward it. An AI combining both clues should still be lost.
- Clue 3: Introduce a factual detail that's true about the answer but also true about 10-20 other things. A brilliant lateral thinker might start forming a theory. Most won't.
- Clue 4: Now narrow seriously. A specific time, place, or context. But even here, 2-3 plausible candidates should remain. The best agents will commit here — and some will commit to the wrong one and die.
- Clue 5: The confirming detail. Only one answer fits all 5 clues. This is where survivors lock in.

BAD CLUES (never do these):
- Defining the answer or using synonyms
- Academic framing (\"a principle that...\", \"a concept in...\")
- Revealing the category (\"this person\", \"this place\", \"this material\")
- Any single clue that an AI can pattern-match to the answer
- Clues that are \"interesting facts\" commonly paired with the answer in training data

GOOD CLUES:
- Sensory or narrative details (what you'd smell, hear, see)
- Second-order consequences (\"because of this, X happened\")
- Connections to unexpected fields (the answer is from biology but clue references architecture)
- Temporal or geographic misdirection
- True statements that sound like they describe something else entirely

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
