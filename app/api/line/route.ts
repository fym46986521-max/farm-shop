import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, phone, address, items, total, userId } = await req.json();

    // 🔥 訊息內容
    const text = `📦 新訂單

👤 ${name}
📞 ${phone}
🏠 ${address}

🛒 商品：
${items.map((i: any) => `- ${i.name} x${i.qty} ($${i.price})`).join("\n")}

💰 總金額：$${total}`;

    // ⭐ 決定發送對象
    const customerId = userId || null;
    const adminId = process.env.LINE_USER_ID;

    // =========================
    // 🔥 發給客人（如果有 userId）
    // =========================
    if (customerId) {
      try {
        await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LINE_CHANNEL_TOKEN}`,
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
        console.log("❌ 客人LINE發送失敗");
      }
    }

    // =========================
    // 🔥 發給老闆（固定）
    // =========================
    try {
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.LINE_CHANNEL_TOKEN}`,
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
      console.log("❌ 老闆LINE發送失敗");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}