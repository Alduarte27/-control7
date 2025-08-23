// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0Mv7wdCkz-lMBARnKi3ZNlKZFdM4Any4",
  authDomain: "control-7-61a3f.firebaseapp.com",
  projectId: "control-7-61a3f",
  storageBucket: "control-7-61a3f.appspot.com",
  messagingSenderId: "246236490186",
  appId: "1:246236490186:web:57214e96476c5ec3220733"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
