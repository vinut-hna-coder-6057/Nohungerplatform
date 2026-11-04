jest.mock("../models/User", () => ({
  findOne: jest.fn()
}));
jest.mock("../models/Donation", () => {
  const Donation = jest.fn();
  Donation.prototype.save = jest.fn();
  return Donation;
});

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const request = require("supertest");
const User = require("../models/User");
const Donation = require("../models/Donation");
const { createDonation } = require("../controllers/donationController");

process.env.JWT_SECRET = "image-validation-tests-only";
const app = require("../app");
const { signUserToken } = require("../utils/jwt");
const { uploadDir } = require("../config/multer");

const userEmail = "upload-donor@example.test";
const authToken = signUserToken(userEmail, {
  role: "donor",
  location: "test city",
  tokenVersion: 0
});

let fixtureImages;
let filesBeforeTest;

function uploadedFiles() {
  return new Set(fs.readdirSync(uploadDir));
}

function addedFiles() {
  return [...uploadedFiles()].filter(file => !filesBeforeTest.has(file));
}

async function submitImage({ name, mimeType, buffer, foodDetails = "Rice" }) {
  return request(app)
    .post("/api/donate")
    .set("Authorization", `Bearer ${authToken}`)
    .field("location", "test city")
    .field("foodDetails", foodDetails)
    .field("expiryHours", "2")
    .attach("image", buffer, { filename: name, contentType: mimeType });
}

beforeAll(async () => {
  const source = sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 12, g: 34, b: 56 }
    }
  });
  const gif = Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64");
  fixtureImages = {
    jpg: await source.clone().jpeg().toBuffer(),
    png: await source.clone().png().toBuffer(),
    gif,
    webp: await source.clone().webp().toBuffer(),
    excessivePixels: await sharp({
      create: {
        width: 5001,
        height: 5000,
        channels: 3,
        background: { r: 12, g: 34, b: 56 }
      }
    }).png().toBuffer(),
    excessiveDimension: await sharp({
      create: {
        width: 10001,
        height: 1,
        channels: 3,
        background: { r: 12, g: 34, b: 56 }
      }
    }).png().toBuffer()
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  filesBeforeTest = uploadedFiles();
  User.findOne.mockImplementation(() => ({
    select: jest.fn().mockResolvedValue({
      email: userEmail,
      role: "donor",
      location: "test city",
      tokenVersion: 0,
      disabled: false
    })
  }));
  Donation.prototype.save.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const [donation] of Donation.mock.calls) {
    if (typeof donation.image !== "string") continue;
    const filePath = path.join(uploadDir, path.basename(donation.image));
    if (path.dirname(filePath) === uploadDir) {
      fs.rmSync(filePath, { force: true });
    }
  }
});

test.each([
  ["JPEG", "meal.jpg", "image/jpeg", "jpg"],
  ["JPG", "meal.jpeg", "image/jpeg", "jpg"],
  ["PNG", "meal.png", "image/png", "png"],
  ["GIF", "meal.gif", "image/gif", "gif"],
  ["WebP", "meal.webp", "image/webp", "webp"]
])("accepts and persists a structurally valid %s image", async (_format, name, mimeType, fixture) => {
  const response = await submitImage({
    name,
    mimeType,
    buffer: fixtureImages[fixture]
  });

  expect(response.status).toBe(201);
  expect(Donation.prototype.save).toHaveBeenCalledTimes(1);
  const files = addedFiles();
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(new RegExp(`\\.${fixture === "jpg" ? "jpe?g" : fixture}$`));
  expect(fs.statSync(path.join(uploadDir, files[0])).size).toBeGreaterThan(0);
}, 15000);

test.each([
  ["incorrect extension", "meal.jpg", "image/jpeg", "png"],
  ["incorrect MIME type", "meal.png", "image/jpeg", "png"],
  ["invalid signature", "meal.png", "image/png", null],
  ["truncated image", "meal.png", "image/png", "truncated"],
  ["corrupted image", "meal.png", "image/png", "corrupted"],
  ["oversized image", "meal.png", "image/png", "oversized"]
])("rejects %s and removes its temporary file", async (_case, name, mimeType, fixture) => {
  let buffer;
  if (fixture === "png") buffer = fixtureImages.png;
  else if (fixture === "truncated") buffer = fixtureImages.png.subarray(0, 24);
  else if (fixture === "corrupted") {
    buffer = Buffer.from(fixtureImages.png);
    buffer[buffer.indexOf(Buffer.from("IDAT")) + 6] ^= 0xff;
  } else if (fixture === "oversized") {
    buffer = Buffer.alloc(5 * 1024 * 1024 + 1, 0x41);
  } else {
    buffer = Buffer.from("not an image");
  }

  const response = await submitImage({ name, mimeType, buffer });

  expect(response.status).toBe(400);
  expect(addedFiles()).toHaveLength(0);
}, 15000);

test.each(["excessivePixels", "excessiveDimension"])(
  "rejects a valid image with excessive %s under the upload-size limit",
  async fixture => {
    const buffer = fixtureImages[fixture];
    expect(buffer.length).toBeLessThan(5 * 1024 * 1024);

    const response = await submitImage({
      name: "large-dimensions.png",
      mimeType: "image/png",
      buffer
    });

    expect(response.status).toBe(400);
    expect(addedFiles()).toHaveLength(0);
  },
  15000
);

test("removes the validated upload when a later donation database save fails", async () => {
  Donation.prototype.save.mockRejectedValue(new Error("database write failed"));
  const log = jest.spyOn(console, "error").mockImplementation(() => {});

  const response = await submitImage({
    name: "meal.png",
    mimeType: "image/png",
    buffer: fixtureImages.png
  });

  expect(response.status).toBe(500);
  expect(addedFiles()).toHaveLength(0);
  log.mockRestore();
});

test("keeps a persisted upload if sending the success response fails", async () => {
  const imagePath = path.join(uploadDir, "persisted-response-failure.png");
  fs.writeFileSync(imagePath, fixtureImages.png);
  const req = {
    body: {
      location: "test city",
      foodDetails: "Rice",
      expiryHours: "2"
    },
    user: { email: userEmail },
    file: { path: imagePath, filename: path.basename(imagePath) }
  };
  const res = {
    statusCode: 0,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json() {
      if (this.statusCode === 201) {
        throw new Error("client disconnected");
      }
    }
  };
  const log = jest.spyOn(console, "error").mockImplementation(() => {});

  await createDonation(req, res);

  expect(res.statusCode).toBe(500);
  expect(fs.existsSync(imagePath)).toBe(true);
  log.mockRestore();
});

test("removes the validated upload when later donation validation rejects it", async () => {
  User.findOne.mockImplementation(() => ({
    select: jest.fn().mockResolvedValue({
      email: userEmail,
      role: "receiver",
      location: "test city",
      tokenVersion: 0,
      disabled: false
    })
  }));

  const response = await submitImage({
    name: "meal.png",
    mimeType: "image/png",
    buffer: fixtureImages.png
  });

  expect(response.status).toBe(403);
  expect(addedFiles()).toHaveLength(0);
});
