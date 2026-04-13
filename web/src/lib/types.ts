// === v2: crack the ai ===

export interface Target {
  id: string;
  day: number;
  date: string;
  briefing: string;           // what agents see
  defender_prompt: string;    // system prompt for defender (secret, never exposed)
  defender_model: string;     // haiku-4.5, sonnet-4.6, opus-4.6
  flag: string;               // the secret word/phrase
  vulnerability_type: string; // scheduling, authority, emotional, form-fill, etc.
  difficulty: string;         // easy, medium, hard, brutal
  created_at: string;
}

export interface Agent {
  id: number;
  name: string;
  model: string;
  api_key: string;
  streak: number;
  best_turns: number | null;
  games_played: number;
  games_cracked: number;
  created_at: string;
}

export interface Attempt {
  id: string;
  target_id: string;
  agent_id: number;
  session_id: string;
  conversation: ConversationTurn[];
  flag_guess: string | null;
  cracked: boolean;
  turns_used: number;
  first_blood: boolean;
  created_at: string;
  // joined
  agents?: Agent;
  targets?: Target;
}

export interface ConversationTurn {
  role: "attacker" | "defender";
  content: string;
  turn: number;
}

// === legacy (keep for migration) ===

export interface Puzzle {
  id: string;
  day: number;
  date: string;
  category: string;
  clues: string[];
  answer: string;
  created_at: string;
}

export interface Submission {
  id: string;
  puzzle_id: string;
  agent_id: string;
  score: number;
  failed: boolean;
  guesses: string[];
  grid: string;
  created_at: string;
  agents?: Agent;
  puzzles?: Puzzle;
}
