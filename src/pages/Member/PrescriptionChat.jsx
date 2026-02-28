import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleGenAI } from "@google/genai";
import {
  ArrowLeft,
  Send,
  Bot,
  User,
  Pill,
  Loader2,
  AlertTriangle,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import "./PrescriptionChat.css";

const MODEL_CANDIDATES = ["gemini-3-flash-preview"];

function PrescriptionChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const medicines = location.state?.medicines || [];

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedChip, setSelectedChip] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMessage, setIsVoiceMessage] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const voiceTranscriptRef = useRef("");
  const sendMessageRef = useRef(null);

  /* ── Initialize AI client once ── */
  const aiRef = useRef(null);
  if (!aiRef.current) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) aiRef.current = new GoogleGenAI({ apiKey });
  }

  /* ── Setup Speech Recognition ── */
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join("");
        setInput(transcript);
        voiceTranscriptRef.current = transcript;

        if (event.results[0].isFinal) {
          setIsListening(false);
          setIsVoiceMessage(true);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        voiceTranscriptRef.current = "";
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto-send the voice message
        const finalText = voiceTranscriptRef.current.trim();
        if (finalText) {
          voiceTranscriptRef.current = "";
          setIsVoiceMessage(true);
          // Small delay to let state settle before sending
          setTimeout(() => {
            setInput("");
            sendMessageRef.current(finalText, true);
          }, 150);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.abort();
      synthRef.current?.cancel();
    };
  }, []);

  /* ── Voice toggle handlers ── */
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput("");
      setIsVoiceMessage(false);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    // Strip markdown formatting for cleaner speech
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/[-•]\s*/g, ". ")
      .replace(/\n+/g, ". ")
      .replace(/[#*_`]/g, "")
      .trim();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  };

  /* ── Build system context from medicines ── */
  const medicineContext = medicines
    .map(
      (m, i) =>
        `${i + 1}. ${m.medicine_name} — Dosage: ${m.dosage}, Frequency: ${m.frequency}, Timing: ${m.timing}, Duration: ${m.duration}`
    )
    .join("\n");

  const systemPrompt = `You are MediBot, a friendly and knowledgeable medical assistant chatbot.
The user has just scanned a prescription. Here are the extracted medicines:

${medicineContext || "No medicines were extracted."}

Your job:
- Answer questions about these medicines clearly and concisely.
- Explain purposes, side effects, interactions, dosage guidance, and precautions.
- If the user clicks on a medicine chip, provide a detailed overview of that medicine.
- Always remind users to consult their doctor for personalized advice.
- Use simple language; avoid overly technical jargon.
- Format responses with line breaks for readability. Use bullet points where helpful.
- Keep responses focused and under 200 words unless the user asks for detail.`;

  /* ── Welcome message on mount ── */
  useEffect(() => {
    const welcome = medicines.length
      ? `👋 Hi! I've analyzed your prescription and found **${medicines.length} medicine${medicines.length !== 1 ? "s" : ""}**.\n\nTap on any medicine chip above to learn more, or type your question below!`
      : "👋 Hi! It seems no medicines were loaded. Please go back and analyze a prescription first.";

    setMessages([{ role: "bot", text: welcome }]);
  }, []);

  /* ── Auto-scroll ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ── Send message to Gemini ── */
  const sendMessage = async (text, fromVoice = false) => {
    if (!text.trim()) return;

    // If fromVoice, mark as voice message for auto-speak
    if (fromVoice) setIsVoiceMessage(true);

    const userMsg = { role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      if (!aiRef.current) throw new Error("Missing VITE_GEMINI_API_KEY in .env");

      /* Keep only last 10 messages to reduce token overhead */
      const recent = messages.slice(-10);
      const history = recent.map((m) => ({
        role: m.role === "bot" ? "model" : "user",
        parts: [{ text: m.text }],
      }));

      const contents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I'm ready to help with the prescription details." }] },
        ...history,
        { role: "user", parts: [{ text: text.trim() }] },
      ];

      /* Try each model; skip to next on 429 / quota errors */
      let result = null;
      let lastErr = null;
      for (const model of MODEL_CANDIDATES) {
        try {
          result = await aiRef.current.models.generateContent({ model, contents });
          break;
        } catch (e) {
          lastErr = e;
          const msg = e?.message || "";
          if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
            console.warn(`${model} rate-limited, trying next…`);
            continue;
          }
          throw e;
        }
      }
      if (!result && lastErr) throw lastErr;

      const responseText =
        typeof result?.text === "function"
          ? result.text()
          : result?.text ?? "Sorry, I couldn't generate a response.";

      setMessages((prev) => [...prev, { role: "bot", text: responseText }]);

      // If user sent via voice, auto-speak the response
      if (isVoiceMessage) {
        speakText(responseText);
        setIsVoiceMessage(false);
      }
    } catch (err) {
      console.error("Chat error:", err);
      const msg = err?.message || "";
      const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
      const friendlyMsg = isQuota
        ? "⏳ API rate limit reached. Please wait about a minute and try again."
        : `⚠️ ${msg || "Something went wrong. Please try again."}`;
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: friendlyMsg, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Keep sendMessageRef pointing to the latest sendMessage
  sendMessageRef.current = sendMessage;

  /* ── Handle chip click ── */
  const handleChipClick = (med) => {
    setSelectedChip(med.medicine_name);
    sendMessage(
      `Tell me everything about ${med.medicine_name}: what it's used for, common side effects, precautions, and any important interactions I should know about.`
    );
  };

  /* ── Handle form submit ── */
  const handleSubmit = (e) => {
    e.preventDefault();
    // Text submit → not a voice message
    if (!isVoiceMessage) setIsVoiceMessage(false);
    sendMessage(input);
  };

  /* ── Format bot text (simple markdown-ish) ── */
  const formatBotText = (text) => {
    return text.split("\n").map((line, i) => {
      /* Bold */
      const boldParsed = line.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );
      /* Bullet */
      const bulletParsed = boldParsed.replace(
        /^[-•]\s*/,
        '<span class="chat-bullet">•</span> '
      );

      return (
        <span
          key={i}
          className="chat-line"
          dangerouslySetInnerHTML={{ __html: bulletParsed }}
        />
      );
    });
  };

  return (
    <div className="chat-page">
      {/* ── Header ── */}
      <header className="chat-header">
        <button className="chat-back-btn" onClick={() => navigate("/prescriptions")}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <div className="chat-header-title">
          <Bot size={22} />
          <span>MediBot</span>
        </div>
        <div className="chat-header-badge">
          <Sparkles size={14} />
          AI
        </div>
      </header>

      {/* ── Medicine Chips ── */}
      {medicines.length > 0 && (
        <div className="chat-chips-bar">
          {medicines.map((med, i) => (
            <button
              key={i}
              className={`chat-chip ${
                selectedChip === med.medicine_name ? "chat-chip--active" : ""
              }`}
              onClick={() => handleChipClick(med)}
              disabled={loading}
            >
              <Pill size={14} />
              {med.medicine_name?.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {/* ── Messages Area ── */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-bubble-wrap ${
              msg.role === "user" ? "chat-bubble-wrap--user" : "chat-bubble-wrap--bot"
            }`}
          >
            {msg.role === "bot" && (
              <div className={`chat-avatar chat-avatar--bot ${msg.isError ? "chat-avatar--error" : ""}`}>
                {msg.isError ? <AlertTriangle size={16} /> : <Bot size={16} />}
              </div>
            )}
            <div
              className={`chat-bubble ${
                msg.role === "user" ? "chat-bubble--user" : "chat-bubble--bot"
              } ${msg.isError ? "chat-bubble--error" : ""}`}
            >
              {msg.role === "bot" ? (
                <div className="chat-bot-text">
                  {formatBotText(msg.text)}
                  {!msg.isError && (
                    <button
                      className="chat-speak-btn"
                      onClick={() =>
                        isSpeaking ? stopSpeaking() : speakText(msg.text)
                      }
                      title={isSpeaking ? "Stop speaking" : "Listen"}
                    >
                      {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                  )}
                </div>
              ) : (
                <span>{msg.text}</span>
              )}
            </div>
            {msg.role === "user" && (
              <div className="chat-avatar chat-avatar--user">
                <User size={16} />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="chat-bubble-wrap chat-bubble-wrap--bot">
            <div className="chat-avatar chat-avatar--bot">
              <Bot size={16} />
            </div>
            <div className="chat-bubble chat-bubble--bot chat-typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* ── Disclaimer ── */}
      <p className="chat-disclaimer">
        <AlertTriangle size={12} />
        This can make mistakes. Check important info with your doctor.
      </p>

      {/* ── Input Bar ── */}
      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`chat-mic-btn ${isListening ? "chat-mic-btn--active" : ""}`}
          onClick={toggleListening}
          disabled={loading}
          title={isListening ? "Stop listening" : "Voice input"}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder={isListening ? "Listening…" : "Ask about your medicines…"}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setIsVoiceMessage(false);
          }}
          disabled={loading || isListening}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={loading || !input.trim()}
        >
          {loading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
        </button>
      </form>
    </div>
  );
}

export default PrescriptionChat;
