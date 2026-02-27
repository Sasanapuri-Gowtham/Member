import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBirhBQ-VQFaAUAFnYjzm2UDPer2xlf3Eo",
  authDomain: "health-connect-1171f.firebaseapp.com",
  projectId: "health-connect-1171f",
  storageBucket: "health-connect-1171f.firebasestorage.app",
  messagingSenderId: "1012336958631",
  appId: "1:1012336958631:web:41748c96e2f097546f4f82",
  measurementId: "G-W9CVLC7VN0",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
