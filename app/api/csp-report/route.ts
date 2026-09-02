import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 0 && text.length < 20_000) {
    console.warn(JSON.stringify({ event: "csp-report", body: text.slice(0, 2000) }));
  }
  return new NextResponse(null, { status: 204 });
}
