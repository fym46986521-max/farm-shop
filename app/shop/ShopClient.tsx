"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  getCountFromServer,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { useRouter} from "next/navigation";
import liff from "@line/liff";
function formatDonationDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "日期待確認";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "日期待確認";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
const weeklyDonationRecords: WeeklyDonationRecord[] = [];
type WeeklyDonationRecord = {
  id: string;
  donationDate: string;
  organizationName: string;
  donationImageUrl: string;
  receiptImageUrl: string;
};
export default function ShopClient() {
  const router = useRouter();
  

  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  useEffect(() => {

  const savedCart = localStorage.getItem("cart");

  if (savedCart) {

    try {

      setCart(JSON.parse(savedCart));

    } catch (err) {

      console.error("購物車讀取失敗", err);
    }
  }

}, []);
  const [openCart, setOpenCart] = useState(false);
const [selectedDonationImage, setSelectedDonationImage] =
  useState<{
    title: string;
    imageUrl: string;
  } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qty, setQty] = useState(1);

  const [category, setCategory] = useState("全部");

// 主分頁：商品商城 / 一菜一心公益計畫
const [activeTab, setActiveTab] = useState<"shop" | "donation">("shop");

// 收據預覽視窗
const [selectedDonationReceipt, setSelectedDonationReceipt] = useState<string | null>(null);
// 一菜一心認捐彈窗
const [showDonationModal, setShowDonationModal] = useState(false);
// 公益捐款明細彈窗
const [showDonationRecords, setShowDonationRecords] = useState(false);
// 一菜一心：農場實際捐贈紀錄
const [weeklyDonationRecords, setWeeklyDonationRecords] = useState<any[]>([]);
// 每週捐贈紀錄：Firestore 分頁
const WEEKLY_PAGE_SIZE = 10;

const [weeklyDonationPage, setWeeklyDonationPage] = useState(1);

const [weeklyTotalPages, setWeeklyTotalPages] = useState(1);

const [weeklyDonationLoading, setWeeklyDonationLoading] = useState(false);

// 記錄每一頁最後一筆文件，供 Firestore 下一頁查詢使用
const [weeklyPageCursors, setWeeklyPageCursors] = useState<
  (QueryDocumentSnapshot<DocumentData> | null)[]
>([null]);

const [selectedWeeklyImage, setSelectedWeeklyImage] = useState<string | null>(null);
// 公益明細彈窗分頁
const [donationRecordsTab, setDonationRecordsTab] = useState<
  "records" | "weekly">("records");
// 認捐人資料
const [donorName, setDonorName] = useState("");
const [donorPhone, setDonorPhone] = useState("");
const [donorAccountLast5, setDonorAccountLast5] = useState("");

// 認捐流程步驟：1 填寫資料、2 查看匯款資訊
const [donationStep, setDonationStep] = useState<1 | 2>(1);
const [donationUnits, setDonationUnits] = useState(1);
// 捐款類型：自由捐款／每月扣繳捐款
const [donationType, setDonationType] = useState<
  "free" | "monthly"
>("free");

const donationAmount =
  donationType === "monthly"
    ? 12000
    : donationUnits * 100;
const [donationSubmitting, setDonationSubmitting] = useState(false);
const [showEmptyAlert, setShowEmptyAlert] = useState(false);
const [lineUserId, setLineUserId] = useState("");
// 捐款明細搜尋
const [donationSearchType, setDonationSearchType] =
  useState<"name" | "phone">("name");

const [donationSearchInput, setDonationSearchInput] =
  useState("");

const [donationSearchKeyword, setDonationSearchKeyword] =
  useState("");

// 捐款明細分頁
const DONATION_PAGE_SIZE = 20;

const [donationRecords, setDonationRecords] =
  useState<any[]>([]);
 



// 目前頁面要顯示的紀錄
const paginatedWeeklyDonationRecords = weeklyDonationRecords.slice(
  (weeklyDonationPage - 1) * WEEKLY_PAGE_SIZE,
  weeklyDonationPage * WEEKLY_PAGE_SIZE
);
// 定期捐款方案
const [monthlyDonationPlans, setMonthlyDonationPlans] =
  useState<any[]>([]);

// 定期捐款每月紀錄
const [monthlyDonationRecords, setMonthlyDonationRecords] =
  useState<any[]>([]);

// 定期捐款資料載入狀態
const [monthlyDonationLoading, setMonthlyDonationLoading] =
  useState(false);
// 前台收據照片視窗
const [selectedReceiptUrl, setSelectedReceiptUrl] =
  useState("");
const [donationRecordsLoading, setDonationRecordsLoading] =
  useState(false);

const [donationRecordsError, setDonationRecordsError] =
  useState("");

// 捐款明細總筆數
const [donationTotalCount, setDonationTotalCount] =
  useState(0);

// 捐款明細目前頁碼
const [donationPage, setDonationPage] =
  useState(1);

// 捐款明細總頁數：直接採用 API 回傳的結果
const [donationTotalPages, setDonationTotalPages] =
  useState(1);

// API 分頁游標：每個頁碼對應該頁開始前的游標
const [donationPageCursors, setDonationPageCursors] =
  useState<(string | null)[]>([null]);



  const fetchProducts = async () => {
  const snapshot = await getDocs(collection(db, "products"));
  const list: any[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.active !== false) {
      list.push({ id: doc.id, ...data });
    }
  });

  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  setProducts(list);

  // ⭐⭐⭐ 加這行（存快取）
  localStorage.setItem("products", JSON.stringify(list));
};
// 載入定期捐款方案及每月記錄
const loadMonthlyDonationData = async () => {
  setMonthlyDonationLoading(true);

  try {
    const [plansSnapshot, recordsSnapshot] = await Promise.all([
      getDocs(collection(db, "monthlyDonationPlans")),
      getDocs(collection(db, "monthlyDonationRecords")),
    ]);

    const plans = plansSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    const records = recordsSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    setMonthlyDonationPlans(plans);
    setMonthlyDonationRecords(records);
  } catch (error) {
    console.error("載入定期捐款資料失敗：", error);
    alert("定期捐款資料載入失敗，請稍後再試。");
  } finally {
    setMonthlyDonationLoading(false);
  }
};
  

