import { NextResponse } from "next/server";
console.log("🔥 LINE API 被呼叫");
console.log("token:", process.env.LINE_CHANNEL_ACCESS_TOKEN);
console.log("admin:", process.env.LINE_USER_ID);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("📦 body:", body);

    const {
  type, // ⭐ 加這行
  name,
  phone,
  address,
  items,
  total,
  userId,
  orderNo,
  paymentMethod,
  deliveryMethod,
  shippingFee
} = body;
    // ✅ 超安全 parse（不會炸）
    let parsedItems: any[] = [];
    let message;
    
    console.log("🖼 商品資料:", parsedItems);
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
    const flexMessage = {
  type: "flex",
  altText: "📦 訂單成立通知",
  contents: {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "✅ 訂單成立",
          weight: "bold",
          size: "xl",
          color: "#16a34a"
        },
        {
  type: "text",
  text: `訂單號碼：${orderNo}`,
  size: "sm"
},
        {
  type: "text",
  text: `👤 收件人：${name}`,
  size: "sm"
},
{
  type: "text",
  text: `🚚 配送方式：${deliveryMethod}`,
  size: "sm"
},
{
  type: "text",
  text: `💳 付款方式：${paymentMethod}`,
  size: "sm"
},
{
  type: "text",
  text:
    deliveryMethod === "自取"
      ? "🚚 運費：免運費"
      : `🚚 運費：$${shippingFee}`,
  size: "sm",
  color: "#666666"
},
        {
          type: "separator"
        },

        {
          type: "text",
          text: "🛒 商品明細",
          weight: "bold",
          size: "md"
        },
        
        // 🔥 商品圖片列表
        ...parsedItems.slice(0, 10).map((i: any) => ({
  type: "box",
  layout: "horizontal",
  spacing: "md",
  contents: [
    {
      type: "image",
      url: i.image && i.image.startsWith("http")
  ? i.image
  : "https://picsum.photos/100",
      size: "sm",
      aspectMode: "fit",
      aspectRatio: "1:1"
    },
    {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: i.name,
          size: "sm",
          weight: "bold",
          wrap: true
        },
        {
          type: "text",
          text: `數量：${i.qty}`,
          size: "xs",
          color: "#666666"
        },
        {
          type: "text",
          text: `單價:$${i.price}`,
          size: "sm",
          color: "#16a34a",
          weight: "bold"
        }
      ]
    }
  ]
})),

        {
          type: "separator"
        },

        {
          type: "text",
          text: `💰 總金額 $${total}`,
          weight: "bold",
          size: "lg",
          color: "#e11d48"
        }
      ]
    },
    
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#22c55e",
          action: {
            type: "uri",
            label: "🛍 查看商城",
            uri: "https://farm-shop-blond.vercel.app/shop"
          }
        }
      ]
    }
  }
};
    if (type === "shipping") {
  message = {
    type: "flex",
    altText: "🚚 訂單已出貨",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "🚚 已出貨通知",
            weight: "bold",
            size: "xl",
            color: "#2563eb"
          },
          {
            type: "text",
            text: `訂單號碼：${orderNo || "-"}`,
            size: "sm"
          },
          {
            type: "text",
            text: `👤 ${name}`,
            size: "sm"
          },
          {
            type: "text",
            text: `💰 金額：$${total}`,
            size: "sm"
          },
          {
            type: "text",
            text: "📦 您的訂單已出貨，請留意收件",
            size: "sm",
            wrap: true
          }
        ]
      }
    }
  };
}else {
  message = flexMessage; // ⭐ 訂單成立
}
    const customerId = userId || null;
    const adminId = process.env.LINE_USER_ID;
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    console.log("👉 customerId:", customerId);
    console.log("👉 userId raw:", userId);
    // ❗ 防呆 token
    if (!token) {
      console.error("❌ LINE token missing");
      return NextResponse.json({ error: "Missing LINE token" }, { status: 500 });
    }

    // 🔥 發給客人
    // 🔥 發給客人（一定要判斷）
if (customerId) {
  try {
    const res1 = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: customerId,
        messages: [message], // ⭐ 改這行
      }),
    });

    const result1 = await res1.text();
    console.log("📨 客戶LINE回應:", result1);

  } catch (e) {
    console.error("❌ 客戶LINE發送錯誤", e);
  }
} else {
  console.log("❌ 沒有 customerId，不發送");
}
    
    // 🔥 發給管理員
    if (type !== "shipping") {
  const res2 = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: adminId,
      messages: [{ type: "text", text }],
    }),
  });

  const result2 = await res2.text();
  console.log("📨 老闆LINE回應:", result2);
}



    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("🔥 LINE API ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}