"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer,
  BarChart, Bar
} from "recharts";

type Mode = "month" | "week";

export default function OpsPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<any[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [mode, setMode] = useState<Mode>("month");

  const [filterMode, setFilterMode] = useState<"all" | "range">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "orders"));
      const list: any[] = [];
      snap.forEach((d) => list.push(d.data()));
      setOrders(list);
    })();
  }, []);

  const toDate = (o: any) =>
    o?.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : null;

  // 🔥 全域統一 filter（修正重點）
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterMode === "all") return true;

      if (!o.createdAt?.seconds) return false;

      const d = new Date(o.createdAt.seconds * 1000);

      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate + "T23:59:59")) return false;

      return true;
    });
  }, [orders, filterMode, startDate, endDate]);

  // 🔥 KPI
  const kpi = useMemo(() => {
    let revenue = 0;
    let cost = 0;

    filteredOrders.forEach((o) => {
      revenue += o.total || 0;
      cost += (o.costTotal || 0) + (o.packagingCost || 0);
    });

    return { revenue, cost, profit: revenue - cost };
  }, [filteredOrders]);

  // 🔥 趨勢
  const trendData = useMemo(() => {
    const map: Record<string, any> = {};

    filteredOrders.forEach((o) => {
      const d = toDate(o);
      if (!d || d.getFullYear() !== year) return;

      let key = "";

      if (mode === "month") {
        key = `${d.getMonth() + 1}月`;
      } else {
        const w = Math.ceil(d.getDate() / 7);
        key = `${d.getMonth() + 1}月-第${w}週`;
      }

      if (!map[key]) {
        map[key] = { period: key, revenue: 0, cost: 0, profit: 0 };
      }

      map[key].revenue += o.total || 0;
      map[key].cost += (o.costTotal || 0) + (o.packagingCost || 0);
      map[key].profit = map[key].revenue - map[key].cost;
    });

    return Object.values(map);
  }, [filteredOrders, year, mode]);

  // 🔥 排行
  const ranking = useMemo(() => {
    const map: Record<string, any> = {};

    filteredOrders.forEach((o) => {
      o.items?.forEach((it: any) => {
        if (!map[it.name]) {
          map[it.name] = { name: it.name, qty: 0, profit: 0 };
        }

        map[it.name].qty += it.qty;
        map[it.name].profit += (it.price - (it.cost || 0)) * it.qty;
      });
    });

    const list = Object.values(map);

    return {
      topSales: [...list].sort((a: any, b: any) => b.qty - a.qty).slice(0, 8),
      topProfit: [...list].sort((a: any, b: any) => b.profit - a.profit).slice(0, 8),
    };
  }, [filteredOrders]);

  return (
    <div className="p-6 space-y-6">

      <button
        onClick={() => router.push("/dashboard")}
        className="bg-green-500 text-white px-4 py-2"
      >
        ← 回後台
      </button>

      <h1 className="text-2xl font-bold">📊 圖表版營運後台</h1>

      {/* 🔥 篩選 UI（修正位置） */}
      <div className="flex gap-2 items-center">
        <button onClick={() => setFilterMode("all")} className="px-3 py-1 bg-blue-500 text-white">
          全部
        </button>
        <button onClick={() => setFilterMode("range")} className="px-3 py-1 bg-gray-500 text-white">
          區間
        </button>

        {filterMode === "range" && (
          <>
            <input type="date" onChange={(e)=>setStartDate(e.target.value)} className="border p-2"/>
            <input type="date" onChange={(e)=>setEndDate(e.target.value)} className="border p-2"/>
          </>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 border">
          <p>營收</p>
          <p className="text-xl font-bold">${kpi.revenue}</p>
        </div>
        <div className="p-4 bg-red-50 border">
          <p>成本</p>
          <p className="text-xl font-bold">${kpi.cost}</p>
        </div>
        <div className="p-4 bg-blue-50 border">
          <p>利潤</p>
          <p className="text-xl font-bold">${kpi.profit}</p>
        </div>
      </div>

      {/* 控制 */}
      <div className="flex gap-2">
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border p-2 w-28"
        />
        <button onClick={() => setMode("month")} className="bg-blue-500 text-white px-2">月</button>
        <button onClick={() => setMode("week")} className="bg-gray-500 text-white px-2">週</button>
      </div>
        <h2 className="font-bold text-lg mb-2">
            🔥 營收分析圖
        </h2>
      {/* 折線圖 */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line dataKey="revenue" />
          <Line dataKey="cost" />
          <Line dataKey="profit" />
        </LineChart>
      </ResponsiveContainer>
        <h2 className="font-bold text-lg mb-2">
            🔥 熱銷商品排行
        </h2>
      {/* 熱銷 */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={ranking.topSales}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="qty" />
        </BarChart>
      </ResponsiveContainer>
        <h2 className="font-bold text-lg mb-2">
            💰 高利潤商品排行
        </h2>
      {/* 利潤 */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={ranking.topProfit}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="profit" />
        </BarChart>
      </ResponsiveContainer>

    </div>
  );
}