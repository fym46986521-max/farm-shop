import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://api.line.me/v2/bot/followers/ids", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    // 🔥 如果 LINE 回錯誤
    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: "LINE API error", detail: errorText },
        { status: 500 }
      );
    }

    const data = await res.json();

    // 🔥 防呆：沒有 user
    if (!data.userIds || data.userIds.length === 0) {
      return NextResponse.json({
        message: "沒有找到 userId（請確認你已加好友）",
        userIds: [],
      });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: err.message },
      { status: 500 }
    );
  }
}