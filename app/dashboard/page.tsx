"use client";

import { useEffect, useMemo, useState } from "react";
import { db, storage } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

type Donation = {
  id: string;
  donorName?: string;
  donorPhone?: string;
  amount?: number;
  units?: number;
  status?: string;
  createdAt?: any;
};

type Organization = { id: string; name: string };
type WeeklyRecord = {
  id: string;
  donationDate: string;
  organizationName: string;
  donationImageUrl?: string;
  receiptImageUrl?: string;
  createdAt?: any;
};

const confirmedStatuses = new Set(["confirmed", "paid", "completed", "已付款", "已確認", "已核對"]);
const dateText = (value: any): string => {
  if (!value) return "";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
};
const money = (n: number) => `NT$${Math.round(n || 0).toLocaleString("zh-TW")}`;

export default function OneHeartManager() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"stats" | "records">("stats");
  const [donations, setDonations] = useState<Donation[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [records, setRecords] = useState<WeeklyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newOrganization, setNewOrganization] = useState("");
  const [donationDate, setDonationDate] = useState(dateText(new Date()));
  const [organizationId, setOrganizationId] = useState("");
  const [donationPhoto, setDonationPhoto] = useState<File | null>(null);
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [statsDate, setStatsDate] = useState(dateText(new Date()));
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [donationSnap, orgSnap, recordSnap] = await Promise.all([
        getDocs(collection(db, "donations")),
        getDocs(query(collection(db, "donationOrganizations"), orderBy("name"))),
        getDocs(query(collection(db, "weeklyDonationRecords"), orderBy("donationDate", "desc"))),
      ]);
      setDonations(donationSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Donation)));
      setOrganizations(orgSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Organization)));
      setRecords(recordSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WeeklyRecord)));
    } catch (error) {
      console.error("一菜一心資料讀取失敗", error);
      alert("讀取一菜一心資料失敗，請確認 Firebase Firestore 規則與集合設定。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void loadData();
    // load only when the modal opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const confirmedDonations = useMemo(
    () => donations.filter((d) => confirmedStatuses.has(String(d.status || "").toLowerCase()) || confirmedStatuses.has(String(d.status || ""))),
    [donations]
  );
  const pendingDonations = donations.filter((d) => !confirmedStatuses.has(String(d.status || "").toLowerCase()) && !confirmedStatuses.has(String(d.status || "")));
  const dailyDonations = donations.filter((d) => dateText(d.createdAt) === statsDate);
  const rank = (period: "week" | "month") => {
    const now = new Date(`${statsDate}T12:00:00+08:00`);
    const start = new Date(now);
    if (period === "week") {
      const weekday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - weekday);
    } else start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (period === "week") end.setDate(end.getDate() + 7); else end.setMonth(end.getMonth() + 1);
    const map = new Map<string, { name: string; amount: number }>();
    confirmedDonations.forEach((d) => {
      const created = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || 0);
      if (Number.isNaN(created.getTime()) || created < start || created >= end) return;
      const key = `${(d.donorName || "未填姓名").trim()}_${(d.donorPhone || "").replace(/\D/g, "")}`;
      const current = map.get(key) || { name: d.donorName || "未填姓名", amount: 0 };
      current.amount += Number(d.amount || 0);
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  };
  const weeklyRank = useMemo(() => rank("week"), [confirmedDonations, statsDate]);
  const monthlyRank = useMemo(() => rank("month"), [confirmedDonations, statsDate]);

  const addOrganization = async () => {
    const name = newOrganization.trim();
    if (!name) return alert("請輸入機構名稱");
    if (organizations.some((o) => o.name.trim() === name)) return alert("這個機構已經存在");
    try {
      await addDoc(collection(db, "donationOrganizations"), { name, createdAt: serverTimestamp() });
      setNewOrganization("");
      await loadData();
      alert("機構已新增");
    } catch (error) {
      console.error(error);
      alert("新增機構失敗，請檢查 Firebase 權限");
    }
  };

  const uploadImage = async (file: File, folder: string) => {
    if (!file.type.startsWith("image/")) throw new Error("請選擇圖片檔案");
    if (file.size > 10 * 1024 * 1024) throw new Error("單張圖片請小於 10MB");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageRef = ref(storage, `one-heart/${folder}/${Date.now()}-${safeName}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  };

  const saveRecord = async () => {
    if (!donationDate) return alert("請選擇捐贈日期");
    const org = organizations.find((o) => o.id === organizationId);
    if (!org) return alert("請選擇受捐助機構");
    if (!donationPhoto || !receiptPhoto) return alert("請上傳實際捐贈照片與收據");
    setSaving(true);
    try {
      const [donationImageUrl, receiptImageUrl] = await Promise.all([
        uploadImage(donationPhoto, "donation-photos"),
        uploadImage(receiptPhoto, "receipts"),
      ]);
      await addDoc(collection(db, "weeklyDonationRecords"), {
        donationDate,
        organizationName: org.name,
        organizationId: org.id,
        donationImageUrl,
        receiptImageUrl,
        createdAt: serverTimestamp(),
      });
      setDonationPhoto(null);
      setReceiptPhoto(null);
      const photoInput = document.getElementById("one-heart-donation-photo") as HTMLInputElement | null;
      const receiptInput = document.getElementById("one-heart-receipt-photo") as HTMLInputElement | null;
      if (photoInput) photoInput.value = "";
      if (receiptInput) receiptInput.value = "";
      await loadData();
      alert("每週捐贈紀錄已儲存，前台可從 weeklyDonationRecords 讀取。");
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "儲存失敗，請確認 Firebase Storage / Firestore 權限");
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (record: WeeklyRecord) => {
    if (!confirm(`確定刪除 ${record.donationDate}「${record.organizationName}」這筆紀錄？`)) return;
    try {
      await deleteDoc(doc(db, "weeklyDonationRecords", record.id));
      await loadData();
    } catch (error) {
      console.error(error);
      alert("刪除失敗，請確認 Firebase 權限");
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="ml-2 mt-2 rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
        💚 一菜一心
      </button>
      {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white p-4 shadow-2xl md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold md:text-2xl">💚 一菜一心管理</h2>
            <button onClick={() => setOpen(false)} className="rounded bg-gray-200 px-3 py-2">關閉 ✕</button>
          </div>
          <div className="mb-5 flex gap-2 border-b">
            <button onClick={() => setTab("stats")} className={`rounded-t px-4 py-2 ${tab === "stats" ? "bg-emerald-600 text-white" : "bg-gray-100"}`}>捐贈統計</button>
            <button onClick={() => setTab("records")} className={`rounded-t px-4 py-2 ${tab === "records" ? "bg-emerald-600 text-white" : "bg-gray-100"}`}>每週捐贈紀錄</button>
          </div>
          {loading && <p className="mb-3 text-sm text-gray-500">資料載入中…</p>}
          {tab === "stats" ? <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-emerald-50 p-4"><p className="text-sm text-gray-600">已確認收款筆數</p><p className="text-2xl font-bold">{confirmedDonations.length}</p><p className="text-sm">實收 {money(confirmedDonations.reduce((s, d) => s + Number(d.amount || 0), 0))}</p></div>
              <div className="rounded-lg bg-amber-50 p-4"><p className="text-sm text-gray-600">待確認筆數</p><p className="text-2xl font-bold">{pendingDonations.length}</p><p className="text-sm">待確認 {money(pendingDonations.reduce((s, d) => s + Number(d.amount || 0), 0))}</p></div>
              <div className="rounded-lg bg-blue-50 p-4"><p className="text-sm text-gray-600">所選日期認捐筆數</p><p className="text-2xl font-bold">{dailyDonations.length}</p><p className="text-sm">認捐金額 {money(dailyDonations.reduce((s, d) => s + Number(d.amount || 0), 0))}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-3"><label className="font-medium">統計日期</label><input type="date" value={statsDate} onChange={(e) => setStatsDate(e.target.value)} className="rounded border p-2"/><span className="text-sm text-gray-500">每日名單顯示所選日期；週／月排行只計入已確認收款。</span></div>
            <section><h3 className="mb-2 text-lg font-bold">📅 每日捐贈名單（認捐紀錄）</h3><div className="overflow-x-auto rounded border"><table className="w-full text-left text-sm"><thead className="bg-gray-100"><tr><th className="p-2">姓名</th><th className="p-2">金額</th><th className="p-2">狀態</th></tr></thead><tbody>{dailyDonations.length ? dailyDonations.map((d) => <tr key={d.id} className="border-t"><td className="p-2">{d.donorName || "未填姓名"}</td><td className="p-2">{money(Number(d.amount || 0))}</td><td className="p-2"><span className={confirmedStatuses.has(String(d.status || "").toLowerCase()) || confirmedStatuses.has(String(d.status || "")) ? "font-semibold text-emerald-700" : "text-amber-700"}>{confirmedStatuses.has(String(d.status || "").toLowerCase()) || confirmedStatuses.has(String(d.status || "")) ? "已確認收款" : `待確認（${d.status || "pending"}）`}</span></td></tr>) : <tr><td colSpan={3} className="p-4 text-center text-gray-500">這一天沒有捐贈紀錄</td></tr>}</tbody></table></div></section>
            <div className="grid gap-5 lg:grid-cols-2"><section><h3 className="mb-2 text-lg font-bold">🏆 本週累計排行（已確認收款）</h3><RankTable rows={weeklyRank}/></section><section><h3 className="mb-2 text-lg font-bold">🏆 本月累計排行（已確認收款）</h3><RankTable rows={monthlyRank}/></section></div>
            <p className="text-xs text-gray-500">同一捐贈者依「姓名＋手機」合併；手機只用於內部辨識，不顯示於畫面。若你的付款確認狀態不是 confirmed／paid／completed／已付款／已確認／已核對，請將實際狀態值加入程式中的 confirmedStatuses。</p>
          </div> : <div className="space-y-6">
            <section className="rounded-lg border p-4"><h3 className="mb-3 text-lg font-bold">新增受捐助機構</h3><div className="flex flex-col gap-2 sm:flex-row"><input value={newOrganization} onChange={(e) => setNewOrganization(e.target.value)} placeholder="輸入機構名稱" className="min-w-0 flex-1 rounded border p-2"/><button onClick={addOrganization} className="rounded bg-blue-600 px-4 py-2 text-white">＋ 新增機構</button></div><p className="mt-2 text-sm text-gray-500">目前機構：{organizations.length ? organizations.map((o) => o.name).join("、") : "尚未新增"}</p></section>
            <section className="rounded-lg border p-4"><h3 className="mb-3 text-lg font-bold">新增每週捐贈紀錄</h3><div className="grid gap-4 md:grid-cols-2"><label className="block text-sm font-medium">捐贈日期<input type="date" value={donationDate} onChange={(e) => setDonationDate(e.target.value)} className="mt-1 block w-full rounded border p-2"/></label><label className="block text-sm font-medium">受捐助機構<select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">請選擇機構</option>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label className="block text-sm font-medium">實際捐贈照片<input id="one-heart-donation-photo" type="file" accept="image/*" onChange={(e) => setDonationPhoto(e.target.files?.[0] || null)} className="mt-1 block w-full rounded border p-2"/><span className="mt-1 block text-xs text-gray-500">圖片格式，單張 10MB 以下</span></label><label className="block text-sm font-medium">捐贈收據<input id="one-heart-receipt-photo" type="file" accept="image/*" onChange={(e) => setReceiptPhoto(e.target.files?.[0] || null)} className="mt-1 block w-full rounded border p-2"/><span className="mt-1 block text-xs text-gray-500">圖片格式，單張 10MB 以下</span></label></div><button disabled={saving} onClick={saveRecord} className="mt-4 rounded bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "上傳及儲存中…" : "儲存捐贈紀錄"}</button></section>
            <section><h3 className="mb-3 text-lg font-bold">已建立的每週捐贈紀錄</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{records.map((r) => <article key={r.id} className="overflow-hidden rounded-lg border"><div className="p-3"><p className="font-bold">{r.donationDate}｜{r.organizationName}</p></div><div className="grid grid-cols-2 gap-2 px-3"><button onClick={() => { setPreviewUrl(r.donationImageUrl || ""); setPreviewTitle("實際捐贈照片"); }} className="rounded bg-blue-50 px-2 py-2 text-sm text-blue-700">查看捐贈照片</button><button onClick={() => { setPreviewUrl(r.receiptImageUrl || ""); setPreviewTitle("捐贈收據"); }} className="rounded bg-amber-50 px-2 py-2 text-sm text-amber-700">查看收據</button></div><button onClick={() => removeRecord(r)} className="m-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">刪除紀錄</button></article>)}{!records.length && <p className="text-sm text-gray-500">尚未建立捐贈紀錄。</p>}</div></section>
          </div>}
        </div>
      </div>}
      {previewUrl && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewUrl(""); }}><div className="max-h-[95vh] max-w-4xl rounded-lg bg-white p-3"><div className="mb-2 flex items-center justify-between gap-4"><h3 className="font-bold">{previewTitle}</h3><button onClick={() => setPreviewUrl("")} className="rounded bg-gray-200 px-3 py-1">關閉</button></div><img src={previewUrl} alt={previewTitle} className="max-h-[80vh] max-w-full object-contain"/></div></div>}
    </>
  );
}

function RankTable({ rows }: { rows: { name: string; amount: number }[] }) {
  return <div className="overflow-x-auto rounded border"><table className="w-full text-left text-sm"><thead className="bg-gray-100"><tr><th className="p-2">排名</th><th className="p-2">捐贈者</th><th className="p-2">累計金額</th></tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={`${r.name}-${i}`} className="border-t"><td className="p-2">{i + 1}</td><td className="p-2">{r.name}</td><td className="p-2">{money(r.amount)}</td></tr>) : <tr><td colSpan={3} className="p-4 text-center text-gray-500">尚無已確認收款資料</td></tr>}</tbody></table></div>;
}
