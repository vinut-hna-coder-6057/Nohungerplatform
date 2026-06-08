const nodemailer = require("nodemailer");

/* ======================================================
   MAIL TRANSPORT
====================================================== */

const transporter =
    nodemailer.createTransport({

        service: "gmail",

        auth: {

            user:
                process.env.EMAIL_USER,

            pass:
                process.env.EMAIL_PASS

        }

    });

/* ======================================================
   SEND MAIL
====================================================== */

async function sendMail(
    to,
    subject,
    html
) {

    try {

        await transporter.sendMail({

            from:
                process.env.EMAIL_USER,

            to,

            subject,

            html

        });

        

    } catch (error) {

        console.error(
            "❌ Mail Error:",
            error.message
        );

    }

}

module.exports = sendMail;