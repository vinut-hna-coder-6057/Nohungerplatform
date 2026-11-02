/* ================= SHARED STATE ================= */
//var API = window.API || "";
var role = "";
var locationValue = "";
var step = 1;
var formData = {};
var selectedFoodType = "";
var notificationCount = 0;
var notificationSound = new Audio("https://www.soundjay.com/buttons/sounds/button-09.mp3");

/* ================= HELPERS ================= */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setClick(id, fn) {
  const el = document.getElementById(id);
  if (el) el.onclick = fn;
}
function showToast(message, type = "info") {
  let region = document.getElementById("toastRegion");
  if (!region) {
    region = document.createElement("div");
    region.id = "toastRegion";
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}
function showPage(pageId){

  document.querySelectorAll(
    ".page-box, .dashboard-page, .main-dash"
  ).forEach(p => {
    p.classList.remove("active");
  });
  document.querySelectorAll(".notify-popup").forEach(popup => {
    popup.style.display = "none";
  });

  const hero = document.querySelector(".hero-container");
  const landing = document.querySelector(".landing-content");
  if (hero) hero.classList.add("hidden");
  if (landing) landing.classList.add("hidden");

  const impactOne = document.getElementById("b1");
  const impactTwo = document.getElementById("b2");
  if (impactOne) impactOne.style.display = "none";
  if (impactTwo) impactTwo.style.display = "none";

  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");
  if (pageId === "mainDashboard") {
    const sidebarLocation = document.getElementById("sidebarLocation");
    const greeting = document.getElementById("dashboardGreeting");
    if (sidebarLocation) sidebarLocation.textContent = locationValue || "Your city";
    if (greeting) {
      const currentRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : "community";
      greeting.textContent = `${currentRole} workspace`;
    }
  }
}
function showHome(){

   const hero = document.querySelector(".hero-container");

   if (hero) hero.classList.remove("hidden");
   const landing = document.querySelector(".landing-content");
   if (landing) landing.classList.remove("hidden");

   document.querySelectorAll(".page-box, .dashboard-page, .main-dash")
     .forEach(p => p.classList.remove("active"));

   const impactOne = document.getElementById("b1");
   const impactTwo = document.getElementById("b2");
   if (impactOne) impactOne.style.display = "block";
   if (impactTwo) impactTwo.style.display = "block";
}
function append(msg) {
  const out = document.getElementById("chatOutput");
  if (!out) return;
  const p = document.createElement("p");
  p.textContent = msg;
  out.appendChild(p);
}

function parseLockedRole(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.role || null;
  } catch {
    return null;
  }
}

function getAuthHeaders(opts = {}) {
  const json = opts.json !== false;
  const token = sessionStorage.getItem("token") || sessionStorage.getItem("adminToken");
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = "Bearer " + token;
  return headers;
}

function getSocketAuth() {
  const token = sessionStorage.getItem("token") || sessionStorage.getItem("adminToken");
  return token ? { token } : {};
}

function clearNgoGpsWatch() {
  if (window.ngoGpsWatchId !== undefined) {
    navigator.geolocation.clearWatch(window.ngoGpsWatchId);
    window.ngoGpsWatchId = undefined;
  }
}

/* ================= THEME ================= */
function setTheme(mode) {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return;
  if (mode === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
    localStorage.setItem("theme", "dark");
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "🌙";
    localStorage.setItem("theme", "light");
  }
}

/* ================= ROTATING COUNTERS ================= */
function initCounters() {
  const data = [
    { num: "12,480+", text: "Meals Donated" },
    { num: "3,920+", text: "People Served" },
    { num: "145+", text: "NGOs Connected" },
    { num: "18+", text: "Cities Active" }
  ];

  let i = 0;
  let j = 2;

  function rotate() {
    let b1 = document.getElementById("b1");
    let b2 = document.getElementById("b2");
    if (!b1 || !b2) return;

    b1.classList.add("fade");
    b2.classList.add("fade");

    setTimeout(() => {
      b1.innerHTML = `<strong>${data[i % data.length].num}</strong> ${data[i % data.length].text}`;
      b2.innerHTML = `<strong>${data[j % data.length].num}</strong> ${data[j % data.length].text}`;
      b1.classList.remove("fade");
      b2.classList.remove("fade");
      i++;
      j++;
    }, 600);
  }

  setInterval(rotate, 3500);
}

/* ================= PARTICLES ================= */
function initParticles() {
  for (let i = 0; i < 35; i++) {
    let p = document.createElement("div");
    p.className = "particle";
    p.style.left = Math.random() * 94 + "vw";
    p.style.animationDuration = (18 + Math.random() * 20) + "s";
    document.body.appendChild(p);
  }
}

/* ================= STORAGE SYNC ================= */
function initStorageSync() {
  window.addEventListener("storage", function (event) {
    const currentEmail = sessionStorage.getItem("userEmail");

    if (event.key === "logout") {
      const logoutData = JSON.parse(event.newValue || "{}");
      if (logoutData.email === currentEmail) {
        alert("You logged out in another tab");
        clearNgoGpsWatch();
        sessionStorage.clear();
        localStorage.removeItem("lockedRole");
        localStorage.removeItem("locationValue");
        location.reload();
      }
    }

    if (event.key === "lockedRole") {
      const roleData = JSON.parse(event.newValue || "{}");
      if (roleData.email === currentEmail) {
        location.reload();
      }
    }
  });
}