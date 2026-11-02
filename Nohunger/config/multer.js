const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const uploadDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    cb(null, randomUUID() + ext);
  }
});
const imageFilter = (req, file, cb) => {
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp"
  ];

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedExtensions.includes(ext) &&
    allowedMimeTypes.includes(file.mimetype)
  ) {
    return cb(null, true);
  }

  cb(new Error("Only image files are allowed"), false);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  },
  fileFilter: imageFilter
});

function hasValidImageSignature(filePath, extension) {
  const bytes = fs.readFileSync(filePath);
  if (extension === ".png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  }
  if (extension === ".gif") {
    return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
  }
  if (extension === ".webp") {
    return bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function validateUploadedImage(req, res, next) {
  if (!req.file) return next();
  const extension = path.extname(req.file.filename).toLowerCase();
  try {
    if (!hasValidImageSignature(req.file.path, extension)) {
      fs.rmSync(req.file.path, { force: true });
      return res.status(400).json({ success: false, message: "Invalid image contents" });
    }
    next();
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    console.error("Image validation error:", error.message);
    return res.status(400).json({ success: false, message: "Invalid image upload" });
  }
}

module.exports = upload;
module.exports.validateUploadedImage = validateUploadedImage;
