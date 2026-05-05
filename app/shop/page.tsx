import { Suspense } from "react";
import ShopClient from "./ShopClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">載入中...</div>}>
      <ShopClient />
    </Suspense>
  );
}