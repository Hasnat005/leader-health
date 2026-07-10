/**
 * @param {*} res HTTP response
 * @param {number} status HTTP status
 * @param {*} body JSON body
 */
function sendJson(res, status, body) {
  res.status(status).json(body);
}

module.exports = {sendJson};
