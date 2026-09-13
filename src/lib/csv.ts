/**
 * CSV parsing + metric computation for the employee master data upload.
 *
 * Expected columns (case/space/underscore-insensitive, a few common aliases
 * accepted — see HEADER_ALIASES): employee_id, full_name, manager_id,
 * department, hire_date, termination_date, status
 *
 * Metric definitions (v1):
 *   Total Employees   = rows where status is "Active"
 *   Turnover Rate     = terminated rows ÷ all rows in the file
 *   Span of Control   = average number of direct reports, across all distinct
 *                        manager_id values referenced by at least one employee
 */

export const REQUIRED_FIELDS = [
  "employee_id",
  "full_name",
  "manager_id",
  "department",
  "hire_date",
  "termination_date",
  "status",
] as const;

export type Field = (typeof REQUIRED_FIELDS)[number];

export type EmployeeRecord = Record<Field, string>;

export interface Metrics {
  total: number;
  activeCount: number;
  terminatedCount: number;
  turnoverRate: number;
  managerCount: number;
  spanOfControl: number;
}

export type NamePart = "first" | "last" | "preferred";

export interface HeaderMapping {
  mapping: Partial<Record<Field, number>>;
  missing: Field[];
  unrecognized: string[];
  /** Row index (within the full `rows` array) that the headers were found on. */
  headerRowIndex: number;
  /** Set when there's no single full_name column but first/last/preferred name columns exist. */
  namePartIndices: Partial<Record<NamePart, number>>;
}

// normalized header -> canonical field name
const HEADER_ALIASES: Record<string, Field> = {
  employee_id: "employee_id",
  empid: "employee_id",
  employeeid: "employee_id",
  id: "employee_id",

  full_name: "full_name",
  name: "full_name",
  employee_name: "full_name",

  manager_id: "manager_id",
  managerid: "manager_id",
  manager: "manager_id",
  manager_employee_id: "manager_id",

  department: "department",
  dept: "department",

  hire_date: "hire_date",
  hiredate: "hire_date",
  start_date: "hire_date",

  termination_date: "termination_date",
  terminationdate: "termination_date",
  term_date: "termination_date",
  end_date: "termination_date",

  status: "status",
  employee_status: "status",
  employment_status: "status",
};

// Recognized when there's no single "full name" column — first_name +
// last_name (optionally preferred_name in place of first_name) are combined
// into full_name instead.
const NAME_PART_ALIASES: Record<string, NamePart> = {
  first_name: "first",
  firstname: "first",
  given_name: "first",

  last_name: "last",
  lastname: "last",
  surname: "last",
  family_name: "last",

  preferred_name: "preferred",
  nickname: "preferred",
};

const TERMINATED_STATUSES = new Set(["terminated", "term", "inactive", "separated"]);
const ACTIVE_STATUSES = new Set(["active", "employed", "current"]);

// ---------- CSV parsing (handles quoted fields, escaped quotes, CRLF/LF) ----------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // skip; \n (if present) will terminate the row
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/_+/g, "_");
}

/**
 * Real HRIS exports sometimes put a "section" row above the actual column
 * headers (e.g. "Identity | | | Demographic | | ..." merged-cell group
 * labels). Scan the first few rows and pick whichever one best matches our
 * known field names, rather than assuming row 0 is always the header row.
 */
function findHeaderRowIndex(rows: string[][]): number {
  const scanLimit = Math.min(rows.length, 20);
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < scanLimit; i++) {
    const score = rows[i].reduce((acc, cell) => {
      const norm = normalizeHeader(cell);
      return HEADER_ALIASES[norm] || NAME_PART_ALIASES[norm] ? acc + 1 : acc;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

export function mapHeaders(rows: string[][]): HeaderMapping {
  const headerRowIndex = findHeaderRowIndex(rows);
  const rawHeaders = rows[headerRowIndex] ?? [];

  const mapping: Partial<Record<Field, number>> = {};
  const namePartIndices: Partial<Record<NamePart, number>> = {};
  const unrecognized: string[] = [];

  rawHeaders.forEach((raw, idx) => {
    const norm = normalizeHeader(raw);
    const canonical = HEADER_ALIASES[norm];
    if (canonical) {
      mapping[canonical] = idx;
      return;
    }
    const namePart = NAME_PART_ALIASES[norm];
    if (namePart) {
      namePartIndices[namePart] = idx;
      return;
    }
    if (raw.trim() !== "") unrecognized.push(raw);
  });

  const canDeriveFullName =
    mapping.full_name === undefined &&
    (namePartIndices.first !== undefined ||
      namePartIndices.last !== undefined ||
      namePartIndices.preferred !== undefined);

  const missing = REQUIRED_FIELDS.filter((f) => {
    if (f in mapping) return false;
    if (f === "full_name" && canDeriveFullName) return false;
    return true;
  });

  return { mapping, missing, unrecognized, headerRowIndex, namePartIndices };
}

export function rowsToRecords(
  rows: string[][],
  mapping: Partial<Record<Field, number>>,
  headerRowIndex = 0,
  namePartIndices: Partial<Record<NamePart, number>> = {}
): EmployeeRecord[] {
  const dataRows = rows.slice(headerRowIndex + 1);

  return dataRows
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r) => {
      const rec = {} as EmployeeRecord;
      REQUIRED_FIELDS.forEach((field) => {
        if (field === "full_name" && mapping.full_name === undefined) {
          const preferred =
            namePartIndices.preferred !== undefined
              ? (r[namePartIndices.preferred] ?? "").trim()
              : "";
          const first =
            namePartIndices.first !== undefined ? (r[namePartIndices.first] ?? "").trim() : "";
          const last =
            namePartIndices.last !== undefined ? (r[namePartIndices.last] ?? "").trim() : "";
          rec.full_name = [preferred || first, last].filter(Boolean).join(" ");
          return;
        }
        const idx = mapping[field];
        rec[field] = idx !== undefined ? (r[idx] ?? "").trim() : "";
      });
      return rec;
    });
}

// ---------- Metric computation ----------

export function computeMetrics(records: EmployeeRecord[]): Metrics {
  const total = records.length;

  const activeCount = records.filter((r) =>
    ACTIVE_STATUSES.has(r.status.trim().toLowerCase())
  ).length;

  const terminatedCount = records.filter((r) =>
    TERMINATED_STATUSES.has(r.status.trim().toLowerCase())
  ).length;

  const turnoverRate = total > 0 ? terminatedCount / total : 0;

  // Span of control reflects the CURRENT org chart, so only count direct
  // reports who are still active — otherwise a manager whose former reports
  // all left the company still inflates the manager count and drags the
  // average down. For every distinct manager_id referenced by an active
  // employee, count how many active employees report to them, then average
  // across those managers.
  const activeRecords = records.filter((r) =>
    ACTIVE_STATUSES.has(r.status.trim().toLowerCase())
  );
  const reportsByManager = new Map<string, number>();
  activeRecords.forEach((r) => {
    const mgr = r.manager_id.trim();
    if (mgr === "") return;
    reportsByManager.set(mgr, (reportsByManager.get(mgr) || 0) + 1);
  });

  const managerCount = reportsByManager.size;
  const totalReports = [...reportsByManager.values()].reduce((a, b) => a + b, 0);
  const spanOfControl = managerCount > 0 ? totalReports / managerCount : 0;

  return {
    total,
    activeCount,
    terminatedCount,
    turnoverRate,
    managerCount,
    spanOfControl,
  };
}