useEffect(() => {

  // ⭐ 先讀快取
  const cached = localStorage.getItem("products");

  if (cached) {

    try {

      const parsed = JSON.parse(cached);

      setProducts(parsed);

      console.log("⚡ 使用快取商品");

    } catch (err) {

      console.error("快取解析失敗", err);
    }
  }

  const init = async () => {

    try {

      await liff.init({
        liffId: process.env.NEXT_PUBLIC_LIFF_ID!,
      });

      

      // ⭐ 已登入才抓 profile
      // ⭐ 已登入才抓 profile
if (liff.isLoggedIn()) {

  const profile = await liff.getProfile();

  setLineUserId(profile.userId);

  localStorage.setItem(
    "lineUserId",
    profile.userId
  );

  console.log("LINE登入成功", profile);

  // ⭐ 登入後自動 checkout
  const params = new URLSearchParams(window.location.search);

  if (params.get("checkout") === "1") {

    router.push("/checkout");
  }

} else {

  console.log("尚未LINE登入");
}

    } catch (err) {

      console.error("LIFF初始化失敗", err);
    }
  };

  init();

  // ⭐ 背景更新 Firebase 商品
  fetchProducts();

}, []);

  const filteredProducts =
    category === "全部"
      ? products
      : products.filter((p) => p.category === category);

  const addToCart = (item: any) => {

  // ⭐ 找商品最新庫存
  const product = products.find((p) => p.id === item.id);

  if (!product) {
    alert("商品不存在");
    return;
  }

  // ⭐ 已存在購物車數量
  const exist = cart.find((c) => c.id === item.id);

  const currentQty = exist ? exist.qty : 0;

  // ⭐ 總數量
  const finalQty = currentQty + item.qty;

  // ⭐ 超過庫存
  if (finalQty > (product.stock || 0)) {
    alert("庫存不足，請重新選購");
    return;
  }

  // ⭐ 沒庫存
  if ((product.stock || 0) <= 0) {
    alert("商品已售完");
    return;
  }

  let newCart;

  if (exist) {
    newCart = cart.map((c) =>
      c.id === item.id
        ? { ...c, qty: c.qty + item.qty }
        : c
    );
  } else {
    newCart = [...cart, item];
  }

  setCart(newCart);

  localStorage.setItem(
    "cart",
    JSON.stringify(newCart)
  );
};

  const changeQty = (id: string, delta: number) => {
    const newCart = cart.map((item) =>
      item.id === id
        ? { ...item, qty: Math.max(1, item.qty + delta) }
        : item
    );
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const removeItem = (id: string) => {
    const newCart = cart.filter((item) => item.id !== id);
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
// 載入捐款明細
// 載入捐款明細
const loadDonationRecords = async (
  page = 1,
  keyword = donationSearchKeyword,
  searchType = donationSearchType
) => {
  setDonationRecordsLoading(true);
  setDonationRecordsError("");

  try {
    const normalizedKeyword = keyword.trim();

    // 搜尋條件改變時，從第一頁重新查詢。
    const isNewSearch =
      normalizedKeyword !== donationSearchKeyword.trim() ||
      searchType !== donationSearchType;

    const targetPage = isNewSearch ? 1 : page;

    const params = new URLSearchParams({
      page: String(targetPage),
      keyword: normalizedKeyword,
      searchType,
    });

    // 搜尋模式不使用一般瀏覽的游標。
    if (!normalizedKeyword && targetPage > 1) {
      const cursor = donationPageCursors[targetPage - 1];

      if (!cursor) {
        throw new Error("找不到分頁游標，請重新載入捐款明細。");
      }

      params.set("cursor", cursor);
    }

    const response = await fetch(
      `/api/donations?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error || "捐款紀錄載入失敗"
      );
    }

    setDonationRecords(result.records || []);
setDonationTotalCount(result.totalCount || 0);
setDonationPage(result.page || 1);

// 使用 API 回傳的總頁數，避免前台自行計算造成下一頁被鎖住
setDonationTotalPages(
  Math.max(1, Number(result.totalPages) || 1)
);

    if (normalizedKeyword) {
      // 搜尋模式仍由 API 依頁碼切頁。
      setDonationPageCursors([null]);
    } else {
      setDonationPageCursors((previous) => {
        const next = [...previous];

        // 記錄下一頁開始時應使用的游標。
        if (result.nextCursor) {
          next[targetPage] = result.nextCursor;
        } else {
          next.length = targetPage + 1;
        }

        return next;
      });
    }
  } catch (error) {
    console.error("載入捐款明細失敗：", error);

    setDonationRecordsError(
      error instanceof Error
        ? error.message
        : "捐款紀錄載入失敗，請稍後再試。"
    );
  } finally {
    setDonationRecordsLoading(false);
  }
};const submitDonation = async () => {
  if (donationSubmitting) return;

  const name = donorName.trim();
  const phone = donorPhone.trim();

  if (!name) {
    alert("請輸入捐款人姓名");
    return;
  }

  if (!/^09\d{8}$/.test(phone)) {
    alert("請輸入正確的台灣手機號碼");
    return;
  }

  if (!/^\d{5}$/.test(donorAccountLast5)) {
    alert("請輸入正確的 5 位數字帳號末碼");
    return;
  }

  if (
  donationType === "free" &&
  (
    !Number.isSafeInteger(donationUnits) ||
    donationUnits < 1 ||
    donationUnits > 10000
  )
) {
  alert("認捐單位數不正確");
  return;
}

  setDonationSubmitting(true);

  try {
    const response = await fetch("/api/donations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  donorName: name,
  donorPhone: phone,
  donorAccountLast5,
  donationType,
  units: donationType === "monthly" ? 120 : donationUnits,
}),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "認捐資料送出失敗，請稍後再試。"
      );
    }

    alert(
      `認捐資料已送出！\n認捐金額：NT$${donationType === "monthly" ? 12000 : donationUnits * 100}\n請等待農場聯繫核對。`
    );

    setShowDonationModal(false);
    setDonationStep(1);
    setDonorName("");
    setDonorPhone("");
    setDonorAccountLast5("");
    setDonationUnits(1);
  } catch (error) {
    console.error("認捐送出失敗：", error);

    alert(
      error instanceof Error
        ? error.message
        : "認捐資料送出失敗，請稍後再試。"
    );
  } finally {
    setDonationSubmitting(false);
  }
};
// 載入農場實際捐贈紀錄：Firestore 真正分頁
const loadWeeklyDonationRecords = async (targetPage: number = 1) => {
  setWeeklyDonationLoading(true);

  try {
    // 取得總筆數，不下載所有捐贈紀錄
    const countSnapshot = await getCountFromServer(
      collection(db, "weeklyDonationRecords")
    );

    const totalCount = countSnapshot.data().count;

    const totalPages = Math.max(
      1,
      Math.ceil(totalCount / WEEKLY_PAGE_SIZE)
    );

    setWeeklyTotalPages(totalPages);

    // 避免切換到不存在的頁數
    const safePage = Math.min(
      Math.max(1, targetPage),
      totalPages
    );

    setWeeklyDonationPage(safePage);

    if (totalCount === 0) {
      setWeeklyDonationRecords([]);
      setWeeklyPageCursors([null]);
      return;
    }

    // 以捐贈日期由新到舊排序
    // donationDate 格式應為 YYYY-MM-DD
    const baseQuery = query(
      collection(db, "weeklyDonationRecords"),
      orderBy("donationDate", "desc"),
      orderBy("createdAt", "desc")
    );

    // 取得目前頁數所需的游標
    let cursor = weeklyPageCursors[safePage - 1] ?? null;

    // 如果尚未建立目標頁的游標，逐頁取得游標
    if (safePage > 1 && !cursor) {
      let previousCursor =
        weeklyPageCursors[weeklyPageCursors.length - 1] ?? null;

      let currentCursorPage = weeklyPageCursors.length;

      while (currentCursorPage < safePage) {
        let cursorQuery = query(
          baseQuery,
          limit(WEEKLY_PAGE_SIZE)
        );

        if (previousCursor) {
          cursorQuery = query(
            baseQuery,
            startAfter(previousCursor),
            limit(WEEKLY_PAGE_SIZE)
          );
        }

        const cursorSnapshot = await getDocs(cursorQuery);

        if (cursorSnapshot.empty) {
          break;
        }

        previousCursor =
          cursorSnapshot.docs[cursorSnapshot.docs.length - 1];

        currentCursorPage += 1;

        setWeeklyPageCursors((prev) => {
          const next = [...prev];
          next[currentCursorPage - 1] = previousCursor;
          return next;
        });
      }

      cursor = previousCursor;
    }

    // 查詢目前頁面的 10 筆資料
    let pageQuery = query(
      baseQuery,
      limit(WEEKLY_PAGE_SIZE)
    );

    if (safePage > 1 && cursor) {
      pageQuery = query(
        baseQuery,
        startAfter(cursor),
        limit(WEEKLY_PAGE_SIZE)
      );
    }

    const snapshot = await getDocs(pageQuery);

    const records = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    setWeeklyDonationRecords(records);

    // 保存目前頁面的最後一筆文件，供下一頁使用
    if (!snapshot.empty) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];

      setWeeklyPageCursors((prev) => {
        const next = [...prev];
        next[safePage] = lastDoc;
        return next;
      });
    }
  } catch (error) {
    console.error("載入農場實際捐贈紀錄失敗：", error);
  } finally {
    setWeeklyDonationLoading(false);
  }
};
// 開啟公益捐款明細彈窗的「每週捐贈紀錄」分頁時，重新載入資料
useEffect(() => {
  if (showDonationRecords && donationRecordsTab === "weekly") {
    setWeeklyDonationPage(1);
    loadWeeklyDonationRecords(1);
  }
}, [showDonationRecords, donationRecordsTab]);
// 載入每月定期捐款資料
useEffect(() => {
  if (showDonationRecords) {
    loadMonthlyDonationData();
  }
}, [showDonationRecords]);
  return (
    
    <div
  className="min-h-screen bg-[#f7f4ea] border border-[#e8e2d3] text-gray-900"
>

      {/* LOGO */}
      <div className="w-full">

  <img
    src="/images/logo.jpg"
    className="
      w-full
      object-cover
      block
    "
  />

</div>

{/* 主分頁：商品商城 / 一菜一心公益計畫 */}
<div className="sticky top-0 z-40 bg-[#f7f4ea] px-3 py-3">
  <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">

    <button
      onClick={() => setActiveTab("shop")}
      className={`py-3 px-2 rounded-xl font-bold text-base transition ${
        activeTab === "shop"
          ? "bg-green-600 text-white shadow-md"
          : "bg-white text-green-700 border border-green-200"
      }`}
    >
      🛒 商品商城
    </button>

    <button
      onClick={() => setActiveTab("donation")}
      className={`py-3 px-2 rounded-xl font-bold text-base transition ${
        activeTab === "donation"
          ? "bg-orange-500 text-white shadow-md"
          : "bg-white text-orange-600 border border-orange-200"
      }`}
    >
      💚 一菜一心公益計畫
    </button>

  </div>
</div>

      {/* 🛒 浮動購物車 */}
<div className="fixed bottom-5 right-5 z-50">
  <button
    onClick={() => setOpenCart(true)}
    className="bg-[#5cab63] text-white rounded-full shadow-2x1 border-4 border-white/70 px-4 py-3 flex flex-col items-center text-xs"
  >
    <span className="text-lg">🛒</span>
    <span>${total}</span>
    <span className="text-[10px]">購物車點我</span>
  </button>
</div>

        {openCart && (
  <div
    className="fixed inset-0 bg-black/40 z-50 flex justify-end"
    onClick={() => setOpenCart(false)}   // ⭐ 點背景關閉
  >
    <div
      className="w-80 bg-white text-black h-full p-4 flex flex-col shadow-xl"
      onClick={(e) => e.stopPropagation()} // ⭐ 防止點裡面關閉
    >


      {/* 標題 */}
      <div className="flex justify-between mb-3">
        <h2 className="font-bold text-lg">🛒 購物車</h2>
        <button onClick={() => setOpenCart(false)}>✕</button>
      </div>

      {/* 商品 */}
      <div className="flex-1 overflow-y-auto">
        {cart.map((item) => (
          <div key={item.id} className="flex gap-2 mb-3">
            <img src={item.image} className="w-14 h-14 rounded object-cover" />
            <div className="flex-1 text-sm">
              <p className="font-bold">{item.name}</p>
              <p>單價:${item.price}</p>

              <div className="flex gap-2 items-center">
                <p>數量:</p>
                <button onClick={() => changeQty(item.id, -1)}>－</button>
                <span>{item.qty}</span>
                <button onClick={() => changeQty(item.id, 1)}>＋</button>
              </div>

              <p>小計:${item.price * item.qty}</p>
              <button onClick={() => removeItem(item.id)} className="text-red-500 text-xs">
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 總金額 */}
      <div className="font-bold mb-2">總金額：${total}</div>

      {/* 結帳 */}
      {/* 結帳 */}
<button
  onClick={async () => {

    if (cart.length === 0) {
      setShowEmptyAlert(true);
      return;
    }

    try {

      // ⭐ 保證 LIFF 初始化
      // ⭐ 保證 LIFF 初始
// ⭐ 未登入就 LINE Login
if (!liff.isLoggedIn()) {

  liff.login({
    redirectUri: "https://judoufarm.com/shop?checkout=1",
  });

  return;
}

      // ⭐ 已登入直接進 checkout
      router.push("/checkout");

    } catch (err) {

      console.error("結帳失敗", err);

      alert("LINE登入失敗");
    }
  }}
  className="bg-green-600 text-white py-3 rounded-lg"
>
  結帳
</button>
    </div>
    </div>
)}
    
      {/* 商品商城分頁內容 */}
{activeTab === "shop" && (
  <div className="
  bg-white/75
  backdrop-blur-lg
  p-4
  rounded-[32px]
  shadow-2xl
  border border-white/40
">


        <div className="sticky top-0 z-40 pb-2">
          <h1 className="text-lg font-bold mb-2">商品商城</h1>

          <div className="flex gap-2 overflow-x-auto">
            {["全部", "水果", "蔬菜","加工農產品", "其他"].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-2 rounded text-sSm font-semibold ${
                  category === c ? "bg-green-500 text-white" : "bg-gray-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          {filteredProducts.map((item) => (
            <div key={item.id} className="
  bg-white/90
  backdrop-blur-md
  rounded-3xl
  shadow-xl
  p-3
  border border-white/50
  hover:scale-[1.02]
  transition
">

              <div className="relative w-full h-[220px] flex items-center justify-center bg-gradient-to-b from-white to-green-50 rounded">

  {(item.stock || 0) <= 0 && (
    <div
      className="
        absolute top-2 right-2
        bg-red-500 text-white
        text-xs px-2 py-1
        rounded-full z-10
      "
    >
      已售完
    </div>
  )}

  <img src={item.image} className="max-h-[200px] object-contain" />
</div>

              <p className="font-bold mt-2 text-base leading-tight">
                {item.name}
              </p>

              <p className="text-sm text-black line-clamp-2">
  {item.description}
</p>

<p className="text-green-600 font-bold text-lg mt-1">
  ${item.price}
</p>

<p className="text-sm text-blue-600 mt-1">
  剩餘庫存：{item.stock || 0}
</p>
              <button
                onClick={() => {
                  setSelectedProduct(item);
                  setQty(1);
                }}
                className="bg-green-500 text-white w-full mt-2 py-3 rounded-xl text-base font-bold active:scale-95"
              >
                加入購物車
              </button>
            </div>
          ))}
        </div>
      </div>
      )}
      {/* 一菜一心公益計畫分頁內容 */}
{activeTab === "donation" && (
  <div className="px-4 pb-10">

    <div className="max-w-3xl mx-auto overflow-hidden rounded-3xl bg-white shadow-xl">

      {/* 公益主視覺 */}
      <div className="bg-gradient-to-br from-green-700 to-green-500 px-6 py-10 text-center text-white">

        <p className="text-sm tracking-[0.3em] mb-3">
          JIUDOU FARM CHARITY
        </p>

        <h1 className="text-3xl font-black mb-4">
          一菜一心
        </h1>

        <p className="text-lg font-bold">
          讓每一份新鮮蔬菜，都成為一份溫暖的關懷
        </p>

      </div>

      <div className="p-6">

        {/* 公益理念 */}
        <h2 className="text-xl font-black text-green-800 mb-4">
          💚 以慈悲為本，讓愛走進方舟
        </h2>

        <p className="text-gray-700 leading-8">
          九斗合作農場發起「一菜一心公益計畫」，希望透過新鮮有機蔬菜，
          將來自土地的關懷送進方舟啟智教養院。
          <br /><br />
          「一菜」代表一份實際的關懷，
          「一心」代表一份真誠的慈悲。
          我們希望集結每一位認捐者的力量，
          讓愛不只停留在心裡，而是真正送到需要的人手中。
        </p>

        {/* 每週公益目標 */}
        <div className="grid grid-cols-2 gap-3 mt-6">

          <div className="bg-green-50 rounded-2xl p-4 text-center">
            <p className="text-sm text-gray-600">
              每週配送
            </p>

            <p className="text-3xl font-black text-green-700 mt-2">
              50 公斤
            </p>

            <p className="text-xs text-gray-500 mt-1">
              新鮮有機蔬菜
            </p>
          </div>

          <div className="bg-orange-50 rounded-2xl p-4 text-center">
            <p className="text-sm text-gray-600">
              每週認捐目標
            </p>

            <p className="text-3xl font-black text-orange-600 mt-2">
              NT$5,000
            </p>

            <p className="text-xs text-gray-500 mt-1">
              新臺幣
            </p>
          </div>
        </div>
        {/* 一菜一心 × ESG 永續公益理念 */}
<section className="mt-8 w-full min-w-0 self-stretch">

  {/* 標題 */}
  <div className="mb-6 w-full text-center">

    <span className="inline-block rounded-full bg-green-100 px-4 py-2 text-sm font-bold tracking-widest text-green-800">
      SUSTAINABLE CHARITY
    </span>

    <h2 className="mt-4 text-2xl font-black text-green-900">
      一菜一心 × ESG
    </h2>

    <p className="mt-2 text-base font-bold text-gray-600">
      以土地孕育善意，以行動實踐永續
    </p>

    <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-green-500" />

  </div>

  {/* ESG 理念介紹 */}
  <div className="mb-5 w-full min-w-0 rounded-2xl bg-gradient-to-br from-green-50 to-[#f7f4ea] p-5 sm:p-6">

    <p className="text-sm leading-8 text-gray-700">
      我們相信，真正的公益不只是付出，更是讓善意持續發生。
      九斗合作農場發起「一菜一心」公益計畫，將新鮮蔬菜送進方舟啟智教養院，
      從土地友善、社會關懷到公益透明，實踐 ESG 永續理念。
      讓每一份蔬菜承載關懷，讓每一顆善心匯聚成改變的力量。
    </p>

  </div>

  {/* E：環境永續 */}
  <div className="mb-4 w-full min-w-0 overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">

    <div className="bg-gradient-to-r from-green-700 to-green-500 p-4 text-white">

      <p className="text-xs font-bold tracking-widest text-green-100">
        ENVIRONMENTAL
      </p>

      <h3 className="mt-1 text-xl font-black">
        🌱 E｜環境永續
      </h3>

      <p className="mt-1 text-sm text-green-50">
        從友善土地開始，讓永續融入日常
      </p>

    </div>

    <div className="p-5">

      <p className="text-sm leading-8 text-gray-700">
        透過有機、友善耕作及在地新鮮蔬菜的支持，
        以實際行動支持永續農業發展，並鼓勵食物在地化，
        讓土地與生活形成更友善的循環。
      </p>

      <div className="mt-4 rounded-xl bg-green-50 p-4">

        <p className="font-bold leading-7 text-green-800">
          「一菜」不只是送菜，更是對土地的珍惜，也是支持友善環境的行動。
        </p>

      </div>

    </div>

  </div>

  {/* S：社會關懷 */}
  <div className="mb-4 w-full min-w-0 overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">

    <div className="bg-gradient-to-r from-emerald-700 to-teal-600 p-4 text-white">

      <p className="text-xs font-bold tracking-widest text-emerald-100">
        SOCIAL
      </p>

      <h3 className="mt-1 text-xl font-black">
        💚 S｜社會關懷
      </h3>

      <p className="mt-1 text-sm text-emerald-50">
        讓每一份蔬菜，都成為溫暖的陪伴
      </p>

    </div>

    <div className="p-5">

      <p className="text-sm leading-8 text-gray-700">
        「一菜一心」以實際行動關懷方舟啟智教養院，
        定期配送新鮮蔬菜，支持院童的日常飲食需求。
        我們邀請更多人一起參與認捐，讓愛不只是個人的付出，
        更成為社會共同成就的善循環。
      </p>

      <div className="mt-4 rounded-xl bg-emerald-50 p-4">

        <p className="font-bold leading-7 text-emerald-800">
          「一心」就是把關懷化成實際行動，讓每一份善意都能抵達需要的地方。
        </p>

      </div>

    </div>

  </div>

  {/* G：公益透明 */}
  <div className="mb-4 w-full min-w-0 overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">

    <div className="bg-gradient-to-r from-amber-700 to-yellow-600 p-4 text-white">

      <p className="text-xs font-bold tracking-widest text-amber-100">
        GOVERNANCE
      </p>

      <h3 className="mt-1 text-xl font-black">
        🤝 G｜公益透明
      </h3>

      <p className="mt-1 text-sm text-amber-50">
        讓每一份善意，都有清楚的紀錄
      </p>

    </div>

    <div className="p-5">

      <p className="text-sm leading-8 text-gray-700">
        我們重視每一位認捐者的信任，也相信公益需要透明、
        負責任的執行方式。蔬菜配送至方舟啟智教養院後，
        將開立相關收據並拍照存證，留下配送紀錄，
        讓每一份支持都有跡可循。
      </p>

      <div className="mt-4 space-y-3">

        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4">

          <span className="text-2xl">🥬</span>

          <div>
            <p className="font-bold text-gray-800">
              第一步｜準備新鮮蔬菜
            </p>

            <p className="mt-1 text-sm leading-6 text-gray-600">
              依公益計畫安排準備配送蔬菜。
            </p>
          </div>

        </div>

        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4">

          <span className="text-2xl">🚚</span>

          <div>
            <p className="font-bold text-gray-800">
              第二步｜送達方舟啟智教養院
            </p>

            <p className="mt-1 text-sm leading-6 text-gray-600">
              將蔬菜實際配送至指定單位。
            </p>
          </div>

        </div>

        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4">

          <span className="text-2xl">📷</span>

          <div>
            <p className="font-bold text-gray-800">
              第三步｜收據與照片存證
            </p>

            <p className="mt-1 text-sm leading-6 text-gray-600">
              配送後開立相關收據並拍照留存，作為公益執行紀錄。
            </p>
          </div>

        </div>

      </div>

      <div className="mt-4 rounded-xl bg-[#f7f4ea] p-4">

        <p className="font-bold leading-7 text-amber-900">
          有愛心，也有制度；有善意，也有責任。
        </p>

      </div>

    </div>

  </div>

  {/* ESG 收尾 */}
  <div className="mt-5 w-full min-w-0 rounded-2xl bg-gradient-to-br from-green-800 to-green-600 p-6 text-center text-white shadow-lg">

    <p className="text-xs font-bold tracking-[0.2em] text-green-100">
      ONE VEGETABLE · ONE HEART
    </p>

    <h3 className="mt-4 text-2xl font-black">
      一菜，連結土地
    </h3>

    <h3 className="mt-1 text-2xl font-black">
      一心，溫暖生命
    </h3>

    <p className="mt-4 text-sm leading-7 text-green-50">
      邀請您與九斗合作農場一起，讓友善農業、社會關懷與公益透明成為日常，
      讓每一份來自土地的心意，都能持續傳遞溫暖。
    </p>

  </div>

</section>
        </div>
        
        {/* 認捐區 */}
        <div className="mt-6 w-full min-w-0 rounded-2xl border border-green-200 p-5">

          <h2 className="text-xl font-black text-gray-800 mb-3">
            🥬 加入一菜一心認捐行動
          </h2>

          <div className="mb-4 grid grid-cols-2 gap-3">
  <button
    type="button"
    onClick={() => setDonationType("free")}
    className={`rounded-xl border-2 px-3 py-3 font-bold transition ${
      donationType === "free"
        ? "border-green-600 bg-green-600 text-white"
        : "border-green-200 bg-white text-green-700"
    }`}
  >
    🥬 自由捐款
  </button>

  <button
    type="button"
    onClick={() => setDonationType("monthly")}
    className={`rounded-xl border-2 px-3 py-3 font-bold transition ${
      donationType === "monthly"
        ? "border-orange-500 bg-orange-500 text-white"
        : "border-orange-200 bg-white text-orange-600"
    }`}
  >
    💚 每月定期捐款
  </button>
</div>

{donationType === "free" ? (
  <p className="text-gray-600 leading-7">
    每認捐一單位為 NT$100。
    每週目標為 NT$5,000，讓我們一起集結善意，
    支持每週 50 公斤新鮮蔬菜的公益配送。
  </p>
) : (
  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
    <p className="font-bold text-orange-800">
      每月定期捐款方案
    </p>
    <p className="mt-2 text-sm leading-7 text-gray-700">
      一次銀行轉帳 NT$12,000，經農場管理員確認收到款項後，
      將安排為期 12 個月的公益捐款紀錄。
      每月捐款 NT$1,000，首月從捐款當日開始記錄，
      後續月份於每月 1 日記錄。
    </p>
  </div>
)}

          <div className="mt-5 rounded-xl bg-gray-50 p-4">
  {donationType === "free" ? (
    <>
      <p className="font-bold text-gray-800">
        認捐單位
      </p>

      <p className="text-sm text-gray-500 mt-1">
        每單位 NT$100
      </p>

      <div className="flex items-center justify-center gap-3 mt-4">
        <button
          type="button"
          onClick={() =>
            setDonationUnits((n) => Math.max(1, n - 1))
          }
          className="w-12 h-12 shrink-0 rounded-full border border-green-200 bg-white text-2xl font-bold text-green-700 active:bg-green-100"
          aria-label="減少認捐單位"
        >
          −
        </button>

        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={1}
          max={10000}
          step={1}
          value={donationUnits}
          onChange={(e) => {
            const value = e.target.value;

            if (value === "") {
              setDonationUnits(0);
              return;
            }

            if (/^\d+$/.test(value)) {
              setDonationUnits(Number(value));
            }
          }}
          onBlur={() => {
            setDonationUnits((n) =>
              Number.isFinite(n) && n >= 1
                ? Math.min(10000, Math.floor(n))
                : 1
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="h-12 w-28 min-w-0 rounded-xl border-2 border-green-300 bg-white px-2 text-center text-2xl font-black text-green-700 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200"
          aria-label="直接輸入認捐單位"
        />

        <button
          type="button"
          onClick={() =>
            setDonationUnits((n) => Math.min(10000, n + 1))
          }
          className="w-12 h-12 shrink-0 rounded-full border border-green-200 bg-white text-2xl font-bold text-green-700 active:bg-green-100"
          aria-label="增加認捐單位"
        >
          +
        </button>
      </div>

      
    </>
  ) : (
    <>
      <p className="font-bold text-gray-800">
        每月定期捐款
      </p>

      <p className="text-sm text-gray-500 mt-1">
        固定一年，不可調整單位
      </p>

      <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
        <p className="text-sm text-gray-600">
          一次轉帳金額
        </p>

        <p className="mt-2 text-3xl font-black text-orange-600">
          NT$12,000
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-700">
          固定 12 個月，每月記錄 NT$1,000。
          <br />
          首月從捐款當日開始記錄，後續月份於每月 1 日記錄。
        </p>
      </div>
    </>
  )}

            {/* 認捐金額 */}
            <p className="text-center mt-4 text-gray-700">
              認捐金額：
              <span className="text-2xl font-black text-orange-600">
                NT${donationAmount.toLocaleString("en-US")}
              </span>
            </p>

            <button
              type="button"
              onClick={() => {
                  setDonationStep(1);
                  setShowDonationModal(true);
              }}
              className="w-full mt-5 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-lg"
            >
              我要支持一菜一心 💚
            </button>

            <p className="text-xs text-gray-500 leading-6 mt-3">
              ※ 目前認捐僅支持轉帳捐款。
            </p>

          </div>
        </div>

        {/* 公益透明化 */}
        <div className="mt-6 mx-4 rounded-3xl bg-[#f7f4ea] p-6">

          <h2 className="text-lg font-black text-gray-800 mb-3">
            📷 每一份愛，都有紀錄
          </h2>

          <p className="text-gray-700 leading-7">
            蔬菜送達方舟啟智教養院後，
            九斗合作農場將開立相關收據並拍照存證，
            讓每一份善意都能留下紀錄。
          </p>
          {/* 查看公益捐款明細按鈕 */}
<button
  type="button"
  onClick={() => {
  setDonationRecordsTab("records");
  setShowDonationRecords(true);

  setDonationSearchInput("");
  setDonationSearchKeyword("");
  setDonationSearchType("name");

  setDonationPage(1);
  setDonationPageCursors([null]);

  void loadDonationRecords(1, "", "name");
}}
  className="mt-5 w-full rounded-2xl bg-green-700 px-5 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-green-800 active:scale-[0.98]"
>
  📋 查看公益捐款明細
</button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          九斗合作農場｜一菜一心公益計畫
        </p>

      </div>
      
    </div>
        )}

      {/* 一菜一心認捐彈窗 */}
      {showDonationModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowDonationModal(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 右上角關閉按鈕 */}
            <button
              type="button"
              onClick={() => setShowDonationModal(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl text-gray-600 hover:bg-gray-200"
              aria-label="關閉認捐視窗"
            >
              ×
            </button>

            {/* 彈窗標題 */}
            <div className="mb-6 pr-10">
              <p className="text-sm font-bold tracking-widest text-green-700">
                JIUDOU FARM CHARITY
              </p>

              <h2 className="mt-2 text-2xl font-black text-gray-800">
                💚 填寫認捐資料
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                感謝您支持九斗合作農場「一菜一心」公益計畫。
              </p>
            </div>

            {donationStep === 1 ? (
              <div className="space-y-5">

                {/* 姓名 */}
                <div>
                  <label className="mb-2 block font-bold text-gray-700">
                    捐款人姓名 <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="請輸入您的姓名"
                    autoComplete="name"
                    maxLength={50}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-black placeholder:text-gray-500 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* 電話 */}
                <div>
                  <label className="mb-2 block font-bold text-gray-700">
                    聯絡電話 <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="tel"
                    value={donorPhone}
                    onChange={(e) =>
                      setDonorPhone(e.target.value.replace(/[^\d+\-\s]/g, ""))
                    }
                    placeholder="請輸入聯絡電話"
                    autoComplete="tel"
                    maxLength={20}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-black placeholder:text-gray-500 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                {/* 認捐金額：沿用原本選好的金額 */}
                <div>
                  <label className="mb-2 block font-bold text-gray-700">
                    本次認捐金額
                  </label>

                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
                    <p className="text-3xl font-black text-orange-600">
                      NT${donationAmount.toLocaleString("en-US")}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {donationType === "free"
                        ? `${donationUnits} 個認捐單位，每單位 NT$100`
                        : "12 個月，每月 NT$1,000"}
                    </p>
                  </div>
                </div>

                {/* 轉出帳號末五碼 */}
                <div>
                  <label className="mb-2 block font-bold text-gray-700">
                    轉出銀行帳號末 5 碼{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{5}"
                    value={donorAccountLast5}
                    onChange={(e) =>
                      setDonorAccountLast5(
                        e.target.value.replace(/\D/g, "").slice(0, 5)
                      )
                    }
                    placeholder="請輸入 5 位數字"
                    maxLength={5}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-black placeholder:text-gray-500 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />

                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    請填寫實際轉出帳戶的末 5 碼，不是銀行密碼。
                  </p>
                </div>

                {/* 下一步 */}
                <button
                  type="button"
                  onClick={() => {
                    if (!donorName.trim()) {
                      alert("請填寫捐款人姓名");
                      return;
                    }

                    if (!/^[0-9+\-\s]{8,20}$/.test(donorPhone.trim())) {
                      alert("請確認聯絡電話格式");
                      return;
                    }

                    if (!/^\d{5}$/.test(donorAccountLast5)) {
                      alert("請輸入正確的 5 位數字帳號末碼");
                      return;
                    }

                    setDonationStep(2);
                  }}
                  className="w-full rounded-xl bg-green-600 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-green-700"
                >
                  下一步：查看匯款資訊
                </button>

              </div>
            ) : (
              <div className="space-y-5">

                <div className="rounded-2xl bg-green-50 p-5">
                  <h3 className="text-lg font-black text-green-800">
                    💳 一菜一心公益匯款資訊
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-gray-700">
                    收款戶名：九斗休閒農場
                    <br />
                    銀行名稱：台灣企銀(新屋)
                    <br />
                    銀行代碼：050
                    <br />
                    銀行帳號：31512019199
                  </p>

                  <div className="mt-4 border-t border-green-200 pt-4">
                    <p className="text-sm text-gray-600">
                      本次認捐金額
                    </p>

                    <p className="mt-1 text-3xl font-black text-orange-600">
                      NT${donationAmount.toLocaleString("en-US")}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                  請依照匯款資訊完成轉帳。送出認捐資料後，九斗合作農場將核對實際入帳紀錄，再與您聯絡確認。
                </div>

                <button
                  type="button"
                  onClick={() => setDonationStep(1)}
                  className="w-full rounded-xl border border-gray-300 py-3 font-bold text-gray-700 hover:bg-gray-50"
                >
                  返回修改資料
                </button>

                <button
  type="button"
  onClick={submitDonation}
  disabled={donationSubmitting}
  className="w-full rounded-xl bg-orange-500 py-4 text-lg font-bold text-white shadow-lg hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
>
  {donationSubmitting
    ? "資料送出中，請稍候…"
    : "我已確認，送出認捐資料 💚"}
</button>

              </div>
            )}

            <p className="mt-5 text-center text-xs leading-5 text-gray-400">
              您的資料將用於本次公益認捐聯絡與匯款核對。
            </p>
          </div>
        </div> 
        )}
          {/* 公益捐款明細彈窗 */}
{showDonationRecords && (
  <div
    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 sm:p-5"
    onClick={() => setShowDonationRecords(false)}
  >
    <div
      className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 標題 */}
      <div className="relative shrink-0 bg-gradient-to-r from-green-800 to-green-600 px-5 py-6 text-white sm:px-7">
        <button
          type="button"
          onClick={() => setShowDonationRecords(false)}
          aria-label="關閉公益捐款明細"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-3xl hover:bg-white/30"
        >
          ×
        </button>

        <p className="text-xs font-bold tracking-[0.2em] text-green-100">
          JIUDOU FARM CHARITY
        </p>

        <h2 className="mt-2 pr-10 text-2xl font-black">
          💚 一菜一心公益紀錄
        </h2>

        <p className="mt-2 text-sm text-green-50">
          感謝每一位支持公益、讓善意持續發生的朋友。
        </p>
      </div>

      {/* 分頁按鈕 */}
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-gray-200 bg-gray-50 p-3">
        <button
          type="button"
          onClick={() => {
            setDonationRecordsTab("records");

            if (donationRecords.length === 0) {
              void loadDonationRecords(1, "", "name");
            }
          }}
          className={`rounded-xl px-3 py-3 font-bold transition ${
            donationRecordsTab === "records"
              ? "bg-green-700 text-white shadow"
              : "bg-white text-gray-700 hover:bg-green-50"
          }`}
        >
          📋 捐款明細
        </button>

        <button
  type="button"
  onClick={() => {
  setDonationRecordsTab("weekly");
  void loadWeeklyDonationRecords();
}}
  className={`rounded-xl px-4 py-4 text-base font-bold transition ${
    donationRecordsTab === "weekly"
      ? "bg-green-700 text-white shadow-md"
      : "bg-white text-gray-700 hover:bg-green-50"
  }`}
>
  📸 每週捐贈紀錄
</button>
      </div>

      {/* 內容區域 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">

        {/* ========================= */}
        {/* 捐款明細 */}
        {/* ========================= */}
        {donationRecordsTab === "records" && (
          <div className="min-w-0">

            <h3 className="mb-4 text-xl font-black text-gray-900">
              每一份善意，都值得被記錄
            </h3>

            {/* 姓名／電話搜尋 */}
            <div className="mb-5 rounded-2xl border border-green-100 bg-green-50 p-4">

              <h4 className="mb-3 font-black text-gray-800">
                🔍 搜尋捐款紀錄
              </h4>

              {/* 搜尋方式 */}
              <div className="mb-3 grid grid-cols-2 gap-2">

                <button
                  type="button"
                  onClick={() => {
                    setDonationSearchType("name");
                    setDonationSearchInput("");
                    setDonationSearchKeyword("");
                    setDonationPage(1);
                    setDonationPageCursors([null]);

                    void loadDonationRecords(1, "", "name");
                  }}
                  className={`rounded-xl px-3 py-3 font-bold ${
                    donationSearchType === "name"
                      ? "bg-green-700 text-white"
                      : "border border-green-200 bg-white text-green-700"
                  }`}
                >
                  👤 姓名搜尋
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDonationSearchType("phone");
                    setDonationSearchInput("");
                    setDonationSearchKeyword("");
                    setDonationPage(1);
                    setDonationPageCursors([null]);

                    void loadDonationRecords(1, "", "phone");
                  }}
                  className={`rounded-xl px-3 py-3 font-bold ${
                    donationSearchType === "phone"
                      ? "bg-green-700 text-white"
                      : "border border-green-200 bg-white text-green-700"
                  }`}
                >
                  📱 電話搜尋
                </button>

              </div>

              {/* 搜尋輸入框 */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  const keyword = donationSearchInput.trim();

                  setDonationSearchKeyword(keyword);
                  setDonationPage(1);
                  setDonationPageCursors([null]);

                  void loadDonationRecords(
                    1,
                    keyword,
                    donationSearchType
                  );
                }}
                className="flex min-w-0 gap-2"
              >
                <input
                  type={
                    donationSearchType === "phone"
                      ? "tel"
                      : "text"
                  }
                  inputMode={
                    donationSearchType === "phone"
                      ? "numeric"
                      : "text"
                  }
                  value={donationSearchInput}
                  onChange={(e) =>
                    setDonationSearchInput(e.target.value)
                  }
                  placeholder={
                    donationSearchType === "name"
                      ? "輸入捐款人姓名"
                      : "輸入電話或電話開頭"
                  }
                  className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />

                <button
                  type="submit"
                  disabled={donationRecordsLoading}
                  className="shrink-0 rounded-xl bg-green-700 px-4 py-3 font-bold text-white disabled:opacity-50"
                >
                  搜尋
                </button>
              </form>

              {/* 紀錄數量 */}
              <div className="mt-3 flex items-center justify-between gap-2">

                <p className="text-sm text-gray-600">
                  共 {donationTotalCount.toLocaleString()} 筆
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setDonationSearchInput("");
                    setDonationSearchKeyword("");
                    setDonationPage(1);
                    setDonationPageCursors([null]);

                    void loadDonationRecords(
                      1,
                      "",
                      donationSearchType
                    );
                  }}
                  className="text-sm font-bold text-green-700 underline"
                >
                  清除搜尋
                </button>

              </div>
            </div>

            {/* 載入中 */}
            {donationRecordsLoading && (
              <div className="py-10 text-center text-gray-500">
                <p className="text-3xl">💚</p>
                <p className="mt-2">正在載入捐款紀錄……</p>
              </div>
            )}

            {/* 錯誤訊息 */}
            {!donationRecordsLoading &&
              donationRecordsError && (
                <div className="rounded-xl bg-red-50 p-4 text-center text-red-700">
                  {donationRecordsError}
                  <button
                    type="button"
                    onClick={() =>
                      void loadDonationRecords(
                        donationPage,
                        donationSearchKeyword,
                        donationSearchType
                      )
                    }
                    className="ml-2 font-bold underline"
                  >
                    重新載入
                  </button>
                </div>
              )}

            {/* 沒有紀錄 */}
            {!donationRecordsLoading &&
              !donationRecordsError &&
              donationRecords.length === 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center">
                  <p className="text-3xl">💚</p>

                  <p className="mt-3 font-bold text-gray-700">
                    {donationSearchKeyword
                      ? "找不到符合條件的捐款紀錄"
                      : "目前尚無捐款紀錄"}
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    感謝您對一菜一心公益計畫的支持。
                  </p>
                </div>
              )}

            {/* 捐款直式卡片 */}
            {!donationRecordsLoading &&
              !donationRecordsError &&
              donationRecords.map((record) => {
  // 判斷是否為每月定期捐款
  const isMonthly = record.donationType === "monthly";

  // 取得設定的開始扣款月份，例如 2026-12
  const startMonth = record.startMonth || "";

  // 取得實際捐款日期
  const donationDate = record.createdAt?.toDate
    ? record.createdAt.toDate()
    : record.createdAt
      ? new Date(record.createdAt)
      : null;

  // 取得捐款年月，例如 2026-10
  const donationMonth =
    donationDate && !Number.isNaN(donationDate.getTime())
      ? `${donationDate.getFullYear()}-${String(
          donationDate.getMonth() + 1
        ).padStart(2, "0")}`
      : "";

  // 判斷定期捐款是否已到開始扣款時間
  let hasStarted = false;

  if (isMonthly && startMonth) {
    if (donationMonth === startMonth && donationDate) {
      // 捐款日期與開始月份相同：從捐款日期開始
      hasStarted = new Date().getTime() >= donationDate.getTime();
    } else {
      // 開始月份晚於捐款月份：從設定月份的 1 日開始
      const [startYear, startMonthNumber] = startMonth
        .split("-")
        .map(Number);

      const startDate = new Date(
        startYear,
        startMonthNumber - 1,
        1
      );

      hasStarted = new Date() >= startDate;
    }
  }

  return (
                
                <div
                  key={record.id}
                  className="mb-4 w-full min-w-0 overflow-hidden rounded-2xl border border-green-100 bg-white p-4 shadow-sm"
                >

                  {/* 日期與捐款類型 */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-500">
                        📅 捐款日期
                      </div>

                      <div className="mt-1 text-lg font-bold text-gray-900">
                        {formatDonationDate(record.createdAt)}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        record.donationType === "monthly"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {record.donationType === "monthly"
                        ? "每月定期捐款"
                        : "自由捐款"}
                    </span>
                  </div>

                  {/* 預計開始投入公益：獨立一行，使用整張卡片的寬度 */}
                  {record.donationType === "monthly" &&
                    (() => {
                      const startMonth = record.startMonth;

                      const [year, month] = startMonth
                        ? startMonth.split("-")
                        : ["", ""];

                      return (
                        <div className="mt-3 w-full box-border rounded-xl border border-blue-100 bg-blue-50 p-3">
                          <div className="text-sm text-blue-700">
                            🗓️ 預計開始投入公益
                          </div>

                          <div className="mt-1 text-base font-bold text-blue-800">
                            {startMonth
                              ? `${year} 年 ${Number(month)} 月`
                              : "開始月份待確認"}
                          </div>

                          <p className="mt-1 text-xs leading-5 text-blue-700">
                            每月定期捐款將依設定月份開始安排，每月 NT$1,000。
                          </p>
                        </div>
                      );
                    })()}

                  {/* 捐款人、金額、狀態：同一排 */}
<div className="mt-4 grid grid-cols-3 items-center gap-2 rounded-xl bg-gray-50 p-3">

  {/* 捐款人 */}
  <div className="min-w-0">
    <p className="text-xs text-gray-500">
      👤 捐款人
    </p>

    <p className="mt-1 truncate text-sm font-bold text-gray-900">
      {record.donorName || "未提供姓名"}
    </p>
  </div>

  {/* 捐款金額 */}
  <div className="min-w-0 text-center">
    <p className="text-xs text-gray-500">
      💰 金額
    </p>

    <p className="mt-1 whitespace-nowrap text-sm font-black text-orange-600">
      NT${Number(record.amount ?? 0).toLocaleString()}
    </p>
  </div>

  {/* 捐款狀態 */}
  <div className="min-w-0 text-right">
    <p className="text-xs text-gray-500">
      📋 狀態
    </p>

    {record.status === "confirmed" ? (
      <span className="mt-1 inline-block whitespace-nowrap rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
        已確認捐款成功
      </span>
    ) : (
      <span className="mt-1 inline-block whitespace-nowrap rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold text-yellow-700">
        款項待確認中
      </span>
    )}
  </div>

</div>
{/* 已開始扣款才顯示每月定期捐款進度 */}
{record.donationType === "monthly" && hasStarted && (
  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
    <h3 className="font-bold text-blue-900">
      📅 每月定期捐款進度
    </h3>

    <p className="mt-2 text-sm text-gray-700">
      原始捐款金額：
      <span className="font-bold">
        NT$12,000
      </span>
    </p>

    <p className="mt-1 text-sm text-gray-700">
      每期記錄金額：
      <span className="font-bold">
        NT$1,000
      </span>
    </p>

    {monthlyDonationLoading ? (
      <p className="mt-3 text-sm text-gray-500">
        正在載入捐款進度……
      </p>
    ) : (
      (() => {
        const plan = monthlyDonationPlans.find(
          (item) => item.donationId === record.id
        );

        const records = monthlyDonationRecords.filter(
          (item) => item.donationId === record.id
        );

        const recordedAmount = records.reduce(
          (sum, item) => sum + Number(item.amount ?? 0),
          0
        );

        const completedMonths = records.length;
        const remainingAmount = Math.max(0, 12000 - recordedAmount);
        const remainingMonths = Math.max(0, 12 - completedMonths);

        return (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs text-gray-500">
                  已記錄金額
                </p>
                <p className="mt-1 text-lg font-black text-green-700">
                  NT${recordedAmount.toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg bg-white p-3">
                <p className="text-xs text-gray-500">
                  剩餘金額
                </p>
                <p className="mt-1 text-lg font-black text-orange-600">
                  NT${remainingAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  已完成期數
                </span>
                <span className="font-bold text-blue-900">
                  {completedMonths} / 12 期
                </span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min(100, (completedMonths / 12) * 100)}%`,
                  }}
                />
              </div>

              <p className="mt-2 text-sm text-gray-600">
                尚有 {remainingMonths} 期待記錄
              </p>

              {plan?.status === "completed" && (
                <p className="mt-2 font-bold text-green-700">
                  🎉 定期捐款已全部記錄完成
                </p>
              )}
            </div>
          </>
        );
      })()
    )}
  </div>
)}
{/* 查看捐款收據 */}
{/* 捐款收據按鈕 */}
{record.receiptUrl &&
(
  record.donationType !== "monthly" ||
  Number(record.amount) === 12000
) ? (
  <button
    type="button"
    onClick={() =>
      setSelectedDonationReceipt(record.receiptUrl)
    }
    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 font-bold text-green-700 shadow-sm transition hover:border-green-300 hover:from-green-100 hover:to-emerald-100 active:scale-[0.99]"
  >
    🧾 查看捐款收據
  </button>
) : (
  record.donationType === "monthly" &&
  Number(record.amount) !== 12000 ? null : (
    <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
      🧾 收據尚未提供
    </div>
  )
)}
{/* 查看捐款收據 */}

                </div>
                );
})}

            {/* 分頁 */}
            {!donationRecordsLoading &&
              !donationRecordsError &&
              donationTotalCount > 0 && (
                <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">

                  <p className="mb-4 text-center text-sm text-gray-600">
                    第 {donationPage} 頁／共 {donationTotalPages} 頁
                  </p>

                  <div className="grid grid-cols-2 gap-3">

                    <button
                      type="button"
                      disabled={
                        donationPage <= 1 ||
                        donationRecordsLoading
                      }
                      onClick={() => {
                        void loadDonationRecords(
                          donationPage - 1,
                          donationSearchKeyword,
                          donationSearchType
                        );
                      }}
                      className="rounded-xl border border-green-200 bg-white px-3 py-3 font-bold text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← 上一頁
                    </button>

                    <button
                      type="button"
                      disabled={
                        donationPage >= donationTotalPages ||
                        donationRecordsLoading
                      }
                      onClick={() => {
                        void loadDonationRecords(
                          donationPage + 1,
                          donationSearchKeyword,
                          donationSearchType
                        );
                      }}
                      className="rounded-xl bg-green-700 px-3 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      下一頁 →
                    </button>

                  </div>
                </div>
              )}

            <p className="mt-4 text-xs leading-6 text-gray-500">
              捐款紀錄依提交時間排序，最新紀錄優先顯示。收據是否提供，以實際紀錄為準。
            </p>

          </div>
        )}

        {/* ========================= */}
        {/* 愛心捐款排名 */}
        {/* ========================= */}
        {donationRecordsTab === "weekly" && (
  <div className="space-y-5">
    <div>
      <h2 className="text-2xl font-bold text-gray-900">
        📸 每週捐贈紀錄
      </h2>

      <p className="mt-2 text-base leading-7 text-gray-600">
        記錄每一次實際捐贈，讓每一份善意都能被看見。
      </p>
    </div>

    {weeklyDonationRecords.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 px-5 py-12 text-center">
        <div className="text-5xl">💚</div>

        <h3 className="mt-4 text-xl font-bold text-gray-800">
          目前尚無捐贈紀錄
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          農場將於完成每週捐贈後，陸續更新捐贈照片與收據。
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-5">
        {weeklyDonationRecords
  .slice(
    (weeklyDonationPage - 1) * WEEKLY_PAGE_SIZE,
    weeklyDonationPage * WEEKLY_PAGE_SIZE
  )
  .map((record) => (
          <article
            key={record.id}
            className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
          >
            <div className="text-sm font-medium text-green-700">
              📅 捐贈日期
            </div>

            <div className="mt-1 text-xl font-bold text-gray-900">
              {record.donationDate}
            </div>

            <div className="mt-4 text-sm font-medium text-gray-500">
              🏢 受捐贈機構
            </div>

            <div className="mt-1 text-lg font-bold text-gray-900">
              {record.organizationName}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!record.donationImageUrl}
                onClick={() =>
                  setSelectedDonationImage({
                    title: "📷 捐贈照片",
                    imageUrl: record.donationImageUrl,
                  })
                }
                className="w-full rounded-xl bg-green-700 px-4 py-4 font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                📷 查看捐贈照片
              </button>

              <button
                type="button"
                disabled={!record.receiptImageUrl}
                onClick={() =>
                  setSelectedDonationImage({
                    title: "🧾 當周捐贈感謝狀",
                    imageUrl: record.receiptImageUrl,
                  })
                }
                className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-4 font-bold text-green-800 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
              >
                🧾 查看當周感謝狀
              </button>
            </div>
          </article>
        ))}
      </div>
    )}
    {/* 每週捐贈紀錄分頁 */}
{weeklyTotalPages > 1 && (
  <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
    <p className="mb-3 text-center text-sm text-gray-500">
      第 {weeklyDonationPage} / {weeklyTotalPages} 頁
    </p>

    <div className="grid grid-cols-2 gap-3">
      {/* 上一頁 */}
      <button
        type="button"
        disabled={
          weeklyDonationPage <= 1 || weeklyDonationLoading
        }
        onClick={() =>
          void loadWeeklyDonationRecords(weeklyDonationPage - 1)
        }
        className="rounded-xl border border-green-200 bg-white px-4 py-3 font-bold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← 上一頁
      </button>

      {/* 下一頁 */}
      <button
        type="button"
        disabled={
          weeklyDonationPage >= weeklyTotalPages ||
          weeklyDonationLoading
        }
        onClick={() =>
          void loadWeeklyDonationRecords(weeklyDonationPage + 1)
        }
        className="rounded-xl bg-green-700 px-4 py-3 font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        下一頁 →
      </button>
    </div>

    {/* 載入提示 */}
    {weeklyDonationLoading && (
      <p className="mt-3 text-center text-sm text-gray-500">
        正在載入捐贈紀錄……
      </p>
    )}
  </div>
)}
  </div>
)}

      </div>

      {/* 底部 */}
      <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3 text-center">
        <p className="text-xs leading-5 text-gray-500">
          九斗合作農場｜一菜一心公益計畫
        </p>
      </div>

    </div>
  </div>
)}

