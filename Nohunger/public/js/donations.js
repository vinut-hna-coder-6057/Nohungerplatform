var uploadedImageBase64 = "";
 
/* ================= MEAL POPUP ================= */
window.openMealPopup = function () {
  document.getElementById("mealPopup").style.display = "flex";
};
 
window.closeMealPopup = function () {
  document.getElementById("mealPopup").style.display = "none";
 
  const notifyPopup = document.getElementById("notifyPopup");
  if (notifyPopup) notifyPopup.style.display = "none";
 
  document.getElementById("bellBtn").click();
};
 
/* ================= DONATION CONFIRM POPUP ================= */
function openDonationPopup() {
  const box = document.getElementById("donorConfirmPopup");
  const details = document.getElementById("donorConfirmDetails");
 
  details.innerHTML = `
    <b>Role:</b> Donor<br>
    <b>Location:</b> ${locationValue}<br>
    <b>Food:</b> ${formData.q1}<br>
    <b>Quantity:</b> ${formData.q2}<br>
    <b>Type:</b> ${selectedFoodType || "-"}
  `;
 
  box.style.display = "flex";
}
 
// Also keep the old name in case it's called from elsewhere
function openDonationConfirmBox() {
  const box = document.getElementById("donorConfirmPopup");
  const details = document.getElementById("donorConfirmDetails");
 
  details.innerHTML = `
    <b>Role:</b> ${role}<br>
    <b>Location:</b> ${locationValue}<br>
    <b>Food:</b> ${formData.q1}<br>
    <b>Quantity:</b> ${formData.q2}<br>
    <b>Type:</b> ${selectedFoodType || "Not selected"}
  `;
 
  box.style.display = "flex";
}
 
window.closeDonationPopup = function () {
  document.getElementById("donorConfirmPopup").style.display = "none";
};
 
window.confirmDonationSend = function () {
  document.getElementById("donorConfirmPopup").style.display = "none";
  createRequest();
};
 
/* ================= CREATE REQUEST ================= */
function createRequest() {
  if (role === "donor" && !selectedFoodType) {
    alert("Please select Veg or Non-Veg");
    return;
  }
 
  append("⏳ Sending request...");
 fetch(`${API}/api/notify`, {
  method: "POST",
  headers: getAuthHeaders(),
  body: JSON.stringify({
    fromRole: role,
    location: locationValue,
    details: formData,
    image: uploadedImageBase64,
    foodType: selectedFoodType,
  })
})
.then(async (res) => {
  const data = await res.json();

  if (!data.success) {
    append(`❌ ${data.message || "Failed to send request"}`);
    return;
  }

  append("✅ Request sent successfully!");

  uploadedImageBase64 = "";
  document.getElementById("imagePreview").innerHTML = "";
})
.catch((err) => {
  console.error(err);
  append("❌ Failed to send request");
});
}
/* ================= IMAGE UPLOAD ================= */
function initImageUpload() {
  const uploadBtn = document.getElementById("uploadBtn");
  const foodImageInput = document.getElementById("foodImageInput");
  const imagePreview = document.getElementById("imagePreview");
 
  if (uploadBtn) {
    uploadBtn.onclick = () => {
      if (role !== "donor") {
        alert("Only donors can upload food package images.");
        return;
      }
      foodImageInput.click();
    };
  }
 
  if (foodImageInput) {
    foodImageInput.onchange = function () {
      const file = this.files[0];
      if (!file) return;
 
      const reader = new FileReader();
      reader.onload = function (e) {
        uploadedImageBase64 = e.target.result;
        imagePreview.innerHTML = `
          <p style="font-size:13px;color:#eee;">📦 Food Package Preview:</p>
          <img src="${uploadedImageBase64}">
        `;
      };
      reader.readAsDataURL(file);
    };
  }
}
 
/* ================= VEG / NON-VEG BUTTONS ================= */
function initFoodTypeButtons() {
  const vegBtn = document.getElementById("vegBtn");
  const nonVegBtn = document.getElementById("nonVegBtn");
 
  if (vegBtn && nonVegBtn) {
    vegBtn.onclick = () => {
      selectedFoodType = "veg";
      vegBtn.classList.add("active");
      nonVegBtn.classList.remove("active");
    };
 
    nonVegBtn.onclick = () => {
      selectedFoodType = "nonveg";
      nonVegBtn.classList.add("active");
      vegBtn.classList.remove("active");
    };
  }
}
 
