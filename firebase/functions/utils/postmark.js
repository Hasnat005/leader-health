/* eslint-disable max-len */
/**
 * Postmark email helper. Plain HTTPS POST to api.postmarkapp.com/email so we
 * don't pull in a Postmark SDK as a runtime dependency.
 *
 * Sender domain `labthree.org` must be verified inside Postmark for the
 * configured server token. From address is fixed at noreply@labthree.org.
 */

const https = require("https");
const logger = require("firebase-functions/logger");
const config = require("../config");
const {buildWelcomeEmail} = require("../lib/welcomeEmailTemplate.js");

const POSTMARK_HOST = "api.postmarkapp.com";
const POSTMARK_PATH = "/email";
const FROM_ADDRESS = "Affiliate Demo <noreply@labthree.org>";
const MESSAGE_STREAM = "outbound";

/**
 * Send an email via Postmark.
 *
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.htmlBody
 * @return {Promise<void>}
 */
function sendEmail({to, subject, htmlBody}) {
  return new Promise((resolve, reject) => {
    const postmarkServerToken =
      (process.env.POSTMARK_SERVER_TOKEN || config.postmarkServerToken || "").trim();
    if (!postmarkServerToken) {
      reject(new Error("postmark_token_missing"));
      return;
    }
    if (!to || !subject || !htmlBody) {
      reject(new Error("postmark_invalid_args"));
      return;
    }

    /** @type {Record<string, unknown>} */
    const body = {
      From: FROM_ADDRESS,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      MessageStream: MESSAGE_STREAM,
    };
    const payload = JSON.stringify(body);

    const req = https.request(
        {
          host: POSTMARK_HOST,
          path: POSTMARK_PATH,
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": postmarkServerToken,
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let raw = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            raw += chunk;
          });
          res.on("end", () => {
            const status = res.statusCode || 0;
            if (status >= 200 && status < 300) {
              resolve();
              return;
            }
            let detail = raw;
            try {
              const parsed = JSON.parse(raw);
              detail = parsed.Message || raw;
            } catch (_) {
              /* leave detail as raw */
            }
            logger.warn("postmark_send_failed", {status, detail});
            reject(new Error(`postmark_status_${status}`));
          });
        },
    );

    req.on("error", (err) => {
      logger.warn("postmark_request_error", {message: err && err.message});
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * HTML for the password-reset email. Inline CSS only — many email
 * clients ignore <style> blocks.
 *
 * @param {string} resetLink
 * @return {string}
 */
function generatePasswordResetEmail(resetLink) {
  const safeLink = String(resetLink || "").replace(/"/g, "&quot;");
  const year = new Date().getUTCFullYear();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset your password</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
            <tr>
              <td style="background-color:#1E293B;border-radius:12px 12px 0 0;padding:40px 32px;text-align:center;">
                <div style="display:inline-block;padding:8px 24px;background-color:#334155;border-radius:6px;margin-bottom:24px;">
                  <span style="color:#a5b4fc;font-size:13px;font-weight:700;letter-spacing:0.08em;">AFFILIATE DEMO</span>
                </div>
                <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:26px;line-height:1.3;font-weight:700;">Reset your password</h1>
                <p style="margin:0;color:#94A3B8;font-size:14px;line-height:1.5;">Action required</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;padding:36px 36px 28px 36px;">
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#1a1a1a;">Hi,</p>
                <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#1a1a1a;">
                  We received a request to reset your <strong>Affiliate Demo</strong> account password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:#6366F1;">
                      <a href="${safeLink}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password &rarr;</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#666666;">Or copy and paste this URL into your browser:</p>
                <p style="margin:0 0 24px 0;font-size:13px;line-height:1.6;word-break:break-all;">
                  <a href="${safeLink}" target="_blank" rel="noopener" style="color:#6366F1;text-decoration:underline;">${safeLink}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e6e6e6;margin:24px 0;" />
                <p style="margin:0;font-size:13px;line-height:1.6;color:#666666;">
                  If you didn't request a password reset you can safely ignore this email — your password won't change.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border-radius:0 0 12px 12px;padding:20px 36px 28px 36px;border-top:1px solid #e6e6e6;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#999999;">
                  &copy; ${year} Affiliate Demo. All rights reserved. &middot; <a href="https://labthree.org" target="_blank" rel="noopener" style="color:#999999;text-decoration:underline;">labthree.org</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * HTML for the affiliate or admin welcome email (same layout as password reset).
 *
 * @param {string} welcomeUrl
 * @param {string} displayName
 * @param {'affiliate' | 'admin'} [portalKind]
 * @return {string}
 */
function generateWelcomeEmail(welcomeUrl, displayName, portalKind = "affiliate") {
  return buildWelcomeEmail({welcomeUrl, displayName, portalKind});
}

module.exports = {
  sendEmail,
  generatePasswordResetEmail,
  generateWelcomeEmail,
};
