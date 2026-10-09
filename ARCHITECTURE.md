# KoHot Architecture & System Specification

## 1. System Overview & The Relay-Race Model

KoHot is a permanent, institutional digital yearbook platform designed for university graduating classes. Rather than operating as an ephemeral social network, generic media feed, or automated broadcast engine, KoHot is built upon a **relay-race institutional model**:

> **The KoHot Principle:**  
> *One graduating class preserves its own memories, earns its place in the physical and digital department legacy, and personally hands off the baton to the next class.*

### Core Architectural Principles
1. **Human-to-Human Baton Handoff**: Graduating class representatives personally pass the baton to the incoming class representatives. KoHot provides structured manual channels (WhatsApp, SMS, Telegram, Native Share Sheet) rather than unsolicited automated cold emails.
2. **Explicit Consent & Permission**: Convocation dates, student profile submissions, testimonials, and department additions require explicit verification and consent.
3. **Auditability & Zero Silent Messaging**: KoHot never silently dispatches WhatsApp messages, SMS, or marketing blasts. Every manual dispatch and automated email is strictly classified and permanently logged in the Owner Audit Ledger.
4. **Physical-to-Digital Bridge**: Every class album is permanently anchored to the Department Legacy Wall and physical Department Corridor Plaque via high-contrast QR codes and persistent web gateways.

---

## 2. Core Entities & Data Architecture

```
[UniversityDirectoryItem]
   │
   ├── [DepartmentItem]
   │      │
   │      ├── [DepartmentLegacyPlaque] (Physical corridor QR code)
   │      │
   │      └── [ClassSet] (Yearly Cohort Album, e.g., 2026 Set)
   │             │
   │             ├── [StudentProfile[]] (Portraits, Bio, Leadership, Socials)
   │             ├── [MomentBatch[]] (Candid gallery with dynamic crop)
   │             ├── [ClassVoice[]] (Spotify/Apple Music anthem + audio memories)
   │             ├── [AwardItem[]] (Department superlatives & voting)
   │             ├── [DepartmentVideoItem[]] (Documentary clips & convocation speech)
   │             ├── [NextClassRepresentativeRecord] (Relay baton & invite tracking)
   │             └── [TestimonialRecord] (Class Rep feedback & public feature consent)
```

### Entity Specifications

### `ClassSet`
The foundational hub representing a specific department cohort (e.g., `University of Lagos`, `Computer Science`, `Class of 2026`).
- **Key Fields**:
  - `id`: Unique identifier (e.g. `unilag-cs-2026`).
  - `institutionId`, `departmentId`, `graduationYear`: Department lineage anchoring.
  - `status`: Lifecycle state (`pending_approval`, `approved`, `published`, `archived`).
  - `isPublished`: Boolean flag unlocked strictly after completing the 3-step publishing flow.
  - `convocationDate`: Required date for alumni milestone tracking and annual relive notifications.
  - `nextClassRep`: Contact information and handoff status for the subsequent cohort.
  - `students`, `memories`, `awards`, `voices`, `videos`: Class content sub-collections.

### `NextClassRepresentativeRecord`
Tracks the sequential handover between cohorts in the department.
- **Fields**:
  - `currentSetId`, `currentGraduationYear`: Preceding cohort.
  - `targetGraduationYear`: Incoming cohort year (e.g. `2027`).
  - `fullName`, `phoneNumber`, `email`: Contact details of incoming student leader.
  - `inviteToken`, `inviteUrl`: Secure gateway link leading into the Department Legacy Wall.
  - `status`: `'pending'` | `'followed_up'` | `'onboarded'` | `'approved'`.
  - `lastContactedAt`, `notes`: Audit records for the Owner and outgoing Class Rep.

### `PublishAlbumDraft`
Stores the required inputs during the 3-step publication workflow:
- Step 1: `convocationDate` (Mandatory date).
- Step 2: `testimonialResponse` (Required reflection text) + `allowPublicFeature` (`true` | `false`).
- Step 3: `nextClassRep` details (Name, WhatsApp/Phone, Email, Notes).

---

## 3. Album Publication Lifecycle (3 Mandatory Steps)

Publication is the milestone where a class album transitions from an active editing workspace to an immutable public digital archive. It enforces **exactly three mandatory sequential steps**:

```
[Draft / Approved Set]
        │
        ▼
[Step 1: Convocation Date] ──────► Enforces verified convocation date
        │
        ▼
[Step 2: Experience Reflection] ──► Requires answers to "What was your experience..."
                                    + Explicit choice:
                                      • "Yes, you may feature my experience publicly."
                                      • "No, please keep my response private."
        │
        ▼
[Step 3: Pass the Legacy] ────────► Details for the Next Class Representative
                                    (Hands off the department baton)
        │
        ▼
[Publish Album Executed] ─────────► • `isPublished: true`
                                    • Automated dispatch: `class_album_is_live`
                                    • Relay invite token generated
                                    • Testimonial recorded in Owner repository
```

