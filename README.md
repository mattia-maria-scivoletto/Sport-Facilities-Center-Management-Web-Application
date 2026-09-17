## React Client Application Routes

- Route `/`: Public availability view showing available counts for all sports facility types with its individual status plus rental equipment inventory
- Route `/login`: User authentication screen dedicated to 1-factor login
- Route `/login-totp`: Two-Factor Authentication (2FA) screen for verifying 6-digit TOTP codes generated using secret. Completing 2FA resets negative user score back to 0
- Route `/reservations`: Protected view displaying all active bookings for the logged-in user with facility identifiers, rented equipment details and buttons to edit equipment or cancel bookings
- Route `/new-reservation`: Protected booking form allowing users to select facility type, choose manual or automatic facility assignment and configure mandatory and optional equipment with available amount and user score validation
- Route `/register`: Dedicated view to create and register a new user, with all controls to set username and password
- Route `/change-password`: Protected view containing form to change user's password
- Route `/calendar`: Interactive schedule calendar timeline matrix displaying court availability and reservations across hourly time slots (08:00-22:00) with sport filtering, date navigation, color coding (green = free, red = booked, yellow = my bookings), and direct slot-to-booking shortcuts
- Route `/admin`: Protected operations dashboard for admin and staff roles to manage facility maintenance, equipment inventory, operational analytics, and user accounts

## List of HTTP API Endpoints Offered by the Backend Server

### User Management & Authentication

#### User Registration
* `POST /api/users`
* Description: Creates a new user account with a unique username, secure scrypt-hashed password, and initial score of 0
* Request body:
```JSON
{
  "username": "federico",
  "password": "password123"
}
```
* Response: `201 Created`
```JSON
{
  "id": 5,
  "username": "federico",
  "name": "Federico",
  "message": "User registered successfully"
}
```
* Error responses: `409 Conflict`, `422 Unprocessable Entity`, `500 Internal Server Error`

#### Login (1-Factor Authentication)
* `POST /api/sessions`
* Description: Authenticates the user with username and password
* Request body:
```JSON
{
  "username": "bob",
  "password": "password"
}
```
* Response: `200 OK`
```JSON
{
  "id": 2,
  "username": "bob",
  "name": "Bob",
  "score": -2,
  "canDoTotp": true,
  "isTotp": false
}
```
* Error responses: `401 Unauthorized`, `500 Internal Server Error`

#### Check Current User Session
* `GET /api/sessions/current`
* Description: Retrieves the currently authenticated user's session data and score.
* Request body: *None*
* Response: `200 OK`
```JSON
{
  "id": 2,
  "username": "bob",
  "name": "Bob",
  "score": -2,
  "canDoTotp": true,
  "isTotp": false
}
```
* Error responses: `401 Unauthorized`, `500 Internal Server Error`

#### Two-Factor Authentication (TOTP 2FA)
* `POST /api/login-totp`
* Description: Verifies a 6-digit TOTP code. On success, marks session as 2FA authenticated and resets negative score to 0
* Request body:
```JSON
{
  "code": "123456"
}
```
* Response: `200 OK`
```JSON
{
  "otp": "authorized",
  "user": {
    "id": 2,
    "username": "bob",
    "name": "Bob",
    "score": 0,
    "canDoTotp": true,
    "isTotp": true
  }
}
```
* Error responses: `401 Unauthorized`, `422 Unprocessable Content`, `500 Internal Server Error`

#### Logout
* `DELETE /api/sessions/current`
* Description: Destroys the current user session and clears authentication cookies
* Request body: *None*
* Response: `200 OK`
```JSON
{
  "message": "Logged out successfully"
}
```
* Error responses: `401 Unauthorized`, `500 Internal Server Error`

#### Change Password
* `PUT /api/users/current/password`
* Description: Updates the password of the currently authenticated user after verifying the current password
* Request body:
```JSON
{
  "oldPassword": "current_password",
  "newPassword": "new_password"
}
```
* Response: `200 OK`
```JSON
{
  "message": "Password updated successfully"
}
```
* Error responses: `401 Unauthorized` (incorrect current password), `422 Unprocessable Entity` (validation failure or same password), `500 Internal Server Error`

---

### Sport Center Facilities and Equipment Management

