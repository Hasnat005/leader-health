/**
 * Bulk affiliate provisioning: Auth + Users/{uid}, role affiliate.
 * Does NOT create AffiliateProfiles (docs §6.2).
 * Run: npm run seed:affiliates (from firebase/functions).
 */
const {auth, db} = require("../utils/Firebase");

const ROLE = "affiliate";

/** @type {{ email: string, password: string, displayName: string }[]} */
const AFFILIATES = [
  // Example:
  // {
  //   email: "partner@example.com",
  //   password: "change-me",
  //   displayName: "Partner One",
  // },
  {
    email: "sixtyagent2@gmail.com",
    password: "test123",
    displayName: "Jason Brown",
  },
];

/**
 * @param {{ email: string, password: string, displayName: string }} row
 * @return {Promise<void>}
 */
async function upsertAffiliate(row) {
  let userRecord;
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
    } else {
      throw e;
    }
  }

  const uid = userRecord.uid;
  await db.collection("Users").doc(uid).set(
      {
        displayName: row.displayName,
        email: row.email,
        role: ROLE,
      },
      {merge: true},
  );

  // eslint-disable-next-line no-console
  console.log(`OK Users/${uid} (${row.email}) role=${ROLE}`);
}

/** @return {Promise<void>} */
async function main() {
  if (!AFFILIATES.length) {
    // eslint-disable-next-line no-console
    console.log(
        "No AFFILIATES entries. Edit scripts/create-affiliate-accounts.js.",
    );
    return;
  }
  for (const row of AFFILIATES) {
    await upsertAffiliate(row);
  }
  // eslint-disable-next-line no-console
  console.log("create-affiliate-accounts done.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
