// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0Mv7wdCkz-lMBARnKi3ZNlKZFdM4Any4",
  authDomain: "control-7-61a3f.firebaseapp.com",
  projectId: "control-7-61a3f",
  storageBucket: "control-7-61a3f.firebasestorage.app",
  messagingSenderId: "246236490186",
  appId: "1:246236490186:web:57214e96476c5ec3220733"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Explicitly initialize Firestore with memory-only persistence disabled
// This can help prevent some intermittent connection issues.
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
});

const storage = getStorage(app);


export { app, db, storage };
