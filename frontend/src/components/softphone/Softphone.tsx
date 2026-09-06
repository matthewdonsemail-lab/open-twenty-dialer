import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Headphones,
  Keyboard,
  Clock,
  RotateCcw,
  Check,
} from "lucide-react";
import { getSipConfig, isSipConfigured, getSipDomain, getSipExtension } from "@/sip";
import { Button } from "@/components/ui/Button";
import { OutcomeSelect } from "@/components/common/OutcomeSelect";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

interface SoftphoneProps {
  lead: Lead | null;
  onCallEnd?: (outcome: {
    outcome: string;
    duration: number;
    notes: string;
    direction: "outbound" | "inbound";
  }) => void;
}

type CallState = "idle" | "connecting" | "ringing" | "active" | "on_hold" | "muted" | "ended";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ods-brand-500)] focus-visible:outline-offset-1";

export function Softphone({ lead, onCallEnd }: SoftphoneProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [duration, setDuration] = useState(0);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("no_answer");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [keypadVisible, setKeypadVisible] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [holdActive, setHoldActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    callerNumber: string;
    callerName: string;
    session: any;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<any>(null);
  const inboundSessionRef = useRef<any>(null);
  const wasEstablishedRef = useRef(false);
  const callStateRef = useRef<CallState>("idle");

  const phoneNumber = lead?.phone ?? dialNumber;

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    if (callState === "active" || callState === "ringing" || callState === "connecting") {
      intervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (inboundSessionRef.current) {
        try { inboundSessionRef.current.terminate(); } catch {}
        inboundSessionRef.current = null;
      }
    };
  }, [callState]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const startSimulatedCall = useCallback(() => {
    setCallState("connecting");
    setTimeout(() => setCallState("ringing"), 1500);
    setTimeout(() => setCallState("active"), 4000);
  }, []);

  const startCall = useCallback(async () => {
    if (!phoneNumber) return;
    setCallState("connecting");
    setDuration(0);
    setNotes("");
    setOutcome("no_answer");
    wasEstablishedRef.current = false;

    const sipConfig = getSipConfig();

    if (!isSipConfigured()) {
      console.warn("SIP not configured, using simulated call");
      startSimulatedCall();
      return;
    }

    try {
      const { UserAgent, Registerer, Inviter, SessionState } = await import("sip.js");

      const domain = getSipDomain();
      const target = UserAgent.makeURI(`sip:${phoneNumber}@${domain}`);
      if (!target) {
        setCallState("ended");
        return;
      }

      const extraHeaders: string[] = [];
      if (sipConfig.callerId) {
        extraHeaders.push(`P-Asserted-Identity: <sip:${sipConfig.callerId}@${domain}>`);
      }

      const userAgent = new UserAgent({
        uri: UserAgent.makeURI(sipConfig.uri),
        displayName: sipConfig.callerId || undefined,
        transportOptions: {
          server: sipConfig.wsUrl || `wss://${domain}:5066`,
        },
        authorizationUsername: getSipExtension(),
        authorizationPassword: sipConfig.password,
      });

      userAgent.delegate = {
        onInvite: async (session: any) => {
          inboundSessionRef.current = session;
          const remoteIdentity = session.remoteIdentity;
          const fromUri = remoteIdentity?.uri?.user ?? remoteIdentity?.user ?? "Unknown";
          const displayName = remoteIdentity?.displayName ?? "";
          setIncomingCall({
            callerNumber: fromUri,
            callerName: displayName || fromUri,
            session,
          });
          setCallState("ringing");
          setDirection("inbound");
        },
      };

      const registerer = new Registerer(userAgent);

      const connectionTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SIP connection timeout")), 8000)
      );

      await Promise.race([userAgent.start(), connectionTimeout]);
      await Promise.race([registerer.register(), connectionTimeout]);

      const inviter = new Inviter(userAgent, target, {
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
        extraHeaders,
      });

      sessionRef.current = inviter;

      inviter.stateChange.addListener((state: string) => {
        if (state === SessionState.Established) {
          wasEstablishedRef.current = true;
          setCallState("active");
          setOutcome("answered");
        } else if (state === SessionState.Terminated) {
          if (!wasEstablishedRef.current && callStateRef.current === "ringing") {
            setOutcome("no_answer");
          }
          setCallState("ended");
        } else if (state === SessionState.Establishing) {
          setCallState("ringing");
        }
      });

      await inviter.invite();
      setCallState("ringing");
    } catch (err) {
      console.warn("SIP.js call failed, using simulated call:", err);
      startSimulatedCall();
    }
  }, [phoneNumber, startSimulatedCall]);

  const endCall = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.bye();
      } catch {
        try { sessionRef.current.terminate(); } catch {}
      }
      sessionRef.current = null;
    }
    if (inboundSessionRef.current) {
      try { inboundSessionRef.current.terminate(); } catch {}
      inboundSessionRef.current = null;
    }
    setIncomingCall(null);
    setCallState("ended");
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const toggleMute = useCallback(() => {
    if (callState === "active") {
      setCallState("muted");
    } else if (callState === "muted") {
      setCallState("active");
    }
  }, [callState]);

  const toggleHold = useCallback(() => {
    if (callState === "active") {
      setHoldActive(true);
      setCallState("on_hold");
    } else if (callState === "on_hold") {
      setHoldActive(false);
      setCallState("active");
    }
  }, [callState]);

  const handleSaveOutcome = useCallback(() => {
    if (onCallEnd) {
      onCallEnd({ outcome, duration, notes, direction });
    }
    setCallState("idle");
    setDuration(0);
    setNotes("");
    setOutcome("no_answer");
    setDirection("outbound");
  }, [onCallEnd, outcome, duration, notes, direction]);

  const handleAcceptIncomingCall = useCallback(async () => {
    const session = inboundSessionRef.current;
    if (!session) return;
    try {
      await session.accept();
      setCallState("active");
      setIncomingCall(null);
    } catch (err) {
      console.warn("Failed to accept incoming call:", err);
    }
  }, []);

  const handleRejectIncomingCall = useCallback(() => {
    const session = inboundSessionRef.current;
    if (!session) return;
    try {
      session.reject(486);
    } catch {}
    inboundSessionRef.current = null;
    setIncomingCall(null);
    setCallState("idle");
  }, []);

  const handleRedial = useCallback(() => {
    setCallState("idle");
    setDuration(0);
    setTimeout(() => startCall(), 300);
  }, [startCall]);

  const keypadKeys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  const stateLabel: Record<CallState, string> = {
    idle: "Ready",
    connecting: "Connecting...",
    ringing: incomingCall ? "Incoming Call..." : "Ringing...",
    active: incomingCall ? "In Call" : "Connected",
    on_hold: "On Hold",
    muted: "Muted",
    ended: "Call Ended",
  };

  // Single semantic token per state — no gradients, no per-state background
  // repaint. Twenty communicates call state with a small dot + label, the
  // same pattern as StatusBadge, not by recoloring the whole panel.
  const stateColor: Record<CallState, string> = {
    idle: "var(--ods-text-tertiary)",
    connecting: "var(--ods-brand-600)",
    ringing: "var(--ods-brand-600)",
    active: "var(--ods-success)",
    on_hold: "var(--ods-warning)",
    muted: "var(--ods-warning)",
    ended: "var(--ods-danger)",
  };

  if (!lead) {
    return (
      <div className="bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] rounded-ods-md p-6">
        <div className="flex items-center justify-center h-48 text-[var(--ods-text-tertiary)]">
          <div className="text-center">
            <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-[13px] font-medium">Select a lead to start a call</p>
            <p className="text-[11px] mt-1">Navigate to a lead detail page and use the dialer</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] rounded-ods-md overflow-hidden">
        {/* 40px header, flat — matches PageCanvas/WidgetCard, no state-based repaint */}
        <div className="h-10 min-h-[40px] px-4 border-b border-[var(--ods-border)] flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-[var(--ods-bg-tertiary)] flex items-center justify-center shrink-0">
            <Phone className="w-3.5 h-3.5 text-[var(--ods-text-secondary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--ods-text-primary)] truncate">
              {lead.first_name} {lead.last_name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {callState !== "idle" && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--ods-text-tertiary)]">
                <Clock className="w-3 h-3" />
                {formatDuration(duration)}
              </span>
            )}
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                callState === "active" || callState === "connecting" || callState === "ringing"
                  ? "animate-pulse"
                  : ""
              }`}
              style={{ backgroundColor: stateColor[callState] }}
            />
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <p className="text-[12px] text-[var(--ods-text-tertiary)] truncate -mt-1">
            {lead.company ?? lead.email ?? "No contact info"}
          </p>

          <div className="text-center">
            <p className="text-[18px] font-semibold text-[var(--ods-text-primary)]">{phoneNumber || "—"}</p>
            <p className="text-[11px] mt-1 font-medium" style={{ color: stateColor[callState] }}>
              {stateLabel[callState]}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            {callState === "idle" || callState === "ended" ? (
              <button
                onClick={callState === "ended" ? handleRedial : startCall}
                disabled={!phoneNumber}
                className={`w-14 h-14 rounded-full bg-[var(--ods-success)] hover:bg-[#15803d] disabled:bg-[var(--ods-bg-tertiary)] disabled:text-[var(--ods-text-tertiary)] disabled:cursor-not-allowed flex items-center justify-center text-white transition ${FOCUS_RING}`}
              >
                {callState === "ended" ? <RotateCcw className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </button>
            ) : (
              <>
                <button
                  onClick={endCall}
                  className={`w-14 h-14 rounded-full bg-[var(--ods-danger)] hover:bg-[#b91c1c] flex items-center justify-center text-white transition ${FOCUS_RING}`}
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  onClick={toggleMute}
                  disabled={callState === "on_hold"}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition ${FOCUS_RING} ${
                    callState === "muted"
                      ? "bg-red-500/10 text-red-600"
                      : "bg-[var(--ods-bg-tertiary)] text-[var(--ods-text-secondary)] hover:bg-[var(--ods-border)]"
                  }`}
                >
                  {callState === "muted" ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleHold}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition ${FOCUS_RING} ${
                    callState === "on_hold"
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-[var(--ods-bg-tertiary)] text-[var(--ods-text-secondary)] hover:bg-[var(--ods-border)]"
                  }`}
                >
                  <Headphones className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setKeypadVisible(!keypadVisible)}
              className={`p-2 rounded-ods-sm transition ${FOCUS_RING} ${
                keypadVisible
                  ? "bg-[var(--ods-brand-100)] text-[var(--ods-brand-700)]"
                  : "bg-[var(--ods-bg-tertiary)] text-[var(--ods-text-secondary)] hover:bg-[var(--ods-border)]"
              }`}
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>

          {keypadVisible && (
            <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
              {keypadKeys.flat().map((key) => (
                <button
                  key={key}
                  onClick={() => setDialNumber((prev) => prev + key)}
                  className={`w-full aspect-square flex items-center justify-center bg-[var(--ods-bg-tertiary)] hover:bg-[var(--ods-border)] rounded-ods-sm text-[16px] font-semibold text-[var(--ods-text-primary)] transition ${FOCUS_RING}`}
                >
                  {key}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-[var(--ods-border)] pt-4 flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--ods-text-tertiary)] mb-1">Outcome</label>
              <OutcomeSelect
                value={outcome}
                onChange={(value) => setOutcome(value)}
                disabled={callState !== "ended"}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--ods-text-tertiary)] mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="ods-input resize-none"
                placeholder="Add call notes..."
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleSaveOutcome}
              disabled={callState !== "ended"}
              className="w-full"
            >
              Save & Next
            </Button>
          </div>
        </div>
      </div>
      {incomingCall && (
        <IncomingCallBanner
          callerName={incomingCall.callerName}
          callerNumber={incomingCall.callerNumber}
          onAccept={handleAcceptIncomingCall}
          onReject={handleRejectIncomingCall}
        />
      )}
    </>
  );
}

function IncomingCallBanner({
  callerName,
  callerNumber,
  onAccept,
  onReject,
}: {
  callerName: string;
  callerNumber: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--ods-bg-primary)] border border-[var(--ods-border)] rounded-ods-lg max-w-sm w-full p-6 text-center flex flex-col gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto animate-pulse">
          <Phone className="w-8 h-8 text-[var(--ods-success)]" />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-[var(--ods-text-primary)]">Incoming Call</h3>
          <p className="text-[13px] text-[var(--ods-text-secondary)]">{callerName || "Unknown"}</p>
          <p className="text-[13px] text-[var(--ods-text-tertiary)]">{callerNumber}</p>
        </div>
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={onReject}
            className={`w-14 h-14 rounded-full bg-[var(--ods-danger)] hover:bg-[#b91c1c] flex items-center justify-center text-white transition ${FOCUS_RING}`}
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <button
            onClick={onAccept}
            className={`w-14 h-14 rounded-full bg-[var(--ods-success)] hover:bg-[#15803d] flex items-center justify-center text-white transition ${FOCUS_RING}`}
          >
            <Check className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}