---

## 4. Next-Class Handoff & The Department Legacy Wall

### Class Rep Baton Handoff
- The graduating representative opens `InviteNextClassModal`.
- KoHot generates a contextual invitation message including:
  - Department and University names.
  - Preceding and incoming graduation years.
  - Direct referral URL (`?next_class_invite=[TOKEN]&dept=[DEPT]&year=[YEAR]&from_year=[YEAR]`).
- The representative sends this message directly via **WhatsApp**, **SMS**, or **Native Share Sheet**.

### Incoming Representative Landing Experience
- When the incoming representative clicks the baton link, the routing system (`resolveCurrentRoute`) routes them to `albums_grid` (Department Legacy Wall).
- The Legacy Wall displays:
  1. **Relay Banner**: *"Your Class — 2027 / Create Your Class Album"* explaining that the preceding class has preserved their legacy and passed the department baton forward.
  2. **Chronological Archive**: Ability to browse all past yearly sets of their specific department to understand traditions and formatting.
  3. **Action Button**: *"Create Your Class Album"* leading to cohort registration.
- **Security Guardrail**: The invitation link does **not** automatically grant admin privileges; the incoming cohort must submit their class album request, which goes through Owner review.

### Owner Handoff Oversight (`MasterNextClassHandoffsSection`)
- Located in the Master Host Dashboard under the **Next-Class Handoffs** tab.
- Displays all department relay links across all registered universities.
- Flags overdue or pending handoffs and provides pre-formatted WhatsApp and SMS templates for manual follow-up.
- Logs all manual follow-ups into the central communication audit ledger.

---

## 5. Communications Architecture & Audit Ledger

KoHot enforces strict communication boundaries to preserve institutional trust:

### Automated Product Emails (Exactly 3)
1. `album_registration_approved`: Sent to Class Rep when Owner approves their new album.
2. `class_album_is_live`: Sent to all registered graduates when the album is officially published.
3. `annual_legacy_reminder`: Sent annually on the convocation anniversary to relive memories.

### Owner Routine Alerts (Exactly 2)
1. `owner_new_album_approval_alert`: Alerts the KoHot Owner when a new class album registration is submitted.
2. `owner_admin_takeover_review_alert`: Alerts the KoHot Owner when an administrative takeover or dispute is lodged.

### Manual Operational Templates (Owner & Admin Outreach)
1. `owner_manual_whatsapp_followup`: Pre-filled template for Owner WhatsApp outreach to prospective class representatives.
2. `owner_manual_sms_followup`: Pre-filled SMS template for mobile follow-up.
3. `admin_next_class_invitation`: Template used by graduating Class Reps to pass the baton.

### Audit Ledger (`logAndDispatchEmail` & `logManualCommunication`)
- Every communication (automated or manual) records:
  - `timestamp`: ISO timestamp of dispatch.
  - `channel`: `'email'` | `'whatsapp'` | `'sms'` | `'telegram'` | `'share_sheet'`.
  - `category`: `'product_email'` | `'owner_routine_alert'` | `'manual_operational'`.
  - `recipientName`, `recipientEmail` / `recipientPhone`.
  - `subject`, `messageBody`, and delivery status.
- Exportable to standard CSV format directly from the Master Host Communications center.

---

## 6. Moments & Image Cropping Engine (`ImageCropModal`)

The image editing engine provides responsive cropping controls:

### Dynamic Controls
- **Pinch-to-Zoom**: Two-finger pinch tracking smoothly scales between 0.5x and 3.5x zoom.
- **Dynamic Stretch Handles**: 8-point resize handles (`nw`, `ne`, `sw`, `se`, `n`, `s`, `e`, `w`) allow dragging to resize the frame dimensions dynamically.
- **Repositioning Drag**: Pointer and touch drag for precise subject framing.
- **Mouse Wheel Zoom & Sliders**: Desktop wheel zoom and slider controls.

### Smart Fit Geometries
- **Customize (Default)**: Fits the exact displayed boundaries of the image without leaving space at the edges or cutting off sides.
- **Portrait (4:5)**: Fits both top and bottom edges to the image height, leaving balanced space on the left and right sides.
- **Landscape (16:9 / 21:9)**: Fits both left and right sides to the image width, leaving balanced space at the top and bottom.
- **Square (1:1)**: Fits the maximum square inscribed within the image dimensions.
- **Official Portrait Mode**: Enforces locked 4:5 ratio for verified graduate yearbook headshots.

---

## 7. Security & Role Hierarchy

| Role | Access Scope |
|---|---|
| **Public Visitor / Student** | View published class albums, browse Department Legacy Walls, submit student profile via invitation code. |
| **Class Representative (`class_rep`)** | Manage class cohort: approve student profiles, curate moments, awards, videos, execute 3-step publishing flow, pass baton to next class. |
| **KoHot Master Host (`master_host`)** | Approve/reject class album registrations, seed universities and departments, manage corridor legacy plaques, monitor handoffs, audit communications. |
