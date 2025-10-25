const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Configuration via environment variables (set these in Functions config or env)
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'kd90af6gj7mk';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM || '';

let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    try {
        const Twilio = require('twilio');
        twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    } catch (e) {
        console.warn('Twilio client could not be initialized:', e.message || e);
    }
}

function sanitizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, ''); // keep digits only
}

async function deleteCollection(path) {
    const collectionRef = db.collection(path);
    const batchSize = 500;

    async function deleteQuery() {
        const snapshot = await collectionRef.limit(batchSize).get();
        if (snapshot.size === 0) return 0;
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        return snapshot.size;
    }

    let numDeleted = 0;
    do {
        numDeleted = await deleteQuery();
    } while (numDeleted >= batchSize);
}

// POST /requestOtp
app.post('/requestOtp', async (req, res) => {
    try {
        const { phone, participantId } = req.body || {};
        if (!phone || !participantId) return res.status(400).json({ error: 'missing_params' });

        const sanitized = sanitizePhone(phone);
        const voteDoc = await db.collection('votes').doc(sanitized).get();
        if (voteDoc.exists) {
            return res.json({ alreadyVoted: true });
        }

        // rate limit: max 3 per hour
        const oneHourAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
        const recent = await db.collection('verifications')
            .where('phone', '==', sanitized)
            .where('createdAt', '>=', oneHourAgo)
            .get();
        if (recent.size >= 3) {
            return res.json({ error: 'rate_limit' });
        }

        // generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);

        await db.collection('verifications').add({
            phone: sanitized,
            participantId,
            otpHash,
            expiresAt,
            used: false,
            createdAt: admin.firestore.Timestamp.now()
        });

        // send SMS via Twilio if available
        if (twilioClient && TWILIO_FROM) {
            try {
                await twilioClient.messages.create({
                    body: `Codul tău de vot este: ${otp}`,
                    from: TWILIO_FROM,
                    to: phone
                });
            } catch (e) {
                console.error('Twilio send error:', e);
                // don't fail the request; OTP is stored server-side
            }
        } else {
            // In environments without Twilio creds, log OTP to functions log (useful for testing)
            console.log('OTP for', sanitized, ':', otp);
        }

        return res.json({ ok: true });
    } catch (err) {
        console.error('requestOtp error', err);
        return res.status(500).json({ error: 'server_error', message: err.message || String(err) });
    }
});

// POST /verifyOtp
app.post('/verifyOtp', async (req, res) => {
    try {
        const { phone, participantId, otp } = req.body || {};
        if (!phone || !participantId || !otp) return res.status(400).json({ error: 'missing_params' });

        const sanitized = sanitizePhone(phone);

        // find latest unused verification for this phone and participant
        const now = admin.firestore.Timestamp.now();
        const q = await db.collection('verifications')
            .where('phone', '==', sanitized)
            .where('participantId', '==', participantId)
            .where('used', '==', false)
            .where('expiresAt', '>=', now)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (q.empty) return res.json({ error: 'invalid_or_expired' });

        const verDoc = q.docs[0];
        const verData = verDoc.data();

        const match = await bcrypt.compare(String(otp), verData.otpHash);
        if (!match) return res.json({ error: 'invalid_or_expired' });

        // transactionally create vote if not exists and mark verification used
        const voteRef = db.collection('votes').doc(sanitized);
        const verRef = verDoc.ref;

        const result = await db.runTransaction(async (tx) => {
            const voteSnap = await tx.get(voteRef);
            if (voteSnap.exists) {
                return { alreadyVoted: true };
            }
            tx.set(voteRef, { participantId, timestamp: admin.firestore.FieldValue.serverTimestamp(), phone: sanitized });
            tx.update(verRef, { used: true });
            return { ok: true };
        });

        if (result.alreadyVoted) {
            return res.json({ alreadyVoted: true });
        }
        return res.json({ ok: true });
    } catch (err) {
        console.error('verifyOtp error', err);
        return res.status(500).json({ error: 'server_error', message: err.message || String(err) });
    }
});

// POST /resetVotes
app.post('/resetVotes', async (req, res) => {
    try {
        const { ownerPassword } = req.body || {};
        if (ownerPassword !== OWNER_PASSWORD) return res.status(403).json({ error: 'forbidden' });

        // delete votes and verifications
        await deleteCollection('votes');
        await deleteCollection('verifications');
        return res.json({ ok: true, message: 'All votes and verifications removed.' });
    } catch (err) {
        console.error('resetVotes error', err);
        return res.status(500).json({ error: 'server_error', message: err.message || String(err) });
    }
});

exports.api = functions.https.onRequest(app);
