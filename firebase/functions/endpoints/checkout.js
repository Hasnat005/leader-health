/* eslint-disable valid-jsdoc, max-len, require-jsdoc */

/**
 * checkoutHttp — Stripe-backed checkout endpoint (ADR-003).
 *
 * Routes:
 *   POST /create-payment-intent   Create Stripe PI + CheckoutSessions doc.
 *   POST /confirm                 Verify PI, requestConsult, write order.
 *
 * Gen-health requestConsult + patient lookup aligned with humn-health.
 * Funnel bridge: mergeFunnelCheckoutSessionId on PI create, mergeFunnelOrderPlaced on confirm.
 */

const logger = require("firebase-functions/logger");
const {db} = require("../utils/Firebase.js");
const {getStripe} = require("../utils/stripe.js");
const {sendJson} = require("../utils/httpJson.js");
const {attributionAllowNoPromoUtm} = require("../config.js");
const {
  getGenHealthApiKey,
  getGenHealthClientPatientsBaseUrl,
  postConsultV2,
  patchOrderV2,
  fetchPatientIdByEmail,
} = require("../utils/genHealthApi.js");
const {
  CHECKOUT_SESSIONS_COL,
  SessionStatus,
  createSession,
  attachPaymentIntent,
  recordPaymentSuccess,
  recordConsultRequest,
  completeSession,
  markSessionFailed,
} = require("../lib/checkout/session.js");
const {
  CHECKOUT_ORDERS_COL,
  buildOrderDoc,
  writeOrder,
} = require("../lib/checkout/orders.js");
const {resolveCheckoutAttribution} = require("../lib/checkout/attribution.js");
const {
  writeAffiliateOrderProjection,
} = require("../lib/checkout/affiliateProjection.js");
const {
  parseClientAttributionSnapshot,
} = require("../lib/promo/normalize.js");
const {
  mergeFunnelCheckoutSessionId,
  mergeFunnelOrderPlaced,
} = require("../lib/funnel/funnelCheckoutBridge.js");
const {
  CATALOG_PROVIDER_DOTFIT,
  normalizeCatalogProvider,
} = require("../lib/catalogProvider.js");
const {bootstrapGenHealthCheckout} = require("../lib/checkout/genHealth/bootstrap.js");
const {
  buildGenHealthCart,
  assertSessionLineItemsSingleUnit,
  resolveCouponCodeForConsult,
} = require("../lib/checkout/genHealth/cart.js");

/**
 * Leader Health storefront rejects Dotfit catalog lines.
 * @param {unknown} provider
 * @return {boolean}
 */
function isDotfitProvider(provider) {
  return normalizeCatalogProvider(provider) === CATALOG_PROVIDER_DOTFIT;
}

/**
 * @param {Record<string, unknown>} patientPayload
 * @param {Record<string, unknown>} orderPayload
 * @param {string} topLevelPatientId
 * @return {Record<string, unknown>}
 */
function buildConsultRequestBody(patientPayload, orderPayload, topLevelPatientId) {
  const out = {
    patient: patientPayload,
    order: orderPayload,
    send_email: false,
  };
  const pid = typeof topLevelPatientId === "string" ? topLevelPatientId.trim() : "";
  if (pid) {
    out.patientId = pid;
    out.patient_id = pid;
  }
  return out;
}

/**
 * Extract upstream gen-health order ids from a consult response `data` block.
 * Handles both the `data.orders[]` and single `data.orderId` shapes.
 *
 * @param {unknown} consultData
 * @return {string[]}
 */
function extractGhOrderIds(consultData) {
  if (!consultData || typeof consultData !== "object") return [];
  const d = /** @type {Record<string, unknown>} */ (consultData);
  if (Array.isArray(d.orders)) {
    return d.orders
        .map((o) => {
          if (!o || typeof o !== "object") return "";
          const row = /** @type {Record<string, unknown>} */ (o);
          return typeof row.orderId === "string" ? row.orderId.trim() : "";
        })
        .filter(Boolean);
  }
  const single = typeof d.orderId === "string" ? d.orderId.trim() : "";
  return single ? [single] : [];
}

/**
 * Read the requested product ids from the request body. Accepts the
 * multi-product `products: [{ clientProductId }, ...]` shape and falls back to
 * a single legacy `clientProductId` string for backward compatibility.
 *
 * @param {unknown} body
 * @return {string[]}
 */
