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
  runTransaction,
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
  const [showOneHeart, setShowOneHeart] = useState(false);
  const [oneHeartTab, setOneHeartTab] = useState<
  "stats" | "records" | "monthlyPlan"
>("stats");
// 每月捐款計畫設定
const [monthlyPlanYear, setMonthlyPlanYear] = useState(
  new Date().getFullYear()
);

const [monthlyPlanMonth, setMonthlyPlanMonth] = useState(
  new Date().getMonth() + 1
);

// 每週配送量
const [weeklyDeliveryKg, setWeeklyDeliveryKg] = useState("50");

// 每週認捐目標
const [weeklyDonationTarget, setWeeklyDonationTarget] = useState("5000");

// 設定儲存狀態
const [savingMonthlyPlan, setSavingMonthlyPlan] = useState(false);

// 當月計畫是否已鎖定
const [monthlyPlanLocked, setMonthlyPlanLocked] = useState(false);
  // 歷史排行榜查詢條件
const currentYear = new Date().getFullYear();
// 取得指定年份、月份的週數
const getWeeksInMonth = (year: number, month: number) => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const firstMonday = new Date(firstDay);
  const offset = (firstMonday.getDay() + 6) % 7;
  firstMonday.setDate(firstMonday.getDate() - offset);

  const lastMonday = new Date(lastDay);
  const lastOffset = (lastMonday.getDay() + 6) % 7;
  lastMonday.setDate(lastMonday.getDate() - lastOffset);

  return Math.round(
    (lastMonday.getTime() - firstMonday.getTime()) /
      (7 * 24 * 60 * 60 * 1000)
  ) + 1;
};

// 取得指定月份的每週排行榜
const getHistoricalWeeklyRanking = () => {
  const year = weeklyRankYear;
  const month = weeklyRankMonth;
  const week = weeklyRankWeek;

  const firstDay = new Date(year, month - 1, 1);

  // 以星期一作為每週的第一天
  const firstMonday = new Date(firstDay);
  const offset = (firstMonday.getDay() + 6) % 7;
  firstMonday.setDate(firstMonday.getDate() - offset);

  const start = new Date(firstMonday);
  start.setDate(start.getDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const rankingMap = new Map<
    string,
    { name: string; amount: number }
  >();

  donations.forEach((item: any) => {
    if (item.status !== "confirmed") return;

    let date: Date | null = null;

    if (item.createdAt?.toDate) {
      date = item.createdAt.toDate();
    } else if (item.createdAt instanceof Date) {
      date = item.createdAt;
    } else if (
      typeof item.createdAt === "string" ||
      typeof item.createdAt === "number"
    ) {
      const parsed = new Date(item.createdAt);

      if (!Number.isNaN(parsed.getTime())) {
        date = parsed;
      }
    }

    if (!date || date < start || date >= end) return;

    // 同時限制在所選月份內
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month
    ) {
      return;
    }

    const name = String(item.donorName || "未提供姓名").trim();

    const current = rankingMap.get(name) || {
      name,
      amount: 0,
    };

    current.amount += Number(item.amount) || 0;
    rankingMap.set(name, current);
  });

  return Array.from(rankingMap.values()).sort(
    (a, b) => b.amount - a.amount
  );
};

// 取得指定年月的每月排行榜
const getHistoricalMonthlyRanking = () => {
  const start = new Date(monthlyRankYear, monthlyRankMonth - 1, 1);
  const end = new Date(monthlyRankYear, monthlyRankMonth, 1);

  const rankingMap = new Map<
    string,
    { name: string; amount: number }
  >();

  donations.forEach((item: any) => {
    if (item.status !== "confirmed") return;

    let date: Date | null = null;

    if (item.createdAt?.toDate) {
      date = item.createdAt.toDate();
    } else if (item.createdAt instanceof Date) {
      date = item.createdAt;
    } else if (
      typeof item.createdAt === "string" ||
      typeof item.createdAt === "number"
    ) {
      const parsed = new Date(item.createdAt);

      if (!Number.isNaN(parsed.getTime())) {
        date = parsed;
      }
    }

    if (!date || date < start || date >= end) return;

    const name = String(item.donorName || "未提供姓名").trim();

    const current = rankingMap.get(name) || {
      name,
      amount: 0,
    };

    current.amount += Number(item.amount) || 0;
    rankingMap.set(name, current);
  });

  return Array.from(rankingMap.values()).sort(
    (a, b) => b.amount - a.amount
  );
};

const [weeklyRankYear, setWeeklyRankYear] = useState(currentYear);
const [weeklyRankMonth, setWeeklyRankMonth] = useState(
  new Date().getMonth() + 1
);
const [weeklyRankWeek, setWeeklyRankWeek] = useState(1);

const [monthlyRankYear, setMonthlyRankYear] = useState(currentYear);
const [monthlyRankMonth, setMonthlyRankMonth] = useState(
  new Date().getMonth() + 1
);
  // 一菜一心：顧客認捐資料
const [donations, setDonations] = useState<any[]>([]);
const [donationsLoading, setDonationsLoading] = useState(false);
const [donationPage, setDonationPage] = useState(1);

const DONATIONS_PAGE_SIZE = 10;
  // 一菜一心：受捐助機構
const [donationOrganizations, setDonationOrganizations] = useState<any[]>([]);
const [selectedOrganization, setSelectedOrganization] = useState("");
const [newOrganization, setNewOrganization] = useState("");

// 一菜一心：每週捐贈紀錄
const [weeklyDonationRecords, setWeeklyDonationRecords] = useState<any[]>([]);
const [donationDate, setDonationDate] = useState(
  new Date().toLocaleDateString("en-CA")
);
const [donationImageFile, setDonationImageFile] = useState<File | null>(null);
const [receiptImageFile, setReceiptImageFile] = useState<File | null>(null);
const [savingDonationRecord, setSavingDonationRecord] = useState(false);
// 每週捐贈紀錄：分頁管理
const [weeklyDonationPage, setWeeklyDonationPage] = useState(1);
const WEEKLY_DONATION_PAGE_SIZE = 10;

