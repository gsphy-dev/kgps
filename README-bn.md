# কল্যাণী সরকারি প্রাথমিক বিদ্যালয় — Firebase সেটআপ (একবারের কাজ)

## ১. প্রকল্প ও সেবা চালু (Firebase Console)
1. console.firebase.google.com → **Add project** (যেমন: kalyani-gps)।
2. **Build → Authentication → Sign-in method → Email/Password** চালু করুন।
3. **Build → Realtime Database → Create database** (Location: Singapore)। তৈরি হলে উপরের URL টি কপি করুন।
4. **Build → Storage → Get started**।
5. **Project settings → Your apps → Web (</>)** → অ্যাপ নিবন্ধন করে `firebaseConfig` কপি করুন।

## ২. কনফিগ বসান
`firebase-config.js` খুলে `YOUR_...` লেখাগুলো আপনার মান দিয়ে বদলান (`databaseURL` সহ)।
প্রধান শিক্ষকের ইমেইল `kalyani.gps@gmail.com` — বদলাতে চাইলে `ADMIN_EMAILS`, `database.rules.json`, `storage.rules`, `firestore.rules` — চারটি ফাইলেই একই ইমেইল দিন।

## ৩. Rules বসান
- Realtime Database → **Rules** ট্যাবে `database.rules.json` এর লেখা পেস্ট → Publish
- Storage → **Rules** ট্যাবে `storage.rules` → Publish
- Firestore (ব্যবহার না হলেও বন্ধ রাখতে) → `firestore.rules`
(অথবা `firebase deploy --only database,storage,firestore,hosting` চালান)

## ৪. প্রথম লগইন
1. সাইটে ডানের “লগআউট” বোতাম চাপুন → **নতুন অ্যাকাউন্ট** → `kalyani.gps@gmail.com` + পাসওয়ার্ড → স্বয়ংক্রিয়ভাবে **অ্যাডমিন**।
2. অন্য শিক্ষকদের একই ভাবে অ্যাকাউন্ট খুলতে বলুন (প্রথমে “দর্শক”)। অ্যাডমিন হিসেবে প্যানেলে তাঁর ইমেইল দিয়ে **শিক্ষক** করে দিন → তিনি জিপিএস হাজিরা দিতে পারবেন।
3. শিক্ষক শুধু নিজের হাজিরা লিখতে পারেন; অ্যাডমিন সব সম্পাদনা করেন; বাকিরা শুধু দেখতে পারেন।

## ৫. ফাইল আপলোড
সব ফাইল (index.html, firebase-config.js, firebase-sync.js, manifest.json, আইকন) একই ফোল্ডারে হোস্টিংয়ে রাখুন। জিপিএস ও ফিঙ্গারপ্রিন্টের জন্য সাইট **https** এ চলতে হবে (Firebase Hosting বা Netlify/GitHub Pages)। আপলোড শেষে Authentication → Settings → **Authorized domains** এ আপনার ডোমেইন যোগ করুন।

বি.দ্র.: ছবি/PDF সিঙ্ক অ্যাডমিনের ডিভাইস থেকে আপলোড হয়; অন্য ডিভাইসে পেতে পাতাটি একবার রিলোড করুন।
