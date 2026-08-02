// js/login.js
import { auth } from './firebase-config.js';

import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// DOM Elements
const form = document.getElementById('login-form');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const toggleBtn = document.getElementById('toggle-password');
const loginBtn = document.getElementById('login-btn');
const loginText = loginBtn.querySelector('.login-btn__text');
const spinner = document.getElementById('login-spinner');
const errorMsg = document.getElementById('login-error');
const successMsg = document.getElementById('login-success');

// Check if user is already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "admin.html";
  }
});

// Toggle password visibility
toggleBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  toggleBtn.setAttribute('aria-pressed', isPassword);
  const icon = toggleBtn.querySelector('i');
  icon.classList.toggle('fa-eye');
  icon.classList.toggle('fa-eye-slash');
});

// Show/hide messages
function setError(message) {
  if (message) {
    errorMsg.textContent = message;
    errorMsg.hidden = false;
  } else {
    errorMsg.hidden = true;
  }
  successMsg.hidden = true;
}

function setSuccess(message) {
  if (message) {
    successMsg.textContent = message;
    successMsg.hidden = false;
  } else {
    successMsg.hidden = true;
  }
  errorMsg.hidden = true;
}

// Set loading state
function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginText.hidden = isLoading;
  spinner.hidden = !isLoading;
}

// Login handler
async function handleLogin(e) {
  e.preventDefault();
  
  // Clear previous messages
  setError(null);
  setSuccess(null);
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  // Basic validation
  if (!email || !password) {
    setError('Please enter both email and password.');
    return;
  }
  
  setLoading(true);
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Success – message will be shown, but redirect will happen shortly
    setSuccess('Login successful! Redirecting...');
    // The onAuthStateChanged will trigger redirect
  } catch (error) {
    let message = 'Login failed. Please try again.';
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'No account found with this email.';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password.';
        break;
        case 'auth/invalid-credential':
    message = 'Invalid email or password.';
    break; 
      case 'auth/invalid-email':
        message = 'Invalid email address.';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later.';
        break;
      default:
        message = error.message || message;
    }
    setError(message);
  } finally {
    setLoading(false);
  }
}

// Submit on Enter key (handled by form submit)
form.addEventListener('submit', handleLogin);