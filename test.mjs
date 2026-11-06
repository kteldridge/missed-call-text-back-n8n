// Runs the Code node with fake Twilio requests, the way n8n does. Run: node test.mjs
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const here = fileURLToPath(new URL('.', import.meta.url));
const SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const code = readFileSync(here + 'src/decide.js', 'utf8');
const settings = { businessName: 'Ace Plumbing', ownerMobile: '+15555550199', twilioNumber: '+15555550100',
  twilioAccountSid: SID, bookingLink: '', voiceMessage: "Sorry we missed your call. We're sending you a text right now." };
const run = (body, extra = {}) => new Function('$input', code)({ first: () => ({ json: { ...settings, ...extra,
  body: { AccountSid: SID, From: '+15125550123', DialCallStatus: 'no-answer', ...body } } }) })[0].json;

let r = run({});
assert.equal(r.textCaller, true); assert.equal(r.alertOwner, true);
assert.match(r.twiml, /^<Response><Say>Sorry we missed your call/);
assert.ok(r.callerText.length <= 160, 'one SMS'); assert.match(r.callerText, /Reply here\. Reply STOP/);
assert.match(r.ownerText, /forwarded to this phone/);
console.log('ok  no answer: texts the caller, alerts the owner');
console.log(`    caller SMS (${r.callerText.length} chars): ${r.callerText}`);

r = run({}, { bookingLink: 'https://acmeplumb.com/book' });
assert.match(r.callerText, /Reply here or book: https:\/\/acmeplumb\.com\/book Reply STOP/); assert.ok(r.callerText.length <= 160, 'one SMS');
console.log('ok  booking link goes in the text when set');

r = run({ DialCallStatus: 'busy' }); assert.equal(r.textCaller, true);
console.log('ok  busy line counts as missed');

r = run({ DialCallStatus: 'completed' });
assert.equal(r.textCaller, false); assert.equal(r.alertOwner, false); assert.equal(r.twiml, '<Response><Hangup/></Response>');
console.log('ok  answered call: sends nothing');

r = run({ From: 'anonymous' }); assert.equal(r.textCaller, false); assert.equal(r.alertOwner, true); assert.match(r.ownerText, /hidden number/);
assert.match(r.twiml, /Please try again soon/); assert.doesNotMatch(r.twiml, /text/);
console.log('ok  hidden number: alerts the owner only');

r = run({ AccountSid: 'ACsomeoneelse' }); assert.equal(r.textCaller, false); assert.equal(r.alertOwner, false);
console.log('ok  another Twilio account: ignored');

r = run({ AccountSid: undefined, From: undefined, DialCallStatus: undefined }); assert.equal(r.textCaller, false); assert.equal(r.alertOwner, false);
console.log('ok  empty request: ignored');

r = run({}, { voiceMessage: 'Tom & Sons <closed>' }); assert.match(r.twiml, /Tom &amp; Sons &lt;closed&gt;/);
console.log('ok  voice message is escaped for TwiML');

const wf = JSON.parse(readFileSync(here + 'workflows/missed-call-text-back-free.json', 'utf8'));
const names = new Set(wf.nodes.map((n) => n.name));
for (const [from, { main }] of Object.entries(wf.connections)) {
  assert.ok(names.has(from), from);
  for (const out of main) for (const c of out) assert.ok(names.has(c.node), c.node);
}
assert.ok(!wf.nodes.some((n) => n.credentials), 'no credentials in the file');
console.log(`ok  workflow file: ${wf.nodes.length} nodes, connections valid, no credentials`);
console.log('\nall checks passed');
