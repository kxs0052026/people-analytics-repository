# Meridian Analytics — People Dashboard

A Vite + React + TypeScript dashboard. Upload employee master data as **CSV
or Excel (.xlsx/.xls)** and it computes three headline metrics, entirely
client-side — nothing is uploaded anywhere; all parsing and calculation
happens in your browser. Excel files are read via [SheetJS](https://sheetjs.com/)
(installed from SheetJS's own CDN release, not the stale/vulnerable version
on the npm registry — see `package.json`'s `xlsx` dependency).

The `.env.local` in this repo is scaffolding for a future Postgres (Render)
backend — this app doesn't read from it yet; everything today runs off the
uploaded CSV only.

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL it prints (defaults to `http://localhost:5173`).

## Try it

Upload either sample file (same 20 employees, two formats) to see the
dashboard populate:
- [`public/sample-data/employee_master_sample.csv`](public/sample-data/employee_master_sample.csv)
- [`public/sample-data/employee_master_sample.xlsx`](public/sample-data/employee_master_sample.xlsx)

## Expected CSV columns

| Column              | Notes                                              |
|---------------------|-----------------------------------------------------|
| `employee_id`       | Unique ID for the employee                          |
| `full_name`         | Display name                                        |
| `manager_id`        | `employee_id` of this person's manager (blank = top of org) |
| `department`        | Free text                                           |
| `hire_date`         | Not yet used in calculations (reserved for later)   |
| `termination_date`  | Not yet used in calculations (reserved for later)   |
| `status`            | `Active` or `Terminated` (a few common synonyms are also accepted, e.g. `Inactive`, `Current`) |

Header matching is case/spacing-insensitive and accepts a few common aliases
(e.g. `EmpID`, `Manager`, `Employee Status`) — see `HEADER_ALIASES` in
[`src/lib/csv.ts`](src/lib/csv.ts) to add more.

## Metric definitions (v1)

- **Total Employees** — count of rows with `status` = Active (current headcount).
- **Turnover Rate** — terminated rows ÷ all rows in the file (simple snapshot,
  not annualized). `= terminated_count / total_rows`
- **Avg. Span of Control** — average number of *active* direct reports per
  manager, reflecting the current org chart rather than its full history.
  Only rows with `status` = Active are considered; a "manager" is any
  `manager_id` value referenced by at least one active employee.
  `= active employees with a manager ÷ distinct managers referenced by active employees`

  Earlier versions of this calculation counted terminated employees too,
  which double-counts historical reporting lines: a manager whose old team
  has since left still shows up as a "manager," inflating the manager count
  and understating span of control. Restricting to active rows fixed this.

These are first-pass definitions chosen for simplicity while testing the UI.
Swap in annualized turnover or period-bounded calculations later by editing
`computeMetrics()` in [`src/lib/csv.ts`](src/lib/csv.ts).

## Project structure

```
src/
  lib/
    csv.ts                  header mapping + metric calculations (pure functions, shared by both formats)
    excel.ts                 .xlsx/.xls parsing (via SheetJS), normalized into the same row shape as CSV
  components/
    UploadPanel.tsx         drag-and-drop / click-to-upload
    ErrorPanel.tsx           validation error display
    MetricCard.tsx           one metric tile
    DataPreviewTable.tsx     first 25 rows, for sanity-checking the upload
  App.tsx                    wires state + components together
public/
  sample-data/
    employee_master_sample.csv
    employee_master_sample.xlsx
```

## Known limitations (by design, for this version)

- No backend, no persistence — re-uploading is required each session.
- No date-based logic yet (hire/termination dates are parsed but unused).
- Single CSV upload at a time, no multi-file merge.