function resolveClientProductIds(body) {
  const b =
    body && typeof body === "object" ?
      /** @type {Record<string, unknown>} */ (body) :
      {};
  if (Array.isArray(b.items)) {
    const ids = [];
    for (const raw of b.items) {
      if (!raw || typeof raw !== "object") continue;
      const item = /** @type {Record<string, unknown>} */ (raw);
      if (isDotfitProvider(item.catalog_provider)) {
        throw new Error("Dotfit products are not supported on Leader Health");
      }
      const id =
        typeof item.clientProductId === "string" ? item.clientProductId.trim() : "";
      if (id) ids.push(id);
    }
    if (ids.length > 0) return ids;
  }
  if (Array.isArray(b.products)) {
    return b.products
        .map((p) => {
          if (!p || typeof p !== "object") return "";
          const o = /** @type {Record<string, unknown>} */ (p);
          return typeof o.clientProductId === "string" ? o.clientProductId.trim() : "";
        })
        .filter(Boolean);
  }
  if (typeof b.clientProductId === "string" && b.clientProductId.trim()) {
    return [b.clientProductId.trim()];
  }
  return [];
}

/**
 * Cart-build errors are client faults (bad product id / duplicate line) → 400,
 * not a 500.
 *
 * @param {unknown} err
 * @return {boolean}
 */
function isCartClientError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Product not found") ||
    msg.includes("not available") ||
    msg.includes("not eligible") ||
    msg.includes("has no price") ||
    msg.includes("no valid price") ||
    msg.includes("At least one") ||
    msg.includes("Only one unit per product")
  );
}

// ---------------------------------------------------------------------------
// POST /create-payment-intent
// ---------------------------------------------------------------------------

