import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  Clock,
  Sunrise,
  Moon,
  Pill,
  RefreshCw,
  Calendar,
  Stethoscope,
  FileText,
  AlertTriangle,
  User,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import { db } from "../../services/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import medsData from "./MyMedicines.json";
import "./Member.css";

export default function MyMedications() {
  const [meds, setMeds] = useState({
    morning: medsData.morning.map((m) => ({ ...m, status: "pending" })),
    evening: medsData.evening.map((m) => ({ ...m, status: "pending" })),
    saved: [],
  });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    async function fetchSaved() {
      try {
        const medsRef = collection(db, "medications");
        const q = query(medsRef, orderBy("created_at", "desc"));
        const snapshot = await getDocs(q);
        const savedMeds = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          status: "pending",
        }));
        setMeds((prev) => ({ ...prev, saved: savedMeds }));
      } catch (err) {
        console.error("Error fetching medications:", err);
      }
    }
    fetchSaved();
  }, []);

  const allMeds = [...meds.morning, ...meds.evening];
  const total = allMeds.length;
  const taken = allMeds.filter((m) => m.status === "taken").length;
  const progressPercent = total ? (taken / total) * 100 : 0;

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="page-wrapper">
      {/* ---- Header ---- */}
      <header className="header">
        <p className="header-title">My Medications</p>
      </header>

      <main className="content">
        <div className="sections-wrapper">
          <Section
            title="MORNING"
            icon={<Sunrise size={16} />}
            meds={meds.morning}
            expandedId={expandedId}
            onToggle={toggleExpand}
          />
          <Section
            title="EVENING"
            icon={<Moon size={16} />}
            meds={meds.evening}
            expandedId={expandedId}
            onToggle={toggleExpand}
          />
          {meds.saved.length > 0 && (
            <Section
              title="SAVED FROM PRESCRIPTION"
              icon={<ClipboardList size={16} />}
              meds={meds.saved}
              expandedId={expandedId}
              onToggle={toggleExpand}
            />
          )}
        </div>
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
  const detailRows = [
    { icon: <RefreshCw size={15} />, label: "Frequency", value: med.frequency },
    { icon: <Clock size={15} />, label: "Timing", value: med.timing },
    { icon: <Calendar size={15} />, label: "Duration", value: med.duration },
    { icon: <Stethoscope size={15} />, label: "Purpose", value: med.purpose },
    { icon: <FileText size={15} />, label: "Instructions", value: med.instructions },
    { icon: <AlertTriangle size={15} />, label: "Side Effects", value: med.side_effects },
    { icon: <User size={15} />, label: "Prescribed By", value: med.prescribed_by },
    { icon: <CalendarDays size={15} />, label: "Prescribed On", value: med.prescribed_date },
  ];

  return (
    <div className={`med-card-wrapper ${isExpanded ? "expanded" : ""}`}>
      <div className="med-card" onClick={onToggle}>
        <div className="med-left">
          <div className="med-icon pending">
            <Pill size={22} />
          </div>
          <div className="med-info">
            <h4 className="med-name">{med.medicine_name}</h4>
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