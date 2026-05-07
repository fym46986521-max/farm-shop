import liff from "@line/liff";
import { useEffect, useState } from "react";
useEffect(() => {
  const run = async () => {
    try {
      console.log("🔥 開始LIFF");

      await liff.init({
        liffId: "2009965103-C4wyKwKd",
      });

      console.log("✅ LIFF init完成");

      // 🔥 強制登入（關鍵）
      if (!liff.isLoggedIn()) {
        console.log("➡️ 未登入，導向登入");
        liff.login();
        return;
      }

      console.log("✅ 已登入");

      // 🔥 等待 LIFF 完整 ready
      await liff.ready;

      console.log("✅ LIFF ready");

      // 🔥 拿 userId（核心）
      const profile = await liff.getProfile();

      console.log("🎉 拿到 userId:", profile.userId);

      alert("LINE ID: " + profile.userId);

      localStorage.setItem("lineUserId", profile.userId);

    } catch (err) {
      console.error("❌ LIFF錯誤:", err);
      alert("LIFF錯誤: " + JSON.stringify(err));
    }
  };

  run();
}, []);