import nodemailer from "nodemailer";
import crypto from "crypto";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export function generateVerificationCode() {
  return crypto.randomInt(100000, 999999).toString();
}

export async function sendVerificationEmail(email, username, code) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    }
    .header {
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      padding: 40px 30px;
      text-align: center;
      color: white;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #4b5563;
      margin-bottom: 30px;
    }
    .code-box {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%);
      border: 2px solid #2563eb;
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      margin-bottom: 30px;
    }
    .code-label {
      font-size: 14px;
      font-weight: 600;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .code {
      font-size: 48px;
      font-weight: 700;
      color: #2563eb;
      letter-spacing: 8px;
      font-family: 'Monaco', 'Courier New', monospace;
    }
    .warning {
      background: rgba(245, 158, 11, 0.1);
      border-left: 4px solid #f59e0b;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .warning p {
      font-size: 14px;
      color: #92400e;
      line-height: 1.5;
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      line-height: 1.6;
    }
    .footer strong {
      color: #2563eb;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Learning Hub</h1>
      <p>Verify your email to get started</p>
    </div>

    <div class="content">
      <div class="greeting">Hello ${username},</div>

      <div class="message">
        Thank you for registering with Learning Hub! To complete your registration and start your learning journey, please use the verification code below:
      </div>

      <div class="code-box">
        <div class="code-label">Your Verification Code</div>
        <div class="code">${code}</div>
      </div>

      <div class="warning">
        <p>This code will expire in 15 minutes. If you didn't request this verification, please ignore this email.</p>
      </div>

      <div class="message">
        Once verified, you'll be able to:
        <ul style="margin-top: 12px; padding-left: 20px; line-height: 1.8;">
          <li>Track your learning progress across all devices</li>
          <li>Earn credits for completing lessons</li>
          <li>Unlock premium features and content</li>
        </ul>
      </div>
    </div>

    <div class="footer">
      <p>This email was sent by <strong>Learning Hub</strong></p>
      <p style="margin-top: 8px;">Powering students since 2025</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"Learning Hub" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: "Verify Your Email - Learning Hub",
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
}
