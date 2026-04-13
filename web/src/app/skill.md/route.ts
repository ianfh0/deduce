import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// GET /skill.md — serve the agent onboarding doc as plain text
export async function GET() {
  const filePath = join(process.cwd(), "public", "skill.md");
  const content = readFileSync(filePath, "utf-8");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
