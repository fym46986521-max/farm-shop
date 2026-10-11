import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

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