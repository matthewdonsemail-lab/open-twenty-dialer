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
  Radio,
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
    recordingUrl?: string;
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<any>(null);
  const inboundSessionRef = useRef<any>(null);
  const wasEstablishedRef = useRef(false);
  const callStateRef = useRef<CallState>("idle");

  // Audio refs
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);

  // Media refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const phoneNumber = lead?.phone ?? dialNumber;

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Cleanup media streams and recording on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopRecording();
      stopLocalStream();
      if (inboundSessionRef.current) {
        try { inboundSessionRef.current.terminate(); } catch {}
        inboundSessionRef.current = null;
      }
    };
  }, []);

  // Duration timer
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
    };
  }, [callState]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Get local microphone stream
  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setMicrophoneError(null);
      return stream;
    } catch (err) {
      console.error("Failed to get local microphone:", err);
      setMicrophoneError("Microphone access denied. Please allow microphone permissions.");
      throw err;
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  }, []);

  // Recording functions
  const startRecording = useCallback(() => {
    if (!localStreamRef.current) return;

    try {
      recordedChunksRef.current = [];

      // Try to get both local and remote audio for recording
      const recordingStream = new MediaStream();

      // Add local mic track
      localStreamRef.current.getAudioTracks().forEach(track => {
        recordingStream.addTrack(track);
      });

      // Add remote audio track if available
      if (remoteAudioRef.current?.srcObject) {
        const remoteStream = remoteAudioRef.current.srcObject as MediaStream;
        remoteStream.getAudioTracks().forEach(track => {
          recordingStream.addTrack(track);
        });
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

      const recorder = new MediaRecorder(recordingStream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        console.log(`Recording completed: ${blob.size} bytes`);

        // Upload recording
        await uploadRecording(blob);
      };

      recorder.start(1000); // Collect 1s chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording:", err);
      setRecordingError("Failed to start recording");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }, []);

  const uploadRecording = useCallback(async (blob: Blob) => {
    if (!blob || blob.size === 0) {
      console.warn("No recording data to upload");
      return null;
    }

    try {
      const formData = new FormData();
      formData.append("recording", blob, `call-recording-${Date.now()}.webm`);
      formData.append("callId", ""); // Will be populated from call log
      formData.append("leadId", lead?.id || "");

      const response = await fetch("/api/calls/recording", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("Recording uploaded:", data);
      return data.recordingUrl;
    } catch (err) {
      console.error("Failed to upload recording:", err);
      setRecordingError("Failed to upload recording");
      return null;
    }
  }, [lead?.id]);

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
    setMicrophoneError(null);
    setRecordingError(null);

    const sipConfig = getSipConfig();

    if (!isSipConfigured()) {
      console.warn("SIP not configured, using simulated call");
      startSimulatedCall();
      return;
    }

    try {
      const { UserAgent, Registerer, Inviter, SessionState } = await import("sip.js");

      // Get local mic stream first
      const localStream = await getLocalStream();

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
      } as any);

      sessionRef.current = inviter;

      /**
       * Handle incoming tracks from remote party
       */
      (inviter.sessionDescriptionHandler as any)?.peerConnection?.addEventListener("track", (event: any) => {
        console.log("Remote track received:", event.track.id);
        if (event.track.kind === "audio" && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(console.error);
        }
      });

      inviter.stateChange.addListener((state: string) => {
        if (state === SessionState.Established) {
          wasEstablishedRef.current = true;
          setCallState("active");
          setOutcome("answered");
          console.log("Call established - starting recording");
          // Start recording once call is established
          setTimeout(() => startRecording(), 500);
        } else if (state === SessionState.Terminated) {
          if (!wasEstablishedRef.current && callStateRef.current === "ringing") {
            setOutcome("no_answer");
          }
          setCallState("ended");
          console.log("Call terminated");
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
  }, [phoneNumber, startSimulatedCall, getLocalStream]);

  const endCall = useCallback(async () => {
    // Stop recording if active
    await stopRecording();
    stopLocalStream();

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

    // Clear audio elements
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }

    setIncomingCall(null);
    setCallState("ended");
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [stopRecording, stopLocalStream]);

  const toggleMute = useCallback(() => {
    const isCurrentlyMuted = callState === "muted";
    setCallState(isCurrentlyMuted ? "active" : "muted");

    // Toggle actual microphone
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isCurrentlyMuted;
      });
    }
  }, [callState]);

  const toggleHold = useCallback(async () => {
    if (callState === "active" || callState === "on_hold") {
      const session = sessionRef.current;
      if (!session) return;

      const isGoingOnHold = callState !== "on_hold";
      setHoldActive(isGoingOnHold);
      setCallState(isGoingOnHold ? "on_hold" : "active");

      if (isGoingOnHold) {
        // Put call on hold via SIP re-invite
        try {
          await session.pause();
          console.log("Call put on hold");
        } catch (err) {
          console.error("Failed to put call on hold:", err);
          setCallState("active");
          setHoldActive(false);
        }
      } else {
        // Resume call
        try {
          await session.resume();
          console.log("Call resumed");
        } catch (err) {
          console.error("Failed to resume call:", err);
        }
      }
    }
  }, [callState]);

  const handleSaveOutcome = useCallback(async () => {
    // Recording is already uploaded via onstop callback
    // Just signal the call is done with its metadata
    if (onCallEnd) {
      onCallEnd({ outcome, duration, notes, direction });
    }

    // Reset state
    setCallState("idle");
    setDuration(0);
    setNotes("");
    setOutcome("no_answer");
    setDirection("outbound");
    setIsRecording(false);
  }, [onCallEnd, outcome, duration, notes, direction]);

  const handleAcceptIncomingCall = useCallback(async () => {
    const session = inboundSessionRef.current;
    if (!session) return;

    try {
      // Get local mic stream
      const localStream = await getLocalStream();

      // Attach local tracks to the session
      const pc = session.sessionDescriptionHandler?.peerConnection;
      if (pc) {
        localStream.getAudioTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      await session.accept();
      setCallState("active");
      setIncomingCall(null);
    } catch (err) {
      console.warn("Failed to accept incoming call:", err);
    }
  }, [getLocalStream]);

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
      <div className="bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] rounded-ods-md p-6 h-[460px] flex items-center justify-center">
        <div className="text-center text-[var(--ods-text-tertiary)]">
          <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-[13px] font-medium">Select a lead to start a call</p>
          <p className="text-[11px] mt-1">Navigate to a lead detail page and use the dialer</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hidden audio elements for playback */}
      <audio ref={remoteAudioRef} hidden />
      <audio ref={localAudioRef} hidden />

      <div className="bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] rounded-ods-md overflow-hidden h-[460px] flex flex-col">
        {/* 40px header, flat */}
        <div className="h-10 min-h-[40px] px-4 border-b border-[var(--ods-border)] flex items-center gap-3 shrink-0">
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
            {isRecording && (
              <span className="flex items-center gap-1 text-[11px] text-red-500">
                <Radio className="w-3 h-3 animate-pulse" />
                REC
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

        <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          <p className="text-[12px] text-[var(--ods-text-tertiary)] truncate -mt-1">
            {lead.company ?? lead.email ?? "No contact info"}
          </p>

          {/* Microphone error */}
          {microphoneError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-ods-sm p-2 text-[11px] text-red-600">
              {microphoneError}
            </div>
          )}

          {/* Recording error */}
          {recordingError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-ods-sm p-2 text-[11px] text-red-600">
              {recordingError}
            </div>
          )}

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
                  title={callState === "muted" ? "Unmute" : "Mute"}
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
                  title="Hold"
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
              title="Keypad"
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