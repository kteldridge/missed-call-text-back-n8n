// Decides what to send after Twilio reports how a forwarded call ended.
// The values you edit live in the Settings node, not here.
const MISSED = ['no-answer', 'busy', 'failed', 'canceled'];
const input = $input.first().json;
const body = input.body || {};
const from = String(body.From || '').trim();
const status = String(body.DialCallStatus || '');

// Only act on requests from your own Twilio account.
const missed = body.AccountSid === input.twilioAccountSid && MISSED.includes(status);
// Hidden caller IDs arrive as "anonymous" (older accounts: +266696687) and can't be texted.
const textable = /^\+\d{8,15}$/.test(from) && from !== '+266696687';

const name = input.businessName;
const booking = String(input.bookingLink || '').trim();
const callerText = `Hi, this is ${name}. Sorry we missed your call! What can we help with? ${booking ? `Reply here or book: ${booking}` : 'Reply here.'} Reply STOP to opt out.`;
const ownerText = textable
  ? `Missed call from ${from}. We texted them back. Any reply will be forwarded to this phone.`
  : `Missed call from a hidden number. Couldn't text them back.`;

// Only promise a text to a number that can get one.
const spoken = textable ? input.voiceMessage : 'Sorry we missed your call. Please try again soon.';
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

return [{
  json: {
    twiml: missed ? `<Response><Say>${xml(spoken)}</Say><Hangup/></Response>` : '<Response><Hangup/></Response>',
    textCaller: missed && textable,
    alertOwner: missed,
    callerNumber: from,
    callerText,
    ownerMobile: input.ownerMobile,
    ownerText,
    twilioNumber: input.twilioNumber,
    status,
  },
}];
