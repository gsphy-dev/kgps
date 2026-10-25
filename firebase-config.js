// ============================================================
//  কল্যাণী সরকারি প্রাথমিক বিদ্যালয় — Firebase কনফিগ
//  ১) Firebase Console → Project settings → Your apps → Web app (</>)
//  ২) সেখানকার firebaseConfig-এর মানগুলো নিচে বসান (YOUR_... মুছে)
//  ৩) Realtime Database-এর URL (databaseURL) অবশ্যই দিন
// ============================================================
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ডাটাবেসে বিদ্যালয়ের ফোল্ডারের নাম (rules ফাইলের সাথে একই রাখুন)
export const SCHOOL_ID = "kalyani-gps";

// প্রধান অ্যাডমিন (প্রধান শিক্ষক) — rules ফাইলের ইমেইলের সাথে হুবহু এক হতে হবে
export const ADMIN_EMAILS = ["kalyani.gps@gmail.com"];
