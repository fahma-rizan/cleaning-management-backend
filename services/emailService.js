let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;
  const nodemailer = await import('nodemailer');
  transporter = nodemailer.default.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  return transporter;
};

const SUBJECT = {
  verify_email:   'Verify Your Cloud Laundry Account',
  reset_password: 'Reset Your Cloud Laundry Password',
};

const TITLE = {
  verify_email:   'Email Verification',
  reset_password: 'Password Reset',
};

const sendOtpEmail = async (to, otp, purpose) => {
  const mail = await getTransporter();
  await mail.sendMail({
    from: `"Cloud Laundry.lk" <${process.env.EMAIL_USER}>`,
    to,
    subject: SUBJECT[purpose],
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;">
        <h2 style="color:#7C3AED;margin-bottom:8px;">${TITLE[purpose]}</h2>
        <p style="color:#374151;">Use the OTP below. It expires in <strong>10 minutes</strong>.</p>
        <div style="
          font-size:36px;font-weight:700;letter-spacing:12px;color:#7C3AED;
          background:#F3F3F5;padding:20px 28px;border-radius:10px;
          display:inline-block;margin:20px 0;
        ">${otp}</div>
        <p style="color:#6B7280;font-size:13px;">
          If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #E5E7EB;margin-top:24px;" />
        <p style="color:#94A3B8;font-size:12px;">Cloud Laundry.lk — Your Trusted Cleaning Partner</p>
      </div>
    `,
  });
};

/**
 * Sends temporary login credentials to a newly created staff or admin account.
 */
const sendTempCredentials = async (to, { name, tempPassword, role }) => {
  const mail = await getTransporter();
  const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  await mail.sendMail({
    from: `"Cloud Laundry.lk" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your Cloud Laundry Account — Temporary Credentials',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
        <h2 style="color:#7C3AED;margin-bottom:8px;">Welcome to Cloud Laundry.lk</h2>
        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151;">
          An account has been created for you as <strong>${roleLabel}</strong>.
          Use the credentials below to log in for the first time.
        </p>
        <div style="background:#F3F3F5;border-radius:10px;padding:20px 28px;margin:20px 0;">
          <p style="margin:6px 0;color:#374151;"><strong>Email:</strong> ${to}</p>
          <p style="margin:6px 0;color:#374151;">
            <strong>Temporary Password:</strong>
            <span style="color:#7C3AED;font-weight:700;letter-spacing:1px;">${tempPassword}</span>
          </p>
        </div>
        <p style="color:#374151;">
          You will be required to set a new password immediately after your first login.
        </p>
        <p style="color:#EF4444;font-size:13px;font-weight:600;">
          Do not share these credentials with anyone.
        </p>
        <hr style="border:none;border-top:1px solid #E5E7EB;margin-top:24px;" />
        <p style="color:#94A3B8;font-size:12px;">Cloud Laundry.lk — Your Trusted Cleaning Partner</p>
      </div>
    `,
  });
};

module.exports = { sendOtpEmail, sendTempCredentials };
