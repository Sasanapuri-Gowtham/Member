import React, { useRef, useState } from "react";
import { Pill, Ruler, RefreshCw, Clock, Calendar, ImagePlus, Pencil } from "lucide-react";

function Card({ medicine, index, onUpdate }) {
  const [editingField, setEditingField] = useState(null);
  const [medicineImage, setMedicineImage] = useState(null);
  const imageInputRef = useRef(null);

  const handleFieldChange = (field, value) => {
    onUpdate(index, { ...medicine, [field]: value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMedicineImage(url);
    }
  };

  const fields = [
    { key: "dosage", label: "Dosage", icon: <Ruler size={16} /> },
    { key: "frequency", label: "Frequency", icon: <RefreshCw size={16} /> },
    { key: "timing", label: "Timing", icon: <Clock size={16} /> },
    { key: "duration", label: "Duration", icon: <Calendar size={16} /> },
  ];

  return (
    <div className="medicine-card fade-in">
      <div className="card-number">#{index + 1}</div>

      <div className="card-image-area" onClick={() => imageInputRef.current.click()}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleImageUpload}
        />
        {medicineImage ? (
          <img src={medicineImage} alt="Medicine" className="medicine-thumbnail" />
        ) : (
          <div className="image-placeholder">
            <ImagePlus size={28} />
            <span>Add Image</span>
          </div>
        )}
      </div>

      <div
        className="medicine-name-row"
        onClick={() => setEditingField("medicine_name")}
      >
        <Pill size={18} className="name-icon" />
        {editingField === "medicine_name" ? (
          <input
            className="edit-input edit-input-name"
            value={medicine.medicine_name}
            autoFocus
            onChange={(e) => handleFieldChange("medicine_name", e.target.value)}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
          />
        ) : (
          <span className="medicine-name-text">
            {medicine.medicine_name}
            <Pencil size={12} className="edit-hint" />
          </span>
        )}
      </div>

      <div className="card-divider" />

      <div className="medicine-details">
        {fields.map((f) => (
          <div
            className="detail-row"
            key={f.key}
            onClick={() => setEditingField(f.key)}
          >
            <span className="detail-label">
              {f.icon}
              {f.label}
            </span>
            {editingField === f.key ? (
              <input
                className="edit-input"
                value={medicine[f.key]}
                autoFocus
                onChange={(e) => handleFieldChange(f.key, e.target.value)}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
              />
            ) : (
              <span className="detail-value">
                {medicine[f.key]}
                <Pencil size={11} className="edit-hint" />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Card;