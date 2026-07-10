/**
 * Upstream gen-health catalog REST helpers.
 *
 * Auth: use `X-API-Key` for the client secret (not Bearer). See Client API doc.
 * URLs: each export is its own Cloud Run host; path is usually `/` or
 * `/?query` — not `.../clientProducts` on a shared host unless yours does.
 */

const logger = require("firebase-functions/logger");
const config = require("../config");

const FETCH_TIMEOUT_MS = 60000;
const ORDER_API_TIMEOUT_MS = 30000;

/**
 * JSON GET helper for gen-health endpoints.
 * @param {string} url Request URL
 * @param {Object=} extraHeaders Extra headers
 * @return {Promise<Object>} Parsed JSON body
 */
async function fetchJson(url, extraHeaders = {}) {
  const key = (
    process.env.GEN_HEALTH_API_KEY ||
    (config.genHealthApi && config.genHealthApi.apiKey) ||
    ""
  ).trim();
  if (!key) {
    throw new Error("genHealthApi.apiKey is not configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": key,
        "Accept": "application/json",
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (e) {
      logger.error("genHealthApi: invalid_json", {url, status: res.status});
      throw new Error("Upstream returned non-JSON");
    }
    if (!res.ok) {
      logger.error("genHealthApi: http_error", {
        url,
        status: res.status,
        bodyPreview: text && text.slice(0, 200),
      });
      throw new Error("Upstream HTTP " + res.status);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @return {Promise<Array<{ categoryId: string, categoryName: string }>>}
 */
async function fetchCategories() {
  const url = buildV2Url("/v2/client/categories");
  logger.info("genHealthApi: GET /v2/client/categories", {url});
  const res = await fetch(url, {headers: jsonHeaders()});
  if (!res.ok) {
    logger.error("genHealthApi: categories HTTP error", {status: res.status});
    throw new Error(`fetchCategories failed: ${res.status}`);
  }
  const json = await res.json();
  if (!json?.success || !Array.isArray(json?.data?.categories)) {
    logger.error("genHealthApi: categories invalid JSON shape");
    throw new Error("fetchCategories: invalid response");
  }
  logger.info("genHealthApi: categories OK", {
    count: json.data.categories.length,
  });
  return json.data.categories;
}

/**
 * Paginated flat product list from v2 API.
 *
 * @return {Promise<Array<Record<string, unknown>>>}
 */
async function fetchProducts() {
  const byId = new Map();
  let cursor = null;
  let page = 0;
  do {
    const query = {limit: "100"};
    if (cursor) query.startAfter = cursor;
    const url = buildV2Url("/v2/client/products", query);
    logger.info("genHealthApi: GET /v2/client/products page", {
      page,
      cursor: cursor || null,
    });
    const res = await fetch(url, {headers: jsonHeaders()});
    if (!res.ok) {
      logger.error("genHealthApi: products HTTP error", {
        status: res.status,
        page,
      });
      throw new Error(`fetchProducts failed: ${res.status}`);
    }
    const json = await res.json();
    if (!json?.success || !Array.isArray(json?.data?.products)) {
      logger.error("genHealthApi: products invalid JSON shape", {page});
      throw new Error("fetchProducts: invalid response");
    }
    for (const p of json.data.products) {
      const pid =
        p && typeof p.clientProductId === "string" ?
          p.clientProductId.trim() :
          "";
      if (pid) byId.set(pid, p);
    }
    const pagination =
      json.data.pagination && typeof json.data.pagination === "object" ?
        json.data.pagination :
        null;
    const hasMore = Boolean(pagination?.hasMore);
    cursor = hasMore && pagination?.nextCursor != null ?
      String(pagination.nextCursor) :
      null;
    page++;
    if (!hasMore) cursor = null;
  } while (cursor);

  const merged = [...byId.values()];
  logger.info("genHealthApi: products OK", {
    uniqueProductCount: merged.length,
    pages: page,
  });
  return merged;
}

/**
 * @return {string}
 */
function getGenHealthApiKey() {
  const ghApiKey =
    config.genHealthApi && config.genHealthApi.apiKey != null ?
      config.genHealthApi.apiKey : "";
  const rawKey = process.env.GEN_HEALTH_API_KEY || ghApiKey;
  const key = String(rawKey).trim();
  if (!key) {
    throw new Error(
        "genHealthApi.apiKey is not set in firebase/functions/config.js",
    );
  }
  return key;
}

/**
 * @return {string}
 */
function getGenHealthClientPatientsBaseUrl() {
  const raw =
    config.genHealthApi && config.genHealthApi.clientPatientsUrl != null ?
      config.genHealthApi.clientPatientsUrl :
      "";
  const u = String(raw).trim();
  if (!u) {
    throw new Error("genHealthApi.clientPatientsUrl is not set in config.js");
  }
  return u.replace(/\/$/, "");
}

/**
 * @param {string} consultUrl
 * @param {string} apiKey
 * @param {Record<string, unknown>} consultBody
 * @return {Promise<{ consultRes: { status: number }, consultJson: unknown }>}
 */
async function postRequestConsult(consultUrl, apiKey, consultBody) {
  const consultRes = await fetch(consultUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(consultBody),
  });
  const consultJson = await consultRes.json().catch(() => null);
  return {consultRes, consultJson};
}

/**
 * @param {string} clientPatientsBase
 * @param {string} apiKey
 * @param {string} email
 * @return {Promise<string | null>}
 */
async function fetchPatientIdByEmail(clientPatientsBase, apiKey, email) {
  const em = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!em) return null;
  try {
    const base = clientPatientsBase.replace(/\/$/, "");
    const url = `${base}/?email=${encodeURIComponent(em)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {"accept": "application/json", "x-api-key": apiKey},
    });
    const json = await res.json().catch(() => null);
    if (!json || json.success !== true) return null;
    const data = json.data && typeof json.data === "object" ? json.data : null;
    if (!data || !data.patient || typeof data.patient !== "object") {
      return null;
    }
    const p = /** @type {Record<string, unknown>} */ (data.patient);
    const candidates = [
      typeof p.patientId === "string" && p.patientId.trim(),
      typeof p.patient_id === "string" && p.patient_id.trim(),
      typeof p.id === "string" && p.id.trim(),
      typeof p.partnerPatientId === "string" && p.partnerPatientId.trim(),
    ];
    const hit = candidates.find((s) => Boolean(s));
    return hit ? String(hit) : null;
  } catch (e) {
    logger.warn("genHealthApi: clientPatients email lookup failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API v2 helpers (promo sync + PATCH mirror)
// ---------------------------------------------------------------------------

/**
 * @return {string}
 */
function getPublicApiBaseUrl() {
  const base =
    config.genHealthApi && config.genHealthApi.publicApiBaseUrl != null ?
      String(config.genHealthApi.publicApiBaseUrl).trim() :
      "";
  if (!base) {
    throw new Error(
        "genHealthApi.publicApiBaseUrl is not set in config.js",
    );
  }
  return base.replace(/\/$/, "");
}

/**
 * @param {boolean} [json]
 * @return {Object<string, string>}
 */
function jsonHeaders(json = false) {
  const key = getGenHealthApiKey();
  const h = {
    "Accept": "application/json",
    "X-API-Key": key,
  };
  if (json) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

/**
 * @param {string} path
 * @param {Record<string, string>} [query]
 * @return {string}
 */
function buildV2Url(path, query) {
  const base = getPublicApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${p}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && String(v).length > 0) {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

/**
 * @return {Promise<Array<Record<string, unknown>>>}
 */
async function fetchPromocodes() {
  const all = [];
  let cursor = null;
  let page = 0;
  do {
    const query = {limit: "100"};
    if (cursor) query.startAfter = cursor;
    const url = buildV2Url("/v2/client/promocodes", query);
    logger.info("genHealthApi: GET promocodes page", {
      page,
      cursor: cursor || null,
    });
    const res = await fetch(url, {headers: jsonHeaders()});
    if (!res.ok) {
      logger.error("genHealthApi: promocodes HTTP error", {
        status: res.status,
        page,
      });
      throw new Error(`fetchPromocodes failed: ${res.status}`);
    }
    const json = await res.json().catch(() => null);
    if (!json?.success || !Array.isArray(json?.data?.promocodes)) {
      logger.error("genHealthApi: promocodes invalid JSON shape", {page});
      throw new Error("fetchPromocodes: invalid response");
    }
    all.push(...json.data.promocodes);
    const pagination =
      json.data.pagination && typeof json.data.pagination === "object" ?
        json.data.pagination :
        null;
    const hasMore = Boolean(pagination?.hasMore);
    cursor = hasMore && pagination?.nextCursor != null ?
      String(pagination.nextCursor) :
      null;
    page++;
    if (!hasMore) cursor = null;
  } while (cursor);

  logger.info("genHealthApi: promocodes OK", {count: all.length, pages: page});
  return all;
}

/**
 * POST /v2/client/promocodes/validations — live promo validity + pricing check.
 *
 * @param {string} code Normalized promo code
 * @param {string} clientProductId
 * @return {Promise<{
 *   valid: boolean,
 *   reasonCodes: unknown[],
 *   pricing: unknown,
 *   promocode: unknown,
 * }>}
 */
async function validatePromocodeOnGH(code, clientProductId) {
  const c = typeof code === "string" ? code.trim() : "";
  const pid = typeof clientProductId === "string" ? clientProductId.trim() : "";
  if (!c || !pid) {
    return {
      valid: false,
      reasonCodes: ["invalid_request"],
      pricing: null,
      promocode: null,
    };
  }
  const url = buildV2Url("/v2/client/promocodes/validations");
  logger.info("genHealthApi: POST promocode validation", {
    code: c,
    clientProductId: pid,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(true),
    body: JSON.stringify({code: c, clientProductId: pid}),
  });
  const json = await res.json().catch(() => null);
  if (res.status === 400 || (json && json.success === false)) {
    const data = json && typeof json.data === "object" ? json.data : null;
    const reasonCodes =
      data && Array.isArray(data.reasonCodes) ? data.reasonCodes : [];
    return {valid: false, reasonCodes, pricing: null, promocode: null};
  }
  if (!res.ok || !json?.success) {
    throw new Error(`validatePromocodeOnGH failed: HTTP ${res.status}`);
  }
  const data = json.data && typeof json.data === "object" ? json.data : {};
  const pricing =
    data.pricing && typeof data.pricing === "object" ? data.pricing : null;
  const promocode =
    data.promocode && typeof data.promocode === "object" ?
      data.promocode :
      null;
  return {
    valid: data.valid === true,
    reasonCodes: Array.isArray(data.reasonCodes) ? data.reasonCodes : [],
    pricing,
    promocode,
  };
}

/**
 * POST /v2/client/patients/{patientId}/consults — paid order + patient create.
 *
 * @param {string|null|undefined} patientId GH id; falsy means "new"
 * @param {Record<string, unknown>} body Consult request body
 * @return {Promise<{ consultRes: Response, consultJson: unknown }>}
 */
async function postConsultV2(patientId, body) {
  const segment = patientId && String(patientId).trim() ?
    encodeURIComponent(String(patientId).trim()) :
    "new";
  const url = buildV2Url(`/v2/client/patients/${segment}/consults`);
  logger.info("genHealthApi: POST v2 consult", {patientSegment: segment});
  const res = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(true),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return {consultRes: res, consultJson: json};
}

/**
 * PATCH /v2/client/orders/:orderId — mutate an upstream order (e.g. mark paid).
 *
 * @param {string} orderId Gen-Health order id from the consult response
 * @param {Record<string, unknown>} body PATCH body
 * @return {Promise<{ patchRes: Response, patchJson: unknown }>}
 */
async function patchOrderV2(orderId, body) {
  const oid = typeof orderId === "string" ? orderId.trim() : "";
  if (!oid) throw new Error("patchOrderV2: orderId is required");
  const url = buildV2Url(`/v2/client/orders/${encodeURIComponent(oid)}`);
  logger.info("genHealthApi: PATCH order", {orderId: oid});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORDER_API_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: jsonHeaders(true),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    return {patchRes: res, patchJson: json};
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /v2/client/orders/:orderId — fetch current upstream order state.
 *
 * @param {string} orderId Gen-Health order id
 * @return {Promise<{ getRes: Response, getJson: unknown }>}
 */
async function getOrderV2(orderId) {
  const oid = typeof orderId === "string" ? orderId.trim() : "";
  if (!oid) throw new Error("getOrderV2: orderId is required");
  const url = buildV2Url(`/v2/client/orders/${encodeURIComponent(oid)}`);
  logger.info("genHealthApi: GET order", {orderId: oid});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORDER_API_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: jsonHeaders(true),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    return {getRes: res, getJson: json};
  } finally {
    clearTimeout(timer);
  }
}

/**
 * PATCH /v2/client/orders/:orderId — cancel an upstream order.
 *
 * @param {string} orderId Gen-Health order id
 * @return {Promise<{ patchRes: Response, patchJson: unknown }>}
 */
async function cancelOrderV2(orderId) {
  return patchOrderV2(orderId, {status: "cancelled"});
}

/**
 * @param {string} code Normalized promo code
 * @param {Record<string, unknown>} body PATCH body
 * @return {Promise<Record<string, unknown>>}
 */
async function patchPromocodeToGenHealth(code, body) {
  const c = typeof code === "string" ? code.trim() : "";
  if (!c) throw new Error("patchPromocodeToGenHealth: code is required");
  const url = buildV2Url(`/v2/client/promocodes/${encodeURIComponent(c)}`);
  logger.info("genHealthApi: PATCH promocode", {code: c});
  const res = await fetch(url, {
    method: "PATCH",
    headers: jsonHeaders(true),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const errMsg =
      json && typeof json.error === "string" && json.error.trim() ?
        json.error.trim() :
        `patchPromocode failed: HTTP ${res.status}`;
    logger.error("genHealthApi: PATCH promocode failed", {
      code: c,
      status: res.status,
      error: errMsg,
    });
    throw new Error(errMsg);
  }
  const promo =
    json.data?.promocode && typeof json.data.promocode === "object" ?
      /** @type {Record<string, unknown>} */ (json.data.promocode) :
      /** @type {Record<string, unknown>} */ ({});
  return promo;
}

module.exports = {
  fetchCategories,
  fetchProducts,
  fetchJson,
  fetchPromocodes,
  patchPromocodeToGenHealth,
  validatePromocodeOnGH,
  postConsultV2,
  patchOrderV2,
  getOrderV2,
  cancelOrderV2,
  getPublicApiBaseUrl,
  buildV2Url,
  getGenHealthApiKey,
  getGenHealthClientPatientsBaseUrl,
  postRequestConsult,
  fetchPatientIdByEmail,
};
