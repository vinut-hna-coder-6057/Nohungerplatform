const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
    if (transporter) {
        return transporter;
    }

    const { EMAIL_USER, EMAIL_PASS } = process.env;
    if (!EMAIL_USER || !EMAIL_PASS) {
        throw new Error("Email is not configured: set EMAIL_USER and EMAIL_PASS.");
    }

    transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || "gmail",
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        }
    });

    return transporter;
}

async function sendMail(to, subject, html) {
    if (!to || !subject || !html) {
        throw new TypeError("Email recipient, subject, and HTML body are required.");
    }

    return getTransporter().sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        html
    });
}

module.exports = sendMail;
