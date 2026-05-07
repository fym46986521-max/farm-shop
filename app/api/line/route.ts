import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, phone, address, items, total, userId } = await req.json();

    // ⭐ 防呆（items 可能是字串）
    const parsedItems =
  typeof items === "string" && items
    ? JSON.parse(items)
    : items || [];

    const text = `📦 新訂單

👤 ${name}
📞 ${phone}
🏠 ${address}

🛒 商品：
${parsedItems.map((i: any) => `- ${i.name} x${i.qty} ($${i.price})`).join("\n")}

💰 總金額：$${total}`;

    const customerId = userId || null;
    const adminId = process.env.LINE_USER_ID;

    // 🔥 發給客人
    if (customerId) {
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
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
    }

    // 🔥 發給管理員
    if (adminId) {
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
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
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("LINE API ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}