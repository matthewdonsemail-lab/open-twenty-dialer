import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, restCatch, routeBody, pick } from 'src/lib/dialer-client';
import { DIALER_CALL_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const data = pick(routeBody(event), ["direction","status","fromNumber","toNumber","startedAt","endedAt","durationSeconds","telnyxCallId","telnyxRecordingId","recordingUrl","transcript","transcriptionStatus","summary","debugLog","meetingUrl","meetingProvider","meetingAt","meetingStatus","meetingBookingId","agencyPhoneId","agencyProspectId","agencyLeadId"]);
  try {
    const payload = await getRest().post('/rest/agencyCalls', data);
    return ok(oneRow(payload as { data?: unknown }, 'createAgencyCall', 'agencyCall', 'agencyCalls') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_CALL_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-call-create',
  description: 'Create a Call',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/calls',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