// 每週捐贈紀錄：詳細資料視窗
const [selectedWeeklyRecord, setSelectedWeeklyRecord] = useState<any>(null);

// 每週捐贈紀錄：編輯表單
const [editingWeeklyDate, setEditingWeeklyDate] = useState("");
const [editingWeeklyOrganization, setEditingWeeklyOrganization] = useState("");
const [editingWeeklyDonationImage, setEditingWeeklyDonationImage] = useState<File | null>(null);
const [editingWeeklyReceiptImage, setEditingWeeklyReceiptImage] = useState<File | null>(null);
const [savingWeeklyEdit, setSavingWeeklyEdit] = useState(false);
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
  useEffect(() => {
  if (!showOneHeart) return;

  fetchDonationOrganizations();
  fetchWeeklyDonationRecords();
  fetchDonations();
}, [showOneHeart]);
  const fetchProducts = async () => {
    const snapshot = await getDocs(collection(db, "products"));
    const list: any[] = [];

    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });

    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setProducts(list);
  };
  // 讀取受捐助機構
const fetchDonationOrganizations = async () => {
  try {
    const snapshot = await getDocs(
      collection(db, "donationOrganizations")
    );

    const list = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    list.sort((a: any, b: any) =>
      String(a.name || "").localeCompare(
        String(b.name || ""),
        "zh-TW"
      )
    );

    setDonationOrganizations(list);
  } catch (error: any) {
  console.error("讀取受捐機構失敗：", error);

  alert(
    `讀取受捐機構失敗：${error?.code || "未知錯誤"}\n${
      error?.message || "請查看瀏覽器 Console"
    }`
  );
}
};

// 讀取每週捐贈紀錄
const fetchWeeklyDonationRecords = async () => {
  try {
    const snapshot = await getDocs(
      collection(db, "weeklyDonationRecords")
    );

    const list = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    list.sort((a: any, b: any) =>
      String(b.donationDate || "").localeCompare(
        String(a.donationDate || "")
      )
    );

    setWeeklyDonationRecords(list);
  } catch (error) {
    console.error("讀取每週捐贈紀錄失敗：", error);
    alert("讀取捐贈紀錄失敗，請檢查 Firebase 權限。");
  }
};
// 新增受捐助機構
const handleAddDonationOrganization = async () => {
  const organizationName = newOrganization.trim();

  if (!organizationName) {
    alert("請輸入受捐助機構名稱");
    return;
  }

  const alreadyExists = donationOrganizations.some(
    (item: any) =>
      String(item.name || "").trim() === organizationName
  );

  if (alreadyExists) {
    alert("這個受捐助機構已經存在");
    return;
  }

  try {
    await addDoc(collection(db, "donationOrganizations"), {
      name: organizationName,
      createdAt: Timestamp.now(),
    });

    setNewOrganization("");
    await fetchDonationOrganizations();

    setSelectedOrganization(organizationName);

    alert("受捐助機構新增成功！");
  } catch (error) {
    console.error("新增受捐助機構失敗：", error);
    alert("新增失敗，請確認管理員權限及 Firebase 設定。");
  }
};
// 上傳捐贈照片或收據
const uploadDonationImage = async (
  file: File,
  folder: string
): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("只能上傳圖片檔案");
  }

  // 限制單張圖片 10 MB
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("圖片大小不可超過 10 MB");
  }

  const safeName = file.name.replace(/[^\w.-]/g, "_");

  const fileRef = ref(
    storage,
    `one-heart/${folder}/${Date.now()}_${safeName}`
  );

  await uploadBytes(fileRef, file);

  return await getDownloadURL(fileRef);
};
// 儲存每週捐贈紀錄
const handleSaveWeeklyDonation = async () => {
  if (!donationDate) {
    alert("請選擇捐贈日期");
    return;
  }

  if (!selectedOrganization) {
    alert("請選擇受捐助機構");
    return;
  }

  if (!donationImageFile) {
    alert("請上傳實際捐贈照片");
    return;
  }

  if (!receiptImageFile) {
    alert("請上傳捐贈收據");
    return;
  }

  setSavingDonationRecord(true);

  try {
    const organization = donationOrganizations.find(
      (item: any) => item.name === selectedOrganization
    );

    if (!organization) {
      throw new Error("找不到所選的受捐助機構，請重新選擇");
    }

    // 上傳實際捐贈照片
    const donationImageUrl = await uploadDonationImage(
      donationImageFile,
      "donation-photos"
    );

    // 上傳捐贈收據
    const receiptImageUrl = await uploadDonationImage(
      receiptImageFile,
      "receipts"
    );

    // 儲存紀錄至 Firestore
    await addDoc(collection(db, "weeklyDonationRecords"), {
      donationDate,
      organizationId: organization.id,
      organizationName: organization.name,
      donationImageUrl,
      receiptImageUrl,
      createdAt: Timestamp.now(),
    });

    // 清空表單
    setDonationDate(new Date().toLocaleDateString("en-CA"));
    setSelectedOrganization("");
    setDonationImageFile(null);
    setReceiptImageFile(null);

    await fetchWeeklyDonationRecords();

    alert("每週捐贈紀錄儲存成功！");
  } catch (error) {
    console.error("儲存捐贈紀錄失敗：", error);

    alert(
      error instanceof Error
        ? `儲存失敗：${error.message}`
        : "儲存失敗，請檢查 Firebase 設定。"
    );
  } finally {
    setSavingDonationRecord(false);
  }
};
// 讀取顧客認捐資料，最新資料排最前面
const fetchDonations = async () => {
  setDonationsLoading(true);

  try {
    const snapshot = await getDocs(
      collection(db, "donations")
    );

    const list = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as any[];
console.log("認捐資料欄位檢查：", list);
    list.sort((a, b) => {
      const timeA =
        a.createdAt?.toMillis?.() ??
        (a.createdAt?.seconds
          ? a.createdAt.seconds * 1000
          : 0);

      const timeB =
        b.createdAt?.toMillis?.() ??
        (b.createdAt?.seconds
          ? b.createdAt.seconds * 1000
          : 0);

      return timeB - timeA;
    });

    setDonations(list);
    setDonationPage(1);
  } catch (error: any) {
  console.error("讀取認捐資料失敗：", error);
  console.error("Firebase 錯誤代碼：", error?.code);
  console.error("Firebase 錯誤訊息：", error?.message);

  alert(
    `讀取認捐資料失敗\n錯誤代碼：${error?.code || "未知"}\n錯誤訊息：${error?.message || "無詳細訊息"}`
  );
} finally {
  setDonationsLoading(false);
}
};
// 一菜一心：計算今日、本週、本月已確認捐款金額
const getDonationStatistics = () => {
  const now = new Date();

  // 今天開始時間
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  // 明天開始時間
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  // 本週一開始時間
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const dayOfWeek = weekStart.getDay();

  weekStart.setDate(
    weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
  );

  // 下週一開始時間
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  // 本月開始時間
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  // 下個月開始時間
  const nextMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  );

  // 取得認捐時間
  const getCreatedAt = (donation: any): Date | null => {
    const value = donation.createdAt;

    if (value?.toDate) {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);

      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  };

  // 只統計已確認的捐款
  const confirmedDonations = donations.filter(
    (item: any) => item.status === "confirmed"
  );

  const sumBetween = (start: Date, end: Date) => {
    return confirmedDonations.reduce(
      (total: number, item: any) => {
        const date = getCreatedAt(item);

        if (
          !date ||
          date < start ||
          date >= end
        ) {
          return total;
        }

        return total + (Number(item.amount) || 0);
      },
      0
    );
  };

  return {
    todayAmount: sumBetween(todayStart, tomorrowStart),
    weekAmount: sumBetween(weekStart, nextWeekStart),
    monthAmount: sumBetween(monthStart, nextMonthStart),
  };
};

