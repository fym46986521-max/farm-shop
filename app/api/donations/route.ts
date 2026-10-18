import { NextResponse } from "next/server";
import { FieldValue, FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Number(searchParams.get("page") || "1");
    const keyword = (searchParams.get("keyword") || "").trim();
    const searchType = searchParams.get("searchType") || "name";
    const cursor = (searchParams.get("cursor") || "").trim();

    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) {
      return NextResponse.json(
        { ok: false, error: "頁碼不正確" },
        { status: 400 }
      );
    }

    if (keyword.length > 100) {
      return NextResponse.json(
        { ok: false, error: "搜尋文字過長" },
        { status: 400 }
      );
    }

    if (!["name", "phone"].includes(searchType)) {
      return NextResponse.json(
        { ok: false, error: "搜尋類型不正確" },
        { status: 400 }
      );
    }

    const donationsRef = adminDb.collection("donations");

    // 搜尋模式：保留原本的姓名／電話子字串搜尋行為。
    // 注意：此模式仍需讀取全部文件，資料量大時需要另外優化。
    if (keyword) {
      const snapshot = await donationsRef
        .orderBy("createdAt", "desc")
        .orderBy(FieldPath.documentId(), "desc")
        .get();

      const records = snapshot.docs
        .map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            donorName: data.donorName || "",
            donationType: data.donationType || "free",
            needsReceipt: data.needsReceipt === true,
            donorAddress:
              typeof data.donorAddress === "string"
                ? data.donorAddress
                : "",
            donorPhone: data.donorPhone
              ? String(data.donorPhone).replace(
                  /^(\d{4})\d+(\d{3})$/,
                  "$1****$2"
                )
              : "",
            amount: Number(data.amount || 0),

            units: Number(data.units || 0),
            status: data.status || "pending",
            receiptUrl:
              typeof data.receiptUrl === "string" &&
              /^https:\/\//i.test(data.receiptUrl)
                ? data.receiptUrl
                : "",
            createdAt:
              data.createdAt?.toDate?.()?.toISOString?.() || null,
          };
        })
        .filter((record) => {
          if (searchType === "phone") {
            const originalPhone =
              snapshot.docs
                .find((doc) => doc.id === record.id)
                ?.data().donorPhone || "";

            return String(originalPhone).includes(keyword);
          }

          return record.donorName.includes(keyword);
        });

      const totalCount = records.length;
      const startIndex = (page - 1) * PAGE_SIZE;
      const pageRecords = records.slice(
        startIndex,
        startIndex + PAGE_SIZE
      );

      return NextResponse.json({
        ok: true,
        records: pageRecords,
        totalCount,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(totalCount / PAGE_SIZE),
        nextCursor: null,
        hasMore: startIndex + PAGE_SIZE < totalCount,
      });
    }

    // 一般瀏覽：真正使用 Firestore 游標分頁。
    let query = donationsRef
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");

    if (cursor) {
      const cursorSnapshot = await donationsRef.doc(cursor).get();

      if (!cursorSnapshot.exists) {
        return NextResponse.json(
          { ok: false, error: "分頁游標不存在，請重新載入" },
          { status: 400 }
        );
      }

      query = query.startAfter(cursorSnapshot);
    }

    const [countSnapshot, pageSnapshot] = await Promise.all([
      donationsRef.count().get(),
      query.limit(PAGE_SIZE + 1).get(),
    ]);

    const hasMore = pageSnapshot.docs.length > PAGE_SIZE;
    const visibleDocs = pageSnapshot.docs.slice(0, PAGE_SIZE);
    const lastDoc = visibleDocs[visibleDocs.length - 1];

    const records = visibleDocs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        donorName: data.donorName || "",
        donationType: data.donationType || "free",
        needsReceipt: data.needsReceipt === true,
        donorAddress:
          typeof data.donorAddress === "string"
            ? data.donorAddress
            : "",
        donorPhone: data.donorPhone
          ? String(data.donorPhone).replace(
              /^(\d{4})\d+(\d{3})$/,
              "$1****$2"
            )
          : "",
        amount: Number(data.amount || 0),
        // 管理員設定的預計開始使用月份，例如 2026-11
        startMonth:
         typeof data.startMonth === "string"
         ? data.startMonth
        : null,
        units: Number(data.units || 0),
        status: data.status || "pending",
        receiptUrl:
          typeof data.receiptUrl === "string" &&
          /^https:\/\//i.test(data.receiptUrl)
            ? data.receiptUrl
            : "",
        createdAt:
          data.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    });

    const totalCount = countSnapshot.data().count;

    return NextResponse.json({
      ok: true,
      records,
      totalCount,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(totalCount / PAGE_SIZE),
      nextCursor: hasMore && lastDoc ? lastDoc.id : null,
      hasMore,
    });
  } catch (error) {
    console.error("載入捐款明細失敗：", error);

    return NextResponse.json(
      { ok: false, error: "捐款紀錄載入失敗，請稍後再試" },
      { status: 500 }
    );
  }
}

