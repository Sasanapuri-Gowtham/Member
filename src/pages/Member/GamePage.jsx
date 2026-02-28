import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

const GAME_URL = "https://spontaneous-choux-2f9680.netlify.app/";

export default function GamePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  return (
    <div className="game-page">
      {/* Top notch back button */}
      <button className="game-back-notch" onClick={() => navigate(-1)}>
        <ArrowLeft size={20} />
      </button>

      {/* Loading indicator */}
      {loading && (
        <div className="game-loading">
          <Loader2 size={36} className="spin" style={{ color: "#2fa187" }} />
          <p>Loading...</p>
        </div>
      )}

      {/* Iframe */}
      <iframe
        src={GAME_URL}
        className="game-iframe"
        title="Health Game"
        allow="accelerometer; gyroscope; autoplay; fullscreen"
        onLoad={() => setLoading(false)}
        style={{ opacity: loading ? 0 : 1 }}
      />
    </div>
  );
}
