import { NextResponse } from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = "Asia/Taipei";

// 取得台灣當地日期
function getTaiwanDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

// 建立下一個月 1 日的台灣時間
function getNextMonthFirstDay(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  // 台灣 UTC+8；下一個月 1 日 00:00 台灣時間
  return Timestamp.fromDate(
    new Date(
      Date.UTC(nextYear, nextMonth - 1, 1, -8, 0, 0)
    )
  );
}

export async function GET(request: Request) {
  // 驗證 Vercel Cron 呼叫
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("缺少 CRON_SECRET 環境變數");

    return NextResponse.json(
      { error: "Cron 尚未完成設定" },
      { status: 500 }
    );
  }

  if (
    request.headers.get("authorization") !==
    `Bearer ${secret}`
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const now = new Date();
  const taiwanDate = getTaiwanDate(now);

  // 每天都會被 Cron 呼叫，但只在台灣每月 1 日執行
  if (taiwanDate.day !== 1) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "今天不是台灣時間每月 1 日",
    });
  }

  const nowTimestamp = Timestamp.fromDate(now);

  const plansSnapshot = await adminDb
    .collection("monthlyDonationPlans")
    .where("status", "==", "active")
    .where("nextRunAt", "<=", nowTimestamp)
    .get();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const planDocument of plansSnapshot.docs) {
    const planRef = planDocument.ref;

    try {
      const result = await adminDb.runTransaction(
        async (transaction) => {
          const planSnapshot = await transaction.get(planRef);

          if (!planSnapshot.exists) {
            return "skipped";
          }

          const plan = planSnapshot.data()!;

          if (plan.status !== "active") {
            return "skipped";
          }

          const nextRunAt = plan.nextRunAt;

          if (
            !nextRunAt ||
            typeof nextRunAt.toDate !== "function" ||
            nextRunAt.toDate().getTime() > now.getTime()
          ) {
            return "skipped";
          }

          const completedMonths = Number(
            plan.completedMonths ?? 0
          );

          const installment = Number(
            plan.nextInstallment ?? completedMonths + 1
          );

          const totalMonths = Number(plan.totalMonths ?? 12);

          // 最多只能建立 12 筆
          if (
            completedMonths >= totalMonths ||
            installment > totalMonths
          ) {
            transaction.update(planRef, {
              status: "completed",
              completedAt: FieldValue.serverTimestamp(),
            });

            return "skipped";
          }

          const recordRef = adminDb
            .collection("monthlyDonationRecords")
            .doc(`${plan.donationId}_${String(installment).padStart(2, "0")}`);

          const recordSnapshot = await transaction.get(recordRef);

          // 防止同一個月份重複入帳
          if (recordSnapshot.exists) {
            return "skipped";
          }

          const scheduledDate = nextRunAt.toDate();
          const scheduledTaiwanDate =
            getTaiwanDate(scheduledDate);

          const month =
            `${scheduledTaiwanDate.year}-${String(
              scheduledTaiwanDate.month
            ).padStart(2, "0")}`;

          transaction.set(recordRef, {
            donationId: plan.donationId,
            donorName: plan.donorName || "善心人士",
            amount: 1000,
            month,
            installment,
            donationType: "monthly",
            createdAt: FieldValue.serverTimestamp(),
          });

          const newCompletedMonths = completedMonths + 1;

          if (newCompletedMonths >= totalMonths) {
            transaction.update(planRef, {
              completedMonths: newCompletedMonths,
              nextInstallment: totalMonths + 1,
              status: "completed",
              completedAt: FieldValue.serverTimestamp(),
            });
          } else {
            const nextDate = getNextMonthFirstDay(
              scheduledTaiwanDate.year,
              scheduledTaiwanDate.month
            );

            transaction.update(planRef, {
              completedMonths: newCompletedMonths,
              nextInstallment: installment + 1,
              nextRunAt: nextDate,
            });
          }

          return "created";
        }
      );

      if (result === "created") {
        created++;
      } else {
        skipped++;
      }
    } catch (error) {
      failed++;

      console.error(
        `處理定期捐款排程失敗：${planDocument.id}`,
        error
      );
    }
  }

  return NextResponse.json({
    success: failed === 0,
    date: `${taiwanDate.year}-${String(
      taiwanDate.month
    ).padStart(2, "0")}-${String(
      taiwanDate.day
    ).padStart(2, "0")}`,
    checked: plansSnapshot.size,
    created,
    skipped,
    failed,
  });
}