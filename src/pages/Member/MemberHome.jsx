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
  Loader2,
} from "lucide-react";
import homeData from "./MemberHome.json";
import { getUserData, getMedicines, getMedicationLogs, calculateAdherence, logMedicineAction, getTodayMedicationLogs } from "../../services/firebase";
import VoiceReminder from "./VoiceReminder";
import "./Member.css";
import { useParams, useNavigate } from "react-router-dom";
const iconMap = {
  Pill,
  FileText,
  Camera,
  User,
};

/* Map timing labels to default scheduled times */
const TIMING_TO_TIME = {
  morning: "08:00 AM",
  afternoon: "02:00 PM",
  evening: "09:00 PM",
};

/** Convert 24h string like "13:00" to "01:00 PM" */
function to12h(time24) {
  if (!time24 || !time24.includes(":")) return null;
  let [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

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

/** Check if scheduled time is still upcoming (not yet past) */
function isUpcoming(scheduledTime) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const schedMin = parseTo24h(scheduledTime);
  // Show as upcoming if scheduled time is in the future or within 2 min past
  return nowMin <= schedMin + 2;
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
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [adherence, setAdherence] = useState("0%");

  /* ── Fetch user data from Firebase ── */
  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true);
        setError(null);
        
        // Get userId from params or localStorage
        let userId = paramUserId || localStorage.getItem("userId");
        
        if (!userId) {
          // Default fallback for testing
          userId = "2xQjFEnVFFVNjChSIYrGjr7iLRG3";
        }
        
        if (paramUserId) {
          localStorage.setItem("userId", paramUserId);
        }

        const data = await getUserData(userId);
        if (data) {
          setUserData(data);
        } else {
          setError("User not found");
        }

        // Fetch real medicines and build today's schedule
        try {
          const medicines = await getMedicines(userId);

          let idCounter = 1;
          const scheduleItems = [];

          medicines.forEach((med) => {
            const timings = med.timing || [];
            const schedTimes = med.scheduledTimes || {};
            timings.forEach((t) => {
              const time12 = to12h(schedTimes[t]) || TIMING_TO_TIME[t] || "08:00 AM";
              scheduleItems.push({
                id: idCounter++,
                name: med.name,
                dosage: med.dosage || "",
                scheduledTime: time12,
                status: "pending",
                medicineId: med.medicineId || med.id,
              });
            });
          });

          // Sort by time of day
          scheduleItems.sort(
            (a, b) => parseTo24h(a.scheduledTime) - parseTo24h(b.scheduledTime)
          );

          // Restore today's taken/skipped statuses from Firebase
          try {
            const todayLogs = await getTodayMedicationLogs(userId);
            scheduleItems.forEach((item) => {
              const key = `${item.medicineId}_${item.scheduledTime?.replace(/[\s:]/g, "")}`;
              if (todayLogs[key]) {
                item.status = todayLogs[key];
              }
            });
          } catch (logRestoreErr) {
            console.error("Error restoring today's logs:", logRestoreErr);
          }

          setSchedule(scheduleItems);
        } catch (medErr) {
          console.error("Error fetching medicines:", medErr);
        }

        // Fetch medication logs and calculate adherence
        try {
          const logs = await getMedicationLogs(userId);
          const adherencePercent = calculateAdherence(logs);
          setAdherence(adherencePercent);
        } catch (logErr) {
          console.error("Error fetching medication logs:", logErr);
          // Keep default adherence value
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setError(err.message || "Failed to fetch user data");
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [paramUserId]);

  useEffect(() => {
    const userId = paramUserId || localStorage.getItem("userId") || "2xQjFEnVFFVNjChSIYrGjr7iLRG3";

    function autoMissExpired() {
      setSchedule((prev) => {
        let changed = false;
        const updated = prev.map((med) => {
          if (med.status === "pending" && isTimeExceeded(med.scheduledTime, 5)) {
            changed = true;
            // Persist missed status to Firebase
            logMedicineAction(userId, med, "missed").catch((err) =>
              console.error("Failed to log missed action:", err)
            );
            return { ...med, status: "missed" };
          }
          return med;
        });
        return changed ? updated : prev;
      });
    }

    autoMissExpired();
    const interval = setInterval(autoMissExpired, 30000);
    return () => clearInterval(interval);
  }, [schedule.length, paramUserId]);

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

    // Persist to Firebase
    const userId = paramUserId || localStorage.getItem("userId") || "2xQjFEnVFFVNjChSIYrGjr7iLRG3";
    logMedicineAction(userId, med, "taken").catch((err) =>
      console.error("Failed to log taken action:", err)
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

    // Persist to Firebase
    const userId = paramUserId || localStorage.getItem("userId") || "2xQjFEnVFFVNjChSIYrGjr7iLRG3";
    logMedicineAction(userId, med, "skipped").catch((err) =>
      console.error("Failed to log skipped action:", err)
    );

    addToast(
      "info",
      "Medicine Skipped",
      `${med.name} ${med.dosage} has been skipped.`
    );
  };

  const handleUpNextTake = () => {
    const next = schedule.find(
      (m) => m.status === "pending" && isUpcoming(m.scheduledTime)
    );
    if (next) {
      handleTakeMedicine(next);
    }
  };

  const nextPending = schedule.find(
    (m) => m.status === "pending" && isUpcoming(m.scheduledTime)
  );

  /* ── Derived user display data ── */
  const displayUser = userData
    ? {
        name: userData.name || "User",
        avatar: userData.gender === "Male" ? "👨" : userData.gender === "Female" ? "👩" : "👤",
        greeting: getGreeting(),
        role: userData.role || "member",
        age: userData.age || "N/A",
      }
    : homeData.user;

  const { stats, quickActions } = homeData;

  /* ── Loading & Error states ── */
  if (loading) {
    return (
      <div className="member-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <Loader2 size={40} className="spin" style={{ color: "#2fa187" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="member-page">
        <div className="error-box" style={{ margin: "40px 20px" }}>
          <AlertTriangle size={18} />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="member-page">
      {/* Voice Reminder Overlay */}
      <VoiceReminder
        schedule={schedule}
        onTakeMedicine={handleTakeMedicine}
        onSkipMedicine={handleSkipMedicine}
      />

      <div className="toast-container">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="member-hero">
        <div className="member-hero-top">
          <div>
            <p className="member-greeting">
              {displayUser.greeting} {displayUser.avatar}
            </p>
            <h2 className="member-username">{displayUser.name}</h2>
          </div>
          <button className="member-bell" onClick={() => navigate("/profile")}>
            <User size={22} />
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
            <span className="stat-value">{adherence}</span>
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
