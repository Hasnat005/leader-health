/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");

/** WebP logo asset; converted to PNG for pdfkit. Replace with demo logo asset. */
const LOGO_WEBP_PATH = path.join(__dirname, "../assets/nxgen-logo-white.webp");

/**
 * @param {number} cents
 * @param {string} [currency]
 * @return {string}
 */
function formatMoney(cents, currency = "USD") {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * @param {unknown} raw
 * @return {string}
 */
function formatOrderDate(raw) {
  if (raw == null) return "—";
  try {
    if (typeof raw === "object" && raw !== null && "toDate" in raw && typeof raw.toDate === "function") {
      return raw.toDate().toLocaleDateString("en-US", {year: "numeric", month: "short", day: "numeric"});
    }
    if (raw instanceof Date) {
      return raw.toLocaleDateString("en-US", {year: "numeric", month: "short", day: "numeric"});
    }
    const s = String(raw).trim();
    if (!s) return "—";
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {year: "numeric", month: "short", day: "numeric"});
    }
    return s;
  } catch {
    return "—";
  }
}

/**
 * @param {{
 *   affiliateName: string,
 *   affiliateEmail: string,
 *   payoutDate: Date,
 *   orders: Array<{
 *     orderId: string,
 *     createdAt: unknown,
 *     promoCodeEntered: string | null,
 *     originalAmountCents: number,
 *     commissionCents: number,
 *     currency?: string,
 *   }>,
 *   totalCommissionCents: number,
 * }} input
 * @return {Promise<Buffer>}
 */
async function generateInvoicePdf(input) {
  const {
    affiliateName,
    affiliateEmail,
    payoutDate,
    orders,
    totalCommissionCents,
  } = input;

  const issuedStr = payoutDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  /** @type {Buffer | null} */
  let logoPngBuffer = null;
  if (fs.existsSync(LOGO_WEBP_PATH)) {
    try {
      logoPngBuffer = await sharp(LOGO_WEBP_PATH).png().toBuffer();
    } catch (_) {
      /* logo optional */
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({margin: 48, size: "LETTER"});
    /** @type {Buffer[]} */
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = 48;

    if (logoPngBuffer) {
      try {
        doc.save();
        doc.roundedRect(48, y, 108, 48, 6).fill("#0f172a");
        doc.image(logoPngBuffer, 56, y + 6, {height: 36});
        doc.restore();
      } catch (_) {
        /* logo optional */
      }
    }

    doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .fillColor("#111827")
        .text("Commission Payout Invoice", 260, y + 8, {align: "right", width: 300});

    y = 110;
    doc.fontSize(10).font("Helvetica").fillColor("#374151");
    doc.text(`Issued: ${issuedStr}`, 48, y);
    y += 16;
    doc.font("Helvetica-Bold").text("Affiliate");
    doc.font("Helvetica").text(affiliateName || "—", {indent: 8});
    y = doc.y + 4;
    doc.font("Helvetica-Bold").text("Email");
    doc.font("Helvetica").text(affiliateEmail || "—", {indent: 8});
    y = doc.y + 16;

    doc.moveTo(48, y).lineTo(564, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
    y += 20;

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#6b7280");
    doc.text("Order date", 48, y, {width: 100});
    doc.text("Promo", 152, y, {width: 90});
    doc.text("Order amount", 248, y, {width: 100, align: "right"});
    doc.text("Commission", 360, y, {width: 100, align: "right"});
    doc.text("Order ID", 468, y, {width: 96, align: "right"});
    y += 14;
    doc.moveTo(48, y).lineTo(564, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 10;

    doc.font("Helvetica").fillColor("#111827").fontSize(9);
    for (const row of orders) {
      const cur = typeof row.currency === "string" && row.currency ? row.currency : "usd";
      const promo = row.promoCodeEntered && String(row.promoCodeEntered).trim() ?
        String(row.promoCodeEntered).trim() :
        "—";
      const orig = formatMoney(row.originalAmountCents, cur);
      const comm = formatMoney(row.commissionCents, cur);

      if (y > 700) {
        doc.addPage();
        y = 48;
      }

      doc.text(formatOrderDate(row.createdAt), 48, y, {width: 100});
      doc.text(promo, 152, y, {width: 90, ellipsis: true});
      doc.text(orig, 248, y, {width: 100, align: "right"});
      doc.text(comm, 360, y, {width: 100, align: "right"});
      doc.fontSize(7).fillColor("#6b7280").text(String(row.orderId || "").slice(0, 18), 468, y + 1, {
        width: 96,
        align: "right",
      });
      doc.fontSize(9).fillColor("#111827");
      y += 22;
    }

    y += 8;
    doc.moveTo(48, y).lineTo(564, y).strokeColor("#d1d5db").lineWidth(1).stroke();
    y += 16;

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827");
    doc.text("Total commission", 48, y);
    doc.text(formatMoney(totalCommissionCents), 360, y, {width: 204, align: "right"});
    y += 28;

    doc.fontSize(8).font("Helvetica").fillColor("#9ca3af");
    doc.text(
        "This document summarizes commission amounts recorded for the listed orders. " +
        "Retain for your records.",
        48,
        y,
        {width: 516, align: "left"},
    );

    doc.end();
  });
}

module.exports = {generateInvoicePdf, formatMoney, formatOrderDate};
