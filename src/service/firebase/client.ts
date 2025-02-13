import { initializeApp } from "firebase/app";

const firebaseConfig = {
	apiKey: "AIzaSyAqmA841Q4iPUszg2zZA07Z9PBOX0VUp6k",
	authDomain: "words-of-the-buddha.firebaseapp.com",
	projectId: "words-of-the-buddha",
	storageBucket: "words-of-the-buddha.firebasestorage.app",
	messagingSenderId: "536796664814",
	appId: "1:536796664814:web:8efe4733236b2c9c2eb4ff",
};

export const app = initializeApp(firebaseConfig);
