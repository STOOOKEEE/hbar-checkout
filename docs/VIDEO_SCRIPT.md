# SaucerPay demo video: script and shot list

[Submission package](SUBMISSION.md) · [Payment evidence](VALIDATION.md) · [Developer walkthrough](REVIEW.md)

**Target:** about 2 minutes 45 seconds; the submission form requires a public video URL under five minutes. Speak at a natural pace. The timecodes are editing targets, not exact audio durations. Show the product for almost the entire video; a presenter shot is useful only for the opening 10–15 seconds.

## What to collect from the presenter

1. **Image:** one sharp, front-facing, evenly lit photo of your own face, shoulders visible, at least 1024 pixels wide. Save as `portrait.jpg`. Avoid sunglasses, hair covering the mouth, filters and a busy background. A 10–15-second steady, front-facing **silent webcam video** is optional and produces a more natural talking-head result than animating a still photo.
2. **Voice:** 15–30 seconds of your own English speech in a quiet room, with no music, echo or noise reduction effects. Save lossless mono or stereo WAV as `voice-ref.wav`; M4A is fine as an original, but convert it to WAV for the local script. Record this sample in one take, at a normal pace. Supply the **verbatim transcript** in `voice-ref.txt`, including contractions and product names. A plausible sample to read is: “Hi, I'm [your name]. I'm building SaucerPay on Hedera. Customers pay in H-bar while merchants receive a fixed amount of SAUCE or USDC. SaucerSwap provides the live quote. In this demo I'll show the checkout, a real testnet receipt, and what developers can reuse.” Put your actual name in both recording and transcript; write only words you actually said.
3. **Presenter name:** spelling and preferred pronunciation for the 10-second introduction.

Place these personal files in the local, Git-ignored `.video-work/` folder. Do not add your face, voice, wallet keys or private login links to the public repository. The existing screen-only B-roll is there as a starting point. No personal media is needed to finish the script or plan.

## Exact English narration and images

Read only the **Voiceover** text. The screen directions and bracketed name are production notes. The line about browser signing is deliberate: the recorded payment used the two-account testnet script, while the injected-wallet signing path has not been live tested.

### 00:00–00:14 — Presenter / promise

**Screen:** 10–14 seconds of your own animated portrait in a small clean frame, or a real webcam take. If using the generated version, label it `AI-assisted presenter, own face and voice`. Add the project name and `Scaffold-HBAR × SaucerSwap` on screen. Cut to the app immediately.

**Voiceover:** “Hi, I'm [YOUR NAME]. I built SaucerPay, a Scaffold-HBAR starter for token payments. Customers hold H-bar; merchants ask for a fixed token amount.”

### 00:14–00:36 — The developer problem

**Screen:** hosted workspace; show `Pay with HBAR`, the selected settlement token, and the live quote panel. Use the commercial USDC preset as a **mainnet quote preview only**. Keep `Mainnet · read-only` visible.

**Voiceover:** “Imagine building service invoices or prepaid API credits. Your customer has H-bar, but you price in a token. Integrating live liquidity, amount limits, settlement and a verifiable receipt is substantial work. This starter gives you that payment path to adapt.”

### 00:36–00:59 — Load-bearing integration

**Screen:** request a live USDC quote, show required HBAR and maximum spend, then change the token amount and show the quote refresh. On-screen label: `SaucerSwap quote · read only`.

**Voiceover:** “The quote comes from a real SaucerSwap pool, not a hard-coded exchange rate. SaucerSwap's exact-output route is essential: it determines the H-bar needed to deliver the merchant's fixed token amount. Without that liquidity and router, this checkout cannot perform the conversion.”

### 00:59–01:25 — What the template enforces

**Screen:** simple four-step graphic or code/docs view: `invoice terms → quote → exact-output swap → verified receipt`. Highlight `exact token delivery`, `maximum HBAR spend` and `surplus refund`. Do not portray a quote as a completed payment.

**Voiceover:** “The contract fixes the merchant, token amount and expiry. At payment time it calls SaucerSwap, checks the merchant's actual token balance increase, and returns unused H-bar to the payer. The payment and invoice update happen in one transaction. If a required step fails, settlement reverts.”

### 01:25–02:02 — Real testnet proof

**Screen:** only after the hosted Vercel environment is updated to token `0.0.5449` and checkout `0x140e27Cf63790a558d66C8796A67984d5164055E`, open the [paid USDC invoice](https://saucerpay-hedera.vercel.app/pay/0x08c3361023db4b0b2097fe1b82f90ed5477056e570daca65967f81c521357791?tx=0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8) and zoom on `Paid`, merchant and payer addresses, `1 USDC`, spent HBAR and refund. Until then, skip the paid page. Show the successful [Hedera Mirror Node transaction](https://testnet.mirrornode.hedera.com/api/v1/contracts/results/0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8). Do not show a wallet click as though it produced this transaction.

**Voiceover:** “Here is an actual Hedera testnet payment with a separate payer and merchant. The merchant received exactly one testnet USDC. Conversion spent 0.43988881 H-bar, and 0.00219945 H-bar of unused input returned to the payer; network fees are separate. Testnet pool prices are not market prices. The public mirror-node result verifies the invoice and transaction. We executed this payment with the included two-account testnet script.”

### 02:02–02:35 — Why a developer would start here

**Screen:** show `npx create-scaffold-hbar@latest --template STOOOKEEE/hedera-temlate`, `/examples` with service invoice and prepaid credits, shared `QuotePreview` component, README/AGENTS, and `npm run submission:check`. Overlay the GitHub URL. A quick terminal snippet or docs screenshot is enough; no need to run a new payment on camera.

**Voiceover:** “This is a reusable starting point, not just a checkout page. Generate it with Scaffold-HBAR, then adapt the token and invoice flow. The shared quote component already appears in service billing and prepaid-credit examples. Your app still owns fulfillment and credit accounting. Guides, tests and a checker against Hedera RPC and mirror data show how to extend and verify the payment.”

### 02:35–02:52 — Clear limit and close

**Screen:** project title, hosted demo and GitHub URL. Small visible caption: `Testnet USDC payment verified · Mainnet USDC quote read-only`.

**Voiceover:** “The USDC mainnet screen is a live quote preview, not a settled mainnet payment. The verified settlement is on testnet. Inspect the code, run the scaffold, and reproduce that payment with the validation guide. If your Hedera app needs H-bar-funded token checkout, SaucerPay gives you a working starting point.”

## Capture and edit checklist

- Record the hosted app at **1920×1080, 16:9, 30 fps**, zooming the browser UI enough for readable amounts. Keep browser notifications, personal accounts and wallet secrets out of frame. Existing silent local clips cover 51 seconds of product and docs footage; use them as source material, not as evidence of a new payment.
- Make the onscreen distinction between **mainnet USDC quote** and **testnet USDC payment** visible throughout. The testnet transaction, mirror-node result and (once the hosted env is updated) paid page are the payment evidence.
- Prefer hard cuts and close-ups of the values being discussed. Add captions for `1 USDC`, `0.43988881 HBAR spent` and `0.00219945 HBAR returned`. Keep narration quieter under any interface sound; the existing clips are silent.
- Check every visible URL and number against [Validation](VALIDATION.md). The separate payer/merchant addresses and amounts are recorded there. Readability and proof matter more than a long talking-head segment.
- Export H.264/AAC MP4, 1080p, with subtitles if practical. Watch it once without sound: the mainnet read-only label, testnet proof and developer entry point should still be clear. Host the final video at a public URL accessible without login before entering it into the submission form.
