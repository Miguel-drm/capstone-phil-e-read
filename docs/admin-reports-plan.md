# Administrative Reports – Phase 1 Blueprint

_Goal_: introduce an Administrative Reports system without impacting current Phil‑I‑Ready functionality. This document captures the data architecture, API contracts, UI layout, and phased rollout strategy before any code changes land.

---

## 1. Scope Overview
| Module | Key Responsibilities | Notes |
| --- | --- | --- |
| Report Templates | Define Phil-IRI Summary, Reading Level Distribution, Teacher ISR Submissions | UI cards, filter forms, quick generate, favorites |
| Generated Reports | Store PDF/CSV/PNG bundles, metadata, download links | Includes data-quality audit trail & AI insights snapshot |
| Scheduling | Cron-driven generation + email dispatch | Nightly worker, queue for retries |
| Report Management | Admin-only visibility controls, categories, template lifecycle | Archive/delete + share links |

---

## 2. Data Model (MongoDB)

### 2.1 Collections
1. **`reportTemplates`**
   - `_id`, `name`, `type`, `description`
   - `filtersSchema` (JSON schema snippet)
   - `category` (`academic`, `performance`, `administrative`, etc.)
   - `visibility` `{ rolesAllowed: string[], userIds?: string[] }`
   - `settings` `{ exportFormats, aiInsightsEnabled, quickActions, notifications }`
   - `isArchived`, `createdBy`, `updatedAt`

2. **`generatedReports`**
   - `_id`, `templateId`, `templateSnapshot` (name/version)
   - `filtersUsed`, `generatedBy`, `generatedAt`
   - `status` (`pending`, `success`, `failed`)
   - `files` `{ pdfUrl?, csvUrl?, pngUrl? }`
   - `aiInsights`, `dataQualityWarnings[]`
   - `favoriteByUserIds[]`, `sharedWith[]`

3. **`scheduledReports`**
   - `_id`, `templateId`, `frequency` (`daily|weekly|monthly`)
   - `timeOfDayLocal`, `recipients`, `filtersPreset`
   - `nextRunAt`, `lastRunStatus`
   - `enabled`, `createdBy`

4. **`reportNotifications`**
   - lightweight queue for teacher reminders when ISR submissions missing.

5. (Optional) **`reportAuditLogs`** for change history if needed later.

---

## 3. Backend Architecture

