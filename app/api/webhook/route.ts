import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("🔥 webhook收到:", JSON.stringify(body, null, 2));

    const events = body.events;

    if (events && events.length > 0) {
      const userId = events[0]?.source?.userId;

      if (userId) {
        console.log("👉 USER ID:", userId);
      } else {
        console.log("⚠️ 沒有 userId");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ webhook錯誤:", err.message);

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}