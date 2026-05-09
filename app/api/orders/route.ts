import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
console.log("KEY:", process.env.FIREBASE_ADMIN_KEY);
export async function GET() {
  try {
    const snap = await adminDb.collection("orders").get();

    const data = snap.docs.map((doc) => {
  const d = doc.data();

  return {
    id: doc.id,
    ...d,
    createdAt: d.createdAt || null, // ⭐ 一定要有
    items: typeof d.items === "string"
      ? JSON.parse(d.items)
      : d.items,
  };
});

    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json([], { status: 500 });
  }
}