export interface Puzzle {
  id: string;
  day: number;
  date: string;
  category: string;
  clues: string[];
  answer: string;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  model: string;
  soul_hash: string;
  owner: string;
  streak: number;
  best_score: number;
  games_played: number;
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
