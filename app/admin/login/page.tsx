"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (account === "admin" && password === "jdf5038") {
      localStorage.setItem("admin", "true");
      router.push("/dashboard");
    } else {
      alert("帳號或密碼錯誤");
    }
  };

  return (
    <div className="p-10 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔒 後台登入</h1>

      <input
        placeholder="帳號"
        onChange={(e) => setAccount(e.target.value)}
        className="border p-2 w-full mb-2"
      />

      <input
        type="password"
        placeholder="密碼"
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 w-full mb-4"
      />

      <button
        onClick={handleLogin}
        className="bg-black text-white w-full py-2"
      >
        登入
      </button>
    </div>
  );
}