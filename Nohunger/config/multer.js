const multer = require("multer");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { randomUUID } = require("crypto");
const uploadDir = path.join(__dirname, "../uploads");
const MAX_IMAGE_DIMENSION = 10000;
const MAX_IMAGE_PIXELS = 25000000;

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

const mimeTypesByExtension = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp"
};
const allowedExtensions = Object.keys(mimeTypesByExtension);

const imageFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    typeof file.mimetype === "string" &&
    mimeTypesByExtension[ext] === file.mimetype.toLowerCase()
  ) {
    return cb(null, true);
  }

  cb(new Error("Only image files are allowed"), false);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: imageFilter
});

function deleteUploadedFile(filePath) {
  if (!filePath) return;
  try {
    fs.rmSync(filePath, { force: true });
  } catch (error) {
    console.error("Cleanup failed:", error.message);
  }
}

async function hasValidImageSignature(filePath, originalExtension) {
  const bytes = await fs.promises.readFile(filePath);
  try {
    const image = sharp(bytes, {
      animated: true,
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS
    });
    const metadata = await image.metadata();
    if (!metadata || !metadata.format) {
      return false;
    }

    const height = metadata.pageHeight || metadata.height;
    const pages = metadata.pages || 1;
    if (
      !Number.isSafeInteger(metadata.width) ||
      !Number.isSafeInteger(height) ||
      !Number.isSafeInteger(pages) ||
      metadata.width > MAX_IMAGE_DIMENSION ||
      height > MAX_IMAGE_DIMENSION ||
      metadata.width * height * pages > MAX_IMAGE_PIXELS
    ) {
      return false;
    }

    const normalizedFormat = metadata.format.toLowerCase();
    const formatMatchesExtension = {
      ".jpg": ["jpg", "jpeg"],
      ".jpeg": ["jpg", "jpeg"],
      ".png": ["png"],
      ".gif": ["gif"],
      ".webp": ["webp"]
    };

    if (!formatMatchesExtension[originalExtension]?.includes(normalizedFormat)) {
      return false;
    }

    await image.raw().toBuffer();
    if (normalizedFormat === "jpeg") {
      return bytes.length >= 4 &&
        bytes.subarray(bytes.length - 2).equals(Buffer.from([0xff, 0xd9]));
    }
    if (normalizedFormat === "png") {
      return bytes.length >= 12 &&
        bytes.subarray(bytes.length - 12).equals(
          Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])
        );
    }
    if (normalizedFormat === "gif") {
      return bytes.length >= 7 && bytes[bytes.length - 1] === 0x3b;
    }
    if (normalizedFormat === "webp") {
      return bytes.length >= 12 &&
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP" &&
        bytes.readUInt32LE(4) + 8 === bytes.length;
    }
    return false;
  } catch {
    return false;
  }
}

async function validateUploadedImage(req, res, next) {
  if (!req.file) return next();

  const extension = path.extname(req.file.originalname || req.file.filename).toLowerCase();

  try {
    if (!allowedExtensions.includes(extension) || !(await hasValidImageSignature(req.file.path, extension))) {
      deleteUploadedFile(req.file.path);
      return res.status(400).json({ success: false, message: "Invalid image contents" });
    }

    return next();
  } catch (error) {
    deleteUploadedFile(req.file.path);
    console.error("Image validation error:", error.message);
    return res.status(400).json({ success: false, message: "Invalid image upload" });
  }
}

module.exports = upload;
module.exports.validateUploadedImage = validateUploadedImage;
module.exports.deleteUploadedFile = deleteUploadedFile;
module.exports.uploadDir = uploadDir;