### 3.1 Routes (all under `/api/reports`)
| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/templates` | GET | list w/ filters (category, visibility) |
| `/templates/:id` | GET | single template detail |
| `/templates` | POST | create template (admin) |
| `/templates/:id` | PATCH | update settings/visibility |
| `/templates/:id/archive` | POST | archive/restore |
| `/templates/:id/favorite` | POST | toggle favorite for current user |
| `/templates/:id/share` | POST | send share link to another admin |
| `/generate` | POST | trigger report generation |
| `/history` | GET | fetch generatedReports w/ filters |
| `/history/:id/download?format=pdf|csv|png` | GET | signed download link |
| `/schedules` | GET/POST/PATCH/DELETE | CRUD scheduled reports |
| `/quick-actions/:type` | GET | returns data snapshots for Student Report, Teacher Activity, System Usage |
| `/ai-insights` | GET | compute on-demand insights (optional) |

Support services:
- `reportBuilderService` – orchestrates data fetching + PDF/CSV/PNG building (using pdf-lib + ChartJS rendering via node-canvas).
- `dataQualityService` – runs validation hooks before generation.
- `aiInsightService` – rule-based evaluation (later can wrap OpenAI).
- `scheduleWorker` – cron job (node-cron) running nightly.
- `notificationService` – integrates with existing SweetAlert/inbox for teacher ISR reminders.

### 3.2 PDF Generation Flow
1. Post `/generate` with template + filters.
2. `dataQualityService` checks Firestore/Mongo data (missing reading levels, duplicates, etc.).
3. If warnings exist → response includes `warnings` and awaits confirmation flag `force`.
4. On continue: `reportBuilderService` pulls data (existing ISR collections), uses Chart.js + `canvas` to render charts, injects into pdf-lib template, saves files to existing GridFS (reuse `/backend/server/services/gridfsService.ts`) or local filesystem fallback.

### 3.3 Scheduling Flow
- Store CRON metadata in `scheduledReports`.
- Node process with `node-cron` runs every hour, finds schedules due, enqueues jobs.
- Job reuses `reportBuilderService`, then emails recipients (use existing mailer if present or placeholder function returning success for now).
- Record results in `generatedReports` linked to schedule.

---

## 4. Frontend Architecture (React + Tailwind)

### 4.1 Routing
Add `AdminReportsPage` under `frontend/src/pages/admin/reports/` exposed via new menu entry (admins only). Tabs:
1. Report Templates
2. Generated Reports
3. Scheduled Reports
4. Report Management

### 4.2 Shared Components
- `ReportTabLayout` (tabs, search bar, category dropdown, right-aligned buttons `Test PDF`, `Analytics`, `New Report`).
- `ReportCard` (template details, quick generate, favorite, share).
- `FilterPanel` – dynamic controls per template.
- `GeneratedReportTable` – list with download actions.
- `ScheduleEditorModal` – config recurrence + recipients.
- `ManagementDrawer` – edit settings/visibility/categories.
- `DataQualityModal`.
- `QuickActions` – horizontal cards linking to Student Report / Teacher Activity / System Usage pages.

### 4.3 State Management
- Extend existing `reportService.ts` with new endpoints (axios hooks).
- Use React Query or SWR-style custom hooks for caching (if acceptable).
- Favor context only when cross-tab state required (e.g., selected template).

---

## 5. Data Sources & Integrations

| Data | Source | Notes |
| --- | --- | --- |
| Phil-IRI assessment metrics | Existing `ISRResult`, `Result`, Firestore `readingSessions` | Need aggregations per student/grade |
| Teacher ISR submission status | `ISRReviewRecord`, `reportNotificationService` | Already tracking approvals → reuse |
| Notifications | `notificationService.ts` + backend inbox route | Add admin-triggered teacher alerts |

---

## 6. AI Insights (Rule-Based v1)
- Highest performing grade → choose grade with highest avg comprehension score.
- Most improved students → compare last two assessments.
- Teachers with rising/lowering performance → trend of submission punctuality.
- Grade with most frustration cases → highest % `Frustration` reading level.

Implementation: `aiInsightService.generateInsights({ templateId, dataset })` returning text bullets stored in `generatedReports.aiInsights`.

---

## 7. Phase Milestones
1. **Phase 1 (this doc)** – blueprint ✅
2. **Phase 2** – create Mongo models, seed script, API skeletons returning mock data; feature-flag endpoints.
3. **Phase 3** – frontend tabs & cards using mock endpoints.
4. **Phase 4** – real data wiring, PDF/export, data-quality validation, AI insights.
5. **Phase 5** – scheduling + cron worker + email notifications.
6. **Phase 6** – management features (visibility, categories, archive), favorites/sharing polish.

Each phase deploys behind `adminReportsEnabled` flag to prevent regressions.

---

## 8. Assumptions & Open Questions
1. **Email delivery** – currently no transactional email service; placeholder function will log output until SMTP provided.
2. **PDF storage** – prefer existing GridFS bucket; confirm size limits.
3. **Auth** – admins only; future phases might allow teachers to view limited reports.
4. **Charts** – use `react-chartjs-2` on frontend, `chartjs-node-canvas` on backend for PNG/PDF.
5. **Environment** – new `VITE_ADMIN_REPORTS_API_URL` lets the frontend target a specific backend instance (useful while production backend hasn’t adopted the new `/api/reports` routes yet).
5. **AI API keys** – until provided, use deterministic rule set.

---

Ready to proceed to **Phase 2: data models + endpoint scaffolding** once this plan is approved.

