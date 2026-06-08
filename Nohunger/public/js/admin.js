
async function loadAdmin() {
  const statsDiv = document.getElementById("adminStats");
  const usersDiv = document.getElementById("adminUsers");
  const donationDiv = document.getElementById("adminDonations");
 
  statsDiv.innerHTML = "Loading...";
 
  try {
    /* ================= STATS ================= */
    const s = await fetch(`${API}/api/admin/stats`, {
      headers: getAuthHeaders({ json: false })
    });
    const stats = await s.json();
 
    statsDiv.innerHTML = `
      <h3>📊 System Stats</h3>
      👥 Users: ${stats.totalUsers}<br>
      🔔 Requests: ${stats.totalNotifications}<br>
      🍱 Donations: ${stats.totalDonations}<br>
      ⏰ Expired: ${stats.expired}
    `;
 
    /* ================= USERS ================= */
    const u = await fetch(`${API}/api/admin/users`, {
      headers: getAuthHeaders({ json: false })
    });
    const users = await u.json();
 
    usersDiv.innerHTML = "";
 
    if (!users.length) {
      usersDiv.innerHTML = "No users found";
    }
 
    users.forEach(x => {
      usersDiv.innerHTML += `
        <div onclick="openUserPopup('${escapeHtml(x._id)}')"
          style="
            background:#f7f7f7;
            padding:14px;
            margin-bottom:12px;
            border-radius:12px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            cursor:pointer;
            transition:0.25s;
          "
          onmouseover="this.style.transform='scale(1.03)'"
          onmouseout="this.style.transform='scale(1)'"
        >
          <div>
            <b>${escapeHtml(x.name || "No Name")}</b><br>
            ${escapeHtml(x.email)}<br>
            Role: ${escapeHtml(x.role || "-")} | 📍 ${escapeHtml(x.location || "-")}
          </div>
          <button onclick="event.stopPropagation();deleteUser('${escapeHtml(x._id)}')"
            style="
              background:#e53935;
              color:white;
              border:none;
              padding:8px 14px;
              border-radius:8px;
              cursor:pointer;
            ">
            Delete
          </button>
        </div>
      `;
    });
 
    /* ================= DONATIONS ================= */
    const d = await fetch(`${API}/api/admin/donations`, {
      headers: getAuthHeaders({ json: false })
    });
    const dons = await d.json();
 
    donationDiv.innerHTML = "";
 
    if (!dons.length) {
      donationDiv.innerHTML = "No donations yet";
      return;
    }
 
    dons.forEach(x => {
      donationDiv.innerHTML += `
        <div style="
          background:#f7f7f7;
          padding:14px;
          margin-bottom:12px;
          border-radius:10px;
          box-shadow:0 4px 10px rgba(0,0,0,0.1);
        ">
          <b style="font-size:15px;">🍛 ${escapeHtml(x.foodDetails)}</b><br>
          📍 Location: ${x.location}<br>
          📧 Donor: ${x.donorEmail || "Unknown"}<br>
          Status:
          <span style="font-weight:bold;color:${x.status === "available" ? "green" : "red"};">
            ${x.status}
          </span>
          <br>
          🕒 ${new Date(x.createdAt).toLocaleString()}
        </div>
      `;
    });
 
  } catch (err) {
    statsDiv.innerHTML = "Error loading admin";
   
  }
}
 
window.loadAdmin = loadAdmin;
 
