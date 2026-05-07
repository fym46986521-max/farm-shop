import { Suspense } from "react";
import ShopClient from "./ShopClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShopClient />
    </Suspense>
  );
}