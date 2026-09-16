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

### 1. 📅 Time-Slot Scheduling & Interactive Calendar (*Gestione Oraria e Calendario*)
Currently, reservations operate on real-time current availability. Expanding into time-based bookings turns the service into a full-fledged booking platform.

* **Hourly Time Slots:**
  - Introduce selectable booking dates and time intervals (e.g. 1-hour slots from `08:00` to `22:00`).
  - Booking in advance (e.g. up to 7 or 14 days ahead).
* **Collision Detection Engine:**
  - Database schema expansion: add `booking_date`, `start_time`, `end_time` to `reservations`.
  - Validate court availability per specific time window.
  - Dynamically recalculate equipment inventory for overlapping slots.
* **Interactive Calendar UI:**
  - Integrate [FullCalendar](https://fullcalendar.io/) or [React-Big-Calendar](https://github.com/jquense/react-big-calendar).
  - Day, week, and month visual timeline view with color-coded slots (green = free, red = booked, yellow = my bookings).

---

### 2. 🛡️ Admin & Facility Manager Dashboard (*Role-Based Access Control - RBAC*)
Introduce administrative privileges to manage sports facilities and oversee center operations.

* **User Roles:**
  - Add `role` column (`'user' | 'admin' | 'staff'`) in the `users` table.
  - Protect administrative routes with an `isAdmin` middleware in Express and an `<AdminRoute />` guard in React.
* **Facility Maintenance Mode:**
  - Toggle individual courts/fields into "Maintenance" mode (e.g. Court `T2` resurfacing) with custom warning banners.
* **Equipment Stock Management:**
  - Admin interface to adjust total inventory (restock new balls, retire damaged rackets).
* **Analytics & Operational Insights:**
  - Visual charts using [Chart.js](https://www.chartjs.org/) / `react-chartjs-2` or [Recharts](https://recharts.org/):
    - Most popular sports disciplines.
    - Peak utilization hours.
    - Cancellation rates and penalty trends.

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

### 4. 👥 Team Matchmaking & Social Bookings (*Prenotazioni di Squadra e Matchmaking*)
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

### 6. 💰 Virtual Wallet & Gamification (*Crediti e Gamification*)
Add economic dynamics and positive reinforcement incentives.

* **Virtual Credits System:**
  - Each user starts with a credit balance or can "recharge" mock credits.
  - Court reservation fee + small rental price per equipment unit.
* **Positive Reinforcement & Streaks:**
  - Award bonus credits for completing bookings without cancellations (*"Reliable Player"* streak).
  - Special badge for users maintaining a 0-penalty record over multiple weeks.

---

### 7. 🧪 Automated Testing & DevOps (*Qualità del Codice e Containerizzazione*)
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
