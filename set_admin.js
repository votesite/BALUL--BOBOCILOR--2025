// Usage: node set_admin.js /absolute/path/to/serviceAccount.json <USER_UID>
// Example: node set_admin.js C:\keys\serviceAccount.json xT1a2b3c4D

const admin = require('firebase-admin');
const fs = require('fs');

if (process.argv.length < 4) {
  console.error('Usage: node set_admin.js /path/to/serviceAccount.json <USER_UID>');
  process.exit(1);
}

const serviceAccountPath = process.argv[2];
const uid = process.argv[3];

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account file not found:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log('Setting custom claim {admin: true} for user:', uid);
admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log('Custom claim set. The user must sign out and sign in again to receive the new token.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error setting custom claim:', err);
    process.exit(1);
  });
