import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  Clock,
  Sunrise,
  Moon,
  Sunset,
  Pill,
  RefreshCw,
  Calendar,
  FileText,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { getMedicines } from "../../services/firebase";
import "./Member.css";

export default function MyMedications() {
  const [meds, setMeds] = useState({
    morning: [],
    afternoon: [],
    evening: [],
  });
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMedicines() {
      try {
        setLoading(true);
        const memberId = localStorage.getItem("userId") || "XixBCGGzCehNB1rZedd11TGWcRI2";
        const medicines = await getMedicines(memberId);
        
        // Organize medicines by timing
        const organized = {
          morning: [],
          afternoon: [],
          evening: [],
        };

        medicines.forEach((med) => {
          const timing = med.timing || [];
          if (timing.includes("morning")) organized.morning.push(med);
          if (timing.includes("afternoon")) organized.afternoon.push(med);
          if (timing.includes("evening")) organized.evening.push(med);
        });

        setMeds(organized);
      } catch (err) {
        console.error("Error fetching medicines:", err);
        setError(err.message || "Failed to fetch medicines");
      } finally {
        setLoading(false);
      }
    }
    fetchMedicines();
  }, []);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="page-wrapper" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <Loader2 size={40} className="spin" style={{ color: "#2fa187" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <header className="header">
          <p className="header-title">My Medications</p>
        </header>
        <div className="error-box" style={{ margin: "20px" }}>
          <AlertTriangle size={18} />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  const totalMeds = meds.morning.length + meds.afternoon.length + meds.evening.length;

  return (
    <div className="page-wrapper">
      {/* ---- Header ---- */}
      <header className="header">
        <p className="header-title">My Medications</p>
        <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>{totalMeds} active {totalMeds === 1 ? "medicine" : "medicines"}</p>
      </header>

      <main className="content">
        {totalMeds === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <Pill size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
            <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>No medicines found</p>
            <p style={{ fontSize: "0.9rem", marginTop: "8px" }}>Your prescribed medicines will appear here</p>
          </div>
        ) : (
          <div className="sections-wrapper">
            {meds.morning.length > 0 && (
              <Section
                title="MORNING"
                icon={<Sunrise size={16} />}
                meds={meds.morning}
                expandedId={expandedId}
                onToggle={toggleExpand}
              />
            )}
            {meds.afternoon.length > 0 && (
              <Section
                title="AFTERNOON"
                icon={<Sunset size={16} />}
                meds={meds.afternoon}
                expandedId={expandedId}
                onToggle={toggleExpand}
              />
            )}
            {meds.evening.length > 0 && (
              <Section
                title="EVENING"
                icon={<Moon size={16} />}
                meds={meds.evening}
                expandedId={expandedId}
                onToggle={toggleExpand}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, icon, meds, expandedId, onToggle }) {
  return (
    <div className="section">
      <p className="section-title">{icon} {title}</p>
      {meds.map((med) => (
        <MedicationCard
          key={med.id}
          med={med}
          isExpanded={expandedId === med.id}
          onToggle={() => onToggle(med.id)}
        />
      ))}
    </div>
  );
}

function MedicationCard({ med, isExpanded, onToggle }) {
  const timingText = med.timing?.join(", ") || "Not specified";
  const durationText = med.numberOfDays ? `${med.numberOfDays} days` : "Not specified";
  
  const detailRows = [
    { icon: <RefreshCw size={15} />, label: "Frequency", value: med.frequency || "Not specified" },
    { icon: <Clock size={15} />, label: "Timing", value: timingText },
    { icon: <Calendar size={15} />, label: "Duration", value: durationText },
    { icon: <FileText size={15} />, label: "Medicine ID", value: med.medicineId || "N/A" },
  ];

  return (
    <div className={`med-card-wrapper ${isExpanded ? "expanded" : ""}`}>
      <div className="med-card" onClick={onToggle}>
        <div className="med-left">
          <div className="med-icon pending">
            <Pill size={22} />
          </div>
          <div className="med-info">
            <h4 className="med-name">{med.name}</h4>
            <p className="med-dose">{med.dosage}</p>
          </div>
        </div>

        <button className={`expand-btn ${isExpanded ? "expand-btn--open" : ""}`}>
          <ChevronDown size={20} />
        </button>
      </div>

      <div className={`med-details ${isExpanded ? "med-details--open" : ""}`}>
        <div className="med-details-inner">
          {detailRows.map((row) => (
            <div key={row.label} className="detail-row">
              <div className="detail-icon">{row.icon}</div>
              <div className="detail-content">
                <span className="detail-label">{row.label}</span>
                <span className="detail-value">{row.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}