#### Public Availability Overview
* `GET /api/public/availability`
* Description: Returns counts and court statuses for all facility types and dynamic rental equipment stock. Supports optional query parameters `date` (YYYY-MM-DD, defaults to today) and `timeSlot` (HH:MM, e.g. 10:00, defaults to 10:00)
* Query parameters: `?date=YYYY-MM-DD&timeSlot=HH:MM` (optional)
* Request body: *None*
* Response: `200 OK`
```JSON
{
  "facilities": [
    {
      "typeId": "TENNIS",
      "typeName": "Tennis Court",
      "totalCount": 3,
      "availableCount": 2,
      "facilityCodes": [
        { "code": "T1", "isBooked": false },
        { "code": "T2", "isBooked": false },
        { "code": "T3", "isBooked": true }
      ]
    }
  ],
  "equipment": [
    {
      "id": "TENNIS_RACKET",
      "name": "Tennis Racket",
      "totalQuantity": 8,
      "availableQuantity": 6
    }
  ]
}
```

#### Facility Types & Rules
* `GET /api/facility-types`
* Description: Retrieves the list of available facility types
* Request body: *None*
* Response: `200 OK`
```JSON
[
    {
        "id": "BASKETBALL",
        "name": "Basketball Court"
    },
    {
        "id": "CYCLING",
        "name": "Cycling Track"
    },
    {
        "id": "SOCCER",
        "name": "Soccer Field"
    },
    {
        "id": "TABLE_TENNIS",
        "name": "Table Tennis Table"
    },
    {
        "id": "TENNIS",
        "name": "Tennis Court"
    },
    {
        "id": "VOLLEYBALL",
        "name": "Volleyball Court"
    }
]
```
* Error responses: `401 Unauthorized`, `500 Internal Server Error`

* `GET /api/facility-types/:typeId/rules`
* Description: Retrieves equipment rental rules (mandatory minimums, optional items, and dynamic slot-based inventory) for a given facility type
* Query parameters: `?date=YYYY-MM-DD&timeSlot=HH:MM` (optional)
* Request body: *None*
* Response: `200 OK`
```JSON
[
    {
        "equipmentTypeId": "BASKETBALL",
        "equipmentName": "Basketball",
        "minQuantity": 1,
        "totalQuantity": 2,
        "availableQuantity": 1
    },
    {
        "equipmentTypeId": "CONE",
        "equipmentName": "Cone",
        "minQuantity": 0,
        "totalQuantity": 4,
        "availableQuantity": 4
    }
]
```
* Error responses: `401 Unauthorized`, `422 Unprocessable Entity`, `500 Internal Server Error`

#### All Individual Facilities
* `GET /api/facilities`
* Description: Retrieves all individual facilities with availability status for a selected date and time slot
* Authentication: Required (logged in user session)
* Query parameters: `?date=YYYY-MM-DD&timeSlot=HH:MM` (optional, defaults to today at 10:00)
* Request body: *None*
* Response: `200 OK`
```JSON
[
    {
        "id": "B1",
        "facilityTypeId": "BASKETBALL",
        "name": "Basketball Court #1",
        "typeName": "Basketball Court",
        "isAvailable": 0
    },
    {
        "id": "C2",
        "facilityTypeId": "CYCLING",
        "name": "Cycling Track #2",
        "typeName": "Cycling Track",
        "isAvailable": 1
    },
    {
        "id": "S1",
        "facilityTypeId": "SOCCER",
        "name": "Soccer Field #1",
        "typeName": "Soccer Field",
        "isAvailable": 1
    },
    {
        "id": "TT1",
        "facilityTypeId": "TABLE_TENNIS",
        "name": "Table Tennis Table #1",
        "typeName": "Table Tennis Table",
        "isAvailable": 0
    },
    {
        "id": "TT2",
        "facilityTypeId": "TABLE_TENNIS",
        "name": "Table Tennis Table #2",
        "typeName": "Table Tennis Table",
        "isAvailable": 1
    },
    {
        "id": "TT3",
        "facilityTypeId": "TABLE_TENNIS",
        "name": "Table Tennis Table #3",
        "typeName": "Table Tennis Table",
        "isAvailable": 1
    },
    {
        "id": "TT4",
        "facilityTypeId": "TABLE_TENNIS",
        "name": "Table Tennis Table #4",
        "typeName": "Table Tennis Table",
        "isAvailable": 1
    },
    {
        "id": "T1",
        "facilityTypeId": "TENNIS",
        "name": "Tennis Court #1",
        "typeName": "Tennis Court",
        "isAvailable": 1
    },
    {
        "id": "V1",
        "facilityTypeId": "VOLLEYBALL",
        "name": "Volleyball Court #1",
        "typeName": "Volleyball Court",
        "isAvailable": 0
    }
]
```
* Error responses: `401 Unauthorized`, `500 Internal Server Error`

