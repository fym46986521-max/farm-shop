import { NextResponse } from "next/server";
import {
  FieldValue,
  Timestamp,
  type Query,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// GET：讀取公益捐款明細
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const keyword = (searchParams.get("keyword") || "").trim();
    const searchType = searchParams.get("searchType") || "name";

    const page = Number(searchParams.get("page") || "1");

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000
    ) {
      return NextResponse.json(
        { error: "頁碼不正確" },
        { status: 400 }
      );
    }

    if (!["name", "phone"].includes(searchType)) {
      return NextResponse.json(
        { error: "搜尋類型不正確" },
        { status: 400 }
      );
    }

    if (keyword.length > 100) {
      return NextResponse.json(
        { error: "搜尋內容過長" },
        { status: 400 }
      );
    }

    const donationsRef = adminDb.collection("donations");

    let query: Query = donationsRef;

    // 姓名或電話開頭搜尋
    if (keyword) {
      const field =
        searchType === "name" ? "donorName" : "donorPhone";

      query = query
        .where(field, ">=", keyword)
        .where(field, "<=", keyword + "\uf8ff");
    }

    // 先取得符合條件的總筆數
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    // 依建立時間排序，最新的排前面
    query = query.orderBy("createdAt", "desc");

    // 使用游標分頁，避免使用 offset 跳過大量文件
    // 這裡先簡化為逐頁取得游標，確保一般分頁可運作
    let lastDocument:
      | FirebaseFirestore.QueryDocumentSnapshot
      | undefined;

    if (page > 1) {
      const cursorSnapshot = await query
        .limit((page - 1) * PAGE_SIZE)
        .get();

      if (cursorSnapshot.empty) {
        return NextResponse.json({
          ok: true,
          records: [],
          totalCount,
          page,
          pageSize: PAGE_SIZE,
        });
      }

      lastDocument =
        cursorSnapshot.docs[cursorSnapshot.docs.length - 1];
    }

    let pageQuery = query.limit(PAGE_SIZE);

    if (lastDocument) {
      pageQuery = query.startAfter(lastDocument).limit(PAGE_SIZE);
    }

    const snapshot = await pageQuery.get();

    const records = snapshot.docs.map((doc) => {
      const data = doc.data();

      const createdAt = data.createdAt;

      return {
        id: doc.id,
        donorName:
          typeof data.donorName === "string"
            ? data.donorName
            : "",
        // 公開明細不顯示完整電話
        donorPhone:
          typeof data.donorPhone === "string"
            ? data.donorPhone.replace(
                /^(\d{4})\d{3}(\d{3})$/,
                "$1***$2"
              )
            : "",
        units:
          typeof data.units === "number"
            ? data.units
            : 0,
        amount:
          typeof data.amount === "number"
            ? data.amount
            : 0,
        status:
          typeof data.status === "string"
            ? data.status
            : "pending",
        receiptUrl:
          typeof data.receiptUrl === "string"
            ? data.receiptUrl
            : "",
        createdAt:
          createdAt instanceof Timestamp
            ? createdAt.toDate().toISOString()
            : null,
      };
    });

    return NextResponse.json({
      ok: true,
      records,
      totalCount,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.error("讀取公益捐款明細失敗：", error);

    return NextResponse.json(
      { error: "捐款紀錄載入失敗，請稍後再試。" },
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

    const units = Number(body.units);
    const amount = units * 100;

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
      !Number.isSafeInteger(units) ||
      units < 1 ||
      units > 10000
    ) {
      return NextResponse.json(
        { error: "認捐單位數不正確" },
        { status: 400 }
      );
    }

    const docRef = await adminDb.collection("donations").add({
      donorName,
      donorPhone,
      units,
      amount,
      donorAccountLast5,
      status: "pending",
      receiptUrl: "",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        ok: true,
        donationId: docRef.id,
        message: "認捐資料已成功送出，請等待農場聯繫核對。",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("公益認捐 API 錯誤：", error);

    return NextResponse.json(
      { error: "認捐資料送出失敗，請稍後再試。" },
      { status: 500 }
    );
  }
}