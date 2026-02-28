import React, { useState, useEffect, useRef, useCallback } from "react";
import { Pill, Mic, X, CheckCircle, Clock3, SkipForward } from "lucide-react";
import "./VoiceReminder.css";

const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/**
 * VoiceReminder — watches the schedule and pops an overlay when a
 * medicine is due.  It speaks the reminder aloud, then listens for
 * the user's voice ("taken / done / yes" → take, "skip" → skip,
 * "later" → snooze 5 min).  Also has manual buttons as fallback.
 *
 * Props:
 *   schedule        – array of { id, name, dosage, scheduledTime, status }
 *   onTakeMedicine  – (med) => void
 *   onSkipMedicine  – (med) => void
 */
export default function VoiceReminder({ schedule, onTakeMedicine, onSkipMedicine }) {
  const [activeMed, setActiveMed] = useState(null);       // medicine currently being reminded
  const [phase, setPhase] = useState("idle");              // idle | speaking | listening | result
  const [transcript, setTranscript] = useState("");
  const [resultText, setResultText] = useState("");
  const [resultType, setResultType] = useState("");        // success | skip | delay | error
  const [snoozedIds, setSnoozedIds] = useState({});        // { id: expiry timestamp }
  const dismissedIds = useRef(new Set());                   // medicines already handled this session

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const checkIntervalRef = useRef(null);
  const speechUnlocked = useRef(false);

  /* ── Unlock speech synthesis on first user interaction ── */
  useEffect(() => {
    const unlock = () => {
      if (!speechUnlocked.current) {
        const u = new SpeechSynthesisUtterance("");
        synthRef.current.speak(u);
        speechUnlocked.current = true;
      }
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  /* ── Helper to convert "02:00 PM" → minutes-from-midnight ── */
  const parseTo24hMin = useCallback((timeStr) => {
    if (!timeStr) return -1;
    const [time, period] = timeStr.split(" ");
    let [h, m] = time.split(":").map(Number);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }, []);

  /* ── Check every 30s if a pending medicine is due ── */
  useEffect(() => {
    function checkSchedule() {
      if (activeMed) return;                           // already showing a reminder

      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      for (const med of schedule) {
        if (med.status !== "pending") continue;

        // skip if already dismissed/handled this session
        if (dismissedIds.current.has(med.id)) continue;

        // skip if snoozed and snooze hasn't expired
        if (snoozedIds[med.id] && Date.now() < snoozedIds[med.id]) continue;

        const schedMin = parseTo24hMin(med.scheduledTime);
        if (schedMin < 0) continue;

        // trigger if within ±2 minutes of scheduled time
        if (Math.abs(nowMin - schedMin) <= 2) {
          setActiveMed(med);
          break;
        }
      }
    }

    checkSchedule();
    checkIntervalRef.current = setInterval(checkSchedule, 30_000);
    return () => clearInterval(checkIntervalRef.current);
  }, [schedule, activeMed, snoozedIds, parseTo24hMin]);

  /* ── Speak the reminder when activeMed changes ── */
  useEffect(() => {
    if (!activeMed) return;

    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const msg = `It is ${timeNow}. Time to take ${activeMed.name} ${activeMed.dosage}.`;

    speakText(msg, () => {
      // After speaking, automatically start listening
      startListening();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMed]);

  /* ── Speak helper ── */
  const speakText = (text, onEnd) => {
    setPhase("speaking");
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      if (onEnd) onEnd();
    };
    synthRef.current.speak(utterance);
  };

  /* ── Start speech recognition ── */
  const startListening = () => {
    if (!SpeechRecognition) {
      setPhase("result");
      setResultText("Voice recognition not supported. Please use buttons.");
      setResultType("error");
      return;
    }

    setPhase("listening");
    setTranscript("");
    setResultText("");
    setResultType("");

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const speech = event.results[0][0].transcript;
      setTranscript(speech);
      handleVoiceIntent(speech);
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e.error);
      if (e.error === "no-speech") {
        setPhase("result");
        setResultText("No speech detected. Tap the mic or use buttons.");
        setResultType("error");
      }
    };

    recognition.onend = () => {
      // If still in listening phase (no result came), reset
      setPhase((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  /* ── Classify intent from voice ── */
  const handleVoiceIntent = (text) => {
    const lower = text.toLowerCase();

    if (
      lower.includes("take") ||
      lower.includes("taken") ||
      lower.includes("done") ||
      lower.includes("yes")
    ) {
      confirmTaken();
    } else if (
      lower.includes("skip") ||
      lower.includes("not taken") ||
      lower.includes("no")
    ) {
      confirmSkipped();
    } else if (lower.includes("later") || lower.includes("snooze")) {
      confirmLater();
    } else {
      setPhase("result");
      setResultText("Couldn't understand. Try again or use buttons.");
      setResultType("error");
    }
  };

  /* ── Action handlers ── */
  const confirmTaken = () => {
    setPhase("result");
    setResultText("Marked as taken!");
    setResultType("success");
    speakText("Great! Marked as taken.", null);
    if (activeMed) {
      dismissedIds.current.add(activeMed.id);
      onTakeMedicine(activeMed);
    }
    setTimeout(dismissOverlay, 2000);
  };

  const confirmSkipped = () => {
    setPhase("result");
    setResultText("Marked as skipped");
    setResultType("skip");
    if (activeMed) {
      dismissedIds.current.add(activeMed.id);
      onSkipMedicine(activeMed);
    }
    setTimeout(dismissOverlay, 1500);
  };

  const confirmLater = () => {
    setPhase("result");
    setResultText("Snoozed for 5 minutes");
    setResultType("delay");
    speakText("Okay, I'll remind you in 5 minutes.", null);
    if (activeMed) {
      setSnoozedIds((prev) => ({
        ...prev,
        [activeMed.id]: Date.now() + 5 * 60 * 1000,
      }));
    }
    setTimeout(dismissOverlay, 2000);
  };

  const dismissOverlay = () => {
    synthRef.current.cancel();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
    }
    // Mark as dismissed so it won't re-trigger on navigation
    if (activeMed) dismissedIds.current.add(activeMed.id);
    setActiveMed(null);
    setPhase("idle");
    setTranscript("");
    setResultText("");
    setResultType("");
  };

  /* ── Nothing to show ── */
  if (!activeMed) return null;

  return (
    <div className="voice-overlay">
      <div className="voice-card">
        <button className="voice-close-btn" onClick={dismissOverlay}>
          <X size={16} />
        </button>

        <div className="voice-pill-icon">
          <Pill size={28} />
        </div>
        <p className="voice-med-name">{activeMed.name}</p>
        <p className="voice-med-dosage">{activeMed.dosage}</p>
        <p className="voice-med-time">Scheduled at {activeMed.scheduledTime}</p>

        {/* Mic area */}
        <div className="voice-mic-area">
          <button
            className={`voice-mic-btn ${phase === "listening" ? "listening" : phase === "speaking" ? "speaking" : "idle"}`}
            onClick={phase === "listening" ? null : startListening}
            disabled={phase === "speaking"}
          >
            <Mic size={28} />
          </button>
          <span
            className={`voice-status-text ${resultType}`}
          >
            {phase === "speaking" && "Speaking..."}
            {phase === "listening" && "Listening — say 'Taken', 'Skip', or 'Later'"}
            {phase === "result" && resultText}
            {phase === "idle" && "Tap mic to respond with voice"}
          </span>
          {transcript && <span className="voice-transcript">"{transcript}"</span>}
        </div>

        {/* Manual fallback buttons */}
        <div className="voice-actions">
          <button
            className="voice-action-btn take"
            onClick={confirmTaken}
            disabled={phase === "speaking"}
          >
            <CheckCircle size={16} /> Taken
          </button>
          <button
            className="voice-action-btn later"
            onClick={confirmLater}
            disabled={phase === "speaking"}
          >
            <Clock3 size={16} /> Later
          </button>
          <button
            className="voice-action-btn skip"
            onClick={confirmSkipped}
            disabled={phase === "speaking"}
          >
            <SkipForward size={16} /> Skip
          </button>
        </div>
        <p className="voice-hint">Or respond by voice: "I've taken it" / "Skip" / "Later"</p>
      </div>
    </div>
  );
}
