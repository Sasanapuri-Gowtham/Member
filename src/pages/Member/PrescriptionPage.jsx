import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleGenAI } from "@google/genai";
import UploadBox from "../../components/Upload";
import MedicineCard from "../../components/Card";
import HeartLoader from "../../components/HeartLoader";
import { analyzePrescription } from "../../services/GeminiKey";
import { saveMedicine } from "../../services/firebase";
import {
  Stethoscope,
  Search,
  ClipboardList,
  Loader2,
  AlertCircle,
  Save,
  CheckCircle,
  MessageCircle,
  Upload,
  Bot,
  Send,
  User,
  AlertTriangle,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import "./Prescription.css";

const MODEL_CANDIDATES = ["gemini-3-flash-preview"];

/* ══════════════════════════════════════════
   Inline General Chatbot (tab content)
   ══════════════════════════════════════════ */
function GeneralChatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceMessage, setIsVoiceMessage] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const voiceTranscriptRef = useRef("");
  const sendMessageRef = useRef(null);

  const aiRef = useRef(null);
  if (!aiRef.current) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) aiRef.current = new GoogleGenAI({ apiKey });
  }

  const systemPrompt = `You are MediBot, a friendly and knowledgeable medical assistant chatbot.

Your job:
- Answer general health and medicine-related questions clearly and concisely.
- Explain symptoms, common medicines, dosage guidance, and health tips.
- Always remind users to consult their doctor for personalized medical advice.
- Use simple language; avoid overly technical jargon.
- Format responses with line breaks for readability. Use bullet points where helpful.
- Keep responses focused and under 200 words unless the user asks for detail.`;

  /* ── Welcome ── */
  useEffect(() => {
    setMessages([
      {
        role: "bot",
        text: "👋 Hi! I'm **MediBot**, your AI health assistant.\n\nAsk me anything about medicines, symptoms, health tips, or general medical queries!",
      },
    ]);
  }, []);

  /* ── Speech Recognition ── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (e) => {
        const transcript = Array.from(e.results)
          .map((r) => r[0].transcript)
          .join("");
        setInput(transcript);
        voiceTranscriptRef.current = transcript;
        if (e.results[0].isFinal) {
          setIsListening(false);
          setIsVoiceMessage(true);
        }
      };
      recognition.onerror = () => {
        setIsListening(false);
        voiceTranscriptRef.current = "";
      };
      recognition.onend = () => {
        setIsListening(false);
        const finalText = voiceTranscriptRef.current.trim();
        if (finalText) {
          voiceTranscriptRef.current = "";
          setIsVoiceMessage(true);
          setTimeout(() => {
            setInput("");
            sendMessageRef.current?.(finalText, true);
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

  /* ── Auto-scroll ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition not supported.");
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

  /* ── Send ── */
  const sendMessage = async (text, fromVoice = false) => {
    if (!text.trim()) return;
    if (fromVoice) setIsVoiceMessage(true);

    setMessages((prev) => [...prev, { role: "user", text: text.trim() }]);
    setInput("");
    setLoading(true);

    try {
      if (!aiRef.current) throw new Error("Missing API key");

      const recent = messages.slice(-10);
      const history = recent.map((m) => ({
        role: m.role === "bot" ? "model" : "user",
        parts: [{ text: m.text }],
      }));

      const contents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I'm ready to help!" }] },
        ...history,
        { role: "user", parts: [{ text: text.trim() }] },
      ];

      let result = null;
      let lastErr = null;
      for (const model of MODEL_CANDIDATES) {
        try {
          result = await aiRef.current.models.generateContent({ model, contents });
          break;
        } catch (e) {
          lastErr = e;
          if (e?.message?.includes("429") || e?.message?.toLowerCase().includes("quota")) continue;
          throw e;
        }
      }
      if (!result && lastErr) throw lastErr;

      const responseText =
        typeof result?.text === "function" ? result.text() : result?.text ?? "Sorry, couldn't generate a response.";

      setMessages((prev) => [...prev, { role: "bot", text: responseText }]);

      if (isVoiceMessage) {
        speakText(responseText);
        setIsVoiceMessage(false);
      }
    } catch (err) {
      const msg = err?.message || "";
      const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: isQuota
            ? "⏳ Rate limit reached. Please wait a minute and try again."
            : `⚠️ ${msg || "Something went wrong."}`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  sendMessageRef.current = sendMessage;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isVoiceMessage) setIsVoiceMessage(false);
    sendMessage(input);
  };

  const formatBotText = (text) =>
    text.split("\n").map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      const bullet = bold.replace(/^[-•]\s*/, '<span class="chat-bullet">•</span> ');
      return <span key={i} className="chat-line" dangerouslySetInnerHTML={{ __html: bullet }} />;
    });

  return (
    <div className="inline-chat">
      {/* Messages */}
      <div className="inline-chat-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-bubble-wrap ${msg.role === "user" ? "chat-bubble-wrap--user" : "chat-bubble-wrap--bot"}`}
          >
            {msg.role === "bot" && (
              <div className={`chat-avatar chat-avatar--bot ${msg.isError ? "chat-avatar--error" : ""}`}>
                {msg.isError ? <AlertTriangle size={14} /> : <Bot size={14} />}
              </div>
            )}
            <div
              className={`chat-bubble ${msg.role === "user" ? "chat-bubble--user" : "chat-bubble--bot"} ${
                msg.isError ? "chat-bubble--error" : ""
              }`}
            >
              {msg.role === "bot" ? (
                <div className="chat-bot-text">
                  {formatBotText(msg.text)}
                  {!msg.isError && (
                    <button
                      className="chat-speak-btn"
                      onClick={() => (isSpeaking ? stopSpeaking() : speakText(msg.text))}
                    >
                      {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>
                  )}
                </div>
              ) : (
                <span>{msg.text}</span>
              )}
            </div>
            {msg.role === "user" && (
              <div className="chat-avatar chat-avatar--user">
                <User size={14} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble-wrap chat-bubble-wrap--bot">
            <div className="chat-avatar chat-avatar--bot">
              <Bot size={14} />
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

      {/* Disclaimer */}
      <p className="inline-chat-disclaimer">
        <AlertTriangle size={11} />
        AI can make mistakes. Consult your doctor.
      </p>

      {/* Input */}
      <form className="inline-chat-input-bar" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`chat-mic-btn ${isListening ? "chat-mic-btn--active" : ""}`}
          onClick={toggleListening}
          disabled={loading}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder={isListening ? "Listening…" : "Ask a health question…"}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setIsVoiceMessage(false);
          }}
          disabled={loading || isListening}
        />
        <button type="submit" className="chat-send-btn" disabled={loading || !input.trim()}>
          {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}

/* ══════════════════════════════════════════
   Main Prescription Page with Tabs
   ══════════════════════════════════════════ */
function PrescriptionPage() {
  const [activeTab, setActiveTab] = useState("upload");
  const [file, setFile] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analyzed, setAnalyzed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (selectedFile) => {
    setFile(selectedFile);
    setMedicines([]);
    setError("");
    setAnalyzed(false);
    setSaved(false);
  };

  const handleMedicineUpdate = (index, updatedMedicine) => {
    setMedicines((prev) =>
      prev.map((med, i) => (i === index ? updatedMedicine : med))
    );
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please upload a prescription file first!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await analyzePrescription(file);

      if (result.length > 0) {
        setMedicines(result);
        setAnalyzed(true);
      } else {
        setError("No medicines found. Try a clearer image.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const memberId = localStorage.getItem("userId") || "XixBCGGzCehNB1rZedd11TGWcRI2";
      const visitId = crypto.randomUUID();

      for (const med of medicines) {
        await saveMedicine(med, memberId, visitId);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Failed to save medicines. Please try again.");
      console.error("Firestore save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app">
      {loading && <HeartLoader text="AI is reading your prescription…" />}

      <header className="header">
        <div className="header-logo">
          <Stethoscope size={36} className="header-icon" />
          <div>
            <h1>MediScan AI</h1>
            <p className="header-subtitle">
              Upload your prescription to get your medicine schedule instantly
            </p>
          </div>
        </div>
      </header>

      {/* ── Tab Switcher ── */}
      <div className="tab-switcher">
        <button
          className={`tab-btn ${activeTab === "upload" ? "tab-btn--active" : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          <Upload size={16} />
          Upload
        </button>
        <button
          className={`tab-btn ${activeTab === "chatbot" ? "tab-btn--active" : ""}`}
          onClick={() => setActiveTab("chatbot")}
        >
          <Bot size={16} />
          Chatbot
        </button>
      </div>

      {/* ── Upload Tab ── */}
      {activeTab === "upload" && (
        <>
          <UploadBox onFileChange={handleFileChange} file={file} />

      <button
        className="analyze-btn"
        onClick={handleAnalyze}
        disabled={loading || !file}
      >
        {loading ? (
          <>
            <Loader2 size={20} className="btn-spinner" />
            Analyzing…
          </>
        ) : (
          <>
            <Search size={20} />
            Analyze Prescription
          </>
        )}
      </button>

      {error && (
        <div className="error-box">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {analyzed && medicines.length > 0 && (
        <div className="results-section fade-in">
          <div className="results-header">
            <ClipboardList size={24} />
            <h2>Your Medicine Schedule</h2>
          </div>
          <p className="results-count">
            {medicines.length} medicine{medicines.length !== 1 && "s"} found
          </p>
          <div className="medicine-grid">
            {medicines.map((med, index) => (
              <MedicineCard
                key={index}
                medicine={med}
                index={index}
                onUpdate={handleMedicineUpdate}
              />
            ))}
          </div>

          <button
            className={`save-btn ${saved ? "save-btn--saved" : ""}`}
            onClick={handleSave}
            disabled={saved || saving}
          >
            {saved ? (
              <>
                <CheckCircle size={20} />
                Saved Successfully!
              </>
            ) : saving ? (
              <>
                <Loader2 size={20} className="btn-spinner" />
                Saving…
              </>
            ) : (
              <>
                <Save size={20} />
                Save Medicines
              </>
            )}
          </button>
          {/* Chat bot button */}
          <button
            className="chatbot-btn"
            onClick={() => navigate("/prescriptions/chat", { state: { medicines } })}
          >
            <MessageCircle size={20} />
            Have queries? Ask MediBot
          </button>
        </div>
      )}
        </>
      )}

      {/* ── Chatbot Tab ── */}
      {activeTab === "chatbot" && <GeneralChatbot />}
    </div>
  );
}

export default PrescriptionPage;
