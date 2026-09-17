# 🚀 Project Expansion Ideas & Roadmap

> **Sport Center Reservation System**  
> Comprehensive guide and roadmap for future expansions, advanced features, and architectural improvements.

---

## 📋 Current Foundation Summary

The application currently features:
- Multi-sport facility catalog (Tennis, Basketball, Volleyball, Soccer, Table Tennis, Cycling).
- Real-time stock calculation and court availability.
- Automatic vs. Manual facility assignment modes.
- Mandatory minimum and optional equipment rental constraints.
- Session-based authentication with Passport (Local Strategy) and SQLite persistent storage.
- 2-Factor Authentication (2FA) with RFC 6238 TOTP (Base32 secret, time-step validation, replay protection).
- Cancellation penalty system (-1 score per cancellation) and 30-second cooldown on released facility types.
- Negative score restriction: users with penalties may only rent mandatory minimum equipment, and edit existing bookings only to remove/reduce equipment.
- Responsive React SPA with Bootstrap, React Router, clean state management, and strict cleanup patterns (`ignore = true`).

---

## 💡 Proposed Feature Expansions

### 1. 📅 Time-Slot Scheduling & Interactive Calendar — ✅ *Implemented*
Transformed the service from static real-time availability into a full-fledged time-slot booking platform with interactive visual matrix navigation and robust collision prevention.

* **Hourly Time Slots (08:00 – 22:00):**
  - Selectable booking dates (from today up to 14 days in advance) and 14 hourly slots (`08:00-09:00` to `21:00-22:00`).
  - Integrated into Step 1 of the reservation wizard and public availability views.
* **Collision Detection Engine:**
  - Database schema expansion: added `booking_date`, `start_time`, `end_time` columns to table `reservations` with strict `UNIQUE (facility_id, booking_date, start_time)` constraint.
  - Back-end DAO validation preventing double-booking of any facility court or pitch in overlapping slots (`409 Conflict`).
  - Dynamic equipment stock calculation: rented equipment inventory is calculated strictly relative to active bookings in the selected date & time window.
* **Interactive Calendar UI (`/calendar`):**
  - Visual matrix timeline displaying all sports courts across all 14 hourly time slots for any selected date.
  - Color-coded slots:
    - 🟢 **Green (Free):** Clickable button to immediately jump to reservation prefilled with court, date, and slot.
    - 🔴 **Red (Booked):** Disabled badge displaying booking owner name.
    - 🟡 **Yellow (My Booking):** Highlights authenticated user's own reservations with direct link to manage.
  - Date navigation toolbar (Previous Day, Next Day, Today, Date Picker) and instant sport discipline filter.

---

### 2. 🛡️ Admin & Facility Manager Dashboard (*Role-Based Access Control - RBAC*) — ✅ *Implemented*
Introduced administrative privileges and operational management tools to oversee center facilities and equipment.

* **User Roles (RBAC):**
  - Added `role` column (`'user' | 'admin' | 'staff'`) to the `users` table (seeded `alice` and `admin` as `admin`, `staff` as `staff`).
  - Protected administrative endpoints (`/api/admin/*`) with `isAdminOrStaff` / `isAdmin` Express middlewares.
  - Front-end protected route guard `<AdminRoute />` ensuring only authenticated `admin` and `staff` access `/admin`.
  - Dynamic navigation links and role badges in the top navigation bar and user account menu.
* **Facility Maintenance Mode:**
  - Added `is_maintenance` and `maintenance_reason` columns to table `facilities`.
  - Admin interface to toggle any court or field into maintenance mode with a custom maintenance banner reason (e.g. *"Clay court resurfacing & line repainting"*).
  - Prevents reservations on maintenance courts across auto and manual selection modes; renders warning notices and maintenance badges across `PublicView`, `ScheduleCalendarView`, and `NewReservationView`.
* **Equipment Stock Management:**
  - Dedicated admin tab to view total stock, peak active rental allocations across time slots, and historical rentals.
  - Controls to adjust total inventory, with safety validation ensuring stock cannot be lowered below active bookings in any slot.
* **Operational Analytics & Visual Insights:**
  - Live KPI metric overview cards: Total Bookings, Active Bookings, Total Cancellations, Courts in Maintenance, Registered Users, Penalized Users.
  - Sports discipline popularity breakdown with color-coded percentage progress bars.
  - Peak hourly utilization breakdown across all 14 time slots (08:00-22:00) with peak hour indicators.
  - Court utilization table with total reservation counts per court.
  - Recent cancellation log with user penalty scores and timestamps.
  - User management table with penalty scores, 2FA status, and admin role adjustment controls.

