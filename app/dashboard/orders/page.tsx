"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc, // ⭐加這個
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";

export default function OrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<any[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [exportPending, setExportPending] = useState(true);
  const [exportShipped, setExportShipped] = useState(true);

  // ⭐新增：查訂單
  const [searchPhone, setSearchPhone] = useState("");
  const [packagingSetting, setPackagingSetting] = useState<any>({
  large: 0,
  medium: 0,
  small: 0,
});
  const toDate = (t: any) => {
  if (!t) return null;

  if (t.seconds) return new Date(t.seconds * 1000);
  if (t._seconds) return new Date(t._seconds * 1000); // ⭐補這行
  if (typeof t === "string") return new Date(t);

  return null;
};

  const fetchOrders = async () => {
  try {
    const res = await fetch("/api/orders");

    const raw = await res.json();

    // ⭐⭐⭐ 關鍵修正
    const data = raw.map((o: any) => ({
      ...o,
      items: (() => {
  try {
    return typeof o.items === "string"
      ? JSON.parse(o.items)
      : o.items;
  } catch {
    return [];
  }
})(),
    }));

    console.log("orders:", data);

    setOrders(data);
  } catch (e) {
    console.error("讀取訂單失敗:", e);
  }
};

  useEffect(() => {
  fetchOrders();

  const fetchPackaging = async () => {
    const snap = await getDoc(doc(db, "settings", "packaging"));
    if (snap.exists()) {
      setPackagingSetting(snap.data());
    }
  };

  fetchPackaging();

}, []);
  const filteredOrders = orders
  .filter((o) => {
    const d = toDate(o.createdAt);
    if (!d) return true;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate + "T23:59:59") : null;

    if (start && d < start) return false;
    if (end && d > end) return false;

    return true;
  })
  .sort((a, b) => (b.orderNo || "").localeCompare(a.orderNo || ""));

  const pendingOrders = filteredOrders.filter(
    (o) => o.status !== "shipped"
  );

  const shippedOrders = filteredOrders.filter(
    (o) => o.status === "shipped"
  );

  // ⭐ 查詢結果
  const searchedOrders = searchPhone
    ? orders.filter((o) =>
        o.customer?.phone?.includes(searchPhone)
      )
    : null;
  const handlePackagingChange = async (order: any, type: string) => {
  if (order.status === "shipped") return;

  const costMap: any = {
    large: packagingSetting.large,
    medium: packagingSetting.medium,
    small: packagingSetting.small,
  };

  setOrders((prev) =>
  prev.map((o) =>
    o.id === order.id
      ? {
          ...o,
          selectedPackaging: type,
          packagingCost: costMap[type] || 0,
        }
      : o
  )
);

await updateDoc(doc(db, "orders", order.id), {
  selectedPackaging: type,
  packagingCost: costMap[type] || 0,
});
};
  const getOrderCost = (order: any) => {
  let productCost = 0;

  order.items?.forEach((item: any) => {
    productCost += (item.cost || 0) * item.qty;
  });

  const packagingCost = order.packagingCost || 0;

  return productCost + packagingCost;
};
  const getDeliveryLabel = (order: any) => {
  if (order.deliveryType === "pickup") {
    if (order.pickupType === "today") return "現場取貨（今日）";
    if (order.pickupType === "scheduled") return `現場取貨（${order.pickupDate}）`;
    return "現場取貨";
  }
  return "宅配";
};
  // ⭐ 出貨 + LINE通知
  const toggleStatus = async (order: any) => {
    if (
  order.status !== "shipped" &&
  order.deliveryType !== "pickup" &&
  !order.selectedPackaging
) {
  alert("請先選擇包裝");
  return;
}
    if (order.status === "shipped") return; // ⭐ 防重複

      const newStatus = "shipped";

    await updateDoc(doc(db, "orders", order.id), {
      status: newStatus,
    });

    if (newStatus === "shipped" && order.lineUserId) {
  try {
    console.log("🚚 發送出貨通知", order.lineUserId);

    const res = await fetch("/api/line", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "shipping",
        userId: order.lineUserId,
        name: order.customer?.name,
        total: order.total,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ LINE 發送失敗:", data);
    } else {
      console.log("✅ LINE 發送成功");
      alert("已出貨，LINE通知已發送");
    }
  } catch (e) {
    console.log("❌ LINE出貨通知失敗", e);
  }
}

    fetchOrders();
  };

  const exportExcel = () => {
    if (!exportPending && !exportShipped) {
      alert("請至少勾選一項");
      return;
    }

    const wb = XLSX.utils.book_new();

    const formatItems = (items: any[]) =>
      items?.map((i) => `${i.name} x${i.qty}`).join(", ");

    if (exportPending) {
      const data = pendingOrders.map((o) => ({
        訂單編號: o.orderNo,
        日期: toDate(o.createdAt)?.toLocaleString(),
        姓名: o.customer?.name,
        電話: o.customer?.phone,
        地址: o.customer?.address,
        商品: formatItems(o.items),
        金額: o.total,
        取貨方式: getDeliveryLabel(o),
        包裝:
    o.selectedPackaging === "large"
      ? "大包裝"
      : o.selectedPackaging === "medium"
      ? "中包裝"
      : o.selectedPackaging === "small"
      ? "小包裝"
      : "-",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "未出貨");
    }

    if (exportShipped) {
      const data = shippedOrders.map((o) => ({
        訂單編號: o.orderNo,
        日期: toDate(o.createdAt)?.toLocaleString(),
        姓名: o.customer?.name,
        電話: o.customer?.phone,
        地址: o.customer?.address,
        商品: formatItems(o.items),
        取貨方式: getDeliveryLabel(o),
        金額: o.total,
        包裝:
  o.selectedPackaging === "large"
    ? "大包裝"
    : o.selectedPackaging === "medium"
    ? "中包裝"
    : o.selectedPackaging === "small"
    ? "小包裝"
    : "-",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "歷史訂單");
    }

    XLSX.writeFile(wb, "orders.xlsx");
  };
  const exportPickupList = () => {
  const pickupOrders = orders.filter(
    (o) => o.deliveryType === "pickup"
  );

  if (pickupOrders.length === 0) {
    alert("沒有現場取貨訂單");
    return;
  }

  const formatItems = (items: any[]) =>
    items?.map((i) => `${i.name} x${i.qty}`).join(", ");

  const data = pickupOrders.map((o) => ({
    訂單編號: o.orderNo,
    姓名: o.customer?.name,
    電話: o.customer?.phone,
    取貨方式:
      o.pickupType === "today"
        ? "今日取貨"
        : `指定日期 ${o.pickupDate || ""}`,
    商品: formatItems(o.items),
    金額: o.total,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "取貨清單");

  XLSX.writeFile(wb, "pickup_list.xlsx");
};
  return (
    <div className="p-6">

      {/* 返回 */}
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-4 bg-green-500 text-white px-4 py-2 rounded-lg"
      >
        ← 回到後台
      </button>

      <h1 className="text-2xl font-bold mb-4">📦 訂單管理</h1>

      {/* ⭐ 查訂單 */}
      <div className="mb-4 flex gap-2">
        <input
          placeholder="輸入電話查訂單"
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
          className="border p-2 flex-1"
        />
      </div>

      {searchPhone && (
        <div className="mb-6">
          <h2 className="font-bold mb-2">🔍 查詢結果</h2>

          {searchedOrders?.length === 0 && <p>查無訂單</p>}

          {searchedOrders?.map((order) => (
            <div key={order.id} className="border p-3 mb-2 rounded">
              <p className="font-bold text-blue-600">
                訂單編號：{order.orderNo || "-"}
              </p>
              <p>姓名：{order.customer?.name}</p>
              <p>電話：{order.customer?.phone}</p>
              <p className="text-sm text-purple-600">
                取貨方式：{getDeliveryLabel(order)}
              </p>
              <p>金額：${order.total}</p>
            </div>
          ))}
        </div>
      )}

      {/* 篩選 + 匯出 */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border p-2"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border p-2"
        />

        <label>
          <input
            type="checkbox"
            checked={exportPending}
            onChange={(e) => setExportPending(e.target.checked)}
          />
          未出貨
        </label>

        <label>
          <input
            type="checkbox"
            checked={exportShipped}
            onChange={(e) => setExportShipped(e.target.checked)}
          />
          歷史訂單
        </label>

        <button
          onClick={exportExcel}
          className="bg-green-600 text-white px-4"
        >
          匯出 Excel
        </button>
        <button
          onClick={exportPickupList}
          className="bg-purple-600 text-white px-4"
        >
        取貨清單
        </button>
      </div>

      {/* 未出貨 */}
      <h2 className="text-xl font-bold mb-2">未出貨</h2>

      {pendingOrders.map((order) => (
        <div key={order.id} className="border p-4 mb-4 rounded">

          <p className="font-bold text-blue-600">
            訂單編號：{order.orderNo || "-"}
          </p>

          <p>日期：{toDate(order.createdAt)?.toLocaleString()}</p>
          <p>姓名：{order.customer?.name}</p>
          <p className="text-sm text-purple-600">
                取貨方式：{getDeliveryLabel(order)}
          </p>
          <p>電話：{order.customer?.phone}</p>
          <p>地址：{order.customer.zip} {order.customer.fullAddress}</p>
          {order.deliveryType !== "pickup" && (
  <>
    <select
      value={order.selectedPackaging || ""}
      onChange={(e) =>
        handlePackagingChange(order, e.target.value)
      }
      className="border p-2 mt-2"
    >
      <option value="">選擇包裝</option>
      <option value="large">大包裝</option>
      <option value="medium">中包裝</option>
      <option value="small">小包裝</option>
    </select>

    <p className="text-sm text-gray-500">
      包裝成本：${order.packagingCost || 0}
    </p>
  </>
)}
          <div className="mt-3 space-y-2">
            {order.items?.map((item: any, i: number) => (
              <div key={i} className="flex gap-3 border-b pb-2">
                <img src={item.image} className="w-16 h-16 object-cover rounded" />
                <div className="flex-1">
                  <p className="font-bold">{item.name}</p>
                  <p>數量：{item.qty}</p>
                </div>
                <div>${item.price * item.qty}</div>
              </div>
            ))}
          </div>

          <p className="font-bold mt-3">總金額：${order.total}</p>
          <p className="text-right text-sm text-gray-600">
  成本：${getOrderCost(order)}
</p>
          <button
            onClick={() => toggleStatus(order)}
            className="bg-blue-500 text-white px-2 py-1 mt-2"
          >
            設為已出貨
          </button>

        </div>
      ))}

      {/* 已出貨 */}
      <h2 className="text-xl font-bold mt-6 mb-2">歷史訂單</h2>

      {shippedOrders.map((order) => (
        <div key={order.id} className="border p-4 mb-4 rounded opacity-70">

          <p className="font-bold text-blue-600">
            訂單編號：{order.orderNo || "-"}
          </p>

          <p>日期：{toDate(order.createdAt)?.toLocaleString()}</p>
          <p>姓名：{order.customer?.name}</p>
          <p className="text-sm text-purple-600">
                取貨方式：{getDeliveryLabel(order)}
          </p>
          <p className="text-sm text-gray-600">
  包裝：{
    order.selectedPackaging === "large"
      ? "大包裝"
      : order.selectedPackaging === "medium"
      ? "中包裝"
      : order.selectedPackaging === "small"
      ? "小包裝"
      : "-"
  }
</p>
          <div className="mt-3 space-y-2">
            {order.items?.map((item: any, i: number) => (
              <div key={i} className="flex gap-3 border-b pb-2">
                <img src={item.image} className="w-16 h-16 object-cover rounded" />
                <div className="flex-1">
                  <p className="font-bold">{item.name}</p>
                  <p>數量：{item.qty}</p>
                </div>
                <div>${item.price * item.qty}</div>
              </div>
            ))}
          </div>

          <p className="font-bold mt-3">總金額：${order.total}</p>
          <p className="text-right text-sm text-gray-600">
  成本：${getOrderCost(order)}
</p>
          <button
            onClick={() => toggleStatus(order)}
            className="bg-gray-500 text-white px-2 py-1 mt-2"
          >
            設為未出貨
          </button>
          
        </div>
      ))}
    </div>
  );
}