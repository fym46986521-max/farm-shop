"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import liff from "@line/liff";
export default function ShopClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [openCart, setOpenCart] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qty, setQty] = useState(1);

  const [category, setCategory] = useState("全部");
  const [showEmptyAlert, setShowEmptyAlert] = useState(false);
const [lineUserId, setLineUserId] = useState("");




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

  return (
    
    <div
      className="min-h-screen p-3"
      style={{
        background:
          "linear-gradient(to bottom, #4fc3f7 0%, #81d4fa 30%, #c8e6c9 60%, #66bb6a 100%)",
      }}
    >

      {/* LOGO */}
      <div className="text-center mb-4">
        <h1 className="text-3xl md:text-4xl font-black text-red-700 drop-shadow">
          九斗合作農場
        </h1>
        <p className="text-sm text-green-900 font-semibold mt-1">
          新鮮直送｜健康安心｜在地農產
        </p>
        
      </div>

      {/* 🛒 浮動購物車 */}
<div className="fixed bottom-5 right-5 z-50">
  <button
    onClick={() => setOpenCart(true)}
    className="bg-green-600 text-white rounded-full shadow-lg px-4 py-3 flex flex-col items-center text-xs"
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
      className="w-80 bg-white h-full p-4 flex flex-col shadow-xl"
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
              <p>${item.price}</p>

              <div className="flex gap-2 items-center">
                <button onClick={() => changeQty(item.id, -1)}>－</button>
                <span>{item.qty}</span>
                <button onClick={() => changeQty(item.id, 1)}>＋</button>
              </div>

              <p>${item.price * item.qty}</p>
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
      <button
        onClick={() => {
          if (cart.length === 0) {
            setShowEmptyAlert(true);
            return;
          }

          if (!liff.isLoggedIn()) {

  liff.login({
    redirectUri: "https://judoufarm.com/shop",
  });

  return;
}

router.push("/checkout");

          router.push("/checkout");
        }}
        className="bg-green-600 text-white py-3 rounded-lg"
      >
        結帳
      </button>
    </div>
    </div>
)}
    
      {/* 商品 */}
      <div className="bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-lg">

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
            <div key={item.id} className="bg-white rounded-2xl shadow-md p-2 border border-green-100">

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

              <p className="text-sm text-gray-500 line-clamp-2">
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
  <p className="text-sm text-gray-500 mt-2 text-left">
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