---

### 3. ⚡ Real-Time Live Updates (*WebSockets / Server-Sent Events*)
Eliminate manual page refreshes by pushing live changes directly to connected clients.

* **Instant Availability Synchronization:**
  - Use [Socket.io](https://socket.io/) or native [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).
  - When a user reserves or cancels a facility, broadcast an event (`FACILITY_UPDATED`).
  - The `PublicView` and booking forms update their badges and available quantities immediately in real-time across all open browser windows.
* **Visual Cooldown Countdown Timer:**
  - An animated countdown clock (from 30s down to 0s) in the UI during the cancellation cooldown, automatically re-enabling booking buttons upon expiry.

---

### 4. 👥 Team Matchmaking & Social Bookings
Enhance team sports (Soccer, Basketball, Volleyball) with collaborative tools.

* **Teammate Invites:**
  - Allow the booking creator to add usernames of other registered players to a reservation.
  - Invited players receive a notification and see the booking in their dashboard.
* **"Looking for Players" Public Board (*Bacheca Partite*):**
  - Option when reserving a soccer/basketball court to flag: *"Need 2 more players"*.
  - Other users can browse open games and join.
* **Priority Waitlists (*Liste d'Attesa*):**
  - If all courts for a sport are booked, allow users to join a priority queue.
  - If a booking is cancelled, notify the first user in the waitlist.

---

### 5. 🎟️ Digital Check-in with QR Codes & Email Confirmations
Bridge the digital system with physical sports center operations.

* **QR Code Generation:**
  - Generate a secure, unique QR code for each confirmed reservation using [qrcode.react](https://github.com/zpao/qrcode.react).
  - Encrypt or sign the QR payload with a timestamp and booking ID.
* **Simulated Gate Scanner:**
  - A staff check-in page that scans/validates QR codes and marks reservations as "Checked-in".
* **Email Confirmations:**
  - Integrate [Nodemailer](https://nodemailer.com/) (using test providers like Ethereal Email or SendGrid).
  - Send transactional emails with booking confirmations, cancellation receipts, and calendar invite attachments (`.ics`).

---

### 6. 💰 Virtual Wallet & Gamification
Add economic dynamics and positive reinforcement incentives.

* **Virtual Credits System:**
  - Each user starts with a credit balance or can "recharge" mock credits.
  - Court reservation fee + small rental price per equipment unit.
* **Positive Reinforcement & Streaks:**
  - Award bonus credits for completing bookings without cancellations (*"Reliable Player"* streak).
  - Special badge for users maintaining a 0-penalty record over multiple weeks.

---

### 7. 🧪 Automated Testing & DevOps
Elevate the project to industry-grade standards for portfolio demonstration.

* **Back-End API Tests:**
  - Unit and integration testing using **Jest** and **Supertest**.
  - Automated tests verifying authentication sessions, 2FA validation, stock race conditions, and cooldown enforcement.
* **Front-End Component Tests:**
  - Unit tests with **Vitest** and **React Testing Library**.
  - Validate interactive behaviors (e.g. verify that `+` and `-` buttons correctly respect negative score restrictions and stock limits).
* **End-to-End (E2E) Tests:**
  - Complete user journeys automated with [Playwright](https://playwright.dev/) or [Cypress] (Login $\rightarrow$ Reserve Court $\rightarrow$ Check Public Availability $\rightarrow$ Cancel $\rightarrow$ Verify Score Penalty).
* **Docker & Docker Compose:**
  - Create a production-ready `Dockerfile` and `docker-compose.yml` to spin up both client and server with a single command:
    ```bash
    docker compose up --build
    ```

---

## 🛠️ Suggested Implementation Phases

| Phase | Focus Area | Key Deliverables | Estimated Effort |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Testing & Reliability | Jest API tests + Vitest component tests | 1-2 days |
| **Phase 2** | Time Slots & Calendar | Date/time selection, overlap validation, calendar UI | 3-4 days |
| **Phase 3** | Admin Dashboard | Admin role, court maintenance toggle, stock management | 2-3 days |
| **Phase 4** | Real-Time Sync | Socket.io / SSE integration for live availability | 1-2 days |
| **Phase 5** | Social & Check-in | QR Code pass generation, matchmaking board, email notices | 2-3 days |
| **Phase 6** | DevOps | Dockerfile and Docker Compose orchestration | 1 day |
