// Builds the importable n8n workflow from src/decide.js. Run: node build.mjs
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const here = fileURLToPath(new URL('.', import.meta.url));
const node = (name, type, typeVersion, position, parameters, extra = {}) =>
  ({ id: randomUUID(), name, type, typeVersion, position, parameters, ...extra });
const ifTrue = (field) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
    conditions: [{ id: randomUUID(), leftValue: `={{ $json.${field} }}`, rightValue: '',
      operator: { type: 'boolean', operation: 'true', singleValue: true } }],
    combinator: 'and',
  },
  options: {},
});
const sms = (to, message) => ({ operation: 'send', from: '={{ $json.twilioNumber }}', to, toWhatsapp: false, message, options: {} });
const note = (name, position, width, height, color, content) =>
  node(name, 'n8n-nodes-base.stickyNote', 1, position, { width, height, color, content });
const text = (name, value) => ({ id: randomUUID(), name, value, type: 'string' });

const overview = `### How it works
For local service businesses that lose jobs when nobody can pick up. Calls come in to a Twilio number, which rings the owner's mobile for about 17 seconds. If nobody answers, or the line is busy, Twilio calls this workflow. The caller hears a short message and gets a text inviting them to reply. The owner gets an alert. The short ring time stops the owner's voicemail from "answering" first, which would make Twilio report the call as completed. Hidden numbers can't be texted, so only the owner is told. Requests from other Twilio accounts are ignored.

### Setup
You need a Twilio number with Voice and SMS. US businesses must also finish A2P 10DLC registration, or Twilio blocks texts to US numbers.
1. Fill in the Settings node.
2. Pick your Twilio credential on both Twilio nodes.
3. Publish the workflow and copy the webhook's production URL.
4. In Twilio, create a TwiML Bin and set it as the number's "A call comes in" handler:
\`<Response><Dial timeout="12" action="YOUR-WEBHOOK-URL">+1OWNERMOBILE</Dial></Response>\`
5. Create a second TwiML Bin for the number's "A message comes in" handler, so replies reach the owner:
\`<Response><Message to="+1OWNERMOBILE">{{From}}: {{Body}}</Message></Response>\`
6. Call from a second phone, let it ring out, then reply to the text.

### Limitations
Every missed call sends a text, so a caller who redials gets another one. The same message goes out at all hours.

### Customization
Edit the texts in Decide what to send. The paid kit adds redial protection and after-hours texts: https://teldridge.gumroad.com/l/ngoljj`;

const workflow = {
  name: 'Text back missed callers and alert the owner with Twilio',
  nodes: [
    note('Overview', [-420, -520], 620, 720, 1, overview),
    note('Section: read the call', [240, -160], 720, 340, 7, '## Read how the call ended\nTwilio posts the result here. Edit your details in Settings. Twilio always gets its answer before any text is sent.'),
    note('Section: send texts', [1000, -320], 500, 640, 7, '## Send the texts\nIf the caller text fails, the owner alert still goes out. Open the Twilio node in the execution to read the error.'),
    node('Twilio call ended', 'n8n-nodes-base.webhook', 2, [280, 0],
      { httpMethod: 'POST', path: 'missed-call-text-back', responseMode: 'responseNode', options: {} },
      { webhookId: randomUUID() }),
    node('Settings', 'n8n-nodes-base.set', 3.4, [460, 0], {
      assignments: { assignments: [
        text('businessName', 'Ace Plumbing'),
        text('ownerMobile', '+15555550199'),
        text('twilioNumber', '+15555550100'),
        text('twilioAccountSid', 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
        text('bookingLink', ''),
        text('voiceMessage', "Sorry we missed your call. We're sending you a text right now."),
      ] },
      includeOtherFields: true,
      options: {},
    }),
    node('Decide what to send', 'n8n-nodes-base.code', 2, [640, 0], { jsCode: readFileSync(here + 'src/decide.js', 'utf8') }),
    node('Answer Twilio', 'n8n-nodes-base.respondToWebhook', 1.1, [820, 0], {
      respondWith: 'text',
      responseBody: '={{ $json.twiml }}',
      options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/xml' }] } },
    }),
    node('Text the caller?', 'n8n-nodes-base.if', 2, [1040, -120], ifTrue('textCaller')),
    node('Text caller', 'n8n-nodes-base.twilio', 1, [1280, -120],
      sms('={{ $json.callerNumber }}', '={{ $json.callerText }}'), { onError: 'continueRegularOutput' }),
    node('Alert the owner?', 'n8n-nodes-base.if', 2, [1040, 120], ifTrue('alertOwner')),
    node('Alert owner', 'n8n-nodes-base.twilio', 1, [1280, 120],
      sms('={{ $json.ownerMobile }}', '={{ $json.ownerText }}'), { onError: 'continueRegularOutput' }),
  ],
  connections: {
    'Twilio call ended': { main: [[{ node: 'Settings', type: 'main', index: 0 }]] },
    Settings: { main: [[{ node: 'Decide what to send', type: 'main', index: 0 }]] },
    'Decide what to send': { main: [[{ node: 'Answer Twilio', type: 'main', index: 0 }]] },
    'Answer Twilio': { main: [[{ node: 'Text the caller?', type: 'main', index: 0 }, { node: 'Alert the owner?', type: 'main', index: 0 }]] },
    'Text the caller?': { main: [[{ node: 'Text caller', type: 'main', index: 0 }]] },
    'Alert the owner?': { main: [[{ node: 'Alert owner', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
  pinData: {},
};
writeFileSync(here + 'workflows/missed-call-text-back-free.json', JSON.stringify(workflow, null, 2) + '\n');
const words = overview.split(/\s+/).length;
console.log(`wrote workflows/missed-call-text-back-free.json (overview note: ${words} words)`);
