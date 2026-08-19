/* ============================================================================
   FIREBASE CONFIG — Braelinn Poker League
   ----------------------------------------------------------------------------
   Live config for the "braelinn" Firebase project. Realtime Database is in
   us-central1 and the security rules from firebase-rules.json are published.

   These keys are PUBLIC BY DESIGN. They ship to every browser that loads the
   app, so committing them here is expected and fine. Security comes from the
   database rules, never from hiding these. See SECURITY.md.
   ========================================================================== */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCGCMCzwNkFN5VgcmFZWFd-OP6X34RYb7I",
  authDomain:        "braelinn.firebaseapp.com",
  databaseURL:       "https://braelinn-default-rtdb.firebaseio.com",
  projectId:         "braelinn",
  storageBucket:     "braelinn.firebasestorage.app",
  messagingSenderId: "924393724338",
  appId:             "1:924393724338:web:28cdb219dfe81deeed6cab"
};

/* Seed PIN, written to the database on first run if none is set.
   >>> CHANGE THIS before you send the link to anyone. <<<
   Firebase Console -> Realtime Database -> Data -> leagues/braelinn/config/pin */
const DEFAULT_ADMIN_PIN = "1234";
