import React from "react";
import { Phone, ClipboardList, UserCircle, Repeat, ChevronRight } from "lucide-react";
import profileData from "./Profile.json";
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
  const { user, healthConditions, settings } = profileData;

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <h2 className="profile-hero-title">My Profile</h2>
        <div className="profile-hero-content">
          <div className="profile-avatar-section">
            <div className="profile-avatar">{user.avatar}</div>
            <div className="profile-info">
              <h3 className="profile-name">{user.name}</h3>
              <p className="profile-role">
                {user.role} &middot; {user.age} yrs
              </p>
            </div>
          </div>
          <HealthScoreRing
            score={user.healthScore}
            label={user.healthScoreLabel}
          />
        </div>
      </div>

      <div className="profile-body">
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-value">{user.adherence}</span>
            <span className="stat-label">Adherence</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{user.medicinesCount}</span>
            <span className="stat-label">Medicines</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{user.conditionsCount}</span>
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
