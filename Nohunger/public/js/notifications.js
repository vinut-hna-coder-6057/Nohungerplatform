/* ================= NOTIFICATIONS ================= */

function renderNotificationList(list, notifyContent) {
  const currentEmail = sessionStorage.getItem("userEmail");
  notifyContent.innerHTML = "";

  list
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach(n => {
      if (n.senderEmail === currentEmail) return;

      notifyContent.innerHTML += `
        <div class="request-box">
          <p><b>👤 ${escapeHtml(n.senderEmail || "Unknown User")}</b></p>
          <p>🍛 ${escapeHtml(n.foodItem || "-")}</p>
          <p>📦 ${escapeHtml(n.quantity || "-")}</p>
          <p>🥗 ${escapeHtml(n.foodType || "-")}</p>

          ${role === "receiver" &&
            n.role === "receiver" &&
            n.status === "created" &&
            n.requestState === "receiver_deciding"
            ? `
            <button class="accept-btn"
              onclick="updateRequest('${escapeHtml(n.requestId)}','receiver_accepted')">
              Accept
            </button>
            <button class="reject-btn"
              onclick="updateRequest('${escapeHtml(n.requestId)}','receiver_declined')">
              Reject
            </button>
            `
            : ""}

          ${role === "donor" && n.requestState === "self_collect_started"
            ? `
            <button class="accept-btn"
              onclick="updateRequest('${escapeHtml(n.requestId)}','reached')">
              Reached
            </button>
            `
            : ""}

          ${role === "receiver" &&
            n.role === "receiver" &&
            n.requestState === "ready_to_receive"
            ? `
            <button class="accept-btn"
              onclick="updateRequest('${escapeHtml(n.requestId)}','received')">
              Received
            </button>
            `
            : ""}

          ${role === "receiver" && n.requestState === "choose_delivery"
            ? `
            <button class="accept-btn"
              onclick="updateRequest('${escapeHtml(n.requestId)}','self_collect')">
              By Myself
            </button>
            <button class="reject-btn"
              onclick="updateRequest('${escapeHtml(n.requestId)}','ask_ngo')">
              By NGO
            </button>
            `
            : ""}

          ${role === "ngo" && n.requestState === "waiting_for_ngo"
            ? `
            <button class="accept-btn"
              onclick="updateRequest('${escapeHtml(n.requestId)}','ngo_accepted')">
              Accept
            </button>
            `
            : ""}

          ${role === "receiver" &&
            ["delivery_started", "picked_up", "on_the_way", "completed"].includes(n.requestState)
            ? `
            <div class="tracking-box">
              <div class="track-step ${["delivery_started","picked_up","on_the_way","completed"].includes(n.requestState) ? "active" : ""}">
                ✔ NGO Accepted
              </div>
              <div class="track-step ${["picked_up","on_the_way","completed"].includes(n.requestState) ? "active" : ""}">
                📦 Picked Up
              </div>
              <div class="track-step ${["on_the_way","completed"].includes(n.requestState) ? "active" : ""}">
                🚚 On The Way
              </div>
              <div class="track-step ${n.requestState === "completed" ? "active" : ""}">
                ✅ Delivered
              </div>
              ${n.requestState !== "completed"
                ? `<button onclick="openTracking('${escapeHtml(n.requestId)}')"
                          style="margin-top:10px;background:#008080;color:white;border:none;padding:8px 12px;border-radius:8px;">
                    📍 Track Order
                  </button>`
                : ""}
            </div>
            `
            : ""}

          ${role === "ngo" &&
            ["delivery_started", "picked_up", "on_the_way"].includes(n.requestState)
            ? `
            ${n.requestState === "delivery_started" ? `
              <button onclick="updateRequest('${escapeHtml(n.requestId)}','picked_up')">
                Picked Up
              </button>
            ` : ""}
            ${n.requestState === "picked_up" ? `
              <button onclick="updateRequest('${escapeHtml(n.requestId)}','on_the_way')">
                On The Way
              </button>
            ` : ""}
            ${n.requestState === "on_the_way" ? `
              <button class="accept-btn"
                onclick="updateRequest('${escapeHtml(n.requestId)}','ngo_delivered')">
                Delivered
              </button>
            ` : ""}
            `
            : ""}
        </div>
      `;
    });
}