/* ================= CHATBOT CARD ================= */
function initChatbotCard() {
  setClick("openChatbotCard", () => {
    step = 1;
    formData = {};
    selectedFoodType = "";
    uploadedImageBase64 = "";
 
    const chatOutput = document.getElementById("chatOutput");
    const chatControls = document.getElementById("chatControls");
    const roleMessage = document.getElementById("roleMessage");
    const foodTypeContainer = document.getElementById("foodTypeContainer");
    const imagePreview = document.getElementById("imagePreview");
    const uploadBtn = document.getElementById("uploadBtn");
 
    if (chatOutput) chatOutput.innerHTML = "";
    if (chatControls) chatControls.style.display = "flex";
    if (roleMessage) roleMessage.textContent = "Logged in as: " + role.toUpperCase();
    if (imagePreview) imagePreview.innerHTML = "";
 
    const vegBtn = document.getElementById("vegBtn");
    const nonVegBtn = document.getElementById("nonVegBtn");
    if (vegBtn) vegBtn.classList.remove("active");
    if (nonVegBtn) nonVegBtn.classList.remove("active");
 
    showPage("chatbotPage");
 
    if (role === "donor") {
      if (foodTypeContainer) foodTypeContainer.style.display = "block";
      if (uploadBtn) uploadBtn.style.display = "block";
      append("Bot: Please select Veg or Non-Veg.");
      append("Bot: What food are you donating?");
    } else if (role === "ngo") {
      if (foodTypeContainer) foodTypeContainer.style.display = "none";
      if (uploadBtn) uploadBtn.style.display = "none";
      append("Bot: What service NGO provides?");
    } else {
      if (foodTypeContainer) foodTypeContainer.style.display = "none";
      if (uploadBtn) uploadBtn.style.display = "none";
      append("Bot: How many people need food?");
    }
  });
}
 
/* ================= CHAT SEND ================= */
function initChatSend() {
  const sendBtn = document.getElementById("sendBtn");
  const chatInput = document.getElementById("chatInput");
 
  if (sendBtn) {
    sendBtn.onclick = () => {
      if (!chatInput) return;
 
      const msg = chatInput.value.trim();
      if (!msg) return;
 
      append("You: " + msg);
      chatInput.value = "";
      step++;
 
      if (step === 2) {
        formData.q1 = msg;
        if (role === "donor") {
          append("Bot: How much quantity?");
        } else if (role === "ngo") {
          append("Bot: Which area?");
        } else {
          append("Bot: Is it urgent?");
        }
        return;
      }
 
      if (step === 3) {
        formData.q2 = msg;
        formData.name = sessionStorage.getItem("userEmail");
 
        if (role === "donor") {
          openDonationPopup();
          return;
        }
 
        createRequest();
        return;
      }
    };
  }
}
 
/* ================= LEADERBOARD ================= */
function initLeaderboard() {
  setClick("openLeaderboardCard", async () => {
    showPage("chatbotPage");
 
    const chatControls = document.getElementById("chatControls");
    const roleMessage = document.getElementById("roleMessage");
    const chatOutput = document.getElementById("chatOutput");
 
    if (chatControls) chatControls.style.display = "none";
    if (roleMessage) roleMessage.textContent = "🏆 Leaderboard";
    if (chatOutput) chatOutput.innerHTML = "Loading...";
 
    try {
      const res = await fetch(`${API}/api/leaderboard`);
      const data = await res.json();
 
      if (chatOutput) chatOutput.innerHTML = "";
 
      if (!data.length) {
        append("No donations yet");
      } else {
        data.forEach(i =>
          append(`🏆 ${i.name} (${i.location.toUpperCase()}) — ${i.donations} donations`)
        );
      }
 
    } catch {
      if (document.getElementById("chatOutput"))
        document.getElementById("chatOutput").innerHTML = "Error loading";
    }
  });
}
 