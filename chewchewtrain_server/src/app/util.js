'use client';

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const BASE_API_URL = ``;

// Fetches JSON from the API
export async function fetchAPI(endpoint, method = 'GET', body = undefined) {
  if (typeof window === 'undefined')
    return undefined;

  try {
    const response = await fetch(`${BASE_API_URL}${endpoint}`, { 
      method, body,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return await response.json();
  } catch (err) {
    console.log(err);
    return undefined;
  }
}

export async function fetchFormDataAPI(endpoint, method = 'GET', body = undefined) {
  if (typeof window === 'undefined')
    return undefined;

  try {
    const response = await fetch(`${BASE_API_URL}${endpoint}`, { 
      method, body
    });
    return await response.json();
  } catch (err) {
    console.log(err);
    return undefined;
  }
}

// https://stackoverflow.com/questions/10730362/get-cookie-by-name
export function getCookie(name) {
  var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) {
    return match[2];
  }
}

export function connectToFirebase() {
  const firebaseConfig = {
    // This is a client-facing API key: this is fine
    apiKey: "AIzaSyBhpnYtybwq7RKdAg7f7LlgnJAI4ZzimRU",
    authDomain: "chew-chew-train.firebaseapp.com",
    projectId: "chew-chew-train",
    storageBucket: "chew-chew-train.appspot.com",
    messagingSenderId: "574571961701",
    appId: "1:574571961701:web:adbed99de348cd6a1e158c"
  };
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  auth.setPersistence('NONE');

  return { firebaseApp: app, firebaseAuth: auth };
}

export function unixTimestampToString(timestamp) {
  if (timestamp === 0) {
    return undefined;
  }
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString('en-US')}, ${date.toLocaleDateString('en-US')}`;
}