/* eslint-disable max-len */

/**
 * HTML for the affiliate or admin welcome / set-password email.
 *
 * @param {object} params
 * @param {string} params.welcomeUrl
 * @param {string} params.displayName
 * @param {'affiliate'|'admin'} [params.portalKind]
 * @return {string}
 */
function buildWelcomeEmail({welcomeUrl, displayName, portalKind = "affiliate"}) {
  const safeLink = String(welcomeUrl || "").replace(/"/g, "&quot;");
  const name = String(displayName || "").trim() || "there";
  const safeName = name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const year = new Date().getUTCFullYear();
  const bodyLine =
    portalKind === "admin" ?
      "Your <strong>Affiliate Demo</strong> Admin Portal account has been created. Click the button below to sign in and choose your password. This link expires in <strong>24 hours</strong>." :
      "Your <strong>Affiliate Demo</strong> affiliate dashboard has been created. Click the button below to sign in and choose your password. This link expires in <strong>24 hours</strong>.";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome to Affiliate Demo</title>
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
                <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:26px;line-height:1.3;font-weight:700;">Welcome to Affiliate Demo &mdash; you're in!</h1>
                <p style="margin:0;color:#94A3B8;font-size:14px;line-height:1.5;">Set up your account</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;padding:36px 36px 28px 36px;">
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#1a1a1a;">Hi ${safeName},</p>
                <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#1a1a1a;">
                  ${bodyLine}
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:#6366F1;">
                      <a href="${safeLink}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Get started &rarr;</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#666666;">Or copy and paste this URL into your browser:</p>
                <p style="margin:0 0 24px 0;font-size:13px;line-height:1.6;word-break:break-all;">
                  <a href="${safeLink}" target="_blank" rel="noopener" style="color:#6366F1;text-decoration:underline;">${safeLink}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e6e6e6;margin:24px 0;" />
                <p style="margin:0;font-size:13px;line-height:1.6;color:#666666;">
                  If you weren't expecting this email, you can ignore it.
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

module.exports = {buildWelcomeEmail};
