jest.mock("nodemailer", () => ({
  createTransport: jest.fn()
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn()
}));

jest.mock("../models/User", () => jest.fn());
jest.mock("../utils/mail", () => jest.fn());
jest.mock("../utils/jwt", () => ({
  signUserToken: jest.fn(),
  signAdminToken: jest.fn()
}));

let nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const sendWelcomeMail = require("../utils/mail");
const authController = require("../controllers/authController");

const originalEmailUser = process.env.EMAIL_USER;
const originalEmailPass = process.env.EMAIL_PASS;
const originalEmailService = process.env.EMAIL_SERVICE;

function restoreEmailEnvironment() {
  for (const [key, value] of Object.entries({
    EMAIL_USER: originalEmailUser,
    EMAIL_PASS: originalEmailPass,
    EMAIL_SERVICE: originalEmailService
  })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("email delivery", () => {
  let sendTransportMail;
  let sendMail;

  beforeEach(() => {
    jest.resetModules();
    nodemailer = require("nodemailer");
    nodemailer.createTransport.mockReset();
    process.env.EMAIL_USER = "sender@example.test";
    process.env.EMAIL_PASS = "test-password";
    process.env.EMAIL_SERVICE = "gmail";
    sendTransportMail = jest.fn();
    nodemailer.createTransport.mockReturnValue({ sendMail: sendTransportMail });
    sendMail = require("../mail");
  });

  afterAll(restoreEmailEnvironment);

  test("creates the transporter lazily and delivers a message", async () => {
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    const accepted = { messageId: "message-1" };
    sendTransportMail.mockResolvedValue(accepted);

    await expect(sendMail("recipient@example.test", "Subject", "<p>Hi</p>"))
      .resolves.toBe(accepted);

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: "gmail",
      auth: { user: "sender@example.test", pass: "test-password" }
    });
    expect(sendTransportMail).toHaveBeenCalledWith({
      from: "sender@example.test",
      to: "recipient@example.test",
      subject: "Subject",
      html: "<p>Hi</p>"
    });
  });

  test.each(["EMAIL_USER", "EMAIL_PASS"])(
    "rejects when %s is missing without creating a transporter",
    async (missingCredential) => {
      delete process.env[missingCredential];
      await expect(sendMail("recipient@example.test", "Subject", "<p>Hi</p>"))
        .rejects.toThrow("Email is not configured");
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    }
  );

  test.each([
    [null, "Subject", "<p>Hi</p>"],
    ["recipient@example.test", "", "<p>Hi</p>"],
    ["recipient@example.test", "Subject", null]
  ])("rejects invalid message arguments (%s)", async (to, subject, html) => {
    await expect(sendMail(to, subject, html)).rejects.toThrow(TypeError);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  test("propagates SMTP delivery failures", async () => {
    const smtpError = new Error("SMTP unavailable");
    sendTransportMail.mockRejectedValue(smtpError);

    await expect(sendMail("recipient@example.test", "Subject", "<p>Hi</p>"))
      .rejects.toBe(smtpError);
  });
});

describe("registration email failure", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    User.mockReset();
    bcrypt.hash.mockReset();
    sendWelcomeMail.mockReset();
    console.error = jest.fn();

    bcrypt.hash.mockResolvedValue("hashed-password");
    User.findOne = jest.fn().mockResolvedValue(null);
    User.mockImplementation(function UserRecord(data) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(this);
    });
  });

  afterAll(() => {
    console.error = originalConsoleError;
    restoreEmailEnvironment();
  });

  test("completes registration after welcome email failure without logging error details", async () => {
    sendWelcomeMail.mockRejectedValue(
      new Error("SMTP failed for sender@example.test with password secret-value")
    );
    const response = {
      json: jest.fn()
    };

    await authController.register({
      body: {
        name: "Test User",
        email: "Test.User@example.test",
        password: "valid-password"
      }
    }, response);

    expect(response.json).toHaveBeenCalledWith({ success: true });
    expect(sendWelcomeMail).toHaveBeenCalledWith(
      "test.user@example.test",
      expect.any(String),
      expect.any(String)
    );
    expect(console.error).toHaveBeenCalledWith(
      "Welcome email delivery failed; registration completed."
    );
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("secret-value");
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("sender@example.test");
  });
});
