import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Pill,
  FileText,
  Camera,
  User,
  ChevronRight,
  CheckCircle,
  Clock,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";
import homeData from "./MemberHome.json";
import "./Member.css";
import { useParams } from "react-router-dom";
const iconMap = {
  Pill,
  FileText,
  Camera,
  User,
};

function parseTo24h(timeStr) {
  const [time, period] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatCurrentTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function isWithinWindow(scheduledTime, windowMinutes = 30) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const schedMin = parseTo24h(scheduledTime);
  return Math.abs(nowMin - schedMin) <= windowMinutes;
}

function isTimeExceeded(scheduledTime, graceMinutes = 30) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const schedMin = parseTo24h(scheduledTime);
  return nowMin > schedMin + graceMinutes;
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isWarning = toast.type === "warning";
  const isSuccess = toast.type === "success";

  return (
    <div className={`toast toast-${toast.type}`}>
      <div className="toast-icon">
        {isWarning && <AlertTriangle size={20} />}
        {isSuccess && <CheckCircle size={20} />}
        {toast.type === "info" && <Info size={20} />}
      </div>
      <div className="toast-content">
        <span className="toast-title">{toast.title}</span>
        <span className="toast-msg">{toast.message}</span>
      </div>
      <button className="toast-close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}

function RiskScoreBadge({ score }) {
  const color =
    score >= 75 ? "#16a34a" : score >= 50 ? "#eab308" : "#dc2626";

  return (
    <span className="risk-badge" style={{ color, borderColor: color }}>
      {score}
    </span>
  );
}

function MemberHome() {
  const {userId} = useParams();
  useEffect(() => {
  if (userId) {
    localStorage.setItem("userId", userId);
    console.log(userId);
    
  }
}, [userId]);
  const { user, upNext, stats, quickActions } = homeData;
  const [schedule, setSchedule] = useState(homeData.schedule);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    function autoMissExpired() {
      setSchedule((prev) => {
        let changed = false;
        const updated = prev.map((med) => {
          if (med.status === "pending" && isTimeExceeded(med.scheduledTime, 30)) {
            changed = true;
            return { ...med, status: "missed" };
          }
          return med;
        });
        return changed ? updated : prev;
      });
    }

    autoMissExpired();
    const interval = setInterval(autoMissExpired, 60000);
    return () => clearInterval(interval);
  }, []);

  const doneCount = schedule.filter((m) => m.status === "taken").length;
  const missedCount = schedule.filter((m) => m.status === "missed").length;
  const totalCount = schedule.length;
  const progressPct = (doneCount / totalCount) * 100;

  const addToast = useCallback((type, title, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleTakeMedicine = (med) => {
    if (med.status === "taken") return;

    if (!isWithinWindow(med.scheduledTime, 30)) {
      const currentTime = formatCurrentTime();
      addToast(
        "warning",
        "Not the right time!",
        `${med.name} ${med.dosage} is scheduled at ${med.scheduledTime}. Current time is ${currentTime}. Please take it within 30 minutes of the scheduled time.`
      );
      return;
    }

    setSchedule((prev) =>
      prev.map((m) => (m.id === med.id ? { ...m, status: "taken" } : m))
    );
    addToast(
      "success",
      "Medicine Taken!",
      `${med.name} ${med.dosage} marked as taken.`
    );
  };

  const handleSkipMedicine = (med) => {
    if (med.status === "taken") return;
    setSchedule((prev) =>
      prev.map((m) => (m.id === med.id ? { ...m, status: "skipped" } : m))
    );
    addToast(
      "info",
      "Medicine Skipped",
      `${med.name} ${med.dosage} has been skipped.`
    );
  };

  const handleUpNextTake = () => {
    const next = schedule.find(
      (m) => m.status === "pending" && !isTimeExceeded(m.scheduledTime, 30)
    );
    if (next) {
      handleTakeMedicine(next);
    }
  };

  const nextPending = schedule.find(
    (m) => m.status === "pending" && !isTimeExceeded(m.scheduledTime, 30)
  );
  
  return (
    <div className="member-page">
      <div className="toast-container">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="member-hero">
        <div className="member-hero-top">
          <div>
            <p className="member-greeting">
              {user.greeting} {user.avatar}
            </p>
            <h2 className="member-username">{user.name}</h2>
          </div>
          <button className="member-bell">
            <Bell size={22} />
          </button>
        </div>

        <div className="upnext-card">
          <div className="upnext-info">
            <span className="upnext-label">UP NEXT</span>
            <p className="upnext-medicine">
              {nextPending
                ? `${nextPending.name} ${nextPending.dosage}`
                : "All done for today!"}
            </p>
            <p className="upnext-time">
              {nextPending ? nextPending.scheduledTime : ""}
            </p>
          </div>
          {nextPending && (
            <button className="upnext-btn" onClick={handleUpNextTake}>
              Take Now
            </button>
          )}
        </div>
      </div>

      <div className="member-body">
        <div className="progress-card">
          <div className="progress-header">
            <span className="progress-title">Today's Progress</span>
            <span className="progress-count">
              {doneCount}/{totalCount} done
            </span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-value">{stats.adherence}</span>
            <span className="stat-label">Adherence</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <RiskScoreBadge score={stats.riskScore} />
            <span className="stat-label">Risk Score</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{stats.conditions}</span>
            <span className="stat-label">Conditions</span>
          </div>
        </div>

        <div className="quick-grid">
          {quickActions.map((action) => {
            const Icon = iconMap[action.icon];
            return (
              <div key={action.id} className="quick-card">
                <div
                  className="quick-icon-wrap"
                  style={{ color: action.color }}
                >
                  {Icon && <Icon size={26} />}
                </div>
                <span className="quick-label">{action.label}</span>
              </div>
            );
          })}
        </div>

        <section className="schedule-section">
          <div className="schedule-header">
            <h4 className="section-title">Today's Schedule</h4>
            <button className="view-all-btn">
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="schedule-list">
            {schedule.map((med) => (
              <div
                key={med.id}
                className={`schedule-card ${
                  med.status === "skipped"
                    ? "schedule-card--skipped"
                    : med.status === "missed"
                    ? "schedule-card--missed"
                    : ""
                }`}
              >
                <div className="schedule-status-icon">
                  {med.status === "taken" ? (
                    <CheckCircle size={28} className="icon-taken" />
                  ) : med.status === "skipped" ? (
                    <X size={28} className="icon-skipped" />
                  ) : med.status === "missed" ? (
                    <AlertTriangle size={28} className="icon-missed" />
                  ) : (
                    <Clock size={28} className="icon-pending" />
                  )}
                </div>
                <div className="schedule-med-info">
                  <span className="schedule-med-name">{med.name}</span>
                  <span className="schedule-med-dosage">
                    {med.dosage}
                    {med.scheduledTime && (
                      <span className="schedule-med-time">
                        {" "}
                        · {med.scheduledTime}
                      </span>
                    )}
                  </span>
                </div>
                <div className="schedule-actions">
                  {med.status === "taken" ? (
                    <span className="taken-label">Taken</span>
                  ) : med.status === "skipped" ? (
                    <span className="skipped-label">Skipped</span>
                  ) : med.status === "missed" ? (
                    <span className="missed-label">Missed</span>
                  ) : (
                    <>
                      <button
                        className="action-check"
                        onClick={() => handleTakeMedicine(med)}
                      >
                        <CheckCircle size={22} />
                      </button>
                      <button
                        className="action-skip"
                        onClick={() => handleSkipMedicine(med)}
                      >
                        <X size={22} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default MemberHome;
