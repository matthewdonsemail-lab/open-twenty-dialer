import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, restCatch, routeBody, routeParam, pick } from 'src/lib/dialer-client';
import { DIALER_CALL_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const data = pick(routeBody(event), ["direction","status","fromNumber","toNumber","startedAt","endedAt","durationSeconds","telnyxCallId","telnyxRecordingId","recordingUrl","transcript","transcriptionStatus","summary","debugLog","meetingUrl","meetingProvider","meetingAt","meetingStatus","meetingBookingId","agencyPhoneId","agencyProspectId","agencyLeadId"]);
  try {
    const payload = await getRest().patch('/rest/agencyCalls/' + id, data);
    return ok(oneRow(payload as { data?: unknown }, 'updateAgencyCall', 'agencyCall', 'agencyCalls') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_CALL_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-call-update',
  description: 'Update a Call',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/calls/:id',
    httpMethod: 'PATCH',
    isAuthRequired: true,
  },
});
