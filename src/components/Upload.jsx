import React, { useRef, useState } from "react";
import { Upload as UploadIcon, FileText, Image, CheckCircle } from "lucide-react";

function Upload({ onFileChange, file }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) onFileChange(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleFileInput = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) onFileChange(selectedFile);
  };

  return (
    <div
      className={`upload-box ${dragging ? "upload-box--dragging" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf, image/*"
        hidden
        onChange={handleFileInput}
      />

      {file ? (
        <div className="file-selected">
          <span className="file-icon-wrap">
            {file.type === "application/pdf" ? (
              <FileText size={36} />
            ) : (
              <Image size={36} />
            )}
          </span>
          <div className="file-meta">
            <p className="file-name">
              <CheckCircle size={14} className="check-icon" />
              {file.name}
            </p>
            <p className="file-size">
              {(file.size / 1024).toFixed(1)} KB — Click to change
            </p>
          </div>
        </div>
      ) : (
        <div className="upload-placeholder">
          <UploadIcon size={36} className="upload-icon" />
          <p className="upload-text">
            Drag & Drop or <span className="upload-link">Click to Upload</span>
          </p>
          <p className="upload-hint">Supports PDF, JPG, PNG</p>
        </div>
      )}
    </div>
  );
}

export default Upload;