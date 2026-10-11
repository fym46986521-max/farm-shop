import { NextResponse } from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// GET：取得公益捐款明細
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const keyword = (
      searchParams.get("keyword") || ""
    ).trim();

    const searchType =
      searchParams.get("searchType") === "phone"
        ? "phone"
        : "name";

    const page = Number(searchParams.get("page") || "1");

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000
    ) {
      return NextResponse.json(
        { ok: false, error: "頁碼不正確" },
        { status: 400 }
      );
    }

    if (keyword.length > 100) {
      return NextResponse.json(
        { ok: false, error: "搜尋內容過長" },
        { status: 400 }
      );
    }

    // 從 Firebase Admin SDK 讀取資料
    const snapshot = await adminDb
      .collection("donations")
      .orderBy("createdAt", "desc")
      .get();

    // 先整理資料，轉換 Firebase Timestamp
    let records = snapshot.docs.map((doc) => {
      const data = doc.data();

      const createdAt = data.createdAt;

      return {
        id: doc.id,

        donorName:
          typeof data.donorName === "string"
            ? data.donorName
            : "善心人士",

        // 完整電話只在伺服器內用於搜尋
        _donorPhone:
          typeof data.donorPhone === "string"
            ? data.donorPhone
            : "",

        amount:
          typeof data.amount === "number"
            ? data.amount
            : 0,

        units:
          typeof data.units === "number"
            ? data.units
            : 0,

        status:
          typeof data.status === "string"
            ? data.status
            : "pending",

        receiptUrl:
          typeof data.receiptUrl === "string" &&
          /^https:\/\//i.test(data.receiptUrl)
            ? data.receiptUrl
            : "",

        createdAt:
          createdAt instanceof Timestamp
            ? createdAt.toDate().toISOString()
            : createdAt &&
                typeof createdAt.toDate === "function"
              ? createdAt.toDate().toISOString()
              : null,
      };
    });

    // 姓名或電話搜尋
    if (keyword) {
      if (searchType === "phone") {
        records = records.filter((record) =>
          record._donorPhone.includes(keyword)
        );
      } else {
        records = records.filter((record) =>
          record.donorName
            .toLowerCase()
            .includes(keyword.toLowerCase())
        );
      }
    }

    const totalCount = records.length;

    const totalPages = Math.ceil(
      totalCount / PAGE_SIZE
    );

    const startIndex = (page - 1) * PAGE_SIZE;

    const pageRecords = records
      .slice(startIndex, startIndex + PAGE_SIZE)
      .map(({ _donorPhone, ...record }) => ({
        ...record,

        // 公開明細不回傳完整電話
        donorPhone: _donorPhone.replace(
          /^(\d{4})\d{3}(\d{3})$/,
          "$1***$2"
        ),
      }));

    return NextResponse.json({
      ok: true,
      records: pageRecords,
      totalCount,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    });
  } catch (error) {
    console.error("讀取公益捐款明細失敗：", error);

    return NextResponse.json(
      {
        ok: false,
        error: "捐款紀錄載入失敗，請稍後再試。",
      },
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

    const docRef = await adminDb
      .collection("donations")
      .add({
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