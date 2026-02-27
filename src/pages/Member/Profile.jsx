import React, { useState, useEffect } from "react";
import { Phone, ClipboardList, UserCircle, Repeat, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import profileData from "./Profile.json";
import { getUserData, getMedicationLogs, calculateAdherence, getMedicines } from "../../services/firebase";
import "./Member.css";

const iconMap = {
  Phone,
  ClipboardList,
  UserCircle,
  Repeat,
};

function HealthScoreRing({ score, label }) {
  const radius = 38;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 75 ? "#16a34a" : score >= 50 ? "#eab308" : "#dc2626";

  return (
    <div className="score-ring-wrap">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle
          cx="45"
          cy="45"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx="45"
          cy="45"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform="rotate(-90 45 45)"
        />
        <text
          x="45"
          y="42"
          textAnchor="middle"
          className="score-number"
          fill={color}
        >
          {score}
        </text>
        <text x="45" y="56" textAnchor="middle" className="score-label">
          {label}
        </text>
      </svg>
    </div>
  );
}

function Profile() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adherence, setAdherence] = useState("0%");
  const [medicinesCount, setMedicinesCount] = useState(0);

  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true);
        const userId = localStorage.getItem("userId") || "2xQjFEnVFFVNjChSIYrGjr7iLRG3";
        const data = await getUserData(userId);
        if (data) {
          setUserData(data);
        } else {
          setError("User not found");
        }

        // Fetch medication logs and calculate adherence
        try {
          const logs = await getMedicationLogs(userId);
          const adherencePercent = calculateAdherence(logs);
          setAdherence(adherencePercent);
        } catch (logErr) {
          console.error("Error fetching medication logs:", logErr);
        }

        // Fetch medicines count
        try {
          const medicines = await getMedicines(userId);
          setMedicinesCount(medicines.length);
        } catch (medErr) {
          console.error("Error fetching medicines:", medErr);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setError(err.message || "Failed to fetch user data");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const { healthConditions, settings } = profileData;

  // Derived user display data
  const displayUser = userData
    ? {
        name: userData.name || "User",
        avatar: userData.gender === "Male" ? "👨" : userData.gender === "Female" ? "👩" : "👤",
        role: userData.role === "caretaker" ? "Caretaker" : "Member",
        age: userData.age || "N/A",
        email: userData.email || "",
        bloodGroup: userData.bloodGroup || "N/A",
        familyCode: userData.familyCode || "",
        healthScore: 75, // Default score, can be fetched from another collection
        healthScoreLabel: "Health",
        adherence: adherence,
        medicinesCount: medicinesCount,
        conditionsCount: healthConditions.length,
      }
    : profileData.user;

  if (loading) {
    return (
      <div className="profile-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <Loader2 size={40} className="spin" style={{ color: "#2fa187" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="error-box" style={{ margin: "40px 20px" }}>
          <AlertTriangle size={18} />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <h2 className="profile-hero-title">My Profile</h2>
        <div className="profile-hero-content">
          <div className="profile-avatar-section">
            <div className="profile-avatar">{displayUser.avatar}</div>
            <div className="profile-info">
              <h3 className="profile-name">{displayUser.name}</h3>
              <p className="profile-role">
                {displayUser.role} &middot; {displayUser.age} yrs
              </p>
            </div>
          </div>
          <HealthScoreRing
            score={displayUser.healthScore}
            label={displayUser.healthScoreLabel}
          />
        </div>
      </div>

      <div className="profile-body">
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-value">{displayUser.adherence}</span>
            <span className="stat-label">Adherence</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{displayUser.medicinesCount}</span>
            <span className="stat-label">Medicines</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{displayUser.conditionsCount}</span>
            <span className="stat-label">Conditions</span>
          </div>
        </div>

        <section className="profile-section">
          <h4 className="section-title">Health Conditions</h4>
          <div className="conditions-list">
            {healthConditions.map((c) => (
              <span key={c} className="condition-chip">
                {c}
              </span>
            ))}
          </div>
        </section>

        <section className="profile-section">
          <h4 className="section-title">Settings</h4>
          <div className="settings-list">
            {settings.map((item) => {
              const Icon = iconMap[item.icon];
              return (
                <div key={item.id} className="settings-card">
                  <div className="settings-icon-wrap">
                    {Icon && <Icon size={22} />}
                  </div>
                  <div className="settings-text">
                    <span className="settings-title">{item.title}</span>
                    <span className="settings-subtitle">{item.subtitle}</span>
                  </div>
                  <ChevronRight size={18} className="settings-arrow" />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Profile;