// 一菜一心：產生每週及每月捐款排行榜
const getDonationRanking = (period: "week" | "month") => {
  const now = new Date();

  let start: Date;
  let end: Date;

  if (period === "week") {
    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const dayOfWeek = start.getDay();

    start.setDate(
      start.getDate() -
        (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    );

    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else {
    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    );
  }

  const rankingMap = new Map<
    string,
    { name: string; amount: number }
  >();

  donations
    .filter((item: any) => item.status === "confirmed")
    .forEach((item: any) => {
      let date: Date | null = null;

      if (item.createdAt?.toDate) {
        date = item.createdAt.toDate();
      } else if (item.createdAt instanceof Date) {
        date = item.createdAt;
      } else if (
        typeof item.createdAt === "string" ||
        typeof item.createdAt === "number"
      ) {
        const parsed = new Date(item.createdAt);

        if (!Number.isNaN(parsed.getTime())) {
          date = parsed;
        }
      }

      if (!date || date < start || date >= end) {
        return;
      }

      const name = String(
        item.donorName || "未提供姓名"
      ).trim();

      const current = rankingMap.get(name) || {
        name,
        amount: 0,
      };

      current.amount += Number(item.amount) || 0;

      rankingMap.set(name, current);
    });

  return Array.from(rankingMap.values()).sort(
    (a, b) => b.amount - a.amount
  );
};

// 開啟每週捐贈紀錄的詳細資料及編輯視窗
const handleOpenWeeklyRecord = (record: any) => {
  setSelectedWeeklyRecord(record);
  setEditingWeeklyDate(record.donationDate || "");
  setEditingWeeklyOrganization(record.organizationName || "");
  setEditingWeeklyDonationImage(null);
  setEditingWeeklyReceiptImage(null);
};

// 儲存每週捐贈紀錄的修改
const handleUpdateWeeklyRecord = async () => {
  if (!selectedWeeklyRecord?.id) {
    alert("找不到這筆捐贈紀錄。");
    return;
  }

  if (!editingWeeklyDate) {
    alert("請選擇捐贈日期。");
    return;
  }

  if (!editingWeeklyOrganization.trim()) {
    alert("請輸入或選擇受捐助機構。");
    return;
  }

  setSavingWeeklyEdit(true);

  try {
    // 預設保留原本的照片與收據
    let donationImageUrl =
      selectedWeeklyRecord.donationImageUrl || "";

    let receiptImageUrl =
      selectedWeeklyRecord.receiptImageUrl || "";

    // 只有選擇新照片時，才重新上傳
    if (editingWeeklyDonationImage) {
      donationImageUrl = await uploadDonationImage(
        editingWeeklyDonationImage,
        "donation-photos"
      );
    }

    // 只有選擇新收據時，才重新上傳
    if (editingWeeklyReceiptImage) {
      receiptImageUrl = await uploadDonationImage(
        editingWeeklyReceiptImage,
        "receipts"
      );
    }

    // 更新 Firestore
    await updateDoc(
      doc(db, "weeklyDonationRecords", selectedWeeklyRecord.id),
      {
        donationDate: editingWeeklyDate,
        organizationName: editingWeeklyOrganization.trim(),
        organizationId:
          donationOrganizations.find(
            (item: any) =>
              item.name === editingWeeklyOrganization.trim()
          )?.id ||
          selectedWeeklyRecord.organizationId ||
          "",
        donationImageUrl,
        receiptImageUrl,
        updatedAt: Timestamp.now(),
      }
    );

    // 同步更新畫面
    setWeeklyDonationRecords((prev) =>
      prev
        .map((item) =>
          item.id === selectedWeeklyRecord.id
            ? {
                ...item,
                donationDate: editingWeeklyDate,
                organizationName: editingWeeklyOrganization.trim(),
                donationImageUrl,
                receiptImageUrl,
                updatedAt: Timestamp.now(),
              }
            : item
        )
        .sort((a, b) => {
          const dateCompare = String(b.donationDate || "").localeCompare(
            String(a.donationDate || "")
          );

          if (dateCompare !== 0) return dateCompare;

          const timeA =
            a.createdAt?.toMillis?.() ??
            (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);

          const timeB =
            b.createdAt?.toMillis?.() ??
            (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);

          return timeB - timeA;
        })
    );

    setSelectedWeeklyRecord(null);
    setEditingWeeklyDonationImage(null);
    setEditingWeeklyReceiptImage(null);

    alert("捐贈紀錄修改成功！");
  } catch (error) {
    console.error("修改每週捐贈紀錄失敗：", error);
    alert("修改失敗，請檢查 Firebase 權限或圖片上傳設定。");
  } finally {
    setSavingWeeklyEdit(false);
  }
};

// 刪除每週捐贈紀錄
const handleDeleteWeeklyRecord = async (record: any) => {
  if (!record?.id) {
    alert("找不到這筆捐贈紀錄。");
    return;
  }

  const confirmed = window.confirm(
    `確定要刪除這筆捐贈紀錄嗎？\n\n日期：${record.donationDate || "未填寫"}\n機構：${record.organizationName || "未填寫"}\n\n刪除後無法復原。`
  );

  if (!confirmed) return;

  try {
    await deleteDoc(
      doc(db, "weeklyDonationRecords", record.id)
    );

    setWeeklyDonationRecords((prev) =>
      prev.filter((item) => item.id !== record.id)
    );

    // 若刪除的是目前開啟的紀錄，也關閉視窗
    if (selectedWeeklyRecord?.id === record.id) {
      setSelectedWeeklyRecord(null);
    }

    alert("捐贈紀錄已刪除。");
  } catch (error) {
    console.error("刪除每週捐贈紀錄失敗：", error);
    alert("刪除失敗，請檢查 Firebase 權限。");
  }
};
// 審核捐款：確認或取消確認
const handleConfirmDonation = async (
  donationId: string,
  checked: boolean
) => {
  try {
    const donationRef = doc(db, "donations", donationId);

    await runTransaction(db, async (transaction) => {
      const donationSnapshot = await transaction.get(donationRef);

      if (!donationSnapshot.exists()) {
        throw new Error("找不到這筆捐款資料");
      }

      const donation = donationSnapshot.data();

      // 取消確認：只更新狀態，不刪除已建立的公益紀錄
      if (!checked) {
        transaction.update(donationRef, {
          status: "pending",
        });

        return;
      }

      // 已經確認過，不重複建立紀錄
      if (donation.status === "confirmed") {
        return;
      }

      // 自由捐款：維持原本行為
      if (donation.donationType !== "monthly") {
        transaction.update(donationRef, {
          status: "confirmed",
          confirmedAt: Timestamp.now(),
        });

        return;
      }

      // 定期捐款必須是固定一年 NT$12,000
      if (Number(donation.amount) !== 12000) {
        throw new Error(
          "定期捐款金額不是 NT$12,000，請先核對資料"
        );
      }

      const now = new Date();

      // 第一筆：以管理員確認收款的日期記錄
      const firstMonth =
        `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, "0")}`;

      // 使用固定文件 ID，避免同一筆捐款重複建立首月紀錄
      const firstRecordRef = doc(
        db,
        "monthlyDonationRecords",
        `${donationId}_01`
      );

      const planRef = doc(
        db,
        "monthlyDonationPlans",
        donationId
      );

      const firstRecordSnapshot = await transaction.get(
        firstRecordRef
      );

      const planSnapshot = await transaction.get(planRef);

      // 如果已經有首月紀錄及排程，代表之前建立過。
// 重新勾選時直接恢復確認狀態，不重複建立資料。
if (firstRecordSnapshot.exists() && planSnapshot.exists()) {
  transaction.update(donationRef, {
    status: "confirmed",
    confirmedAt: Timestamp.now(),
    monthlyPlanCreated: true,
  });

  return;
}

// 只存在其中一份資料時，不自動重建，避免覆蓋或重複記帳。
if (firstRecordSnapshot.exists() || planSnapshot.exists()) {
  throw new Error(
    "這筆定期捐款的月紀錄與排程不完整，請先核對 Firebase 資料"
  );
}

      // 下一次執行日期：下個月 1 日
      const nextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      );

      transaction.set(firstRecordRef, {
        donationId,
        donorName: donation.donorName || "善心人士",
        amount: 1000,
        month: firstMonth,
        installment: 1,
        donationType: "monthly",
        createdAt: Timestamp.now(),
      });

      // 保存後續 11 個月的排程資訊
      transaction.set(planRef, {
        donationId,
        donorName: donation.donorName || "善心人士",
        totalAmount: 12000,
        monthlyAmount: 1000,
        totalMonths: 12,
        completedMonths: 1,
        nextInstallment: 2,
        nextRunAt: Timestamp.fromDate(nextMonth),
        status: "active",
        createdAt: Timestamp.now(),
      });

      transaction.update(donationRef, {
        status: "confirmed",
        confirmedAt: Timestamp.now(),
        monthlyPlanCreated: true,
      });
    });

    // 更新後台畫面
    setDonations((prev) =>
      prev.map((item) =>
        item.id === donationId
          ? {
              ...item,
              status: checked ? "confirmed" : "pending",
            }
          : item
      )
    );

    alert(
      checked
        ? "捐款確認成功！若為定期捐款，已建立首月紀錄及後續排程資料。"
        : "已取消捐款確認。"
    );
  } catch (error) {
    console.error("更新捐款狀態失敗：", error);

    alert(
      error instanceof Error
        ? `更新失敗：${error.message}`
        : "更新失敗，請檢查 Firebase 權限。"
    );
  }
};
// 上傳捐款收據
const handleUploadDonationReceipt = async (
  donationId: string,
  file: File
) => {
  if (!file.type.startsWith("image/")) {
    alert("請選擇圖片格式的收據。");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert("收據圖片不能超過 10 MB。");
    return;
  }

  try {
    // 上傳圖片至 Firebase Storage
    const receiptUrl = await uploadDonationImage(
  file,
  "receipts"
);

    if (!receiptUrl) {
      throw new Error("沒有取得收據圖片網址");
    }

    // 將圖片網址儲存至該筆捐款
    await updateDoc(doc(db, "donations", donationId), {
      receiptUrl,
    });

    // 更新後台畫面
    setDonations((prev: any[]) =>
      prev.map((item) =>
        item.id === donationId
          ? { ...item, receiptUrl }
          : item
      )
    );

    alert("收據上傳成功！");
  } catch (error) {
    console.error("上傳捐款收據失敗：", error);
    alert("收據上傳失敗，請檢查 Firebase Storage 與 Firestore 權限。");
  }
};
// 刪除捐款資料
const handleDeleteDonation = async (donationId: string) => {
  const confirmed = window.confirm(
    "確定要刪除這筆認捐資料嗎？刪除後無法復原。"
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "donations", donationId));

    setDonations((prev) =>
      prev.filter((item) => item.id !== donationId)
    );

    alert("認捐資料已刪除。");
  } catch (error) {
    console.error("刪除認捐資料失敗：", error);
    alert("刪除失敗，請檢查 Firebase 權限。");
  }
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
} catch (error: any) {
  console.error("儲存捐贈紀錄失敗：", error);

  alert(
    `儲存失敗\n錯誤代碼：${error?.code || "未知"}\n錯誤訊息：${
      error?.message || "請查看瀏覽器 Console"
    }`
  );
} finally {
  setSavingDonationRecord(false);
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
            <button
        onClick={() => setShowOneHeart(true)}
        className="ml-2 bg-green-600 text-white px-3 py-1 rounded"
      >
        💚 一菜一心
      </button>
            {showOneHeart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">

            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-green-700">
                💚 一菜一心管理
              </h2>

              <button
                onClick={() => setShowOneHeart(false)}
                className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
              >
                關閉 ✕
              </button>
            </div>

            <div className="mb-6 flex gap-3 border-b pb-3">
  <button
    onClick={() => setOneHeartTab("stats")}
    className={`rounded px-4 py-2 ${
      oneHeartTab === "stats"
        ? "bg-green-600 text-white"
        : "bg-gray-200 text-gray-700"
    }`}
  >
    捐贈統計
  </button>

  <button
    onClick={() => setOneHeartTab("records")}
    className={`rounded px-4 py-2 ${
      oneHeartTab === "records"
        ? "bg-green-600 text-white"
        : "bg-gray-200 text-gray-700"
    }`}
  >
    每週捐贈紀錄
  </button>
  <button
  type="button"
  onClick={() => setOneHeartTab("monthlyPlan")}
  className={`rounded-lg px-4 py-2 ${
    oneHeartTab === "monthlyPlan"
      ? "bg-green-600 text-white"
      : "bg-gray-200 text-gray-700 "
  }`}
>
  每月捐款計畫
</button>
</div>

            {oneHeartTab === "stats" ? (
  <div className="rounded-lg border p-5">
    <h3 className="mb-4 text-lg font-bold">
      📊 捐贈統計
    </h3>

    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-lg bg-green-50 p-4">
        <p className="text-sm text-gray-600">今日捐贈金額</p>
        <p className="mt-2 text-2xl font-bold text-green-700">
          NT$ {getDonationStatistics().todayAmount.toLocaleString("zh-TW")}
        </p>
      </div>

      <div className="rounded-lg bg-blue-50 p-4">
        <p className="text-sm text-gray-600">本週捐贈金額</p>
        <p className="mt-2 text-2xl font-bold text-blue-700">
          NT$ {getDonationStatistics().weekAmount.toLocaleString("zh-TW")}
        </p>
      </div>

      <div className="rounded-lg bg-yellow-50 p-4">
        <p className="text-sm text-gray-600">本月捐贈金額</p>
        <p className="mt-2 text-2xl font-bold text-yellow-700">
          NT$ {getDonationStatistics().monthAmount.toLocaleString("zh-TW")}
        </p>
      </div>
    </div>

    <h4 className="mb-3 font-bold">每日捐贈名單</h4>

{(() => {
  const totalPages = Math.max(
    1,
    Math.ceil(donations.length / DONATIONS_PAGE_SIZE)
  );

  const startIndex =
    (donationPage - 1) * DONATIONS_PAGE_SIZE;

  const pageDonations = donations.slice(
    startIndex,
    startIndex + DONATIONS_PAGE_SIZE
  );

  return (
    <div>
      {donationsLoading ? (
        <p className="py-6 text-center text-gray-500">
          正在載入捐款資料……
        </p>
      ) : donations.length === 0 ? (
        <p className="py-6 text-center text-gray-500">
          目前尚無認捐資料。
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              共 {donations.length} 筆認捐資料
            </p>

            <p className="text-sm text-gray-600">
              第 {donationPage} / {totalPages} 頁
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border p-3">匯款審核</th>
                  <th className="border p-3">捐款人</th>
                  <th className="border p-3">聯絡電話</th>
                  <th className="border p-3">認捐金額</th>
                  <th className="border p-3">匯款末五碼</th>
                  <th className="border p-3">捐款狀態</th>
                  <th className="border p-3">操作</th>
                </tr>
              </thead>

              <tbody>
                {pageDonations.map((item: any) => {
                  const isConfirmed =
                    item.status === "confirmed";

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="border p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isConfirmed}
                          onChange={(event) =>
                            handleConfirmDonation(
                              item.id,
                              event.target.checked
                            )
                          }
                          aria-label={`審核 ${item.donorName || "捐款人"} 的捐款`}
                          className="h-5 w-5 cursor-pointer"
                        />
                      </td>

                      <td className="border p-3">
                        {item.donorName || "未填寫"}
                      </td>

                      <td className="border p-3">
                        {item.donorPhone || "未填寫"}
                      </td>

                      <td className="border p-3 font-bold">
                        NT$ {Number(item.amount || 0).toLocaleString()}
                      </td>

                      <td className="border p-3">
                        {item.donorAccountLast5 || "未填寫"}
                      </td>

                      <td className="border p-3">
  <div className="flex flex-col gap-2">
    {/* 上傳收據 */}
    <label className="cursor-pointer whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-center font-bold text-white hover:bg-blue-700">
      🧾 {item.receiptUrl ? "更換收據" : "上傳收據"}

      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];

          if (file) {
            await handleUploadDonationReceipt(item.id, file);
          }

          event.target.value = "";
        }}
      />
    </label>

    {/* 預覽收據 */}
    {item.receiptUrl && (
      <button
        type="button"
        onClick={() => window.open(item.receiptUrl, "_blank")}
        className="whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 font-bold text-blue-700 hover:bg-blue-50"
      >
        👁 預覽收據
      </button>
    )}

    
  </div>
</td>
{/* 操作：只保留刪除按鈕 */}
<td className="w-[100px] border p-3 text-center">
  <button
    type="button"
    onClick={() => handleDeleteDonation(item.id)}
    className="w-full whitespace-nowrap rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-700"
  >
    🗑 刪除
  </button>
</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={donationPage <= 1}
              onClick={() =>
                setDonationPage((page) => Math.max(1, page - 1))
              }
              className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← 上一頁
            </button>

            <span className="text-sm text-gray-600">
              {donationPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={donationPage >= totalPages}
              onClick={() =>
                setDonationPage((page) =>
                  Math.min(totalPages, page + 1)
                )
              }
              className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一頁 →
            </button>
          </div>
        </>
      )}
    </div>
  );
})()}
    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
  <h4 className="mb-3 font-bold">🏆 每週捐贈排行</h4>

  <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
    <select
      value={weeklyRankYear}
      onChange={(e) => {
        setWeeklyRankYear(Number(e.target.value));
        setWeeklyRankWeek(1);
      }}
      className="rounded border p-2"
    >
      {Array.from(
        { length: 10 },
        (_, i) => currentYear - 5 + i
      ).map((year) => (
        <option key={year} value={year}>
          {year} 年
        </option>
      ))}
    </select>

    <select
      value={weeklyRankMonth}
      onChange={(e) => {
        setWeeklyRankMonth(Number(e.target.value));
        setWeeklyRankWeek(1);
      }}
      className="rounded border p-2"
    >
      {Array.from({ length: 12 }, (_, i) => i + 1).map(
        (month) => (
          <option key={month} value={month}>
            {month} 月
          </option>
        )
      )}
    </select>

    <select
      value={weeklyRankWeek}
      onChange={(e) =>
        setWeeklyRankWeek(Number(e.target.value))
      }
      className="rounded border p-2"
    >
      {Array.from(
        {
          length: getWeeksInMonth(
            weeklyRankYear,
            weeklyRankMonth
          ),
        },
        (_, i) => i + 1
      ).map((week) => (
        <option key={week} value={week}>
          第 {week} 週
        </option>
      ))}
    </select>
  </div>

  <p className="mb-3 text-sm text-gray-500">
    查詢：{weeklyRankYear} 年 {weeklyRankMonth} 月第{" "}
    {weeklyRankWeek} 週
  </p>

  {getHistoricalWeeklyRanking().length === 0 ? (
    <p className="text-sm text-gray-500">
      此週尚無已確認的捐款資料
    </p>
  ) : (
    <div className="space-y-2">
      {getHistoricalWeeklyRanking().map((item, index) => (
        <div
          key={item.name}
          className="flex justify-between rounded-lg bg-gray-50 p-3"
        >
          <span>
            {index + 1}. {item.name}
          </span>

          <span className="font-bold text-green-700">
            NT$ {item.amount.toLocaleString("zh-TW")}
          </span>
        </div>
      ))}
    </div>
  )}
</div>

      <div>
  <h4 className="mb-3 font-bold">🏆 每月捐贈排行</h4>

  <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
    <select
      value={monthlyRankYear}
      onChange={(e) =>
        setMonthlyRankYear(Number(e.target.value))
      }
      className="rounded border p-2"
    >
      {Array.from(
        { length: 10 },
        (_, i) => currentYear - 5 + i
      ).map((year) => (
        <option key={year} value={year}>
          {year} 年
        </option>
      ))}
    </select>

    <select
      value={monthlyRankMonth}
      onChange={(e) =>
        setMonthlyRankMonth(Number(e.target.value))
      }
      className="rounded border p-2"
    >
      {Array.from({ length: 12 }, (_, i) => i + 1).map(
        (month) => (
          <option key={month} value={month}>
            {month} 月
          </option>
        )
      )}
    </select>
  </div>

  <p className="mb-3 text-sm text-gray-500">
    查詢：{monthlyRankYear} 年 {monthlyRankMonth} 月
  </p>

  {getHistoricalMonthlyRanking().length === 0 ? (
    <p className="text-sm text-gray-500">
      此月份尚無已確認的捐款資料
    </p>
  ) : (
    <div className="space-y-2">
      {getHistoricalMonthlyRanking().map((item, index) => (
        <div
          key={item.name}
          className="flex justify-between rounded-lg bg-gray-50 p-3"
        >
          <span>
            {index + 1}. {item.name}
          </span>

          <span className="font-bold text-green-700">
            NT$ {item.amount.toLocaleString("zh-TW")}
          </span>
        </div>
      ))}
    </div>
  )}
</div>
    </div>
  </div>
) : oneHeartTab === "records" ? (
  <div className="rounded-lg border p-5">
    <h3 className="mb-4 text-lg font-bold">
      📋 每週捐贈紀錄
    </h3>

    <p className="mb-4 text-sm text-gray-500">
      登記實際捐贈日期、受捐助機構、捐贈照片及收據。
    </p>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block font-medium">
          捐贈日期
        </label>
        <input
          type="date"
          className="w-full rounded border p-2"
        />
      </div>

      <div>
        <label className="mb-1 block font-medium">
          受捐助機構
        </label>
        <div className="flex gap-2">
          <select
  value={selectedOrganization}
  onChange={(e) => setSelectedOrganization(e.target.value)}
  className="w-full rounded border p-2"
>
  <option value="">請選擇機構</option>

  {donationOrganizations.map((organization: any) => (
    <option key={organization.id} value={organization.name}>
      {organization.name}
    </option>
  ))}
</select>

          <button
  type="button"
  onClick={async () => {
    const organization = window.prompt(
      "請輸入新的受捐助機構名稱"
    );

    if (!organization?.trim()) return;

    setNewOrganization(organization.trim());

    const alreadyExists = donationOrganizations.some(
      (item: any) =>
        String(item.name || "").trim() === organization.trim()
    );

    if (alreadyExists) {
      alert("這個受捐助機構已經存在");
      return;
    }

    try {
      await addDoc(collection(db, "donationOrganizations"), {
        name: organization.trim(),
        createdAt: Timestamp.now(),
      });

      await fetchDonationOrganizations();
      setSelectedOrganization(organization.trim());

      alert("受捐助機構新增成功！");
    } catch (error) {
      console.error(error);
      alert("新增失敗，請檢查 Firebase 權限。");
    }
  }}
  className="shrink-0 rounded bg-green-600 px-4 py-2 text-white"
>
  ＋新增
</button>
        </div>
      </div>

      <div>
  <label className="mb-1 block font-medium">
    實際捐贈照片
  </label>

  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const file = e.target.files?.[0] ?? null;
      setDonationImageFile(file);
      console.log("實際捐贈照片：", file);
    }}
    className="w-full rounded border p-2"
  />
</div>

      <div>
  <label className="mb-1 block font-medium">
    捐贈收據
  </label>

  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const file = e.target.files?.[0] ?? null;
      setReceiptImageFile(file);
      console.log("捐贈收據：", file);
    }}
    className="w-full rounded border p-2"
  />
</div>
    </div>

    <button
  type="button"
  onClick={handleSaveWeeklyDonation}
  disabled={savingDonationRecord}
  className="mt-6 rounded bg-green-600 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
>
  {savingDonationRecord ? "正在儲存..." : "儲存捐贈紀錄"}
</button>
  
{/* 每週捐贈紀錄列表 */}
<div className="mt-8 border-t pt-6">
  <h4 className="mb-4 text-lg font-bold">
    📋 已登記的捐贈紀錄
  </h4>

  {(() => {
    const sortedRecords = [...weeklyDonationRecords].sort((a, b) => {
      const dateCompare = String(b.donationDate || "").localeCompare(
        String(a.donationDate || "")
      );

      if (dateCompare !== 0) return dateCompare;

      const timeA =
        a.createdAt?.toMillis?.() ??
        (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);

      const timeB =
        b.createdAt?.toMillis?.() ??
        (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);

      return timeB - timeA;
    });

    const totalPages = Math.max(
      1,
      Math.ceil(sortedRecords.length / WEEKLY_DONATION_PAGE_SIZE)
    );

    const currentPage = Math.min(weeklyDonationPage, totalPages);

    const startIndex =
      (currentPage - 1) * WEEKLY_DONATION_PAGE_SIZE;

    const pageRecords = sortedRecords.slice(
      startIndex,
      startIndex + WEEKLY_DONATION_PAGE_SIZE
    );

    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>共 {sortedRecords.length} 筆捐贈紀錄</span>

          <span>
            第 {currentPage} / {totalPages} 頁
          </span>
        </div>

        {sortedRecords.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-6 text-center text-gray-500">
            目前還沒有捐贈紀錄。
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {pageRecords.map((record: any) => (
                <div
                  key={record.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenWeeklyRecord(record)}
                    className="flex-1 text-left hover:text-green-700"
                  >
                    <div className="font-bold">
                      {record.donationDate || "未填寫日期"}
                    </div>

                    <div className="mt-1 text-sm text-gray-600">
                      受捐助機構：
                      {record.organizationName || "未填寫機構"}
                    </div>

                    <div className="mt-2 text-sm text-blue-600">
                      點擊查看詳細資料、捐贈照片及收據 →
                    </div>
                  </button>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenWeeklyRecord(record)}
                      className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      編輯
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteWeeklyRecord(record)}
                      className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() =>
                  setWeeklyDonationPage((page) => Math.max(1, page - 1))
                }
                className="rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← 上一頁
              </button>

              <span className="text-sm">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setWeeklyDonationPage((page) =>
                    Math.min(totalPages, page + 1)
                  )
                }
                className="rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一頁 →
              </button>
            </div>
          </>
        )}
      </div>
    );
  })()}
