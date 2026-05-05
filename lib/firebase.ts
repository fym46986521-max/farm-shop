import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDlLD736s5zosEj99OFqv2DHkPjHPtbPgE",
  authDomain: "farm-shop-7137e.firebaseapp.com",
  projectId: "farm-shop-7137e",
  storageBucket: "farm-shop-7137e.firebasestorage.app",
  messagingSenderId: "798962866754",
  appId: "1:798962866754:web:f73be06ac76296b47a6bdb",
  
};

// ✅ 防止重複初始化（你之前遇過那個錯）
const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

// 🔥 services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 🔥 ⭐ 關鍵這行（沒有就會爆錯）
export const googleProvider = new GoogleAuthProvider();