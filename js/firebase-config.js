import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
// import { getStorage } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyBtFQr2EozYHEqNFDNpjsgpUiTvvgju_qg",
  authDomain: "the-bm-fitness-world-v2.firebaseapp.com",
  projectId: "the-bm-fitness-world-v2",
  storageBucket: "the-bm-fitness-world-v2.firebasestorage.app",
  messagingSenderId: "283918436935",
  appId: "1:283918436935:web:8a9f1dfcdd3a2a0a033f62"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app);

export { app, auth, db };
// export { storage };