import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.json();

  const params: any = {
    MerchantID: process.env.ECPAY_ID,
    MerchantTradeNo: "TEST" + Date.now(),
    MerchantTradeDate: new Date().toISOString(),
    PaymentType: "aio",
    TotalAmount: body.total,
    TradeDesc: "訂單",
    ItemName: "商品",
    ReturnURL: "https://你的網址/api/ecpay/callback",
    ChoosePayment: "ATM",
    EncryptType: 1,
  };

  return NextResponse.json(params);
}