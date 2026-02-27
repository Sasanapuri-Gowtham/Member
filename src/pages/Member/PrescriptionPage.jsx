import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadBox from "../../components/Upload";
import MedicineCard from "../../components/Card";
import HeartLoader from "../../components/HeartLoader";
import { analyzePrescription } from "../../services/GeminiKey";
import { db } from "../../services/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { Stethoscope, Search, ClipboardList, Loader2, AlertCircle, Save, CheckCircle, MessageCircle } from "lucide-react";
import "./Prescription.css";

function PrescriptionPage() {
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
      const medsRef = collection(db, "medications");
      const timestamp = new Date().toISOString().split("T")[0];

      for (const med of medicines) {
        await addDoc(medsRef, {
          medicine_name: med.medicine_name || "",
          dosage: med.dosage || "",
          frequency: med.frequency || "",
          timing: med.timing || "",
          duration: med.duration || "",
          purpose: "",
          instructions: "",
          side_effects: "",
          prescribed_by: "",
          prescribed_date: timestamp,
          created_at: Timestamp.now(),
        });
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
    </div>
  );
}

export default PrescriptionPage;
