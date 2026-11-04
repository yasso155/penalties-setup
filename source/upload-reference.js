/**
 * upload-reference.js
 * Uploads ref.json data to Firebase Realtime Database under reference/
 * Run once: node source/upload-reference.js  (from penalties-setup folder)
 */
import {readFileSync} from 'fs';
import {initializeApp,cert} from 'firebase-admin/app';
import {getDatabase} from 'firebase-admin/database';

// ---- Load source data ----
const ref = JSON.parse(readFileSync(new URL('./ref.json', import.meta.url)));

// ---- Firebase Admin using Application Default Credentials ----
// (firebase-tools already authenticated; ADC picks it up automatically)
initializeApp({
  databaseURL: 'https://penalties-setup-default-rtdb.asia-southeast1.firebasedatabase.app'
});
const db = getDatabase();

/** Firebase keys cannot contain . # $ [ ] so we sanitise the label */
const safeKey = s => s.replace(/[.#$[\]]/g, '_');

// ---- Build reference payload ----
const payload = { fare:{}, leg:{}, pax:{}, cur:{} };

// fare: key = safe(label_part_before_first_dash), value = {label, code}
// But many fares share same prefix so we use the full label as key
for (const [label, code] of ref.fare) {
  payload.fare[safeKey(label)] = { label, code };
}

// leg: key = "ORG-DST" (already clean), value = {label, code}
for (const [label, code] of ref.leg) {
  payload.leg[safeKey(label)] = { label, code };
}

// pax: key = safe(label), value = {label, code}
for (const [label, code] of ref.pax) {
  payload.pax[safeKey(label)] = { label, code };
}

// cur: enabled list + all codes
payload.cur = {
  enabled: ['SDG','USD','AED','SAR','QAR','OMR','EGP','JOD','KWD'],
  quick_fares: [
    ['S','S - Economy Class','Economy Class'],
    ['H','H - High Fare','High Fare'],
    ['Y','Y - Full Fare','Full Fare'],
    ['J','J - Business Class','Business Class']
  ]
};

// ---- Upload ----
console.log('Uploading reference data to Firebase...');
console.log(`  fare: ${Object.keys(payload.fare).length} entries`);
console.log(`  leg:  ${Object.keys(payload.leg).length} entries`);
console.log(`  pax:  ${Object.keys(payload.pax).length} entries`);

await db.ref('reference').set(payload);
console.log('✅ Done! reference/ written to Firebase.');
process.exit(0);
