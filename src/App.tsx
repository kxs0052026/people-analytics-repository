import { useState } from "react";
import {
  computeMetrics,
  mapHeaders,
  parseCsv,
  rowsToRecords,
  type EmployeeRecord,
  type Metrics,
} from "./lib/csv";
import { parseExcel } from "./lib/excel";
import { UploadPanel } from "./components/UploadPanel";
import { ErrorPanel } from "./components/ErrorPanel";
import { MetricCard } from "./components/MetricCard";
import { DataPreviewTable } from "./components/DataPreviewTable";

interface DashboardState {
  fileName: string;
  errors: string[];
  records: EmployeeRecord[] | null;
  metrics: Metrics | null;
}

const initialState: DashboardState = {
  fileName: "",
  errors: [],
  records: null,
  metrics: null,
};

function App() {
  const [state, setState] = useState<DashboardState>(initialState);

  function handleFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isCsv = extension === "csv";
    const isExcel = extension === "xlsx" || extension === "xls";

    if (!isCsv && !isExcel) {
      setState((s) => ({
        ...s,
        fileName: file.name,
        errors: [
          "Unsupported file type. Please upload a .csv, .xlsx, or .xls file.",
        ],
        records: null,
        metrics: null,
      }));
      return;
    }

    function finishWithRows(rows: string[][]) {
      try {
        if (rows.length === 0) {
          setState((s) => ({
            ...s,
            fileName: file.name,
            errors: ["The file appears to be empty."],
            records: null,
            metrics: null,
          }));
          return;
        }

        const { mapping, missing, headerRowIndex, namePartIndices } = mapHeaders(rows);
        if (missing.length > 0) {
          setState((s) => ({
            ...s,
            fileName: file.name,
            errors: [
              `Missing required column(s): ${missing.join(", ")}.`,
              "Expected headers: employee_id, full_name, manager_id, department, hire_date, termination_date, status.",
            ],
            records: null,
            metrics: null,
          }));
          return;
        }

        const records = rowsToRecords(rows, mapping, headerRowIndex, namePartIndices);
        if (records.length === 0) {
          setState((s) => ({
            ...s,
            fileName: file.name,
            errors: ["No data rows found below the header."],
            records: null,
            metrics: null,
          }));
          return;
        }

        setState({
          fileName: file.name,
          errors: [],
          records,
          metrics: computeMetrics(records),
        });
      } catch (err) {
        setState((s) => ({
          ...s,
          fileName: file.name,
          errors: [`Could not parse this file: ${(err as Error).message}`],
          records: null,
          metrics: null,
        }));
      }
    }

    const reader = new FileReader();
    reader.onerror = () =>
      setState((s) => ({
        ...s,
        fileName: file.name,
        errors: ["Could not read this file from disk."],
        records: null,
        metrics: null,
      }));

    if (isCsv) {
      reader.onload = () => finishWithRows(parseCsv(String(reader.result)));
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        try {
          finishWithRows(parseExcel(reader.result as ArrayBuffer));
        } catch (err) {
          setState((s) => ({
            ...s,
            fileName: file.name,
            errors: [`Could not read this spreadsheet: ${(err as Error).message}`],
            records: null,
            metrics: null,
          }));
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  function handleReset() {
    setState(initialState);
  }

  const { fileName, errors, records, metrics } = state;

  return (
    <div className="page">
      <header className="page-header">
        <div className="brand">
          <span className="brand-mark">MA</span>
          <div>
            <h1>Meridian Analytics</h1>
            <p className="subtitle">People Analytics Dashboard</p>
          </div>
        </div>
      </header>

      <main>
        <UploadPanel fileName={fileName} onFile={handleFile} />

        <ErrorPanel messages={errors} />

        {metrics && records && (
          <section className="dashboard">
            <div className="metric-grid">
              <MetricCard
                label="Total Employees"
                value={metrics.activeCount.toLocaleString()}
                sub={`active headcount (of ${metrics.total.toLocaleString()} total rows)`}
              />
              <MetricCard
                label="Turnover Rate"
                value={`${(metrics.turnoverRate * 100).toFixed(1)}%`}
                sub="terminated ÷ all employees in file"
              />
              <MetricCard
                label="Avg. Span of Control"
                value={metrics.managerCount > 0 ? metrics.spanOfControl.toFixed(1) : "—"}
                sub="active direct reports per active manager"
              />
            </div>

            <DataPreviewTable records={records} />

            <button className="reset-button" onClick={handleReset}>
              Upload a different file
            </button>
          </section>
        )}
      </main>

      <footer className="page-footer">
        Prototype — runs entirely in your browser, no data leaves this machine.
      </footer>
    </div>
  );
}

export default App;
