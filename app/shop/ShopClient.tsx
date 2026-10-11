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

// 公益明細彈窗分頁
const [donationRecordsTab, setDonationRecordsTab] = useState<
  "records" | "ranking"
>("records");
// 認捐人資料
const [donorName, setDonorName] = useState("");
const [donorPhone, setDonorPhone] = useState("");
const [donorAccountLast5, setDonorAccountLast5] = useState("");

// 認捐流程步驟：1 填寫資料、2 查看匯款資訊
const [donationStep, setDonationStep] = useState<1 | 2>(1);
const [donationUnits, setDonationUnits] = useState(1);
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

const [donationRecordsLoading, setDonationRecordsLoading] =
  useState(false);

const [donationRecordsError, setDonationRecordsError] =
  useState("");

const [donationTotalCount, setDonationTotalCount] =
  useState(0);

const [donationPage, setDonationPage] =
  useState(1);

// Firestore 分頁游標
const [donationPageCursors, setDonationPageCursors] =
  useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);



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
const loadDonationRecords = async (
  page: number,
  keyword = donationSearchKeyword,
  searchType = donationSearchType
) => {
  setDonationRecordsLoading(true);
  setDonationRecordsError("");

  try {
    const donationsRef = collection(db, "donations");

    // 基本排序：最新捐款優先
    const constraints: any[] = [];

    if (keyword.trim()) {
      const searchValue = keyword.trim();

      if (searchType === "name") {
        // 姓名開頭搜尋
        constraints.push(
          where("donorName", ">=", searchValue),
          where("donorName", "<=", searchValue + "\uf8ff")
        );
      } else {
        // 電話開頭搜尋
        constraints.push(
          where("donorPhone", ">=", searchValue),
          where("donorPhone", "<=", searchValue + "\uf8ff")
        );
      }
    }

    constraints.push(orderBy("createdAt", "desc"));

    // 計算符合搜尋條件的總筆數
    const countQuery = query(
      donationsRef,
      ...constraints
    );

    const countSnapshot = await getCountFromServer(countQuery);

    setDonationTotalCount(countSnapshot.data().count);

    // 查詢指定頁面的游標
    const cursor =
      page === 1
        ? null
        : donationPageCursors[page - 1];

    if (page > 1 && !cursor) {
      throw new Error("找不到該頁的分頁位置，請重新查詢。");
    }

    const pageQuery = query(
      donationsRef,
      ...constraints,
      ...(cursor ? [startAfter(cursor)] : []),
      limit(DONATION_PAGE_SIZE)
    );

    const snapshot = await getDocs(pageQuery);

    const records = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setDonationRecords(records);
    setDonationPage(page);

    // 記錄下一頁的起始位置
    if (snapshot.docs.length > 0) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];

      setDonationPageCursors((previous) => {
        const next = [...previous];
        next[page] = lastDoc;
        return next;
      });
    }
  } catch (error) {
    console.error("載入捐款明細失敗：", error);

    setDonationRecordsError(
      "捐款紀錄載入失敗，請稍後再試。"
    );
  } finally {
    setDonationRecordsLoading(false);
  }
};
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

          <p className="text-gray-600 leading-7">
            每認捐一單位為 NT$100。
            每週目標為 NT$5,000，讓我們一起集結善意，
            支持每週 50 公斤新鮮蔬菜的公益配送。
          </p>

          <div className="mt-5 rounded-xl bg-gray-50 p-4">

            <p className="font-bold text-gray-800">
              認捐單位
            </p>

            <p className="text-sm text-gray-500 mt-1">
              每單位 NT$100
            </p>

            {/* 認捐單位加減 */}
            {/* 認捐單位加減與直接輸入 */}
<div className="flex items-center justify-center gap-3 mt-4">

  {/* 減少認捐單位 */}
  <button
    type="button"
    onClick={() =>
      setDonationUnits((n) => Math.max(1, n - 1))
    }
    className="w-12 h-12 shrink-0 rounded-full border border-green-200
               bg-white text-2xl font-bold text-green-700
               active:bg-green-100"
    aria-label="減少認捐單位"
  >
    −
  </button>

  {/* 可直接輸入認捐單位 */}
  <input
    type="number"
    inputMode="numeric"
    pattern="[0-9]*"
    min={1}
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
          ? Math.floor(n)
          : 1
      );
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    }}
    className="h-12 w-28 min-w-0 rounded-xl border-2
               border-green-300 bg-white px-2
               text-center text-2xl font-black text-green-700
               outline-none focus:border-green-600
               focus:ring-2 focus:ring-green-200"
    aria-label="直接輸入認捐單位"
  />

  {/* 增加認捐單位 */}
  <button
    type="button"
    onClick={() => setDonationUnits((n) => n + 1)}
    className="w-12 h-12 shrink-0 rounded-full border border-green-200
               bg-white text-2xl font-bold text-green-700
               active:bg-green-100"
    aria-label="增加認捐單位"
  >
    +
  </button>

