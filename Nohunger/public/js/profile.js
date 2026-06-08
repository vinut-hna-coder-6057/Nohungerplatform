
function renderProfileHTML(data) {
  return `
    <p><b>Name:</b> ${escapeHtml(data.name || "-")}</p>
    <p><b>Role:</b> ${escapeHtml(data.role || "").toUpperCase()}</p>
    <p><b>Location:</b> ${escapeHtml(data.location || "-")}</p>
    <hr>
    <p>🍱 Donations: ${data.donations || 0}</p>
    <p>🤝 Received: ${data.received || 0}</p>
    <p>🏢 NGO Services: ${data.services || 0}</p>
  `;
}
 
async function fetchAndRenderProfile(email, container) {
  const res = await fetch(`${API}/api/profile/${email}`, {
    headers: getAuthHeaders({ json: false })
  });
  const data = await res.json();
  if (!data.success) return false;
  container.innerHTML = renderProfileHTML(data);
  return true;
}
 
function initProfileBtn() {
  setClick("profileBtn", async () => {
    const popup = document.getElementById("profilePopup");
    const content = document.getElementById("profileContent");
 
    popup.style.display =
      popup.style.display === "block" ? "none" : "block";
 
    if (popup.style.display === "none") {
      if (window.profileInterval) {
  clearInterval(window.profileInterval);
  window.profileInterval = null;
}
      return;
    }
 
    content.innerHTML = "Loading...";
 
    try {
      const email = sessionStorage.getItem("userEmail");
 
      const res = await fetch(`${API}/api/profile/${email}`, {
        headers: getAuthHeaders({ json: false })
      });
      const data = await res.json();
 
      if (!data.success) {
        content.innerHTML = "Profile not found";
        return;
      }
 
      content.innerHTML = renderProfileHTML(data);
 if (window.profileInterval) {
  clearInterval(window.profileInterval);
  window.profileInterval = null;
}
 
      window.profileInterval = setInterval(async () => {
        try {
          const email = sessionStorage.getItem("userEmail");
          if (!email) return;
 
          const profileBox = document.getElementById("profileContent");
          if (!profileBox) return;
 
          await fetchAndRenderProfile(email, profileBox);
        } catch (err) {
          console.error("Live update failed:", err);
        }
      }, 3000);
 
    } catch (err) {
      console.error(err);
      content.innerHTML = "Error loading profile";
    }
  });
}
 
/* ================= REALTIME PROFILE UPDATE (socket event) ================= */
async function handleProfileUpdated() {
  try {
    const email = sessionStorage.getItem("userEmail");
    if (!email) return;
 
    const res = await fetch(`${API}/api/profile/${email}`, {
      headers: getAuthHeaders({ json: false })
    });
    const data = await res.json();
    if (!data.success) return;
 
    const profileBox = document.getElementById("profileContent");
    if (!profileBox || profileBox.innerHTML === "") return;
 
    profileBox.innerHTML = renderProfileHTML(data);
 
  } catch (err) {
    console.error("Realtime profile update failed:", err);
  }
}
 
/* ================= ACTIVITY PAGE ================= */
function initActivityPage() {
  setClick("myActivityBtn", async () => {
    showPage("activityPage");
 
    const out = document.getElementById("activityOutput");
    out.innerHTML = "Loading...";
 
    try {
      const email = sessionStorage.getItem("userEmail");
 
      const res = await fetch(`${API}/api/my-activity/${email}`, {
        headers: getAuthHeaders({ json: false })
      });
      const data = await res.json();
 
      out.innerHTML = "";
 
      if (!data.length) {
        out.innerHTML = "No activity yet";
        return;
      }
 
      data.forEach(d => {
        out.innerHTML += `
          <div style="padding:10px;border-bottom:1px solid #ddd">
            <b>${escapeHtml(d.message)}</b><br>
            📍 ${escapeHtml(d.location)}<br>
            🕒 ${new Date(d.createdAt).toLocaleString()}<br>
            📌 Status: ${escapeHtml(d.status)}
          </div>
        `;
      });
 
    } catch {
      out.innerHTML = "Error loading";
    }
  });
}