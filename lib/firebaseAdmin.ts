import { getApps, initializeApp, cert } from "firebase-admin/app"; // ⭐這行要加 cert
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_ADMIN_KEY as string
);

// ⭐ 修正 private_key
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
      })
    : getApps()[0];

export const adminDb = getFirestore(app);