#### Interactive Schedule Calendar Matrix
* `GET /api/schedule/calendar`
* Description: Returns full schedule matrix including all facilities, facility types, and booked reservations with ownership flag (`isMine`) for visual calendar/timeline representation
* Authentication: Optional (publicly viewable; `isMine` evaluates to `true` for reservations belonging to the authenticated user)
* Query parameters:
  - `startDate` (YYYY-MM-DD, optional, defaults to today)
  - `endDate` (YYYY-MM-DD, optional, defaults to 6 days after startDate)
  - `facilityTypeId` (string, optional filter by sport discipline)
* Request body: *None*
* Response: `200 OK`
```JSON
{
  "startDate": "2026-09-16",
  "endDate": "2026-09-22",
  "facilities": [
    {
      "id": "B1",
      "facilityTypeId": "BASKETBALL",
      "name": "Basketball Court #1",
      "typeName": "Basketball Court",
      "isAvailable": 0
    }
  ],
  "facilityTypes": [
    {
      "id": "BASKETBALL",
      "name": "Basketball Court"
    }
  ],
  "reservations": [
    {
      "reservationId": 1,
      "userId": 2,
      "facilityId": "B1",
      "bookingDate": "2026-09-16",
      "startTime": "10:00",
      "endTime": "11:00",
      "facilityName": "Basketball Court #1",
      "facilityTypeId": "BASKETBALL",
      "typeName": "Basketball Court",
      "bookedByUsername": "bob",
      "isMine": true
    }
  ]
}
```
* Error responses: `500 Internal Server Error`

---

### Reservations Management

#### Get User Reservations
* `GET /api/reservations`
* Description: Fetches all active reservations for the logged-in user, including allocated equipment
* Request body: *None*
* Response: `200 OK`
```JSON
[
  {
    "reservationId": 1,
    "facilityId": "B1",
    "facilityName": "Basketball Court #1",
    "facilityTypeId": "BASKETBALL",
    "typeName": "Basketball Court",
    "equipments": [
      {
        "equipmentTypeId": "BASKETBALL",
        "equipmentName": "Basketball",
        "quantity": 1,
        "minQuantity": 1,
        "isMandatory": true
      }
    ]
  }
]
```
* Error responses: `401 Unauthorized`, `500 Internal Server Error`

#### Create a New Reservation
* `POST /api/reservations`
* Description: Creates a facility reservation with required equipment for a specific date and time slot. Enforces court collision prevention, 30s cooldown, mandatory minimums, slot-based inventory availability, and negative score restrictions
* Request body:
```JSON
{
  "facilityTypeId": "TENNIS",
  "facilityId": "T1",
  "automaticFacilitySelection": 0,
  "bookingDate": "2026-09-17",
  "startTime": "14:00",
  "endTime": "15:00",
  "equipments": [
    { "equipmentTypeId": "TENNIS_RACKET", "quantity": 2 },
    { "equipmentTypeId": "TENNIS_BALL", "quantity": 3 },
    { "equipmentTypeId": "TOWEL", "quantity": 1 }
  ]
}
```
* Response: `201 Created`
```JSON
{
  "message": "Facility and equipment reserved successfully!",
  "reservationId": 5,
  "facilityId": "T1",
  "facilityName": "Tennis Court #1",
  "bookingDate": "2026-09-17",
  "startTime": "14:00",
  "endTime": "15:00"
}
```
* Error responses: `401 Unauthorized`, `403 Forbidden` (score violation or 30 seconds cooldown active), `409 Conflict` / `422 Unprocessable Content` (facility double-booking collision, missing mandatory equipment, or insufficient stock), `500 Internal Server Error`