{/* 捐款收據檢視視窗 */}
{selectedDonationReceipt && (
  <div
    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
    onClick={() => setSelectedDonationReceipt(null)}
  >
    <div
      className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setSelectedDonationReceipt(null)}
        className="mb-3 rounded-lg bg-gray-100 px-4 py-2 font-bold text-gray-800"
      >
        ✕ 關閉收據
      </button>

      <img
        src={selectedDonationReceipt}
        alt="公益捐款收據"
        className="mx-auto h-auto max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
      />
    </div>
  </div>
)}
    
      {/* 空購物車提示 */}
      {showEmptyAlert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl text-center w-64">
            <p className="mb-4 font-bold text-lg">您還沒選購商品 🛒</p>
            <button onClick={() => setShowEmptyAlert(false)} className="bg-green-500 text-white px-4 py-2 rounded">
              確定
            </button>
          </div>
        </div>
      )}

      {/* 彈窗 */}
      {selectedProduct && (
        <div
  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
  onClick={() => setSelectedProduct(null)}
>
  
          <button
  onClick={() => setSelectedProduct(null)}
  className="
    absolute top-3 right-3
    bg-white/80
    rounded-full
    w-10 h-10
    text-xl
    shadow
  "
>

  ✕
</button>
          <div
  onClick={(e) => e.stopPropagation()}
  className="
    bg-white
    w-[95%]
    max-w-md
    h-[90vh]
    rounded-2xl
    overflow-hidden
    flex
    flex-col
  "
>   
            {/* 內容區 */}
<div className="flex-1 overflow-y-auto p-4">

  {/* 商品主圖 */}
  <img
    src={selectedProduct.image}
    className="w-full rounded-xl bg-gray-100 mb-3"
  />

  {/* 商品名稱 */}
  <h2 className="font-bold text-xl text-left">
    {selectedProduct.name}
  </h2>

  {/* 價格 */}
  <p className="text-2xl text-green-600 font-black text-left mt-2">
    ${selectedProduct.price}
  </p>
  <p className="text-sm text-blue-600 mt-1">
  剩餘庫存：{selectedProduct.stock || 0}
</p>
  {/* ⭐ 快速購買區 */}
<div className="mt-4 bg-green-50 border rounded-2xl p-4">

  <div className="flex justify-center items-center gap-4 mb-4">

    <button
      onClick={() => setQty(q => Math.max(1, q - 1))}
      className="
        w-10 h-10 rounded-full
        bg-white border text-xl
      "
    >
      －
    </button>

    <span className="text-2xl font-bold">
      {qty}
    </span>

    <button
      onClick={() => {

  if (qty >= (selectedProduct.stock || 0)) {
    alert("庫存不足，請重新選購");
    return;
  }

  setQty(q => q + 1);
}}
      className="
        w-10 h-10 rounded-full
        bg-white border text-xl
      "
    >
      ＋
    </button>
  </div>

  <button
    onClick={() => {
      addToCart({ ...selectedProduct, qty });
      setSelectedProduct(null);
    }}
    className="
      bg-green-500
      text-white
      w-full
      py-4
      rounded-2xl
      text-lg
      font-bold
    "
  >
    加入購物車
  </button>
  
</div>
  {/* 短描述 */}
  <p className="text-sm text-black mt-2 text-left">
    {selectedProduct.description}
  </p>

  {/* ⭐ 詳細文字 */}
  {selectedProduct.detailDescription && (
    <div className="mt-5">
      <h3 className="font-bold text-left mb-2">
        商品介紹
      </h3>

      <p className="text-sm whitespace-pre-wrap text-left leading-7">
        {selectedProduct.detailDescription}
      </p>
    </div>
  )}

  {/* ⭐ 詳細長圖 */}
  <div className="space-y-4 mt-4">

  {selectedProduct.detailImages?.map((img: string, i: number) => (

    <img
      key={i}
      src={img}
      loading="lazy"
      decoding="async"
      className="
        w-full
        h-auto
        rounded-xl
      "
    />
  ))}

</div>
</div>
          </div>
        </div>
      )}
      {selectedDonationImage && (
  <div
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
    onClick={() => setSelectedDonationImage(null)}
  >
    <div
      className="relative w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-gray-900">
          {selectedDonationImage.title}
        </h3>

        <button
          type="button"
          onClick={() => setSelectedDonationImage(null)}
          className="rounded-full bg-gray-100 px-4 py-2 text-lg font-bold text-gray-700 hover:bg-gray-200"
          aria-label="關閉圖片"
        >
          ✕
        </button>
      </div>

      <div className="flex max-h-[75vh] items-center justify-center overflow-auto">
        <img
          src={selectedDonationImage.imageUrl}
          alt={selectedDonationImage.title}
          className="max-h-[75vh] max-w-full rounded-lg object-contain"
        />
      </div>
    </div>
  </div>
)}
    </div>
);
}