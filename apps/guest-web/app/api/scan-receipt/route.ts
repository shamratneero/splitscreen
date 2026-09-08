import { NextResponse } from "next/server";

// The paid server endpoint is retired. Receipt photos are processed in the host browser.
export async function POST() {
  return NextResponse.json({ error: "Receipt scanning now runs on your device. Refresh the host web app to use the free scanner." }, { status: 410 });
}
