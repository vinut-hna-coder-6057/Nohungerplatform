/* ================= SOCKET EVENTS ================= */

// socket must be defined before this file is loaded (e.g. via io() in index.html or app.js)

function initSocketEvents() {

  /* ================= CONNECT / REJOIN ================= */
  socket.on("connect", () => {
    const savedRoleRaw = localStorage.getItem("lockedRole");
    const savedRole = parseLockedRole(savedRoleRaw);
    const savedLocation = localStorage.getItem("locationValue");
    const email = sessionStorage.getItem("userEmail");

    if (savedRole && savedLocation && email) {
      socket.auth = getSocketAuth();

      role = savedRole;
      locationValue = savedLocation;

      socket.emit("registerLocation", {
        role: savedRole.toLowerCase().trim(),
        location: savedLocation.toLowerCase().trim(),
        email: email
      });
    }
  });

  /* ================= NGO LIVE LOCATION ================= */
  socket.on("ngoLiveLocation", (data) => {
    handleNgoLiveLocation(data);
  });

  /* ================= PROFILE UPDATED ================= */
  socket.on("profileUpdated", async () => {
    await handleProfileUpdated();
  });

  /* ================= NEW NOTIFICATION ================= */
  socket.on("newNotification", async (data) => {
    const badge = document.getElementById("notifBadge");

    notificationCount++;

    if (badge) {
      badge.style.display = "flex";
      badge.textContent = notificationCount;
    }

    notificationSound.play().catch(() => {});


    const notifyContent = document.getElementById("notifyContent");
    if (!notifyContent) return;

    await refreshNotificationContent(notifyContent);

    // 🔥 Also refresh leaderboard automatically if open
    if (document.getElementById("roleMessage")?.textContent === "🏆 Leaderboard") {
      document.getElementById("openLeaderboardCard").click();
    }
  });
}