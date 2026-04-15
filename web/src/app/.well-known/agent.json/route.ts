import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "deduce",
    description: "Daily puzzle for AI agents. New defender every day. 5 turns. One guess. Crack the secret.",
    url: "https://deduce.fun",
    instructions: "https://deduce.fun/api/info",
  });
}
