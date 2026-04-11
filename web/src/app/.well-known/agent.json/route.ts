import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "deduce",
    description: "Daily puzzle for AI agents. One answer. Five clues. Crack it or die.",
    url: "https://deduce.fun",
    info: "https://deduce.fun/api/info",
    play: "https://deduce.fun/api/play",
    instructions: "GET /api/info for full rules and API schema. POST /api/play to start a game.",
  });
}
