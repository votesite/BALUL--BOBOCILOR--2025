Secure Firebase Realtime Database rules and admin claim guide

What this contains
- Two recommended rulesets for Realtime Database:
  1) Strict (admin-only writes to `timer` and `session`) - recommended for production.
  2) Interim (authenticated users can write) - temporary while you set up an admin user and custom claim.
- A short Node script `set_admin.js` that sets the `admin` custom claim for a user uid using a service account JSON.
- Steps to publish rules and set admin.

1) Strict rules (admin-only writes)

Replace the Realtime Database rules with the following in Firebase Console -> Realtime Database -> Rules, then Publish:

{
  "rules": {
    ".read": true,
    "voturi": {
      ".read": true,
      ".write": "auth !== null"
    },
    "timer": {
      ".read": true,
      ".write": "auth !== null && auth.token.admin === true"
    },
    "session": {
      ".read": true,
      ".write": "auth !== null && auth.token.admin === true"
    }
  }
}

Notes:
- `voturi` writes require authentication (so only signed-in users can vote). If you prefer anonymous votes for now, change `voturi/.write` to `true`, but that is less secure.
- `timer` and `session` writes require `auth.token.admin === true` (custom claim `admin`) which you set with the Admin SDK (see below).

2) Interim rules (auth-only writes)

If you need to revert immediately but haven't set admin claims yet, use these rules temporarily:

{
  "rules": {
    ".read": true,
    "voturi": {
      ".read": true,
      ".write": "auth !== null"
    },
    "timer": {
      ".read": true,
      ".write": "auth !== null"
    },
    "session": {
      ".read": true,
      ".write": "auth !== null"
    }
  }
}

This requires the organizer to sign in (Email/Password or another provider) before calling Start/Reset.

3) How to set the admin claim (quick steps)

Prerequisites:
- Node.js installed locally.
- A Firebase service account JSON with Editor permissions (create in Firebase Console -> Project Settings -> Service accounts -> Generate new private key).
- The organizer's Firebase Auth UID (you can find it in Firebase Console -> Authentication -> Users -> Click the user -> UID).

Commands:
- Install firebase-admin if you don't have it:

```powershell
npm init -y
npm install firebase-admin
```

- Run the included script to set the claim (replace paths/UID):

```powershell
node d:\Site\set_admin.js C:\path\to\serviceAccount.json <USER_UID>
```

After setting the claim, the organizer must sign out and sign back in. The client code must read idTokenResult.claims.admin (Firebase SDK does this if you call getIdTokenResult) to enable admin UI.

4) Client notes
- The current `index.html` writes `session` and `timer` when `startVotare()` / `resetVotare()` are used. Under the strict rules, those write attempts will only succeed when the client is signed in and the token has `admin:true`.
- If you want to hide admin buttons in the UI until a user is admin, check `firebase.auth().currentUser.getIdTokenResult()` and inspect `.claims.admin`.

5) Rollback guidance
- If you publish strict rules and get locked out, use the Firebase Console to revert rules manually. The Console allows you to edit and publish rules.

6) Security checklist
- Do not leave the DB rules wide open in production.
- Use Email/Password + enforce a strong organizer password and rotate service account keys.
- Optionally move admin actions to a Cloud Function callable by authenticated clients to avoid exposing credentials on clients.

If you want, I can:
- Paste the exact rules JSON again for you to copy/paste.
- Walk you through creating the organizer user and running `set_admin.js` (I can prepare exact PowerShell commands for your Windows environment).
- Update `index.html` to require sign-in before showing admin buttons if you'd like.
