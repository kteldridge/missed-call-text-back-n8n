# Missed-call text-back for n8n and Twilio (free)

When a local business can't pick up, the caller gets a text within seconds and the owner gets an alert. It's one n8n workflow, with no code to write.

## What it does

- Rings the owner's mobile for about 17 seconds, short enough that most voicemail can't answer first, though carriers vary. If voicemail does answer, Twilio counts the call as answered and most text-back flows never fire.
- If nobody answers or the line is busy, the caller hears a short message and gets a text.
- The owner gets an alert with the caller's number, and customers' replies are forwarded to the owner's phone.
- Hidden numbers can't be texted, so only the owner is told.
- Requests from other Twilio accounts are ignored.

## Setup (about 20 minutes)

You need n8n (Cloud or self-hosted) and a Twilio number with Voice and SMS.

1. In n8n, go to **Workflows → Import from file** and pick `workflows/missed-call-text-back-free.json`.
2. Open **Settings** and fill in your business name, mobile, Twilio number and Twilio Account SID. The booking link is optional.
3. Open **Text caller** and **Alert owner** and choose your Twilio credential on each.
4. Click **Publish** (older n8n versions have an **Active** switch). Copy the production URL from the **Twilio call ended** node.
5. In Twilio, go to **Develop → TwiML Bins → Create new** and paste this, using your URL and mobile:

   ```xml
   <Response>
     <Dial timeout="12" action="YOUR-WEBHOOK-URL">+1OWNERMOBILE</Dial>
   </Response>
   ```

6. Under **Phone Numbers**, set your number's **A call comes in** to that TwiML Bin.
7. Create a second TwiML Bin, paste this with your mobile, and set it as the number's **A message comes in**. Without it, replies only show up in Twilio's logs.

   ```xml
   <Response>
     <Message to="+1OWNERMOBILE">{{From}}: {{Body}}</Message>
   </Response>
   ```

8. Call your Twilio number from a second phone, let it ring out, then reply to the text.

**US businesses:** Twilio blocks texts to US numbers from an unregistered number, so A2P 10DLC registration is required. Start it in Twilio on day one, because approval can take days.

## Limits of the free version

- Every missed call sends a text, so a caller who redials 3 times gets 3 texts.
- The same message goes out at all hours.
- The account check compares the Account SID in each request. It doesn't verify Twilio's request signature.

## Testing

`node test.mjs` runs the logic against fake Twilio requests. The workflow was also run in n8n 2.45.7 with simulated Twilio requests covering no answer, busy, answered, hidden number, wrong account and empty requests. Real calls and texts through Twilio haven't been tested yet, so run step 8 before you rely on it. If you do, please open an issue and say what happened, especially whether your carrier's voicemail beat the timeout.

I made this with help from Claude.

## Want more?

[Missed-Call Rescue](https://teldridge.gumroad.com/l/ngoljj) is the paid version, which I sell. It adds redial protection ("called 3x, likely urgent"), separate after-hours texts in the business's time zone, Google review requests and a sales kit.

## License

MIT. See `LICENSE`.
