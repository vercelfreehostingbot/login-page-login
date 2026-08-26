const form = document.getElementById("loginForm");
const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const message = document.getElementById("message");
const forgotPassword = document.getElementById("forgotPassword");

togglePassword.addEventListener("click", () => {
  const isPassword = password.type === "password";
  password.type = isPassword ? "text" : "password";
  togglePassword.textContent = isPassword ? "Hide" : "Show";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const pass = password.value;

  if (!email || !pass) {
    message.textContent = "সব তথ্য পূরণ করুন।";
    message.style.color = "#fca5a5";
    return;
  }

  // Demo login only. Replace this section with your real backend/API.
  message.textContent = "Login successful! (Demo)";
  message.style.color = "#a7f3d0";
});

forgotPassword.addEventListener("click", (event) => {
  event.preventDefault();
  message.textContent = "পাসওয়ার্ড রিসেট ফিচারটি আপনার backend-এর সাথে যুক্ত করুন।";
  message.style.color = "#fde68a";
});