</div>
{/* 每週捐贈紀錄編輯視窗 */}
{selectedWeeklyRecord && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-bold text-green-700">
          編輯每週捐贈紀錄
        </h3>

        <button
          type="button"
          onClick={() => setSelectedWeeklyRecord(null)}
          className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
        >
          關閉 ✕
        </button>
      </div>

      {/* 捐贈日期 */}
      <div className="mb-4">
        <label className="mb-2 block font-medium">
          捐贈日期
        </label>

        <input
          type="date"
          value={editingWeeklyDate}
          onChange={(e) => setEditingWeeklyDate(e.target.value)}
          className="w-full rounded-lg border p-3"
        />
      </div>

      {/* 受捐助機構 */}
      <div className="mb-5">
        <label className="mb-2 block font-medium">
          受捐助機構
        </label>

        <select
          value={editingWeeklyOrganization}
          onChange={(e) =>
            setEditingWeeklyOrganization(e.target.value)
          }
          className="w-full rounded-lg border p-3"
        >
          <option value="">請選擇機構</option>

          {donationOrganizations.map((organization: any) => (
            <option
              key={organization.id}
              value={organization.name}
            >
              {organization.name}
            </option>
          ))}

          {editingWeeklyOrganization &&
            !donationOrganizations.some(
              (organization: any) =>
                organization.name === editingWeeklyOrganization
            ) && (
              <option value={editingWeeklyOrganization}>
                {editingWeeklyOrganization}
              </option>
            )}
        </select>
      </div>

      {/* 原有捐贈照片 */}
      <div className="mb-5">
        <label className="mb-2 block font-medium">
          實際捐贈照片
        </label>

        {selectedWeeklyRecord.donationImageUrl ? (
          <a
            href={selectedWeeklyRecord.donationImageUrl}
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={selectedWeeklyRecord.donationImageUrl}
              alt="實際捐贈照片"
              className="mb-3 max-h-72 w-full rounded-lg border object-contain"
            />
          </a>
        ) : (
          <p className="mb-3 text-sm text-gray-500">
            尚未上傳捐贈照片
          </p>
        )}

        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setEditingWeeklyDonationImage(
              e.target.files?.[0] || null
            )
          }
          className="w-full rounded-lg border p-3"
        />

        <p className="mt-1 text-sm text-gray-500">
          不選擇新照片，就會保留原本的照片。
        </p>
      </div>

      {/* 原有捐贈收據 */}
      <div className="mb-6">
        <label className="mb-2 block font-medium">
          捐贈收據
        </label>

        {selectedWeeklyRecord.receiptImageUrl ? (
          <a
            href={selectedWeeklyRecord.receiptImageUrl}
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={selectedWeeklyRecord.receiptImageUrl}
              alt="捐贈收據"
              className="mb-3 max-h-72 w-full rounded-lg border object-contain"
            />
          </a>
        ) : (
          <p className="mb-3 text-sm text-gray-500">
            尚未上傳捐贈收據
          </p>
        )}

        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setEditingWeeklyReceiptImage(
              e.target.files?.[0] || null
            )
          }
          className="w-full rounded-lg border p-3"
        />

        <p className="mt-1 text-sm text-gray-500">
          不選擇新收據，就會保留原本的收據。
        </p>
      </div>

      {/* 操作按鈕 */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setSelectedWeeklyRecord(null)}
          disabled={savingWeeklyEdit}
          className="rounded-lg bg-gray-200 px-5 py-3 hover:bg-gray-300 disabled:opacity-50"
        >
          取消
        </button>

        <button
          type="button"
          onClick={handleUpdateWeeklyRecord}
          disabled={savingWeeklyEdit}
          className="rounded-lg bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {savingWeeklyEdit ? "儲存中..." : "儲存修改"}
        </button>
      </div>
    </div>
  </div>
)}
</div>
) : oneHeartTab === "monthlyPlan" ?(
  <div className="space-y-6 rounded-xl border p-5">
  <div>
    <h3 className="text-xl font-bold text-green-700">
      📅 每月捐款計畫
    </h3>

    <p className="mt-2 text-sm text-gray-500">
      設定每週配送量及認捐目標，設定變更於下個月生效。
    </p>
  </div>

  {/* 選擇適用月份 */}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div>
      <label className="mb-2 block font-medium">
        年度
      </label>

      <select
        value={monthlyPlanYear}
        onChange={(e) =>
          setMonthlyPlanYear(Number(e.target.value))
        }
        className="w-full rounded-lg border p-3"
      >
        {Array.from(
          { length: 10 },
          (_, i) => new Date().getFullYear() - 2 + i
        ).map((year) => (
          <option key={year} value={year}>
            {year} 年
          </option>
        ))}
      </select>
    </div>

    <div>
      <label className="mb-2 block font-medium">
        月份
      </label>

      <select
        value={monthlyPlanMonth}
        onChange={(e) =>
          setMonthlyPlanMonth(Number(e.target.value))
        }
        className="w-full rounded-lg border p-3"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(
          (month) => (
            <option key={month} value={month}>
              {month} 月
            </option>
          )
        )}
      </select>
    </div>
  </div>

  {/* 每週配送量 */}
  <div>
    <label className="mb-2 block font-medium">
      每週配送量（公斤）
    </label>

    <input
      type="number"
      min="0"
      step="0.1"
      value={weeklyDeliveryKg}
      onChange={(e) =>
        setWeeklyDeliveryKg(e.target.value)
      }
      disabled={monthlyPlanLocked}
      className="w-full rounded-lg border p-3 disabled:bg-gray-100"
    />
  </div>

  {/* 每週認捐目標 */}
  <div>
    <label className="mb-2 block font-medium">
      每週認捐目標（新臺幣）
    </label>

    <input
      type="number"
      min="0"
      step="100"
      value={weeklyDonationTarget}
      onChange={(e) =>
        setWeeklyDonationTarget(e.target.value)
      }
      disabled={monthlyPlanLocked}
      className="w-full rounded-lg border p-3 disabled:bg-gray-100"
    />
  </div>

  {/* 當月目標摘要 */}
  <div className="rounded-xl bg-green-50 p-4">
    <p className="text-sm text-gray-600">
      選定月份的每週認捐目標
    </p>

    <p className="mt-1 text-2xl font-bold text-green-700">
      NT${" "}
      {Math.max(
        0,
        Number(weeklyDonationTarget) || 0
      ).toLocaleString("zh-TW")}
    </p>

    <p className="mt-2 text-sm text-gray-500">
      此金額為每週目標；實際月度上限需依當月配送週次計算。
    </p>
  </div>

  <button
    type="button"
    disabled={savingMonthlyPlan || monthlyPlanLocked}
    onClick={() => {
      alert(
        "目前只有設定介面，尚未連接 Firebase 儲存功能。"
      );
    }}
    className="w-full rounded-lg bg-green-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
  >
    {savingMonthlyPlan ? "儲存中..." : "儲存每月計畫"}
  </button>
</div>
) : null}

          </div>
        </div>
      )}
    </div>
  );
}
