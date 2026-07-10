/* eslint-disable max-len */
/**
 * Funnel-abandonment reminder emails.
 *
 * The live checkout is a 3-step wizard: Your details -> Promo & shipping ->
 * Payment (the old "Screening & consent" step was removed). Step routing:
 * abandonedAtStep is the highest step the user *finished*
 * (FunnelSessions.maxStepCompleted, 0-3). The template names the step the
 * user actually reached (the section they last worked on), not the next one:
 *   0 or 1 -> template 1 (Your details), 2 -> template 2 (Promo & shipping),
 *   3 -> template 3 (Payment).
 */

const DEFAULT_SUPPORT_EMAIL = "noreply@labthree.org";

/**
 * @param {unknown} value
 * @return {string}
 */
function escapeHtml(value) {
  return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

/**
 * Per-step copy. `step` is 1..3 and matches the wizard step the customer
 * paused on.
 *
 * @typedef {Object} StepCopy
 * @property {number} step
 * @property {string} subject       Postmark subject line.
 * @property {string} headerTitle   White H1 inside the header band.
 * @property {string} bodyIntro     Single-paragraph lede (HTML allowed).
 * @property {string} stepLabel     Label after "Step:" in the "Where you left off" card.
 * @property {string} completedLabel  Label after "Completed:" (empty for step 1).
 * @property {string} nextLine      Final card line ("Next up: ..." or step-3 reminder).
 * @property {string} ctaLabel      Button label.
 */

/** @type {Record<1 | 2 | 3, StepCopy>} */
const STEP_COPY = {
  1: {
    step: 1,
    subject: "Finish your details",
    headerTitle: "Finish your details",
    bodyIntro:
      "You started checkout but haven\u2019t placed your order yet. You left off at <strong>Your details</strong> \u2014 take a minute to confirm your name, email, phone, and date of birth so we can continue your care plan.",
    stepLabel: "Your details",
    completedLabel: "",
    nextLine: "<strong>Next up:</strong> Promo &amp; shipping",
    ctaLabel: "Continue checkout",
  },
  2: {
    step: 2,
    subject: "Add promo & shipping",
    headerTitle: "Add promo &amp; shipping",
    bodyIntro:
      "You\u2019re almost done. You stopped on <strong>Promo &amp; shipping</strong> \u2014 apply a promo code if you have one and confirm shipping so we can prepare your order.",
    stepLabel: "Promo &amp; shipping",
    completedLabel: "Your details",
    nextLine: "<strong>Next up:</strong> Payment",
    ctaLabel: "Continue checkout",
  },
  3: {
    step: 3,
    subject: "Complete your payment",
    headerTitle: "Complete your payment",
    bodyIntro:
      "Everything before billing is done. Open checkout, go to <strong>Payment</strong>, and securely enter your card to place your order.",
    stepLabel: "Payment",
    completedLabel: "Your details \u00b7 Promo &amp; shipping",
    nextLine: "<strong>Reminder:</strong> Your order total and line items are shown on the checkout page.",
    ctaLabel: "Complete payment",
  },
};

/**
 * Map the highest *completed* checkout step (0-3) to the template step (1-3)
 * for the section the user actually reached (the step they last worked on).
 *
 *   maxStepCompleted=0 (in details, none done) -> template 1 (Your details)
 *   maxStepCompleted=1 (details done)          -> template 1 (Your details)
 *   maxStepCompleted=2 (promo & shipping done) -> template 2 (Promo & shipping)
 *   maxStepCompleted=3 (reached payment)       -> template 3 (Payment)
 *
 * @param {number | null | undefined} abandonedAtStep
 * @return {1 | 2 | 3}
 */
function resolveTemplateStep(abandonedAtStep) {
  const n =
    typeof abandonedAtStep === "number" && Number.isFinite(abandonedAtStep) ?
      Math.round(abandonedAtStep) :
      0;
  if (n >= 3) return 3;
  if (n === 2) return 2;
  return 1;
}

/**
 * @param {object} args
 * @param {number|null|undefined} args.abandonedAtStep  0..3 from FunnelSessions.
 * @param {string} args.continueUrl  Absolute URL the CTA points at.
 * @param {string} [args.supportEmail]  Address rendered in the "Need help?" footer.
 * @return {{subject: string, htmlBody: string, step: number}}
 */
function generateFunnelAbandonEmail({abandonedAtStep, continueUrl, supportEmail} = {}) {
  if (!continueUrl || typeof continueUrl !== "string") {
    throw new Error("generateFunnelAbandonEmail: continueUrl is required.");
  }
  const step = resolveTemplateStep(abandonedAtStep);
  const copy = STEP_COPY[step];
  const safeUrl = escapeHtml(continueUrl);
  const support =
    supportEmail && String(supportEmail).trim() ?
      String(supportEmail).trim() :
      DEFAULT_SUPPORT_EMAIL;
  const safeSupport = escapeHtml(support);
  const year = new Date().getUTCFullYear();

  const completedRow = copy.completedLabel ?
    `                  <p style="margin:0 0 10px 0;font-size:15px;line-height:1.5;color:#1a1a1a;">
                    <strong>Completed:</strong> ${copy.completedLabel}
                  </p>` :
    "";
  const nextLineMargin = copy.completedLabel ? "0" : "12px 0 0 0";

  const htmlBody = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.subject)}</title>
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
                <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:26px;line-height:1.3;font-weight:700;">${copy.headerTitle}</h1>
                <p style="margin:0;color:#94A3B8;font-size:14px;line-height:1.5;">Affiliate Demo</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;padding:36px 36px 28px 36px;">
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#1a1a1a;">Hi there,</p>
                <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#1a1a1a;">
                  ${copy.bodyIntro}
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e6e6e6;border-radius:12px;margin:0 0 24px 0;">
                  <tr>
                    <td style="padding:20px 22px;">
                      <p style="margin:0 0 14px 0;font-size:16px;font-weight:700;color:#1a1a1a;">Where you left off</p>
                      <p style="margin:0 0 10px 0;font-size:15px;line-height:1.5;color:#1a1a1a;">
                        <strong>Step:</strong> ${copy.stepLabel}
                      </p>
${completedRow}
                      <p style="margin:${nextLineMargin};font-size:15px;line-height:1.5;color:#1a1a1a;">
                        ${copy.nextLine}
                      </p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:#6366F1;">
                      <a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(copy.ctaLabel)} &rarr;</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#666666;">Or copy and paste this URL into your browser:</p>
                <p style="margin:0 0 24px 0;font-size:13px;line-height:1.6;word-break:break-all;">
                  <a href="${safeUrl}" target="_blank" rel="noopener" style="color:#6366F1;text-decoration:underline;">${safeUrl}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e6e6e6;margin:24px 0;" />
                <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#1a1a1a;">
                  Thank you,<br /><strong>The Affiliate Demo Team</strong>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#666666;">
                  Need help? Reach us at <a href="mailto:${safeSupport}" style="color:#6366F1;text-decoration:underline;">${safeSupport}</a>.
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

  return {subject: copy.subject, htmlBody, step};
}

module.exports = {generateFunnelAbandonEmail, resolveTemplateStep};
