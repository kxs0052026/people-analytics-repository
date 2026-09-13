import { REQUIRED_FIELDS, type EmployeeRecord } from "../lib/csv";

interface DataPreviewTableProps {
  records: EmployeeRecord[];
}

const PREVIEW_LIMIT = 25;

export function DataPreviewTable({ records }: DataPreviewTableProps) {
  const rowCountLabel =
    records.length > PREVIEW_LIMIT
      ? `Showing ${PREVIEW_LIMIT} of ${records.length} rows`
      : `${records.length} row${records.length === 1 ? "" : "s"}`;

  return (
    <div className="table-panel">
      <div className="table-panel-header">
        <h3>Data preview</h3>
        <span className="row-count">{rowCountLabel}</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {REQUIRED_FIELDS.map((field) => (
                <th key={field}>{field}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.slice(0, PREVIEW_LIMIT).map((rec, i) => (
              <tr key={i}>
                {REQUIRED_FIELDS.map((field) => (
                  <td key={field}>{rec[field] || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