async function handleCreatePaymentIntent(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (isDotfitProvider(body.catalog_provider)) {
    sendJson(res, 400, {
      success: false,
      error: "Dotfit checkout is not supported on Leader Health",
    });
    return;
  }

  let clientProductIds = [];
  try {
    clientProductIds = resolveClientProductIds(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendJson(res, 400, {success: false, error: msg});
    return;
  }
  const promoCodeRaw =
    typeof body.promoCode === "string" ? body.promoCode.trim() : "";
  const currency = (body.currency || "usd").toLowerCase();
  const shippingCents =
    typeof body.shippingCents === "number" && Number.isFinite(body.shippingCents) ?
      Math.max(0, Math.round(body.shippingCents)) :
      0;
  const funnelSessionId =
    typeof body.funnelSessionId === "string" ? body.funnelSessionId.trim() : "";

  logger.info("checkoutHttp: POST /create-payment-intent", {
    productCount: clientProductIds.length,
    currency,
    hasPromoCode: Boolean(promoCodeRaw),
    shippingCents,
    hasFunnelSessionId: Boolean(funnelSessionId),
  });

  if (clientProductIds.length === 0) {
    sendJson(res, 400, {
      success: false,
      error: "products array with clientProductId is required",
    });
    return;
  }

  let sessionId = null;
  try {
    const cart = await buildGenHealthCart(clientProductIds, promoCodeRaw);

    const orderTotalCents = cart.totalCents + shippingCents;
    if (orderTotalCents <= 0) {
      sendJson(res, 400, {
        success: false,
        error: "Order total cannot be zero; contact support.",
      });
      return;
    }

    sessionId = await createSession(db, {
      lineItems: cart.lineItems,
      totalCents: orderTotalCents,
      subtotalCents: cart.subtotalCents,
      shippingCents,
      promoCodeApplied: cart.promoCodeApplied,
      currency,
    });
    logger.info("checkoutHttp: session created", {
      sessionId,
      productCount: cart.lineItems.length,
      subtotalCents: cart.subtotalCents,
      productTotalCents: cart.totalCents,
      shippingCents,
      totalCents: orderTotalCents,
      promoCodeApplied: cart.promoCodeApplied || null,
    });

    const stripe = getStripe();
    const pi = await stripe.paymentIntents.create({
      amount: orderTotalCents,
      currency,
      // Manual capture: authorize now, capture only after the gen-health
      // consult/order is created (POST unpaid → capture → PATCH paid). A consult
      // failure voids the authorization so the customer is never charged.
      capture_method: "manual",
      metadata: {
        source: "demo-landing",
        checkoutSessionId: sessionId,
        productCount: String(cart.lineItems.length),
      },
    });
    logger.info("checkoutHttp: Stripe PaymentIntent created", {
      paymentIntentId: pi.id,
      sessionId,
      totalCents: orderTotalCents,
    });

    await attachPaymentIntent(db, sessionId, {paymentIntentId: pi.id});

    await mergeFunnelCheckoutSessionId(db, funnelSessionId, sessionId);

    sendJson(res, 200, {
      success: true,
      data: {
        clientSecret: pi.client_secret,
        paymentIntentId: pi.id,
        sessionId,
        lineItems: cart.lineItems,
        subtotalCents: cart.subtotalCents,
        discountTotalCents: cart.discountTotalCents,
        productTotalCents: cart.totalCents,
        shippingCents,
        totalCents: orderTotalCents,
        amountCents: orderTotalCents,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isCartClientError(err)) {
      sendJson(res, 400, {success: false, error: msg});
      return;
    }
    logger.error("checkoutHttp: create-payment-intent failed", {
      error: msg,
      sessionId,
    });
    if (sessionId) {
      try {
        await markSessionFailed(db, sessionId, {
          message: msg,
          code: "create_payment_intent",
        });
      } catch (markErr) {
        logger.error(
            "checkoutHttp: markSessionFailed after create-payment-intent error",
            markErr,
        );
      }
    }
    sendJson(res, 500, {success: false, error: msg});
  }
}

// ---------------------------------------------------------------------------
// POST /confirm
// ---------------------------------------------------------------------------

async function handleConfirm(req, res) {
  const body = req.body || {};
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  let catalogProvider = normalizeCatalogProvider(body.catalog_provider);
  if (!catalogProvider && sessionId) {
    const sessionSnap = await db.collection(CHECKOUT_SESSIONS_COL).doc(sessionId).get();
    if (sessionSnap.exists) {
      catalogProvider = normalizeCatalogProvider(sessionSnap.get("catalog_provider"));
    }
  }
  if (catalogProvider === CATALOG_PROVIDER_DOTFIT) {
    sendJson(res, 400, {
      success: false,
      error: "Dotfit checkout is not supported on Leader Health",
    });
    return;
  }

  const {
    paymentIntentId,
    patient,
    promoCodeEntered,
    attributionSnapshot,
    funnelSessionId,
  } = body;
  let genHealthPatientId =
    typeof body.patientId === "string" ? body.patientId.trim() :
      typeof body.patient_id === "string" ? body.patient_id.trim() : "";

  logger.info("checkoutHttp: POST /confirm START", {
    paymentIntentId,
    sessionId,
    promoCodeEntered: promoCodeEntered || null,
    hasAttributionSnapshot: Boolean(attributionSnapshot),
    hasFunnelSessionId: Boolean(funnelSessionId),
    patientEmail:
      patient && typeof patient.email === "string" ? patient.email : null,
  });

  // -------------------------------------------------------------------------
  // §4.2 Validation gates — any failure returns 400, no Firestore writes yet.
  // -------------------------------------------------------------------------
  if (!paymentIntentId || typeof paymentIntentId !== "string") {
    sendJson(res, 400, {success: false, error: "paymentIntentId is required"});
    return;
  }
  if (!patient || typeof patient !== "object") {
    sendJson(res, 400, {success: false, error: "patient object is required"});
    return;
  }
  if (!sessionId) {
    sendJson(res, 400, {success: false, error: "sessionId is required"});
    return;
  }

  const required = ["email", "firstName", "lastName", "phone", "dateOfBirth"];
  for (const f of required) {
    if (
      !patient[f] ||
      typeof patient[f] !== "string" ||
      !patient[f].trim()
    ) {
      sendJson(res, 400, {
        success: false,
        error: `patient.${f} is required`,
      });
      return;
    }
  }
  const addr = patient.address || {};
  for (const f of ["street1", "city", "state", "zip"]) {
    if (!addr[f] || typeof addr[f] !== "string" || !addr[f].trim()) {
      sendJson(res, 400, {
        success: false,
        error: `patient.address.${f} is required`,
      });
      return;
    }
  }

  try {
    // -----------------------------------------------------------------------
    // §4.3 Session validation + idempotent replay
    // -----------------------------------------------------------------------
    logger.info("checkoutHttp: confirm — loading session", {sessionId});
    const sessionSnap = await db
        .collection(CHECKOUT_SESSIONS_COL)
        .doc(sessionId)
        .get();
    if (!sessionSnap.exists) {
      sendJson(res, 404, {
        success: false,
        error: "Checkout session not found",
      });
      return;
    }
    const sess = sessionSnap.data() || {};
    logger.info("checkoutHttp: confirm — session loaded", {
      sessionId,
      status: sess.status,
    });

    if (sess.status === SessionStatus.FAILED) {
      sendJson(res, 400, {
        success: false,
        error:
          typeof sess.failureMessage === "string" &&
          sess.failureMessage.trim() ?
            sess.failureMessage.trim() :
            "Checkout session failed earlier",
      });
      return;
    }

    // Idempotent replay: session already completed → return existing order.
    if (
      sess.status === SessionStatus.COMPLETED &&
      typeof sess.orderId === "string" &&
      sess.orderId.trim()
    ) {
      logger.info(
          "checkoutHttp: confirm — session already completed, idempotent replay",
          {sessionId, orderId: sess.orderId},
      );
      const existing = await db
          .collection(CHECKOUT_ORDERS_COL)
          .doc(sess.orderId.trim())
          .get();
      if (existing.exists) {
        const o = existing.data() || {};
        const consultOk = o.requestConsultSuccess === true;
        const legacyFulfillOk =
          o.fulfillment && o.fulfillment.status === "sent";
        const integrationOk = consultOk || legacyFulfillOk;
        const piStored =
          typeof o.paymentIntentId === "string" ?
            o.paymentIntentId :
            paymentIntentId;
        if (!integrationOk) {
          sendJson(res, 200, {
            success: true,
            warning:
              "Payment captured but consultation request failed. " +
              "Our team will follow up.",
            data: {
              orderId: sess.orderId.trim(),
              paymentIntentId: piStored,
              consultError:
                o.requestConsultError ||
                (o.fulfillment && o.fulfillment.error) ||
                "requestConsult failed previously",
              needsGenHealthPatientId: false,
            },
          });
          return;
        }
        const rcd =
          o.requestConsultData && typeof o.requestConsultData === "object" ?
            o.requestConsultData :
            null;
        sendJson(res, 200, {
          success: true,
          data: {
            orderId: sess.orderId.trim(),
            paymentIntentId: piStored,
            patientId:
              rcd && typeof rcd.patientId === "string" ? rcd.patientId : null,
            genHealthPatientIdUsed: o.genHealthPatientIdUsed || null,
            genHealthOrderId:
              rcd && typeof rcd.orderId === "string" ? rcd.orderId : null,
            paymentStatus:
              rcd && typeof rcd.paymentStatus === "string" ?
                rcd.paymentStatus :
                "paid",
            genHealthPatientIdSource:
              typeof o.genHealthPatientIdSource === "string" ?
                o.genHealthPatientIdSource :
                null,
            magicLink:
              typeof o.genHealthMagicLink === "string" &&
              o.genHealthMagicLink.trim() ?
                o.genHealthMagicLink.trim() : null,
            patientStatus:
              typeof o.ghPatientStatus === "string" ?
                o.ghPatientStatus.trim() : null,
          },
        });
        return;
      }
    }

    // Cross-check: client values must match what the session recorded.
    const sessPi =
      typeof sess.paymentIntentId === "string" ?
        sess.paymentIntentId.trim() :
        "";
    if (sessPi !== paymentIntentId.trim()) {
      sendJson(res, 400, {
        success: false,
        error: "paymentIntentId does not match checkout session",
      });
      return;
    }

    const lineItems = Array.isArray(sess.lineItems) ? sess.lineItems : [];
    const amountCents =
      typeof sess.totalCents === "number" ?
        Math.round(sess.totalCents) :
        typeof sess.amountCents === "number" ?
          Math.round(sess.amountCents) :
          0;
    if (lineItems.length === 0 || amountCents <= 0) {
      sendJson(res, 400, {
        success: false,
        error: "Checkout session is missing cart data",
      });
      return;
    }

    try {
      assertSessionLineItemsSingleUnit(lineItems);
    } catch (qtyErr) {
      const qm = qtyErr instanceof Error ? qtyErr.message : String(qtyErr);
      sendJson(res, 400, {success: false, error: qm});
      return;
    }

    const originalAmountCents =
      typeof sess.subtotalCents === "number" ?
        Math.round(sess.subtotalCents) :
        amountCents;
    const currency =
      typeof sess.currency === "string" && sess.currency.trim() ?
        sess.currency.trim().toLowerCase() :
        "usd";
    const promoCodeApplied =
      typeof sess.promoCodeApplied === "string" ? sess.promoCodeApplied.trim() : "";

    // -----------------------------------------------------------------------
    // §4.4 Stripe verification — PI status is the only authoritative signal.
    // -----------------------------------------------------------------------
    logger.info("checkoutHttp: confirm — retrieving PaymentIntent", {
      paymentIntentId,
    });
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    logger.info("checkoutHttp: confirm — PaymentIntent retrieved", {
      paymentIntentId,
      status: pi.status,
      amount: pi.amount,
    });

    // Manual capture: a fresh confirm arrives with the card authorized
    // (`requires_capture`); we capture it below only after the consult succeeds.
    // `succeeded` is still accepted for idempotent replays of an already-captured
    // order (and for any PI configured for automatic capture).
    if (pi.status !== "requires_capture" && pi.status !== "succeeded") {
      sendJson(res, 400, {
        success: false,
        error: `Payment not completed (status: ${pi.status})`,
      });
      return;
    }
    if (pi.amount !== amountCents) {
      sendJson(res, 400, {
        success: false,
        error: `Amount mismatch: expected ${amountCents} cents, PaymentIntent has ${pi.amount}`,
      });
      return;
    }

    const customerSnapshot = {
      email: patient.email.trim(),
      firstName: patient.firstName.trim(),
      lastName: patient.lastName.trim(),
      phone: patient.phone.trim(),
      dateOfBirth: patient.dateOfBirth.trim(),
      address: {
        street1: addr.street1.trim(),
        city: addr.city.trim(),
        state: addr.state.trim(),
        zip: addr.zip.trim(),
      },
    };

    // -----------------------------------------------------------------------
    // §4.6 Inner try/catch wraps everything after PI verification.
    // Any throw here marks the session FAILED (prevents stuck sessions).
    // -----------------------------------------------------------------------
    let consultRes = null;
    let consultJson = null;
    let genHealthPatientIdSource = null;
    let orderRef = null;
    let sessionShouldFailOnError = false;
    let ghOrderIds = [];
    let ghPatchStatus = "na";
    let ghPaymentStatus = null;
    let consultFailureError = null;

    try {
      sessionShouldFailOnError = true;

      await recordPaymentSuccess(db, sessionId, {
        paymentIntentId,
        customer: customerSnapshot,
        promoCodeEntered:
          typeof promoCodeEntered === "string" ? promoCodeEntered : "",
        attributionSnapshot,
      });

      const clientPatientsBase = getGenHealthClientPatientsBaseUrl();
      const apiKey = getGenHealthApiKey();
      const useApiOrders = true;
      logger.info("checkoutHttp: confirm — gen-health config", {
        useApiOrders,
        hasApiKey: Boolean(apiKey),
      });

      // v2 API expects per-line order amounts in major units (dollars), not cents.
      const orderPayload = {
        productIds: lineItems.map((item) => {
          const row = /** @type {Record<string, unknown>} */ (item);
          const finalCents =
            typeof row.finalPriceCents === "number" && Number.isFinite(row.finalPriceCents) ?
              Math.round(row.finalPriceCents) :
              0;
          return {
            clientProductId: String(row.clientProductId || ""),
            amount: Number((finalCents / 100).toFixed(2)),
          };
        }),
        // Created unpaid — flipped to "paid" via PATCH after Stripe capture.
        payment_status: "unpaid",
      };

      const couponCode = resolveCouponCodeForConsult(
          lineItems,
          typeof promoCodeEntered === "string" ? promoCodeEntered : "",
          promoCodeApplied,
      );
      if (couponCode) orderPayload.couponCode = couponCode;

      const attrParsed = parseClientAttributionSnapshot(attributionSnapshot);
      if (attrParsed.source) {
        orderPayload.tracking = {
          utmSource: attrParsed.source,
          utmMedium: attrParsed.medium || "affiliate",
          utmCampaign: attrParsed.campaign || "",
        };
      }

      const patientPayload = {
        email: customerSnapshot.email,
        firstName: customerSnapshot.firstName,
        lastName: customerSnapshot.lastName,
        phone: customerSnapshot.phone,
        dateOfBirth: customerSnapshot.dateOfBirth,
        address: {...customerSnapshot.address},
      };

      if (genHealthPatientId) {
        genHealthPatientIdSource = "request_body";
        logger.info("checkoutHttp: confirm — patientId in body", {genHealthPatientId});
      } else {
        logger.info("checkoutHttp: confirm — patient lookup by email", {
          email: patientPayload.email,
        });
        const lookedUp = await fetchPatientIdByEmail(
            clientPatientsBase,
            apiKey,
            patientPayload.email,
        );
        if (lookedUp) {
          genHealthPatientId = lookedUp;
          genHealthPatientIdSource = "clientPatients_email";
        }
      }

      let attributionBlock = {
        rawUtm: {source: null, medium: null, campaign: null},
        utmSnapshot: {
          capturedAtMs: null,
          clientWindowSeconds: 30 * 60,
          utmResolutionNote: "error",
        },
        promoCodeEntered: null,
        anchorAffiliateId: null,
        rootSuperAffiliateId: null,
        chain: [],
        totalChainCommissionCents: 0,
        affiliateIdResolved: null,
        attributionStatus: "unattributed",
        attributionReason: "attribution_resolution_error",
        commissionEligible: false,
        commissionRateSnapshot: null,
        commissionTypeSnapshot: null,
        commissionFixedCentsSnapshot: null,
      };
      try {
        logger.info("checkoutHttp: confirm — resolving attribution", {
          promoCodeEntered: promoCodeEntered || null,
        });
        const resolved = await resolveCheckoutAttribution(db, {
          attributionSnapshot,
          promoCodeEntered,
          allowNoPromoUtm: attributionAllowNoPromoUtm,
          originalAmountCents,
        });
        attributionBlock =
          /** @type {Record<string, unknown>} */ (resolved.attribution);
        logger.info("checkoutHttp: confirm — attribution resolved", {
          attributionStatus: attributionBlock.attributionStatus,
          anchorAffiliateId: attributionBlock.anchorAffiliateId,
          rootSuperAffiliateId: attributionBlock.rootSuperAffiliateId,
          chainLength: Array.isArray(attributionBlock.chain) ?
            attributionBlock.chain.length :
            0,
          commissionEligible: attributionBlock.commissionEligible,
        });
      } catch (attrErr) {
        const msg =
          attrErr instanceof Error ? attrErr.message : String(attrErr);
        logger.error(
            "checkoutHttp: confirm — attribution resolution failed (non-fatal)",
            {error: msg},
        );
      }

      const pendingOrderDoc = buildOrderDoc({
        sessionId,
        paymentIntentId,
        genHealthPatientIdUsed: genHealthPatientId || null,
        genHealthPatientIdSource,
        lineItems,
        totalCents: amountCents,
        subtotalCents: originalAmountCents,
        currency,
        customer: customerSnapshot,
        stripeStatus: pi.status,
        useApiOrders,
        consultRes: /** @type {{ status: number }} */ ({status: 0}),
        consultJson: /** @type {Record<string, unknown>} */ ({
          success: false,
          pending: true,
        }),
        attribution: attributionBlock,
        genHealthMagicLink: null,
        ghPatientStatus: null,
      });
      orderRef = await writeOrder(db, pendingOrderDoc);
      logger.info("checkoutHttp: order saved (pre-consult)", {
        orderId: orderRef.id,
        sessionId,
        paymentIntentId,
      });

      logger.info("checkoutHttp: confirm — calling postConsultV2", {
        paymentIntentId,
        genHealthPatientId: genHealthPatientId || null,
        genHealthPatientIdSource,
        amountCents,
        productCount: lineItems.length,
        hasCouponCode: Boolean(couponCode),
        hasTracking: Boolean(orderPayload.tracking),
      });
      const consultBody = buildConsultRequestBody(
          patientPayload,
          orderPayload,
          genHealthPatientId,
      );
      const consultPair = await postConsultV2(genHealthPatientId || null, consultBody);
      consultRes = consultPair.consultRes;
      consultJson = consultPair.consultJson;
      logger.info("checkoutHttp: confirm — postConsultV2 response received", {
        status: consultRes && consultRes.status,
        success:
          consultJson && typeof consultJson === "object" ?
            consultJson.success :
            undefined,
      });

      const consultEarly =
        consultJson && typeof consultJson === "object" ?
          /** @type {Record<string, unknown>} */ (consultJson) :
          null;
      const consultSucceeded = Boolean(
          consultEarly && consultEarly.success === true,
      );
      const consultDataEarly =
        consultEarly && consultEarly.data && typeof consultEarly.data === "object" ?
          /** @type {Record<string, unknown>} */ (consultEarly.data) :
          null;

      if (consultSucceeded) {
        const pidFromConsult =
          consultDataEarly && typeof consultDataEarly.patientId === "string" &&
          consultDataEarly.patientId.trim() ?
            consultDataEarly.patientId.trim() :
            consultDataEarly && typeof consultDataEarly.patient_id === "string" &&
            consultDataEarly.patient_id.trim() ?
              consultDataEarly.patient_id.trim() :
              "";
        if (!genHealthPatientId && pidFromConsult) {
          genHealthPatientId = pidFromConsult;
          if (!genHealthPatientIdSource) {
            genHealthPatientIdSource = "request_consult_created";
          }
        }
      }

      ghOrderIds = consultSucceeded ? extractGhOrderIds(consultDataEarly) : [];

      if (!consultSucceeded) {
        // ---------------------------------------------------------------------
        // Consult/order creation failed upstream. Void the Stripe authorization
        // so the customer is NOT charged, record the failure on the order, and
        // fail the session. The error response is sent after the try block.
        // ---------------------------------------------------------------------
        const errStr =
          consultEarly && typeof consultEarly.error === "string" ?
            consultEarly.error :
            "";
        consultFailureError =
          errStr && errStr.trim() ?
            errStr.trim() :
            `requestConsult HTTP ${consultRes && consultRes.status}`;
        logger.warn("checkoutHttp: requestConsult failed — voiding authorization", {
          status: consultRes && consultRes.status,
          error: consultFailureError,
          orderId: orderRef.id,
        });
        if (pi.status === "requires_capture") {
          try {
            await stripe.paymentIntents.cancel(paymentIntentId);
            logger.info("checkoutHttp: PI authorization voided", {paymentIntentId});
          } catch (voidErr) {
            logger.error("checkoutHttp: failed to void PI after consult failure", {
              paymentIntentId,
              error: voidErr instanceof Error ? voidErr.message : String(voidErr),
            });
          }
        }
        await orderRef.update({
          genHealthPatientIdUsed: genHealthPatientId || null,
          genHealthPatientIdSource,
          requestConsultStatus:
            consultRes && typeof consultRes.status === "number" ?
              consultRes.status :
              0,
          requestConsultSuccess: false,
          requestConsultData: null,
          requestConsultError: consultFailureError,
          paymentCaptured: false,
          ghPaymentStatus: null,
          ghPatchStatus: "na",
        });
        await markSessionFailed(db, sessionId, {
          message: consultFailureError,
          code: "consult_failed",
        });
      } else {
        // ---------------------------------------------------------------------
        // Consult/order created upstream. Capture the authorized payment, then
        // PATCH the upstream order to "paid". A PATCH failure after capture is
        // logged for manual follow-up (customer is charged; order shows unpaid).
        // ---------------------------------------------------------------------
        let capturedStripeStatus = pi.status;
        if (pi.status === "requires_capture") {
          const captured = await stripe.paymentIntents.capture(paymentIntentId);
          capturedStripeStatus =
            captured && typeof captured.status === "string" ?
              captured.status :
              "succeeded";
          logger.info("checkoutHttp: PI captured after consult success", {
            paymentIntentId,
            stripeStatus: capturedStripeStatus,
          });
        }
        ghPaymentStatus = "unpaid";

        const primaryGhOrderId = ghOrderIds[0] ? String(ghOrderIds[0]).trim() : "";
        if (!primaryGhOrderId) {
          logger.warn("checkoutHttp: consult succeeded but no ghOrderIds returned", {
            orderId: orderRef.id,
            paymentIntentId,
          });
        } else {
          try {
            const {patchRes, patchJson} = await patchOrderV2(primaryGhOrderId, {
              payment_status: "paid",
              transaction_id: paymentIntentId,
            });
            if (patchJson && typeof patchJson === "object" &&
              patchJson.success === true) {
              ghPatchStatus = "success";
              ghPaymentStatus = "paid";
              logger.info("checkoutHttp: upstream order marked paid", {
                orderId: primaryGhOrderId,
              });
            } else {
              ghPatchStatus = "failed";
              logger.error("checkoutHttp: PATCH order paid failed (already captured)", {
                orderId: primaryGhOrderId,
                paymentIntentId,
                status: patchRes && patchRes.status,
                error:
                  patchJson && typeof patchJson === "object" &&
                  typeof patchJson.error === "string" ?
                    patchJson.error :
                    "Unknown error",
              });
            }
          } catch (patchErr) {
            ghPatchStatus = "failed";
            logger.error("checkoutHttp: PATCH order paid threw (already captured)", {
              orderId: primaryGhOrderId,
              paymentIntentId,
              error: patchErr instanceof Error ? patchErr.message : String(patchErr),
            });
          }
        }

        await recordConsultRequest(db, sessionId, {
          genHealthPatientId,
          genHealthPatientIdSource,
        });

        const consultForOrder =
          consultJson && typeof consultJson === "object" ?
            /** @type {Record<string, unknown>} */ (consultJson) :
            /** @type {Record<string, unknown>} */ ({});
        const consultDataBlock =
          consultForOrder.data && typeof consultForOrder.data === "object" ?
            /** @type {Record<string, unknown>} */ (consultForOrder.data) :
            null;
        const magicLink =
          consultDataBlock && typeof consultDataBlock.magicLink === "string" &&
          consultDataBlock.magicLink.trim() ?
            consultDataBlock.magicLink.trim() :
            null;
        const patientStatus =
          consultDataBlock && typeof consultDataBlock.patientStatus === "string" ?
            consultDataBlock.patientStatus.trim() :
            null;

        const orderDoc = {
          ...pendingOrderDoc,
          // Reflect the post-capture Stripe status (dashboard's Paid pill reads
          // stripeStatus === "succeeded"). The pending doc held "requires_capture".
          stripeStatus: capturedStripeStatus,
          genHealthPatientIdUsed: genHealthPatientId || null,
          genHealthPatientIdSource,
          ghOrderIds,
          ghPrimaryOrderId: primaryGhOrderId || null,
          requestConsultStatus:
            consultRes && typeof consultRes.status === "number" ?
              consultRes.status :
              0,
          requestConsultSuccess: true,
          requestConsultData: consultForOrder.data || null,
          requestConsultError: null,
          paymentCaptured: true,
          ghPaymentStatus,
          ghPatchStatus,
          genHealthMagicLink: magicLink,
          ghPatientStatus: patientStatus,
        };
        await orderRef.update(orderDoc);
        await writeAffiliateOrderProjection(db, {
          orderId: orderRef.id,
          orderData: orderDoc,
        });
        await completeSession(db, sessionId, {orderId: orderRef.id});

        logger.info("checkoutHttp: order saved", {
          orderId: orderRef.id,
          sessionId,
          paymentIntentId,
          consultStatus: consultRes && consultRes.status,
          ghPatchStatus,
        });
        await mergeFunnelOrderPlaced(db, funnelSessionId, {
          orderId: orderRef.id,
          paymentIntentId,
          checkoutSessionId: sessionId,
        });
      }
    } catch (innerErr) {
      const im =
        innerErr instanceof Error ? innerErr.message : String(innerErr);
      logger.error(
          "checkoutHttp: confirm — inner error during ledger/consult phase",
          {error: im, sessionId, paymentIntentId},
      );
      if (sessionShouldFailOnError) {
        try {
          await markSessionFailed(db, sessionId, {
            message: im,
            code: "confirm_ledger",
          });
        } catch (markErr) {
          logger.error(
              "checkoutHttp: markSessionFailed after confirm error",
              markErr,
          );
        }
      }
      throw innerErr;
    }

    if (!orderRef) {
      throw new Error(
          "checkoutHttp: internal error — order reference missing after confirm",
      );
    }
    const ref = orderRef;

    const consultObj =
      consultJson && typeof consultJson === "object" ?
        /** @type {Record<string, unknown>} */ (consultJson) :
        null;
    const consultSuccess = consultObj && consultObj.success === true;

    if (!consultSuccess) {
      // The consult failed and the authorization was voided in the try block —
      // the customer was NOT charged. Return a hard error so they can retry.
      const consultErr =
        consultFailureError ||
        `requestConsult HTTP ${consultRes && consultRes.status}`;
      sendJson(res, 502, {
        success: false,
        error:
          "We couldn't create your consultation, so your card was not charged. " +
          "Please try again.",
        data: {
          orderId: ref.id,
          consultError: consultErr,
        },
      });
      return;
    }

    const dataBlock =
      consultObj && typeof consultObj.data === "object" && consultObj.data !== null ?
        /** @type {Record<string, unknown>} */ (consultObj.data) :
        null;

    sendJson(res, 200, {
      success: true,
      data: {
        orderId: ref.id,
        paymentIntentId,
        patientId:
          dataBlock && typeof dataBlock.patientId === "string" ?
            dataBlock.patientId :
            null,
        genHealthPatientIdUsed: genHealthPatientId || null,
        genHealthOrderId:
          (ghOrderIds[0] ? String(ghOrderIds[0]).trim() : null) ||
          (dataBlock && typeof dataBlock.orderId === "string" ?
            dataBlock.orderId :
            null),
        paymentStatus:
          ghPaymentStatus ||
          (dataBlock && typeof dataBlock.paymentStatus === "string" ?
            dataBlock.paymentStatus :
            "paid"),
        ghPatchStatus,
        genHealthPatientIdSource,
        magicLink:
          dataBlock && typeof dataBlock.magicLink === "string" &&
          dataBlock.magicLink.trim() ?
            dataBlock.magicLink.trim() :
            null,
        patientStatus:
          dataBlock && typeof dataBlock.patientStatus === "string" ?
            dataBlock.patientStatus.trim() :
            null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("checkoutHttp: confirm FAILED", {
      error: msg,
      sessionId,
      paymentIntentId,
    });
    sendJson(res, 500, {success: false, error: msg});
  }
}

// ---------------------------------------------------------------------------
// POST /bootstrap
// ---------------------------------------------------------------------------

async function handleBootstrap(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (isDotfitProvider(body.catalog_provider)) {
    sendJson(res, 400, {
      success: false,
      error: "Dotfit bootstrap is not supported on Leader Health",
    });
    return;
  }

  const clientProductId =
    typeof body.clientProductId === "string" ?
      body.clientProductId.trim() :
      typeof body.productId === "string" ?
        body.productId.trim() :
        "";
  const data = await bootstrapGenHealthCheckout(clientProductId);
  const status = data.errors.length > 0 ? 400 : 200;
  sendJson(res, status, {success: data.errors.length === 0, data});
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function checkoutHttpHandler(req, res) {
  const path = (req.path || "/").replace(/\/+$/, "");

  if (path.endsWith("/bootstrap")) {
    if (req.method !== "POST") {
      sendJson(res, 405, {success: false, error: "Method not allowed"});
      return;
    }
    await handleBootstrap(req, res);
    return;
  }

  if (path.endsWith("/create-payment-intent")) {
    if (req.method !== "POST") {
      sendJson(res, 405, {success: false, error: "Method not allowed"});
      return;
    }
    await handleCreatePaymentIntent(req, res);
    return;
  }

  if (path.endsWith("/confirm")) {
    if (req.method !== "POST") {
      sendJson(res, 405, {success: false, error: "Method not allowed"});
      return;
    }
    await handleConfirm(req, res);
    return;
  }

  sendJson(res, 404, {success: false, error: "Not found"});
}

exports.checkoutHttp = checkoutHttpHandler;

/* eslint-enable valid-jsdoc, max-len, require-jsdoc */
