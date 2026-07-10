/**
 * Idempotent seed: creates Auth users (if missing) and upserts Users/{uid}.
 * Run: npm run seed:dashboard-users (from firebase/functions).
 * Targets affiliate-demo-9b56a via firebaseServiceAccount or
 * GOOGLE_APPLICATION_CREDENTIALS.
 * @see docs/01-rbac-access-control.md §6.1
 */
const {auth, db} = require("../utils/Firebase");

const ALLOWED_ROLES = new Set(["affiliate", "super_admin"]);

/**
 * @type {Array<{
 *   email: string,
 *   password: string,
 *   displayName: string,
 *   role: string,
 * }>}
 */
const SUPER_ADMINS = [
  {
    email: "raff@labthree.org",
    password: "test1234",
    displayName: "Raff Hoque",
    role: "super_admin",
  },
  {
    email: "abuhasan@labthree.org",
    password: "test1234",
    displayName: "Abu Hasan",
    role: "super_admin",
  },
  {
    email: "fahmid@labthree.org",
    password: "test1234",
    displayName: "Fahmid",
    role: "super_admin",
  },
];

/**
 * @param {{
 *   email: string,
 *   password: string,
 *   displayName: string,
 *   role: string
 * }} row
 * @return {Promise<void>}
 */
async function upsertDashboardUser(row) {
  if (!ALLOWED_ROLES.has(row.role)) {
    throw new Error(`Invalid role: ${row.role}`);
  }

  let userRecord;
  let created = false;
  try {
    userRecord = await auth.getUserByEmail(row.email);
  } catch (e) {
    if (e && e.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email: row.email,
        password: row.password,
        displayName: row.displayName,
        emailVerified: true,
      });
      created = true;
    } else {
      throw e;
    }
  }

  if (!created) {
    await auth.updateUser(userRecord.uid, {
      password: row.password,
      displayName: row.displayName,
      emailVerified: true,
    });
  }

  const uid = userRecord.uid;
  await db.collection("Users").doc(uid).set(
      {
        displayName: row.displayName,
        email: row.email,
        role: row.role,
      },
      {merge: true},
  );

  const action = created ? " (created)" : " (updated)";
  // eslint-disable-next-line no-console
  console.log(`OK Users/${uid} (${row.email}) role=${row.role}${action}`);
}

/** @return {Promise<void>} */
async function main() {
  for (const row of SUPER_ADMINS) {
    await upsertDashboardUser(row);
  }
  // eslint-disable-next-line no-console
  console.log("seed-dashboard-users done.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
