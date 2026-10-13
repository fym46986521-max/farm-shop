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

    const donationsRef = adminDb.collection("donations");

    // 搜尋模式：保留原本的部分姓名／電話搜尋功能。
    // 注意：目前搜尋仍會讀取全部資料，之後可另外優化。
    if (keyword) {
      const snapshot = await donationsRef
        .orderBy("createdAt", "desc")
        .get();

      let records = snapshot.docs.map((doc) => {
        const data = doc.data();

        const createdAt = data.createdAt;

        return {
          id: doc.id,
          donorName:
            typeof data.donorName === "string"
              ? data.donorName
              : "善心人士",
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
            createdAt &&
            typeof createdAt.toDate === "function"
              ? createdAt.toDate().toISOString()
              : null,
        };
      });

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

      const totalCount = records.length;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      const startIndex = (page - 1) * PAGE_SIZE;

      const pageRecords = records
        .slice(startIndex, startIndex + PAGE_SIZE)
        .map(({ _donorPhone, ...record }) => ({
          ...record,
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
    }

    // 無搜尋關鍵字：直接在 Firestore 分頁，
    // 不再一次下載整個 donations 集合。
    const countSnapshot = await donationsRef.count().get();
    const totalCount = countSnapshot.data().count;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    if (totalCount === 0 || page > totalPages) {
      return NextResponse.json({
        ok: true,
        records: [],
        totalCount,
        page,
        pageSize: PAGE_SIZE,
        totalPages,
      });
    }

    let pageQuery = donationsRef
      .orderBy("createdAt", "desc")
      .limit(PAGE_SIZE);

    // 只讀取前面頁數所需的文件，避免下載整個集合。
    // 適合目前規模不大、頁數有限的捐款紀錄。
    if (page > 1) {
      const cursorSnapshot = await donationsRef
        .orderBy("createdAt", "desc")
        .limit((page - 1) * PAGE_SIZE)
        .get();

      if (cursorSnapshot.empty) {
        return NextResponse.json({
          ok: true,
          records: [],
          totalCount,
          page,
          pageSize: PAGE_SIZE,
          totalPages,
        });
      }

      const lastDoc =
        cursorSnapshot.docs[cursorSnapshot.docs.length - 1];

      pageQuery = donationsRef
        .orderBy("createdAt", "desc")
        .startAfter(lastDoc)
        .limit(PAGE_SIZE);
    }

    const snapshot = await pageQuery.get();

    const records = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;

      const phone =
        typeof data.donorPhone === "string"
          ? data.donorPhone
          : "";

      return {
        id: doc.id,
        donorName:
          typeof data.donorName === "string"
            ? data.donorName
            : "善心人士",
        donorPhone: phone.replace(
          /^(\d{4})\d{3}(\d{3})$/,
          "$1***$2"
        ),
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
          createdAt &&
          typeof createdAt.toDate === "function"
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

    const donationType =
    body.donationType === "monthly" ? "monthly" : "free";

    const submittedUnits = Number(body.units);

    const units =
    donationType === "monthly" ? 120 : submittedUnits;

    const amount =
    donationType === "monthly" ? 12000 : submittedUnits * 100;

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

    const docRef = await adminDb
      .collection("donations")
      .add({
        donorName,
        donorPhone,
        units,
        amount,
        donationType,
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