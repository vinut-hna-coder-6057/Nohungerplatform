const bcrypt = require("bcrypt");
const User = require("../models/User");
const sendMail = require("../utils/mail");
const { signUserToken, signAdminToken } = require("../utils/jwt");
exports.register = async (req, res) => {
  try {
    

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailRegex.test(email)) {
  return res.status(400).json({
    success: false,
    message: "Invalid email format"
  });
}
      return res.status(400).json({
        success: false,
        message: "All fields required"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists"
      });
    }


const hashedPassword = await bcrypt.hash(password, 10);

const newUser = new User({
  name,
  email: normalizedEmail,
  password: hashedPassword
});
await newUser.save();
    

    try {
      const subject = "Welcome to No Hunger 🤝";
      const html = `
        <h2>Hi ${name} 👋</h2>
        <p>You are successfully registered in <b>No Hunger</b>.</p>
        <p>Next: Login and choose your role + location.</p>
      `;
      await sendMail(normalizedEmail, subject, html);
    } catch (mailErr) {
     
    }

    res.json({ success: true });

  } catch (err) {
  console.error("Register error FULL:", err);

  return res.status(500).json({
    success: false,
    message: "Server error"
  });
}
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

   if (!email || !password) {
  return res.status(400).json({
    success: false,
    message: "Missing fields"
  });
}

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.password) {
  return res.status(404).json({
    success: false,
    message: "User not found"
  });
}

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
  return res.status(401).json({
    success: false,
    message: "Incorrect password"
  });
}

    const token = signUserToken(normalizedEmail, {
      role: user.role,
      location: user.location
    });

    res.json({ success: true, token, email: normalizedEmail });

  } catch (err) {
  console.error("Login error:", err);

  return res.status(500).json({
    success: false,
    message: "Server error"
  });
}
};

exports.logout = (req, res) => {
  const activeUsers = require("../utils/activeUsers");
  const email = req.user?.email || req.body.email;

  if (email) {
    activeUsers.delete(email);
  }

  res.json({ success: true });
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
  return res.status(400).json({
    success: false,
    message: "Missing credentials"
  });
}
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminEmail || !adminPasswordHash) {
  return res.status(500).json({
    success: false,
    message: "Admin login unavailable"
  });
}
    if (email.toLowerCase().trim() !== adminEmail) {
  return res.status(401).json({
    success: false,
    message: "Invalid credentials"
  });
}

    const isMatch = await bcrypt.compare(password, adminPasswordHash);

    if (!isMatch) {
  return res.status(401).json({
    success: false,
    message: "Invalid credentials"
  });
}
    const token = signAdminToken(adminEmail);

    return res.json({ success: true, token, isAdmin: true });

  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({
  success: false,
  message: "Server error"
});
  }
};