#### Edit Equipment Quantities For an Existing Reservation
* `PUT /api/reservations/:reservationId/equipment`
* Description: Modify equipment quantities for an active reservation owned by the user
* Request body:
```JSON
{
  "equipments": [
    { "equipmentTypeId": "TENNIS_RACKET", "quantity": 2 },
    { "equipmentTypeId": "TENNIS_BALL", "quantity": 4 }
  ]
}
```
* Response: `200 OK`
```JSON
{
  "message": "Reservation equipment modified successfully!"
}
```
* Error responses: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422 Unprocessable Content`, `500 Internal Server Error`

#### Delete an Existing Reservation
* `DELETE /api/reservations/:reservationId`
* Description: Cancels a reservation, releases facilities and equipment, decrements user score by 1, and records 30s cooldown timestamp
* Request body: *None*
* Response: `200 OK`
```JSON
{
  "message": "Reservation cancelled successfully. Your score has been reduced by 1.",
  "newScore": -3,
  "cooldownFacilityTypeId": "TENNIS"
}
```
* Error responses: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Internal Server Error`

---

### Admin & Facility Operations Management (RBAC)

#### Operational Analytics & Insights
* `GET /api/admin/analytics`
* Description: Protected endpoint for `admin` and `staff` returning comprehensive operational metrics including KPI counters, sport popularity distribution, peak hourly utilization across 14 slots, facility booking frequencies, recent cancellation logs, and equipment utilization summary
* Request body: *None*
* Response: `200 OK`
```JSON
{
  "kpis": {
    "totalReservations": 4,
    "activeReservations": 4,
    "totalCancellations": 2,
    "totalUsers": 6,
    "totalPenalizedUsers": 2,
    "totalFacilities": 14,
    "maintenanceFacilities": 1
  },
  "disciplinePopularity": [ ... ],
  "hourlyUtilization": [ ... ],
  "facilityUtilization": [ ... ],
  "recentCancellations": [ ... ],
  "equipmentUtilization": [ ... ]
}
```
* Error responses: `401 Unauthorized`, `403 Forbidden` (non-admin/staff), `500 Internal Server Error`

#### Admin Facilities Management
* `GET /api/admin/facilities`
* Description: Protected endpoint returning all sports courts and fields along with their maintenance status, maintenance reason, and total historical bookings count
* Request body: *None*
* Response: `200 OK`
* Error responses: `401 Unauthorized`, `403 Forbidden`, `500 Internal Server Error`

#### Toggle Court Maintenance Mode
* `PATCH /api/admin/facilities/:id/maintenance`
* Description: Protected endpoint to toggle individual courts into or out of maintenance mode with a custom maintenance banner reason
* Request body:
```JSON
{
  "isMaintenance": true,
  "maintenanceReason": "Clay court resurfacing & line repainting"
}
```
* Response: `200 OK`
```JSON
{
  "message": "Facility T2 maintenance mode successfully enabled.",
  "updated": true,
  "facilityId": "T2",
  "isMaintenance": true
}
```
* Error responses: `401 Unauthorized`, `403 Forbidden`, `422 Unprocessable Entity`, `500 Internal Server Error`

#### Admin Equipment Stock Inventory
* `GET /api/admin/equipment`
* Description: Protected endpoint returning all equipment types, their total physical stock, peak active rental units across time slots, and total units rented all-time
* Request body: *None*
* Response: `200 OK`
* Error responses: `401 Unauthorized`, `403 Forbidden`, `500 Internal Server Error`

#### Adjust Equipment Total Stock
* `PATCH /api/admin/equipment/:id`
* Description: Protected endpoint to adjust total inventory quantity. Enforces safety constraint preventing reduction below active bookings in any slot
* Request body:
```JSON
{
  "totalQuantity": 10
}
```
* Response: `200 OK`
```JSON
{
  "message": "Equipment TENNIS_BALL total inventory adjusted to 10.",
  "updated": true,
  "equipmentTypeId": "TENNIS_BALL",
  "totalQuantity": 10
}
```
* Error responses: `401 Unauthorized`, `403 Forbidden`, `422 Unprocessable Entity` (e.g. stock cannot fall below active rentals), `500 Internal Server Error`

#### Registered Users Overview
* `GET /api/admin/users`
* Description: Protected endpoint returning all registered users with their penalty score, 2FA status, role, and total reservations count
* Request body: *None*
* Response: `200 OK`
* Error responses: `401 Unauthorized`, `403 Forbidden`, `500 Internal Server Error`

