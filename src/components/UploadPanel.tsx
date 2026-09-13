import { useRef, useState, type DragEvent } from "react";

interface UploadPanelProps {
  fileName: string;
  onFile: (file: File) => void;
}

export function UploadPanel({ fileName, onFile }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <section
      className={`upload-panel${dragOver ? " drag-over" : ""}`}
      onDragEnter={(e: DragEvent) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <div className="upload-panel-inner">
        <div className="upload-icon">⬆</div>
        <h2>Upload employee master data</h2>
        <p className="hint">
          CSV or Excel (.xlsx/.xls) with columns:{" "}
          <code>
            employee_id, full_name, manager_id, department, hire_date,
            termination_date, status
          </code>
        </p>

        <label className="file-button" htmlFor="csvInput">
          Choose file
          <input
            ref={inputRef}
            type="file"
            id="csvInput"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>
        <p className="drop-hint">or drag &amp; drop a .csv or .xlsx file anywhere on this panel</p>
        <p className="file-name">{fileName}</p>
      </div>
    </section>
  );
}
