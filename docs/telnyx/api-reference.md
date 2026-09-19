# Telnyx API surface we depend on (curated 2026-09-19)

Sources: [API reference](https://developers.telnyx.com/internal/pages/api-reference-overview),
[OpenAPI spec](https://raw.githubusercontent.com/team-telnyx/openapi/master/openapi/spec3.json),
[`telnyx-node` SDK](https://github.com/team-telnyx/telnyx-node) (installed version's
`node_modules/telnyx` typings are the ground truth for method names), plus the
parallel-web-search dumps used to assemble this page.

## Call Control — recording

- [`POST /calls/{call_control_id}/actions/record_start`](https://developers.telnyx.com/api-reference/call-commands/recording-start)
  — body `{format: wav|mp3, channels: single|dual, transcription?: bool, ...}`.
  Recording stops on hangup (or stop command). Expected webhooks:
  `call.recording.saved`, `call.recording.transcription.saved`, `call.recording.error`.
- SDK: `client.calls.actions.startRecording(callControlId, {format, channels, transcription})`.
- [Commands/resources overview](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-commands-and-resources).

## Call recordings

- [`GET /recordings`](https://developers.telnyx.com/api-reference/call-recordings/list-all-call-recordings)
  filters: `call_control_id`, `call_leg_id`, `call_session_id`, `from`, `to`,
  `connection_id`, `conference_id`, `sip_call_id`, time ranges. SDK:
  `client.recordings.list({filter: {from, to}})`.
- [`GET /recordings/{recording_id}`](https://developers.telnyx.com/api-reference/call-recordings/retrieve-a-call-recording)
  → `data.download_urls.{mp3,wav}`, `duration_millis`, `from`/`to`,
  `connection_id`, `initiated_by` (e.g. `StartCallRecordingAPI`, `Trunking`).
  SDK: `client.recordings.retrieve(id)`.
- Download URLs expire (~10 min); re-resolve per playback.
- TeXML-side equivalents (not used by us, listed so nobody confuses them):
  [`<Record>`](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/record)
  / [`<Recording>`](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/recording)
  verbs, `POST .../Recordings.json` ([request recording](https://developers.telnyx.com/api-reference/texml-rest-commands/request-recording-for-a-call)),
  [`GET .../Recordings.json`](https://developers.telnyx.com/api-reference/texml-rest-commands/fetch-recordings-for-a-call).

## Debugging / detail records

- [`GET /v2/call_events`](https://developers.telnyx.com/api-reference/debugging/list-call-events)
  (`filter[from|to|...]`, last 24h default) — server-side SIP trace when the
  browser log isn't enough.
- [`GET /v2/detail_records`](https://developers.telnyx.com/api-reference/detail-records/search-detail-records)
  (`filter[record_type]=...`: `sip-trunking`, `recording`, `call-control`, …).
- [WebRTC CDR guide](https://developers.telnyx.com/development/webrtc/troubleshooting/detail-records).

## Messaging

- `POST /v2/messages` `{from, to, text}`; `GET /v2/messaging_profiles`;
  `POST /v2/messaging_profiles` needs `name` + `whitelisted_destinations`;
  number assignment: `PATCH /v2/phone_numbers/{id}/messaging`
  `{messaging_profile_id}` (or `PATCH /v2/messaging_phone_numbers/{e164}`).
- Since 2024-03-01 profile create/edit requires whitelisted countries;
  non-US destinations need an alphanumeric sender ID; US A2P needs 10DLC.

## Numbers & SIP connections

- `GET /v2/phone_numbers`, `PATCH /v2/phone_numbers/{id}`
  (`connection_id`, `messaging_profile_id` via `/messaging` sub-path).
- Credential connections: `POST/PATCH /v2/credential_connections`
  (`connection_name`, `user_name`, `password`, `outbound: {outbound_voice_profile_id}`,
  `conversation_persistence`, `rtcp_settings`, `webhook_event_url`).
  There is **no** auto-record toggle on connections — recordings come from
  Call Control / TeXML actions above.

## SIP.js (browser side, not Telnyx)

- Outgoing response callbacks go on `requestDelegate` passed to `invite()`
  ([session-description-handler docs](https://github.com/onsip/SIP.js/blob/main/docs/session-description-handler.md));
  plain `session.delegate` assignment does not fire `onAccept`/`onReject` on the Inviter.
- [API framework overview](https://github.com/onsip/SIP.js/blob/main/docs/api.md),
  [`Inviter.invite()`](https://github.com/onsip/SIP.js/blob/main/docs/api/sip.js.inviter.invite.md),
  [attach-media guide](https://sipjs.com/guides/attach-media) (read receivers on
  Established; `track` event is backup), [failure causes](https://sipjs.com/api/0.6.0/causes).
- WS close 1006 carries no reason by design — decide from `onclose`, not `onerror`
  ([websocket.org](https://www.websocket.org/guides/error-handling)).
