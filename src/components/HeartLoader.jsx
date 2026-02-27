import React from "react";

function HeartLoader({ text = "AI is reading your prescription…" }) {
  return (
    <div className="loader-overlay">
      <div className="loader-content">
        <div className="heart-container">
          <svg className="heart-svg" viewBox="0 0 512 512">
            <defs>
              <clipPath id="heartClip">
                <path d="M256 430 L86 270 C40 224 40 152 86 120
                  C110 104 138 100 164 110
                  C194 118 224 140 256 170
                  C288 140 318 118 348 108
                  C374 100 402 104 426 120
                  C472 152 472 224 426 270 Z" />
              </clipPath>
            </defs>

            <path
              className="heart-path"
              d="M256 430 L86 270 C40 224 40 152 86 120
                C110 104 138 100 164 108
                C194 118 224 140 256 170
                C288 140 318 118 348 108
                C374 100 402 104 426 120
                C472 152 472 224 426 270 Z"
            />

            <polyline
              className="pulse-path"
              clipPath="url(#heartClip)"
              points="60,230 145,230 165,145 190,315 215,165 240,295 265,230 460,230"
            />
          </svg>
        </div>
        <p className="loader-text">{text}</p>
      </div>
    </div>
  );
}

export default HeartLoader;
