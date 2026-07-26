import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBjvY_yr6f5cy2D0lzEIIYFobQKHRW31To",
  authDomain: "build-crew.firebaseapp.com",
  projectId: "build-crew",
  storageBucket: "build-crew.firebasestorage.app",
  messagingSenderId: "459573038425",
  appId: "1:459573038425:web:d4e0af388e42fdf165d048",
};

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const firebaseFunctions = getFunctions(firebaseApp, "us-west1");
export const firebaseStorage = getStorage(firebaseApp);
