"use client";
import {
  ref,
  getDownloadURL,
  uploadBytes,
} from "firebase/storage";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { storage } from "@/lib/firebase";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

function SortableItem({ item, children }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        className="cursor-move text-gray-400 text-sm mb-2"
      >
        ⠿ 拖曳排序
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [products, setProducts] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [packaging, setPackaging] = useState({
    large: 0,
    medium: 0,
    small: 0,
  });
  const [category, setCategory] = useState("水果");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [costInput, setCostInput] = useState("");
  const [description, setDescription] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailFiles, setDetailFiles] = useState<File[]>([]);
  const [detailPreviews, setDetailPreviews] = useState<string[]>([]);
  const [shippingFee, setShippingFee] = useState(120);
  const [freeThreshold, setFreeThreshold] = useState(1000);
  const [orders, setOrders] = useState<any[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [cost, setCost] = useState(0);
  const [profit, setProfit] = useState(0);
  
  const fetchOrders = async () => {
  try {
    const res = await fetch("/api/orders");
    const data = await res.json();

    setOrders(data);

    let totalRevenue = 0;
    let totalCost = 0;

    data.forEach((o: any) => {
      totalRevenue += o.total || 0;
      totalCost += (o.costTotal || 0) + (o.packagingCost || 0);
    });

    setRevenue(totalRevenue);
    setCost(totalCost);
    setProfit(totalRevenue - totalCost);

  } catch (e) {
    console.error("讀取訂單失敗:", e);
  }
};
  useEffect(() => {
    if (localStorage.getItem("admin") !== "true") {
      router.push("/admin/login");
    }
  }, []);
  
  const fetchProducts = async () => {
    const snapshot = await getDocs(collection(db, "products"));
    const list: any[] = [];

    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });

    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setProducts(list);
  };

  useEffect(() => {
  fetchProducts();
  fetchOrders();

  // ⭐加在這裡（同一個 useEffect 裡面）
  const fetchPackaging = async () => {
    const ref = doc(db, "settings", "packaging");

try {
  const snap = await getDoc(ref);

  if (snap.exists()) {
    setPackaging(snap.data() as any);
  }
} catch (e) {
  console.error("Firestore read error:", e);
}
  };

  fetchPackaging();

}, []);

  // ⭐讀取運費（只保留一份）
  useEffect(() => {
  const fetchShipping = async () => {
    try {
      const ref = doc(db, "settings", "shipping");
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setShippingFee(data.fee ?? 120);
        setFreeThreshold(data.freeShippingThreshold ?? 1000);
      } else {
        console.warn("shipping 文件不存在");
      }
    } catch (e) {
      console.error("讀取運費失敗:", e);
    }
  };

  fetchShipping(); // ⭐ 這行你缺了
}, []);

  const compressImage = (file: File): Promise<Blob> => {

  return new Promise((resolve, reject) => {

    const img = new Image();
    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onerror = reject;

    img.onload = () => {

      const canvas = document.createElement("canvas");

      const MAX_WIDTH = 800;

      const scale = Math.min(
        1,
        MAX_WIDTH / img.width
      );

      canvas.width = img.width * scale;

      canvas.height = Math.min(
        img.height * scale,
        3000
      );

      const ctx = canvas.getContext("2d");

      ctx?.drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
      );

      canvas.toBlob(
        (blob) => {

          if (!blob) {
            reject("blob失敗");
            return;
          }

          resolve(blob);

        },
        "image/webp",
        0.7
      );
    };
  });
};
const convertToWebP = (file: File): Promise<Blob> => {

  return new Promise((resolve, reject) => {

    const img = new Image();
    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onerror = reject;

    img.onload = () => {

      const canvas = document.createElement("canvas");

      // ⭐ 保持原尺寸
      // ⭐ 長圖最大高度
const MAX_HEIGHT = 4000;

// ⭐ 等比例縮放
const scale = Math.min(
  1,
  MAX_HEIGHT / img.height
);

canvas.width = img.width * scale;
canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");

      ctx?.drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // ⭐ 轉 WebP
      canvas.toBlob(
        (blob) => {

          if (!blob) {
            reject("WebP失敗");
            return;
          }

          resolve(blob);

        },
        "image/webp",
        0.75 // ⭐ 品質
      );
    };
  });
};
  const handleFile = (f: File) => {
    if (!f.type.startsWith("image/")) {
      alert("請選擇圖片！");
      return;
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleAdd = async () => {
    
    if (!name.trim() || Number(price) <= 0) {
  alert("請填寫名稱與價格");
  console.log("🚀 handleAdd trigger");
  return;
}
    console.log("🚀 開始新增");
    let image = "https://placehold.co/400x300";
    
if (file) {
  try {

    // ⭐ 壓縮圖片
    const compressed = await compressImage(file);

    // ⭐ storage位置
    const fileRef = ref(
      storage,
      `products/${Date.now()}_${file.name}`
    );

    // ⭐ 上傳base64壓縮圖
    await uploadBytes(
  fileRef,
  compressed
);

    // ⭐ 取得網址
    image = await getDownloadURL(fileRef);

    console.log("✅ 上傳成功:", image);

  } catch (e) {
    console.error("❌ 上傳失敗:", e);
    alert("圖片上傳失敗");
    return;
  }
}
let detailImages: string[] = [];

if (detailFiles.length > 0) {

  for (const f of detailFiles) {

    try {

      console.log("🚀 開始處理:", f.name);

      const webp = await convertToWebP(f);

      console.log("✅ WebP完成");

      const fileRef = ref(
        storage,
        `product-details/${Date.now()}_${f.name}.webp`
      );

      console.log("🚀 開始上傳");

      await uploadBytes(
        fileRef,
        webp
      );

      console.log("✅ 上傳成功");

      const url = await getDownloadURL(fileRef);

      detailImages.push(url);

    } catch (e) {

      console.error("❌ 詳細圖失敗:", e);

      alert(`長圖失敗: ${f.name}`);

      return; // ⭐ 全部中止
    }
  }
}
    await addDoc(collection(db, "products"), {
  name,
  price: Number(price),
  cost: Number(costInput || 0),
  stock: Number(stock || 0),
  image,
  detailImages, // ⭐

  category,
  active: true,
  order: products.length,

  description,

  detailDescription, // ⭐
});

    setName("");
    setPrice("");
    setStock("");
    setFile(null);
    setPreview("");
    setDescription("");
    setCostInput("");
    fetchProducts();
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);

    const newList = arrayMove(products, oldIndex, newIndex);
    setProducts(newList);

    await Promise.all(
      newList.map((item, index) =>
        updateDoc(doc(db, "products", item.id), {
          order: index,
        })
      )
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除？")) return;
    await deleteDoc(doc(db, "products", id));
    fetchProducts();
  };

  const toggleActive = async (item: any) => {
    await updateDoc(doc(db, "products", item.id), {
      active: !item.active,
    });

    fetchProducts();
  };

  const handleSaveShipping = async () => {
    try {
      await setDoc(doc(db, "settings", "shipping"), {
        fee: Number(shippingFee),
        freeShippingThreshold: Number(freeThreshold),
      });

      alert("✅ 運費設定已更新");
    } catch (e) {
      console.error(e);
      alert("❌ 儲存失敗");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("admin");
    await signOut(auth);
    router.push("/admin/login");
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">🛒 商品管理</h1>

      {/* ⭐運費設定 */}
      <div className="border p-4 rounded mb-6 bg-yellow-50">
        <h2 className="font-bold mb-2">🚚 運費設定</h2>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-24">運費</span>
            <input
              type="number"
              value={shippingFee}
              onChange={(e) => setShippingFee(Number(e.target.value))}
              className="border p-2 flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="w-24">免運門檻</span>
            <input
              type="number"
              value={freeThreshold}
              onChange={(e) => setFreeThreshold(Number(e.target.value))}
              className="border p-2 flex-1"
            />
          </div>

          <button
            onClick={handleSaveShipping}
            className="bg-blue-500 text-white px-4 py-2 w-fit"
          >
            儲存設定
          </button>
        </div>
      </div>
      {/* ⭐運費設定 */}

{/* ⭐👉 這裡貼（緊接著下面） */}
<div className="border p-4 rounded mb-6 bg-blue-50">
  <h2 className="font-bold mb-3">📦 包裝成本</h2>

  <div className="flex gap-4 items-center flex-wrap">
    
    <div>
      <p className="text-sm mb-1">大包裝</p>
      <input
        type="number"
        value={packaging.large}
        onChange={(e) =>
          setPackaging({ ...packaging, large: Number(e.target.value) })
        }
        className="border p-2 w-28"
      />
    </div>

    <div>
      <p className="text-sm mb-1">中包裝</p>
      <input
        type="number"
        value={packaging.medium}
        onChange={(e) =>
          setPackaging({ ...packaging, medium: Number(e.target.value) })
        }
        className="border p-2 w-28"
      />
    </div>

    <div>
      <p className="text-sm mb-1">小包裝</p>
      <input
        type="number"
        value={packaging.small}
        onChange={(e) =>
          setPackaging({ ...packaging, small: Number(e.target.value) })
        }
        className="border p-2 w-28"
      />
    </div>

    <button
      onClick={async () => {
        await setDoc(doc(db, "settings", "packaging"), packaging);
        alert("已儲存");
      }}
      className="bg-blue-500 text-white px-3 py-2"
    >
      儲存
    </button>
  </div>
</div>

{/* 🔥 新增商品 */}

      {/* 🔥 新增商品 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          placeholder="名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2"
        />

        <input
          type="number"
          placeholder="價格"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="border p-2"
        />
        <input
          type="number"
          placeholder="商品成本"
          value={costInput}
          onChange={(e) => setCostInput(e.target.value)}
          className="border p-2"
        />
        <input
          type="number"
          placeholder="庫存數量"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="border p-2"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border p-2"
        >
          <option>水果</option>
          <option>蔬菜</option>
          <option>加工農產品</option>
          <option>其他</option>
        </select>

        <input
          type="file"
          onChange={(e) => {
  const f = e.target.files?.[0];
  if (f) handleFile(f);
}}
        />

        <textarea
          placeholder="商品描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border p-2 w-full"
        />    
        <textarea
          placeholder="商品詳細說明"
          value={detailDescription}
          onChange={(e) => setDetailDescription(e.target.value)}
          className="border p-2 w-full h-40"
        />

<input
  type="file"
  multiple
  accept="image/*"
  onChange={(e) => {
    const files = Array.from(e.target.files || []);

    setDetailFiles(files);

    setDetailPreviews(
      files.map((f) => URL.createObjectURL(f))
    );
  }}
/>

{/* ⭐ 長圖預覽 */}
<div className="flex flex-col gap-2 w-full">
  {detailPreviews.map((src, i) => (
    <img
  key={i}
  src={src}
  className="
    w-full
    max-h-[300px]
    object-contain
    rounded
    border
    bg-gray-50
  "
/>
  ))}
</div>

        <button
          onClick={handleAdd}
          className="bg-green-500 text-white px-4"
        >
          新增
        </button>
      </div>

      {preview && (
        <img src={preview} className="w-40 mb-4 rounded" />
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={products.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-wrap gap-4">
            {products.map((item) => (
              <SortableItem key={item.id} item={item}>
                <div
                  className={`border p-4 rounded w-72 shadow ${
                    item.active ? "" : "opacity-50"
                  }`}
                >
                  <img
                    src={item.image}
                    className="w-full h-48 object-contain bg-gray-100 rounded mb-2"
                  />

                  <h2 className="font-bold">{item.name}</h2>
                  <p className="text-sm text-gray-500">
                    {item.description}
                  </p>
                  <p>{item.category}</p>
                  <p>💰 ${item.price}</p>
                  <div className="mt-2">
  <p className="text-sm text-blue-600 mb-1">
    庫存
  </p>

  <input
    type="number"
    value={item.stock || 0}
    onChange={async (e) => {

      const newStock = Number(e.target.value);

      const updated = products.map((p) =>
        p.id === item.id
          ? { ...p, stock: newStock }
          : p
      );

      setProducts(updated);

      await updateDoc(
        doc(db, "products", item.id),
        {
          stock: newStock,
        }
      );
    }}
    className="border p-1 w-24"
  />
</div>
                  <p className="text-sm text-gray-500">
                    成本：${item.cost || 0}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="bg-red-500 text-white px-2 py-1"
                    >
                      刪除
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive(item);
                      }}
                      className={`px-2 py-1 text-white ${
                        item.active
                          ? "bg-gray-500"
                          : "bg-green-500"
                      }`}
                    >
                      {item.active ? "下架" : "上架"}
                    </button>
                  </div>
                </div>
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={handleLogout}
        className="bg-red-600 text-white px-4 py-2 mt-6"
      >
        登出
      </button>

      <button
        onClick={() => router.push("/dashboard/orders")}
        className="bg-blue-500 text-white px-3 py-1"
      >
        訂單管理
      </button>
      <button
        onClick={() => router.push("/dashboard/analytics")}
        className="ml-2 bg-purple-600 text-white px-3 py-1"
      >
        營收分析
      </button>
      
    </div>
  );
}