/* ================= APP ENTRY POINT ================= */

// Keep the static application usable when the optional Socket.IO server is unavailable.
var socket = typeof io === "function"
  ? io({ auth: getSocketAuth() })
  : {
      auth: {},
      connected: false,
      on() {},
      emit() {},
      connect() {},
      disconnect() {}
    };

document.addEventListener("DOMContentLoaded", () => {

  /* ================= INIT CORE ================= */
  initParticles();
  initCounters();
  initStorageSync();

  /* ================= INIT SOCKET EVENTS ================= */
  initSocketEvents();

  /* ================= INIT AUTH ================= */
  initLogout();
  initLocationPage();
  initRoleSelection();

  /* ================= INIT PROFILE ================= */
  initProfileBtn();
  initActivityPage();

  /* ================= INIT NOTIFICATIONS ================= */
  initBellNotifications();

  /* ================= INIT DONATIONS / CHATBOT ================= */
  initImageUpload();
  initFoodTypeButtons();
  initChatbotCard();
  initChatSend();
  initLeaderboard();

  /* ================= THEME ================= */
  setTheme(localStorage.getItem("theme") || "light");

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.onclick = () => {
      const isDark = document.body.classList.contains("dark");
      setTheme(isDark ? "light" : "dark");
    };
  }

  // Restore locationValue from localStorage on load
  const savedLocation = localStorage.getItem("locationValue");
  if (savedLocation) {
    locationValue = savedLocation;
    window.locationValue = locationValue;
  }

  // Restore role from localStorage on load
  const savedRoleRaw = localStorage.getItem("lockedRole");
  const savedRole = parseLockedRole(savedRoleRaw);
  if (savedRole) {
    role = savedRole;
  }

});