window.deleteUser = async function (id) {
  if (!confirm("Delete this user?")) return;
 
  try {
    const res = await fetch(`${API}/api/admin/delete-user/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders({ json: false })
    });
 
    const data = await res.json();
 
    if (data.success) {
      alert("User deleted successfully");
      loadAdmin();
    } else {
      alert("Delete failed");
    }
 
  } catch (err) {
    alert("Server error");
    
  }
};
 
window.openUserPopup = async function (id) {
  const popup = document.getElementById("userPopup");
  const card = document.getElementById("userPopupCard");
  const content = document.getElementById("userPopupContent");
 
  popup.style.display = "flex";
  setTimeout(() => {
    card.style.transform = "scale(1)";
    card.style.opacity = "1";
  }, 50);
 
  content.innerHTML = "Loading user...";
 
  try {
    const res = await fetch(`${API}/api/admin/users`, {
      headers: getAuthHeaders({ json: false })
    });
    const users = await res.json();
    const u = users.find(x => x._id === id);
 
    if (!u) {
      content.innerHTML = "User not found";
      return;
    }
 
    content.innerHTML = `
      <p><b>Name:</b> ${escapeHtml(u.name)}</p>
      <p><b>Email:</b> ${escapeHtml(u.email)}</p>
      <p><b>Role:</b> ${escapeHtml(u.role)|| "-"}</p>
      <p><b>Location:</b> ${u.location || "-"}</p>
      <hr>
      <p>🍱 Donations: ${u.donationsCount || 0}</p>
      <p>🤝 Received: ${u.receivedCount || 0}</p>
      <p>🏢 NGO Services: ${u.ngoServices || 0}</p>
      <p style="font-size:12px;color:gray">Mongo ID: ${u._id}</p>
    `;
 
  } catch {
    content.innerHTML = "Error loading user";
  }
};
 
window.closeUserPopup = function () {
  const popup = document.getElementById("userPopup");
  const card = document.getElementById("userPopupCard");
 
  card.style.transform = "scale(0.7)";
  card.style.opacity = "0";
 
  setTimeout(() => {
    popup.style.display = "none";
  }, 200);
};
 
/* ================= ANALYTICS ================= */

 
window.openAnalytics = async function () {
  const popup = document.getElementById("analyticsPopup");
  popup.style.display = "flex";
 
  try {
    const res = await fetch(`${API}/api/admin/stats`, {
      headers: getAuthHeaders({ json: false })
    });
    const stats = await res.json();
 
    const ctx = document.getElementById("mainChart").getContext("2d");
 
    if (mainChart) mainChart.destroy();
 
    mainChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Users", "Requests", "Donations", "Expired"],
        datasets: [{
          label: "System Overview",
          data: [
            stats.totalUsers,
            stats.totalNotifications,
            stats.totalDonations,
            stats.expired
          ]
        }]
      }
    });
 
    const dres = await fetch(`${API}/api/admin/donations`, {
      headers: getAuthHeaders({ json: false })
    });
    const donations = await dres.json();
 
    let available = 0, expired = 0;
    donations.forEach(d => {
      if (d.status === "available") available++;
      else expired++;
    });
 
    const ctx2 = document.getElementById("donationChart").getContext("2d");
 
    if (donationChart) donationChart.destroy();
 
    donationChart = new Chart(ctx2, {
      type: "pie",
      data: {
        labels: ["Available", "Expired"],
        datasets: [{ data: [available, expired] }]
      }
    });
 
  } catch (err) {
    alert("Chart load failed");
   
  }
};
 
window.closeAnalytics = function () {
  document.getElementById("analyticsPopup").style.display = "none";
};
 
/* ================= LOAD USERS (standalone panel) ================= */
window.loadUsers = async function () {
  const box = document.getElementById("adminUsersBox");
  if (!box) return;
 
  box.innerHTML = "Loading users...";
 
  try {
    const res = await fetch(`${API}/api/admin/users`, {
      headers: getAuthHeaders({ json: false })
    });
    const users = await res.json();
 
    box.innerHTML = "";
 
    if (!users.length) {
      box.innerHTML = "No users found";
      return;
    }
 
    users.forEach(u => {
      box.innerHTML += `
        <div style="background:#fff;padding:10px;margin-bottom:10px;border-radius:8px">
         <b>${escapeHtml(u.name || "No Name")}</b><br>
${escapeHtml(u.email || "-")}<br>
Role: ${escapeHtml(u.role || "-")}<br>
Location: ${escapeHtml(u.location || "-")}<br>
          <button onclick="deleteUser('${escapeHtml(u._id)}')"
                  style="background:red;color:white;border:none;padding:6px 10px;margin-top:5px;border-radius:6px">
            Delete User
          </button>
        </div>
      `;
    });
 
  } catch (err) {
    box.innerHTML = "Error loading users";
  }
};