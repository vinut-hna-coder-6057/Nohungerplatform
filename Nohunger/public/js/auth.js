/* ================= AUTH ================= */

window.loginUser = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    alert("Invalid email");
    return;
  }

  if (pass.length < 8) {
    alert("Password must be at least 8 characters");
    return;
  }

  /* ================= ADMIN LOGIN ================= */
  try {
    const res = await fetch(`${API}/api/admin/login`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ email: email, password: pass })
    });

    const data = await res.json();

    if (data.success) {
      sessionStorage.setItem("isAdmin", "true");
      if (data.token) sessionStorage.setItem("adminToken", data.token);
      alert("🛡 Admin login successful");
      showPage("adminPage");
      loadAdmin();
      return;
    }
  } catch (err) {
    console.error("Admin check failed");
  }

  /* ================= NORMAL USER LOGIN ================= */
  try {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ email: email, password: pass })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Login failed");
      return;
    }

    sessionStorage.setItem("userEmail", email.toLowerCase().trim());
    if (data.token) {
      sessionStorage.setItem("token", data.token);
      socket.auth = getSocketAuth();
    }
    alert("✅ Login successful!");
    showPage("locationPage");

  } catch (err) {
    alert("Server error");
  }
};

window.registerUser = async function () {
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  if (!name || !email || !password) {
    alert("Fill all fields");
    return;
  }

  try {
    const res = await fetch(`${API}/api/register`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Registration failed!");
      return;
    }

    alert("✅ Registration successful!");
    showPage("loginPage");

  } catch (e) {
    console.error("Register error:", e);
    alert("Server error");
  }
};

/* ================= LOGOUT ================= */
function initLogout() {
  setClick("logoutBtn2", async () => {
    try {
      await fetch(`${API}/api/logout`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({})
      });
    } catch (err) {
      console.error("Logout cleanup failed");
    }

    const email = sessionStorage.getItem("userEmail");

    localStorage.setItem("logout", JSON.stringify({
      email: email,
      time: Date.now()
    }));

    clearNgoGpsWatch();
    sessionStorage.clear();
    localStorage.removeItem("lockedRole");
    localStorage.removeItem("locationValue");
    location.reload();
  });
}

/* ================= LOCATION PAGE ================= */
function initLocationPage() {
  const locationInput = document.getElementById("locationInput");
  const confirmLocationBtn = document.getElementById("confirmLocationBtn");

  if (locationInput) {
    locationInput.addEventListener("input", () => {
      const mapFrame = document.getElementById("mapFrame");
      if (!locationInput.value || !mapFrame) return;
      mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(locationInput.value)}&output=embed`;
    });
  }

  if (confirmLocationBtn) {
    confirmLocationBtn.onclick = () => {
      if (!locationInput.value.trim()) return alert("Enter location");
      locationValue = locationInput.value.trim().toLowerCase();
      window.locationValue = locationValue;
      localStorage.setItem("locationValue", locationValue);
      showPage("dashboardPage");
    };
  }
}

/* ================= ROLE SELECTION ================= */
function initRoleSelection() {
  document.querySelectorAll(".dash-card").forEach(card => {
    card.onclick = async () => {
      if (!locationValue) {
        alert("Select location first");
        return;
      }

      const selected = card.dataset.role;
      role = selected;

      localStorage.setItem("lockedRole", JSON.stringify({
        role: role,
        email: sessionStorage.getItem("userEmail"),
        time: Date.now()
      }));
      sessionStorage.setItem("lockedRole", role);

      try {
        const regRes = await fetch(`${API}/api/registerRole`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ role: role, location: locationValue })
        });
        const regData = await regRes.json();
        if (regData.token) {
          sessionStorage.setItem("token", regData.token);
          socket.auth = getSocketAuth();
        }
      } catch (e) {
        console.error(e);
      }

      socket.emit("registerLocation", {
        role,
        location: locationValue,
        email: sessionStorage.getItem("userEmail")
      });

      showPage("mainDashboard");

      const t = document.getElementById("dashRoleTitle");
      if (t) t.textContent = role.toUpperCase() + " Dashboard";
    };
  });
}