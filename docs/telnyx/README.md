# Telnyx reference (canonical for this repo)

Fetched 2026-09-19. Vendored index: `upstream/developers-llms.txt` (Telnyx
developer-docs map). Full texts live upstream — start from the index; the
sections below map every Telnyx surface this repo touches to its doc URL.

Base URL for REST: `https://api.telnyx.com/v2`, auth
`Authorization: Bearer <TELNYX_API_KEY>` (server-side only).
Node SDK: [`telnyx` on npm](https://www.npmjs.com/package/telnyx)
([repo](https://github.com/team-telnyx/telnyx-node), MIT) —
`import Telnyx from 'telnyx'; new Telnyx({ apiKey })`.
SDK docs: https://developers.telnyx.com/docs/development/sdk/node
(+ [resource map](https://developers.telnyx.com/docs/development/sdk/node/resource-map),
[errors/retries](https://developers.telnyx.com/docs/development/sdk/node/errors-and-retries)).
Backend rule: all Telnyx REST goes through `backend/src/lib/telnyx.ts`
(`telnyxClient()`), never hand-rolled fetch.

## What we use, per area (see `api-reference.md` for params)

| Area | Surface we use |
|---|---|
| Voice calls (record/transcribe) | Call Control `record_start` + `call.recording.saved` / `call.recording.transcription.saved` webhooks + `GET /v2/recordings[/{id}]` |
| Webhooks | `telnyx-timestamp` + `telnyx-signature-ed25519` (Standard Webhooks); see Webhook section below |
| SMS/MMS | `POST /v2/messages`; numbers assigned to messaging profiles; profile needs `name` + `whitelisted_destinations` |
| Numbers | `GET /v2/phone_numbers`, `PATCH /v2/phone_numbers/{id}[/messaging]` |
| SIP (voice path) | Credential connections + outbound voice profiles; browser SIP over `wss://sip.telnyx.com:7443` (raw SIP.js). Telnyx's own WebRTC SDK instead uses `wss://rtc.telnyx.com:443` + TURN on 3478/443 |
| AI search/transcripts | `conversation_persistence: true` on the connection (auto-transcribe/store/index) |

## Webhooks (receiver: `frontend/api/telnyx-webhook.ts`)

- Telnyx signs with `telnyx-timestamp` + `telnyx-signature-ed25519`, compatible
  with the [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks)
  spec ([call.recording.saved ref](https://developers.telnyx.com/api-reference/callbacks/call-recording-saved)).
  Our receiver currently gates on a shared `?token=` instead — proper signature
  verification is open work (needs the connection's webhook signing secret).
- Voice event catalog: [Voice API webhooks](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-webhooks)
  (`call.initiated/answered/hangup`, `call.recording.saved`, `call.transcription`, …).
- Recording URLs in webhook payloads expire (~10 min,
  [source](https://preview.redoc.ly/telnyx/FILE-557-Storage-Docs-Update/openapi/callcontrol/tag/Call-Recordings));
  always re-resolve via `GET /v2/recordings/{id}` (our `/api/calls/:id/audio` does this).

## SIP voice path (browser → Telnyx → PSTN)

- [SIP trunking overview](https://developers.telnyx.com/docs/voice/sip-trunking/get-started):
  connections handle inbound/auth, **outbound voice profiles handle outbound
  routing**. A missing profile = `403 Connection has no Outbound Profile assigned`.
- [Connection settings](https://support.telnyx.com/en/articles/4351104-sip-connection-settings)
  (incl. RTCP mux vs RTCP+1 at connection level), [inbound/outbound
  settings](https://support.telnyx.com/en/articles/4404448-sip-connection-inbound-outbound-settings),
  [outbound profiles](https://support.telnyx.com/en/articles/4320411-more-about-outbound-voice-profiles).
- Raw SIP.js over WebSocket: [sip.telnyx.com](https://sip.telnyx.com/) documents
  `wss://sip.telnyx.com:7443` for the US region. (Port 8443 is filtered on some
  networks — we hit this; 7443 connects.)
- Network requirements for Telnyx's own WebRTC SDK (useful baseline):
  [firewall guide](https://developers.telnyx.com/development/webrtc/js-sdk/how-to/configure-network-firewall)
  (`rtc.telnyx.com:443` WSS, STUN/TURN 3478, TURNS 443).
- Known interop: FreeSWITCH answers without RTCP-MUX → Chrome requires it →
  our `rtcpMuxPolicy: "negotiate"` + connection `rtcp_settings.port: rtcp-mux`.

## Messaging

- [Phone number messaging configuration](https://developers.telnyx.com/docs/messaging/messages/phone-number-configuration):
  assign numbers via `PATCH /v2/messaging_phone_numbers/{number}` or
  `POST /v2/messaging_profiles/{id}/phone_numbers`. US A2P needs 10DLC.

## Env contract (secret names, never values)

`TELNYX_API_KEY` (backend + scripts + Vercel fn) · `TELNYX_MESSAGING_PROFILE_ID` /
`TELNYX_MESSAGING_PROFILE_US` (backend default/US sends) · `TELNYX_WEBHOOK_TOKEN`
(shared gate for our receiver) · `TELNYX_WEBHOOK_URL` (where Telnyx points).
Browser SIP creds are `VITE_SIP_*` (baked into the SPA bundle at build time).