#### Role Management
* `PATCH /api/admin/users/:id/role`
* Description: Admin-only endpoint to assign or modify user roles (`'user' | 'admin' | 'staff'`)
* Request body: `{"role": "staff"}`
* Response: `200 OK`
* Error responses: `401 Unauthorized`, `403 Forbidden` (only admin), `422 Unprocessable Entity`, `500 Internal Server Error`

---

## Database Tables

- Table `users`: Contains `id`, `username`, `password_hash`, `salt`, `score`, `totp_secret`, `lastTotpStep`, `role`
- Table `facility_types`: Contains `id`, `name`
- Table `facilities`: Contains `id`, `facility_type_id`, `name`, `is_maintenance`, `maintenance_reason`
- Table `equipment_types`: Contains `id`, `name`, `total_quantity`
- Table `facility_equipment_rules`: Contains `facility_type_id`, `equipment_type_id`, `min_quantity`
- Table `reservations`: Contains `id`, `user_id`, `facility_id`, `booking_date`, `start_time`, `end_time`
- Table `reservation_equipment`: Contains `reservation_id`, `equipment_type_id`, `quantity`
- Table `facility_release_logs`: Contains `id`, `user_id`, `facility_type_id`, `released_at`

---

## Main React Components

- `Navigation` (in `src/components/Navigation.jsx`): Navbar featuring "Manage My Reservations" dropdown (grouping Public Availability, Schedule Calendar, My Reservations, and New Reservation), user role badge, user score badge, and "Account Settings" dropdown menu (including Admin Dashboard access for admin/staff)
- `AdminRoute` (in `src/components/AdminRoute.jsx`): Route protection guard restricting access to `/admin` to authenticated users with `admin` or `staff` role
- `AdminDashboardView` (in `src/views/AdminDashboardView.jsx`): Administrative operations dashboard featuring tabs for real-time analytics, facility maintenance mode toggles, equipment inventory management, and user role oversight
- `PublicView` (in `src/views/PublicView.jsx`): Overview of all facility types with status badges (available, booked, maintenance), date/time slot selectors, link to schedule calendar, and rental equipment table
- `ScheduleCalendarView` (in `src/views/ScheduleCalendarView.jsx`): Interactive timeline matrix displaying court availability across 14 hourly slots (08:00-22:00) with sport filtering, maintenance indicators, color-coded slots, and direct booking shortcuts
- `LoginView` (in `src/views/LoginView.jsx`): User credentials authentication form with password visibility toggle
- `RegisterView` (in `src/views/RegisterView.jsx`): New user registration form with validation, password confirmation, and error handling
- `ChangePasswordView` (in `src/views/ChangePasswordView.jsx`): Account password update form with current password verification and confirmation checks
- `TotpView` (in `src/views/TotpView.jsx`): 2-Factor Authentication screen for TOTP validation with score reset explanation
- `MyReservationsView` (in `src/views/MyReservationsView.jsx`): User reservations dashboard with date and hourly slot badges, equipment details, edit equipment modal trigger, and cancellation confirmation dialog with score warnings
- `NewReservationView` (in `src/views/NewReservationView.jsx`): Multi-step booking creation interface supporting date selection (up to 14 days in advance), hourly time slot selection, manual or automatic facility selection (filtering out maintenance courts), dynamic equipment inventory validation, mandatory equipment locking, and score restrictions
- `EditReservationModal` (in `src/components/EditReservationModal.jsx`): Interactive modal for adjusting equipment quantities for active bookings while enforcing mandatory minimums and slot-based stock limits
- `ScoreBadge` (in `src/components/ScoreBadge.jsx`): Visual badge showing user score and penalty status with explanatory tooltips

---

## Users Credentials
Please note that when restarting the back end, a Javascript file called init-db.mjs is run
and database state is taken to the starting one, whose users are those below.
This is to have the application database on a well-defined and well-known
starting status. Every other user created later will go lost

|  username  |  plain-text password  |      role       |  initial_score  |   number_of_reservations  |
|------------|-----------------------|-----------------|-----------------|---------------------------|
|   alice    |       password        |      admin      |        0        |            0              |
|   bob      |       password        |      user       |       -2        |            1              |
|   carol    |       password        |      user       |       -1        |            1              |
|   dave     |       password        |      user       |        0        |            2              |
|   admin    |       password        |      admin      |        0        |            0              |
|   staff    |       password        |      staff      |        0        |            0              |