async function refreshNotificationContent(notifyContent) {
  try {
    const res = await fetch(`${API}/api/notifications/${role}/${locationValue}`, {
      headers: getAuthHeaders({ json: false })
    });
    const list = await res.json();
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    notifyContent.innerHTML = "";
    const currentEmail = sessionStorage.getItem("userEmail");

    list.forEach(n => {
      if (n.senderEmail === currentEmail) return;

      if (
        role === "receiver" &&
        n.fromRole === "donor" &&
        n.status !== "created"
      ) return;

      notifyContent.innerHTML += `
        <div style="padding:15px;margin-bottom:15px;background:#fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <h4 style="margin:0 0 6px 0;">${escapeHtml(n.message)}</h4>
          <p><b>👤 ${escapeHtml(n.donorName || (n.senderEmail || "").split("@")[0] || "User")}</b></p>
          <p><b>🍛 Item:</b> ${escapeHtml(n.foodItem || "Not Provided")}</p>
          <p><b>📦 Quantity:</b> ${escapeHtml(n.quantity || "Not Provided")}</p>
          <p><b>📍 Location:</b> ${escapeHtml(n.location)}</p>
          <p><b>Status:</b> ${escapeHtml(n.status)}</p>
          ${role === "receiver" &&
            n.role === "receiver" &&
            n.fromRole === "donor" &&
            n.requestState === "receiver_deciding" &&
            n.status === "created"
            ? `
            <div style="margin-top:10px;">
              <button onclick="updateRequest('${escapeHtml(n.requestId)}','receiver_accepted')">
                ✅ Accept
              </button>
              <button onclick="updateRequest('${escapeHtml(n.requestId)}','receiver_declined')"
                      style="background:#e53935;color:white;">
                ❌ Reject
              </button>
            </div>
            `
            : ""}
        </div>
      `;
    });
  } catch (err) {
    console.error("Refresh failed");
  }
}

window.updateRequest = async function (requestId, status) {
  try {
    const res = await fetch(`${API}/api/update-status`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ requestId, status })
    });

    const data = await res.json();

    if (data.success) {
    
      if (status === "received") {
        openMealPopup();
      }

      // Save receiver location when asking NGO
      if (status === "ask_ngo") {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          await fetch(`${API}/api/save-receiver-location`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              requestId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            })
          });
      
        });
      }

      /* ====== NGO START LIVE TRACKING ====== */
      if (status === "ngo_accepted") {
        socket.emit("joinRequestRoom", requestId);
        clearNgoGpsWatch();
        window.ngoGpsWatchId = navigator.geolocation.watchPosition((pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          socket.emit("ngoLocationUpdate", { requestId, lat, lng });
        }, (err) => {
          console.error("GPS ERROR:", err);
        }, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        });
      }

      if (status === "ngo_delivered" || status === "received") {
        clearNgoGpsWatch();
      }

      const notifyPopup = document.getElementById("notifyPopup");
      if (notifyPopup) notifyPopup.style.display = "none";

      setTimeout(() => {
        document.getElementById("bellBtn").click();
      }, 200);

    } else {
      alert("Update failed");
    }

  } catch (err) {
    console.error(err);
    alert("Server error");
  }
};

function initBellNotifications() {
  setClick("bellBtn", async () => {
    notificationCount = 0;

    const badge = document.getElementById("notifBadge");
    if (badge) {
      badge.style.display = "none";
      badge.textContent = "0";
    }

    const notifyPopup = document.getElementById("notifyPopup");
    const notifyContent = document.getElementById("notifyContent");

    if (!notifyPopup || !notifyContent) return;

    notifyPopup.style.display =
      notifyPopup.style.display === "block" ? "none" : "block";

    notifyContent.innerHTML = "Loading...";

    try {
      const res = await fetch(`${API}/api/notifications/${role}/${locationValue}`, {
        headers: getAuthHeaders({ json: false })
      });
      const data = await res.json();

      if (!data.length) {
        notifyContent.innerHTML = "No notifications";
        return;
      }

      renderNotificationList(data, notifyContent);

    } catch {
      notifyContent.innerHTML = "Error";
    }
  });
}