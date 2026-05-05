import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  return NextResponse.json({
    url: "https://sandbox-api-pay.line.me/mock-payment",
  });
}