// POST：新增公益認捐
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const donorName =
      typeof body.donorName === "string"
        ? body.donorName.trim()
        : "";

    const donorPhone =
      typeof body.donorPhone === "string"
        ? body.donorPhone.trim()
        : "";

    const donorAccountLast5 =
      typeof body.donorAccountLast5 === "string"
        ? body.donorAccountLast5.trim()
        : "";
    // 是否需要寄送收據及感謝狀
      const needsReceipt = body.needsReceipt === true;

      // 寄送地址：只有勾選需要寄送時才保存
      const donorAddress =
        needsReceipt && typeof body.donorAddress === "string"
          ? body.donorAddress.trim()
          : "";

      // 勾選寄送時，必須填寫地址
      if (needsReceipt && !donorAddress) {
        return NextResponse.json(
          { error: "請填寫收據及感謝狀的寄送地址" },
          { status: 400 }
        );
      }
    const donationType =
    body.donationType === "monthly" ? "monthly" : "free";

    const submittedUnits = Number(body.units);

   const units =
  donationType === "monthly"
    ? 120
    : submittedUnits;

const amount =
  donationType === "monthly"
    ? 12000
    : submittedUnits * 100;
    if (!donorName || donorName.length > 100) {
      return NextResponse.json(
        { error: "請輸入正確的捐款人姓名" },
        { status: 400 }
      );
    }

    if (!/^09\d{8}$/.test(donorPhone)) {
      return NextResponse.json(
        { error: "請輸入正確的台灣手機號碼" },
        { status: 400 }
      );
    }

    if (!/^\d{5}$/.test(donorAccountLast5)) {
      return NextResponse.json(
        { error: "請輸入正確的 5 位數字帳號末碼" },
        { status: 400 }
      );
    }

    if (
  donationType === "free" &&
  (
    !Number.isSafeInteger(submittedUnits) ||
    submittedUnits < 1 ||
    submittedUnits > 10000
  )
) {
  return NextResponse.json(
    { error: "認捐單位數不正確" },
    { status: 400 }
  );
}

// 勾選寄送收據及感謝狀時，必須填寫地址
if (needsReceipt && !donorAddress) {
  return NextResponse.json(
    { error: "請填寫收據及感謝狀的寄送地址" },
    { status: 400 }
  );
}

if (donorAddress.length > 300) {
  return NextResponse.json(
    { error: "寄送地址過長，請重新確認" },
    { status: 400 }
  );
}

const docRef = await adminDb
  .collection("donations")
  .add({
    donorName,
    donorPhone,
    units,
    amount,
    donationType,
    donorAccountLast5,

    // 收據及感謝狀寄送資料
    needsReceipt,
    donorAddress: needsReceipt ? donorAddress : "",

    status: "pending",
    receiptUrl: "",
    createdAt: FieldValue.serverTimestamp(),
  });

    return NextResponse.json(
      {
        ok: true,
        donationId: docRef.id,
        message:
          "認捐資料已成功送出，請等待農場聯繫核對。",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("公益認捐 API 錯誤：", error);

    return NextResponse.json(
      {
        error: "認捐資料送出失敗，請稍後再試。",
      },
      { status: 500 }
    );
  }
}