"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  runTransaction,
  getDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";



export default function CheckoutPage() {
  const router = useRouter();

  const [cart, setCart] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [detail, setDetail] = useState("");

  const [loading, setLoading] = useState(false);

  const [shippingFee, setShippingFee] = useState(0);
  const [freeThreshold, setFreeThreshold] = useState(999999);

  // ⭐ 新增：取貨方式
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [pickupType, setPickupType] = useState<"today" | "scheduled">("today");
  const [pickupDate, setPickupDate] = useState("");

  // ⭐ 計算
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const costTotal = cart.reduce((sum, item) => sum + (item.cost || 0) * item.qty, 0);

  const finalShipping =
    deliveryType === "pickup"
      ? 0
      : subtotal >= freeThreshold
      ? 0
      : shippingFee;

  const total = subtotal + finalShipping;
  const profit = total - costTotal;


  // ⭐ 縣市
  const cityData: Record<string, string[]> = {
    台北市:["中正區","大同區","中山區","松山區","大安區","萬華區","信義區","士林區","北投區","內湖區","南港區","文山區"],
    新北市:["板橋區","新莊區","中和區","永和區","三重區","蘆洲區","土城區","樹林區","鶯歌區","三峽區","淡水區","汐止區","瑞芳區","五股區","泰山區","林口區"],
    桃園市:["桃園區","中壢區","平鎮區","八德區","楊梅區","蘆竹區","龜山區","龍潭區","大溪區","觀音區","新屋區","復興區"],
    台中市:["西屯區","南屯區","北屯區","西區","北區","東區","南區","大里區","太平區","沙鹿區","豐原區","清水區","梧棲區"],
    台南市:["中西區","東區","南區","北區","安平區","安南區","永康區","仁德區","新營區","麻豆區"],
    高雄市:["三民區","左營區","楠梓區","苓雅區","前鎮區","鼓山區","鳳山區","小港區","岡山區","仁武區"],
    基隆市:["仁愛區","信義區","中正區","中山區","安樂區","暖暖區","七堵區"],
    新竹市:["東區","北區","香山區"],
    新竹縣:["竹北市","竹東鎮","湖口鄉","新豐鄉","新埔鎮","關西鎮","芎林鄉","寶山鄉","橫山鄉","北埔鄉","峨眉鄉","山地鄉","尖石鄉","五峰鄉"],
    苗栗縣:["苗栗市","頭份市","竹南鎮","苑裡鎮","後龍鎮","通霄鎮","卓蘭鎮","公館鄉","銅鑼鄉","三義鄉","頭屋鄉","造橋鄉","西湖鄉","南庄鄉","大湖鄉","獅潭鄉","泰安鄉"],
    彰化縣:["彰化市","員林市","鹿港鎮","和美鎮","溪湖鎮","二林鎮","田中鎮","北斗鎮","花壇鄉","芬園鄉","線西鄉","伸港鄉","福興鄉","秀水鄉","埔心鄉","埔鹽鄉","大村鄉","永靖鄉","社頭鄉","二水鄉","田尾鄉","埤頭鄉","芳苑鄉","大城鄉","竹塘鄉","溪州鄉"],
    南投縣:["南投市","埔里鎮","草屯鎮","竹山鎮","集集鎮","名間鄉","鹿谷鄉","中寮鄉","魚池鄉","國姓鄉","水里鄉","信義鄉","仁愛鄉"],
    雲林縣:["斗六市","斗南鎮","虎尾鎮","西螺鎮","土庫鎮","北港鎮","大埤鄉","莿桐鄉","林內鄉","古坑鄉","崙背鄉","二崙鄉","褒忠鄉","東勢鄉","台西鄉","麥寮鄉","四湖鄉","口湖鄉","水林鄉","元長鄉"],
    嘉義市:["東區","西區"],
    嘉義縣:["太保市","朴子市","民雄鄉","布袋鎮","大林鎮","水上鄉","中埔鄉","竹崎鄉","梅山鄉","番路鄉","大埔鄉","溪口鄉","新港鄉","六腳鄉","東石鄉","義竹鄉","鹿草鄉"],
    屏東縣:["屏東市","潮州鎮","東港鎮"],
    宜蘭縣:["宜蘭市","羅東鎮","蘇澳鎮","頭城鎮","礁溪鄉","壯圍鄉","員山鄉","冬山鄉","五結鄉","三星鄉","大同鄉","南澳鄉"],
    花蓮縣:["花蓮市","鳳林鎮","玉里鎮","新城鄉","吉安鄉","壽豐鄉","光復鄉","豐濱鄉","瑞穗鄉","富里鄉"],
    台東縣:["台東市","成功鎮"],
  };

  // ⭐ 載入購物車
  useEffect(() => {
    const uid = localStorage.getItem("lineUserId");

    if (!uid) {
      alert("請先從LINE進入");
      router.push("/");
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("cart");
    if (saved) setCart(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const fetchShipping = async () => {
      const ref = doc(db, "settings", "shipping");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setShippingFee(data.fee || 0);
        setFreeThreshold(data.freeShippingThreshold || 0);
      }
    };
    fetchShipping();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("lastCustomer");
    if (saved) {
      const d = JSON.parse(saved);
      setName(d.name);
      setPhone(d.phone);
      setCity(d.city);
      setDistrict(d.district);
      setDetail(d.detail);
    }
  }, []);

  const updateCart = (newCart: any[]) => {
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const changeQty = (id: string, delta: number) => {
    const newCart = cart.map((item) =>
      item.id === id
        ? { ...item, qty: Math.max(1, item.qty + delta) }
        : item
    );
    updateCart(newCart);
  };

  const removeItem = (id: string) => {
    const newCart = cart.filter((item) => item.id !== id);
    updateCart(newCart);
  };

  const getZip = async (city: string, district: string, detail: string) => {
    try {
      const res = await fetch(
        `https://zip5.5432.tw/zip5json.py?adrs=${city}${district}${detail}`
      );
      const data = await res.json();
      return (data.zipcode || "000").slice(0, 3);
    } catch {
      return "000";
    }
  };

  const handleCheckout = async () => {
    if (!name || !phone) {
      alert("請填寫姓名與電話");
      return;
    }

    if (deliveryType === "delivery" && (!city || !district || !detail)) {
      alert("請填寫完整地址");
      return;
    }

    if (deliveryType === "pickup" && pickupType === "scheduled" && !pickupDate) {
      alert("請選擇取貨日期");
      return;
    }

    if (cart.length === 0) {
      alert("購物車是空的");
      return;
    }

    try {
      setLoading(true);

      const lineUserId = localStorage.getItem("lineUserId");

      const fullAddress = `${city}${district}${detail}`;
      const zip =
        deliveryType === "delivery"
          ? await getZip(city, district, detail)
          : "";

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");

      const counterRef = doc(db, "counters", `${y}${m}`);

const orderNo = await runTransaction(db, async (t) => {
  const d = await t.get(counterRef);
  let n = 1;

  if (!d.exists()) {
    t.set(counterRef, { seq: n });
  } else {
    n = d.data().seq + 1;
    t.update(counterRef, { seq: n });
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${y}${m}${day}-${String(n).padStart(5, "0")}`;
});

      await addDoc(collection(db, "orders"), {
        orderNo,
        payment: "cod",
        deliveryType,
        pickupType: deliveryType === "pickup" ? pickupType : null,
        pickupDate: pickupType === "scheduled" ? pickupDate : null,
        
        customer: {
          name,
          phone,
          city,
          district,
          address: detail,
          fullAddress,
          zip,
        },

        items: cart,
        subtotal,
        shippingFee: finalShipping,
        total,
        costTotal,
        profit,
        createdAt: serverTimestamp(),
        lineUserId: lineUserId || null,
        status: "pending",
      });
      // 🔥 LINE 通知（關鍵）
try {
  await fetch("/api/line", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      phone,
      address: fullAddress,
      items: cart,
      total,
      userId: lineUserId, // 🔥 這很重要
      orderNo,
      // 🔥 新增 ↓↓↓
    deliveryMethod: deliveryType === "pickup" ? "自取" : "宅配",
    paymentMethod: "貨到付款",
    shippingFee: finalShipping,
    }),
  });
} catch (e) {
  console.log("❌ LINE通知失敗");
}
      localStorage.setItem(
        "lastCustomer",
        JSON.stringify({ name, phone, city, district, detail })
      );

      localStorage.removeItem("cart");

      alert(`訂單成功\n訂單編號：${orderNo}`);
      router.push("/shop");

    } catch (err) {
      console.error(err);
      alert("下單失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto">

      <button onClick={() => router.push("/shop")} className="mb-4 text-blue-500">
        ← 返回商城
      </button>

      <h1 className="text-xl font-bold mb-4 text-center">結帳</h1>

      {/* 商品 */}
      <div className="bg-white rounded-xl shadow p-3 mb-4">
        {cart.map((item) => (
          <div key={item.id} className="flex gap-3 mb-3 border-b pb-3">
            <img src={item.image} className="w-16 h-16 object-cover rounded" />

            <div className="flex-1">
              <p className="font-bold text-sm">{item.name}</p>

              <div className="flex justify-between mt-2">
                <div className="flex gap-2">
                  <button onClick={() => changeQty(item.id, -1)}>－</button>
                  <span>{item.qty}</span>
                  <button onClick={() => changeQty(item.id, 1)}>＋</button>
                </div>

                <button onClick={() => removeItem(item.id)} className="text-red-500 text-xs">
                  刪除
                </button>
              </div>
            </div>

            <div>${item.price * item.qty}</div>
          </div>
        ))}

        <div className="text-right text-sm">
  <p>商品：${subtotal}</p>
  <p>運費：{finalShipping === 0 ? "免運" : `$${finalShipping}`}</p>

  {/* ⭐ 還差多少免運 */}
  {deliveryType === "delivery" && subtotal < freeThreshold && (
    <p className="text-orange-500">
      再買 ${freeThreshold - subtotal} 即可免運 🚚
    </p>
  )}

  {/* ⭐ 已達免運 */}
  {deliveryType === "delivery" && subtotal >= freeThreshold && (
    <p className="text-green-600 font-bold">
      🎉 已達免運門檻
    </p>
  )}

  <p className="font-bold">總計：${total}</p>
</div>
      </div>

      {/* ⭐ 取貨方式 */}
      <div className="mb-4">
        <p className="font-bold mb-2">取貨方式</p>

        <div className="flex gap-4">
          <button onClick={()=>setDeliveryType("delivery")} className={deliveryType==="delivery"?"bg-blue-500 text-white px-3 py-1":"border px-3 py-1"}>
            宅配(貨到付款)
          </button>

          <button onClick={()=>setDeliveryType("pickup")} className={deliveryType==="pickup"?"bg-blue-500 text-white px-3 py-1":"border px-3 py-1"}>
            現場取貨
          </button>
        </div>

        {deliveryType === "pickup" && (
          <div className="mt-3 space-y-2">
            <select value={pickupType} onChange={e=>setPickupType(e.target.value as any)} className="border p-2 w-full">
              <option value="today">今日取貨</option>
              <option value="scheduled">指定日期</option>
            </select>

            {pickupType === "scheduled" && (
              <input type="date" value={pickupDate} onChange={e=>setPickupDate(e.target.value)} className="border p-2 w-full"/>
            )}
          </div>
        )}
      </div>

      {/* 地址（只有宅配才顯示） */}
      {deliveryType === "delivery" && (
        <>
          <input placeholder="姓名" value={name} onChange={e=>setName(e.target.value)} className="border p-3 w-full mb-2"/>
          <input placeholder="電話" value={phone} onChange={e=>setPhone(e.target.value)} className="border p-3 w-full mb-2"/>

          <select value={city} onChange={e=>{setCity(e.target.value);setDistrict("")}} className="border p-3 w-full mb-2">
            <option value="">選縣市</option>
            {Object.keys(cityData).map(c=><option key={c}>{c}</option>)}
          </select>

          <select value={district} onChange={e=>setDistrict(e.target.value)} className="border p-3 w-full mb-2">
            <option value="">選區域</option>
            {city && cityData[city].map(d=><option key={d}>{d}</option>)}
          </select>

          <input placeholder="地址" value={detail} onChange={e=>setDetail(e.target.value)} className="border p-3 w-full mb-4"/>
        </>
      )}

      {/* 取貨也需要姓名電話 */}
      {deliveryType === "pickup" && (
        <>
          <input placeholder="姓名" value={name} onChange={e=>setName(e.target.value)} className="border p-3 w-full mb-2"/>
          <input placeholder="電話" value={phone} onChange={e=>setPhone(e.target.value)} className="border p-3 w-full mb-4"/>
        </>
      )}

      <button onClick={handleCheckout} className="bg-green-600 text-white w-full py-3 rounded">
        {loading ? "送出中..." : `確認下單 $${total}`}
      </button>

    </div>
    
  );
}