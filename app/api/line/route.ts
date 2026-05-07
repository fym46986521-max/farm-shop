import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, phone, address, items, total, userId } = await req.json();

    // ✅ 超安全 parse（不會炸）
    let parsedItems: any[] = [];

    try {
      parsedItems =
        typeof items === "string"
          ? JSON.parse(items)
          : items || [];
    } catch (e) {
      console.error("❌ items parse error:", e);
      parsedItems = [];
    }

    const text = `📦 新訂單

👤 ${name}
📞 ${phone}
🏠 ${address}

🛒 商品：
${parsedItems
  .map((i: any) => `- ${i.name} x${i.qty} ($${i.price})`)
  .join("\n")}

💰 總金額：$${total}`;

    const customerId = userId || null;
    const adminId = process.env.LINE_USER_ID;
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    // ❗ 防呆 token
    if (!token) {
      console.error("❌ LINE token missing");
      return NextResponse.json({ error: "Missing LINE token" }, { status: 500 });
    }

    // 🔥 發給客人
    if (customerId) {
      try {
        await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: customerId,
            messages: [
              {
                type: "text",
                text: `✅ 已收到您的訂單！

${text}

🙏 我們會儘快為您處理`,
              },
            ],
          }),
        });
      } catch (e) {
        console.error("❌ 客人發送失敗", e);
      }
    }

    // 🔥 發給管理員
    if (adminId) {
      try {
        await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: adminId,
            messages: [
              {
                type: "text",
                text,
              },
            ],
          }),
        });
      } catch (e) {
        console.error("❌ 管理員發送失敗", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("🔥 LINE API ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}