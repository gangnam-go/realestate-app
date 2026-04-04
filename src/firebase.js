import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCTiRWV7wuqVpem9XdUcNHtDIIR0-Y3KMM",
  authDomain: "realestate-app-913fc.firebaseapp.com",
  projectId: "realestate-app-913fc",
  storageBucket: "realestate-app-913fc.firebasestorage.app",
  messagingSenderId: "226746577215",
  appId: "1:226746577215:web:a6005970e533870f6ea38a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);