</div>

            {/* 認捐金額 */}
            <p className="text-center mt-4 text-gray-700">
              認捐金額：
              <span className="text-2xl font-black text-orange-600">
                NT${donationUnits * 100}
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
                      NT${donationUnits * 100}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {donationUnits} 個認捐單位，每單位 NT$100
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
                    收款戶名：待設定
                    <br />
                    銀行名稱：待設定
                    <br />
                    銀行代碼：待設定
                    <br />
                    銀行帳號：待設定
                  </p>

                  <div className="mt-4 border-t border-green-200 pt-4">
                    <p className="text-sm text-gray-600">
                      本次認捐金額
                    </p>

                    <p className="mt-1 text-3xl font-black text-orange-600">
                      NT${donationUnits * 100}
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
                  onClick={() => {
                    alert("目前尚未連接認捐資料庫，請先完成 Firebase 設定。");
                  }}
                  className="w-full rounded-xl bg-orange-500 py-4 text-lg font-bold text-white shadow-lg hover:bg-orange-600"
                >
                  我已確認，送出認捐資料 💚
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
          onClick={() => setDonationRecordsTab("ranking")}
          className={`rounded-xl px-3 py-3 font-bold transition ${
            donationRecordsTab === "ranking"
              ? "bg-green-700 text-white shadow"
              : "bg-white text-gray-700 hover:bg-green-50"
          }`}
        >
          🏆 愛心捐款排名
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
              donationRecords.map((record) => (
                <div
                  key={record.id}
                  className="mb-4 w-full min-w-0 overflow-hidden rounded-2xl border border-green-100 bg-white p-4 shadow-sm"
                >

                  {/* 日期 */}
                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-500">
                        📅 捐款日期
                      </p>

                      <p className="mt-1 break-words font-bold text-gray-800">
                        {record.createdAt?.toDate
                          ? record.createdAt
                              .toDate()
                              .toLocaleString("zh-TW", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              })
                          : "日期待確認"}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                      公益捐款
                    </span>

                  </div>

                  <div className="my-4 border-t border-dashed border-gray-200" />

                  {/* 捐款人 */}
                  <div>
                    <p className="text-sm text-gray-500">
                      👤 捐款人
                    </p>

                    <p className="mt-1 break-words font-bold text-gray-900">
                      {record.donorName || "未提供姓名"}
                    </p>
                  </div>

                  {/* 金額 */}
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">
                      💰 捐款金額
                    </p>

                    <p className="mt-1 text-2xl font-black text-orange-600">
                      NT$
                      {Number(
                        record.amount ?? 0
                      ).toLocaleString()}
                    </p>
                  </div>

                  {/* 收據 */}
                  <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">

                    <p className="font-bold text-gray-800">
                      🧾 捐款收據
                    </p>

                    {record.receiptUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDonationReceipt(
                            record.receiptUrl
                          )
                        }
                        className="mt-3 w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white transition hover:bg-green-800"
                      >
                        📷 查看捐款收據
                      </button>
                    ) : (
                      <div className="mt-2 rounded-lg bg-amber-50 p-3">
                        <p className="font-bold text-amber-800">
                          ⏳ 收據整理中
                        </p>

                        <p className="mt-1 text-xs leading-5 text-amber-700">
                          此筆紀錄目前尚未提供收據圖片。
                        </p>
                      </div>
                    )}

                  </div>

                </div>
              ))}

            {/* 分頁 */}
            {!donationRecordsLoading &&
              !donationRecordsError &&
              donationTotalCount > 0 && (
                <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">

                  <p className="mb-4 text-center text-sm text-gray-600">
                    第 {donationPage} 頁／共{" "}
                    {Math.ceil(
                      donationTotalCount / DONATION_PAGE_SIZE
                    ).toLocaleString()} 頁
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
                        donationPage >=
                          Math.ceil(
                            donationTotalCount /
                              DONATION_PAGE_SIZE
                          ) ||
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
        {donationRecordsTab === "ranking" && (
          <div>

            <h3 className="mb-3 text-xl font-black text-gray-900">
              🏆 愛心捐款排行榜
            </h3>

            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">

              <p className="font-bold text-gray-800">
                感謝每一位支持一菜一心的朋友
              </p>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                排行榜將依捐款人累計認捐金額，由高至低排列。
              </p>

              <p className="mt-3 text-sm font-bold text-orange-700">
                排名資料需串接實際捐款統計後顯示。
              </p>

            </div>

            <p className="mt-4 text-xs leading-6 text-gray-500">
              為保護捐款人的個人資料，排行榜應以遮蔽姓名的方式顯示。
            </p>

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
    </div>
);
}