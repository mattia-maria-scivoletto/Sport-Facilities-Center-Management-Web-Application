import * as OTPAuth from 'otpauth';

const BASE_URL = 'http://localhost:3001';

let passed = 0;
let failed = 0;
const failures = [];

async function assert(testName, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${testName}`);
  } catch (err) {
    failed++;
    failures.push({ testName, error: err.message || err });
    console.error(`  ✗ ${testName}: ${err.message || err}`);
  }
}

class Client {
  constructor() {
    this.cookies = '';
  }

  async request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    const res = await fetch(url, {
      ...options,
      headers
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      // Store session cookie
      const match = setCookie.match(/connect\.sid=[^;]+/);
      if (match) {
        this.cookies = match[0];
      }
    }

    let data = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { status: res.status, headers: res.headers, data };
  }

  get(path) {
    return this.request(path, { method: 'GET' });
  }

  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  }

  put(path, body) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  patch(path, body) {
    return this.request(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  delete(path) {
    return this.request(path, { method: 'DELETE' });
  }
}

async function runTests() {
  console.log('=== STARTING COMPREHENSIVE TEST SUITE ===\n');

  // --- 1. Public Endpoints ---
  console.log('--- Test Suite 1: Public Availability & Schedule Calendar ---');
  await assert('Public availability without params returns 200 and valid structure', async () => {
    const client = new Client();
    const res = await client.get('/api/public/availability');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.facilities || !Array.isArray(res.data.facilities)) throw new Error('Missing facilities array');
    if (!res.data.equipment || !Array.isArray(res.data.equipment)) throw new Error('Missing equipment array');
    const tennis = res.data.facilities.find((f) => f.typeId === 'TENNIS');
    if (!tennis) throw new Error('TENNIS facility type not found');
    const t2 = tennis.facilityCodes.find((c) => c.code === 'T2');
    if (!t2 || !t2.isMaintenance) throw new Error('T2 should be marked as maintenance in seed data');
  });

  await assert('Public availability with custom date and timeSlot', async () => {
    const client = new Client();
    const res = await client.get('/api/public/availability?date=2026-10-01&timeSlot=14:00');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.selectedDate !== '2026-10-01') throw new Error('Date mismatch');
    if (res.data.selectedTimeSlot !== '14:00') throw new Error('TimeSlot mismatch');
  });

  await assert('Schedule calendar matrix returns 200 with facilities and reservations', async () => {
    const client = new Client();
    const res = await client.get('/api/schedule/calendar');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.facilities || !res.data.facilityTypes || !res.data.reservations) {
      throw new Error('Incomplete calendar data payload');
    }
  });

  // --- 2. Authentication & Authorization Security ---
  console.log('\n--- Test Suite 2: Authentication & Authorization ---');
  await assert('Protected endpoint returns 401 when unauthenticated', async () => {
    const client = new Client();
    const res = await client.get('/api/reservations');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await assert('Admin endpoint returns 401 when unauthenticated', async () => {
    const client = new Client();
    const res = await client.get('/api/admin/analytics');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await assert('Login with wrong credentials returns 401', async () => {
    const client = new Client();
    const res = await client.post('/api/sessions', { username: 'alice', password: 'wrongpassword' });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await assert('Login with alice (admin) returns 200 and admin role', async () => {
    const client = new Client();
    const res = await client.post('/api/sessions', { username: 'alice', password: 'password' });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.role !== 'admin') throw new Error(`Expected admin role, got ${res.data.role}`);
    if (res.data.username !== 'alice') throw new Error('Username mismatch');
  });

  await assert('Current session reflects authenticated state', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.get('/api/sessions/current');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.username !== 'alice') throw new Error('Session username mismatch');
  });

  await assert('Logout successfully clears session', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const logoutRes = await client.delete('/api/sessions/current');
    if (logoutRes.status !== 200) throw new Error(`Expected 200, got ${logoutRes.status}`);
    const checkRes = await client.get('/api/sessions/current');
    if (checkRes.status !== 401) throw new Error(`Expected 401 after logout, got ${checkRes.status}`);
  });

  // --- 3. User Registration & Password Management ---
  console.log('\n--- Test Suite 3: User Registration & Password Change ---');
  const testUsername = `u_${Date.now().toString().slice(-8)}`;
  await assert('Registration creates new user with 201', async () => {
    const client = new Client();
    const res = await client.post('/api/users', { username: testUsername, password: 'testpassword123' });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.username !== testUsername) throw new Error('Username mismatch');
  });

  await assert('Registration with duplicate username returns 409', async () => {
    const client = new Client();
    const res = await client.post('/api/users', { username: testUsername, password: 'testpassword123' });
    if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
  });

  await assert('Registration validation fails for short password with 422', async () => {
    const client = new Client();
    const res = await client.post('/api/users', { username: 'validname', password: '123' });
    if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);
  });

  await assert('Change password verifies old password and updates with 200', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: testUsername, password: 'testpassword123' });

    // Try same password -> 422
    const sameRes = await client.put('/api/users/current/password', {
      oldPassword: 'testpassword123',
      newPassword: 'testpassword123'
    });
    if (sameRes.status !== 422) throw new Error(`Expected 422 for same password, got ${sameRes.status}`);

    // Try incorrect old password -> 401
    const wrongRes = await client.put('/api/users/current/password', {
      oldPassword: 'wrongoldpassword',
      newPassword: 'newpassword456'
    });
    if (wrongRes.status !== 401) throw new Error(`Expected 401 for wrong old password, got ${wrongRes.status}`);

    // Valid update
    const updateRes = await client.put('/api/users/current/password', {
      oldPassword: 'testpassword123',
      newPassword: 'newpassword456'
    });
    if (updateRes.status !== 200) throw new Error(`Expected 200, got ${updateRes.status}`);

    // Verify login with new password
    const reClient = new Client();
    const reLogin = await reClient.post('/api/sessions', { username: testUsername, password: 'newpassword456' });
    if (reLogin.status !== 200) throw new Error(`Login with new password failed with ${reLogin.status}`);
  });

  // --- 4. 2FA TOTP Verification & Score Reset ---
  console.log('\n--- Test Suite 4: 2FA TOTP & Score Reset ---');
  await assert('TOTP verification fails on invalid 6-digit code with 401', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'bob', password: 'password' }); // bob has score -2
    const res = await client.post('/api/login-totp', { code: '000000' });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await assert('TOTP verification resets negative score to 0 on valid code', async () => {
    const client = new Client();
    const loginRes = await client.post('/api/sessions', { username: 'bob', password: 'password' });
    const totp = new OTPAuth.TOTP({
      issuer: 'SportsCenter',
      label: 'bob',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32('LXBSMDTMSP2I5XFXIYRGFVWSFI')
    });
    const validToken = totp.generate();

    const totpRes = await client.post('/api/login-totp', { code: validToken });
    if (totpRes.status !== 200) throw new Error(`Expected 200, got ${totpRes.status}: ${JSON.stringify(totpRes.data)}`);
    if (totpRes.data.user.score !== 0) throw new Error(`Expected score 0, got ${totpRes.data.user.score}`);
    if (!totpRes.data.user.isTotp) throw new Error('Expected isTotp to be true');

    // Replay attack prevention: same token again should be rejected with 401
    const replayRes = await client.post('/api/login-totp', { code: validToken });
    if (replayRes.status !== 401) throw new Error(`Expected 401 on replay attack, got ${replayRes.status}`);
  });

  // --- 5. Facilities, Rules & Reservation Constraints ---
  console.log('\n--- Test Suite 5: Reservation Rules & Constraints ---');
  await assert('Facility types returns 200 and list of sports', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.get('/api/facility-types');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.data) || res.data.length === 0) throw new Error('No facility types returned');
  });

  await assert('Facility equipment rules return mandatory minimums and available inventory', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.get('/api/facility-types/TENNIS/rules');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const racket = res.data.find((r) => r.equipmentTypeId === 'TENNIS_RACKET');
    if (!racket) throw new Error('TENNIS_RACKET rule missing');
    if (racket.minQuantity !== 2) throw new Error(`Expected minQuantity 2, got ${racket.minQuantity}`);
  });

  await assert('Creating reservation without mandatory equipment fails with 422', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    // Tennis requires min 2 rackets and 3 balls
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'TENNIS',
      bookingDate: '2026-11-01',
      startTime: '10:00',
      endTime: '11:00',
      automaticFacilitySelection: 1,
      equipments: [
        { equipmentTypeId: 'TENNIS_RACKET', quantity: 1 } // only 1 racket provided
      ]
    });
    if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await assert('Creating reservation with excess equipment over total physical stock fails with 422', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'TENNIS',
      bookingDate: '2026-11-01',
      startTime: '10:00',
      endTime: '11:00',
      automaticFacilitySelection: 1,
      equipments: [
        { equipmentTypeId: 'TENNIS_RACKET', quantity: 999 },
        { equipmentTypeId: 'TENNIS_BALL', quantity: 3 }
      ]
    });
    if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);
  });

  await assert('Negative score user booking optional equipment is rejected with 403', async () => {
    const client = new Client();
    // Carol has score -1
    await client.post('/api/sessions', { username: 'carol', password: 'password' });
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'TENNIS',
      bookingDate: '2026-11-02',
      startTime: '10:00',
      endTime: '11:00',
      automaticFacilitySelection: 1,
      equipments: [
        { equipmentTypeId: 'TENNIS_RACKET', quantity: 2 },
        { equipmentTypeId: 'TENNIS_BALL', quantity: 3 },
        { equipmentTypeId: 'TOWEL', quantity: 1 } // TOWEL is optional (min = 0)
      ]
    });
    if (res.status !== 403) throw new Error(`Expected 403 for negative score optional item, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await assert('Negative score user booking extra above mandatory minimum is rejected with 403', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'carol', password: 'password' }); // score -1
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'TENNIS',
      bookingDate: '2026-11-02',
      startTime: '10:00',
      endTime: '11:00',
      automaticFacilitySelection: 1,
      equipments: [
        { equipmentTypeId: 'TENNIS_RACKET', quantity: 4 }, // 4 > 2 (extra mandatory)
        { equipmentTypeId: 'TENNIS_BALL', quantity: 3 }
      ]
    });
    if (res.status !== 403) throw new Error(`Expected 403 for negative score extra equipment, got ${res.status}`);
  });

  await assert('Negative score user booking exact mandatory equipment succeeds with 201', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'carol', password: 'password' }); // score -1
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'TENNIS',
      bookingDate: '2026-11-03',
      startTime: '10:00',
      endTime: '11:00',
      automaticFacilitySelection: 1,
      equipments: [
        { equipmentTypeId: 'TENNIS_RACKET', quantity: 2 }, // exact mandatory min
        { equipmentTypeId: 'TENNIS_BALL', quantity: 3 }    // exact mandatory min
      ]
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await assert('Booking a court currently in maintenance is blocked with 422', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    // T2 is in maintenance mode
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'TENNIS',
      facilityId: 'T2',
      bookingDate: '2026-11-05',
      startTime: '10:00',
      endTime: '11:00',
      automaticFacilitySelection: 0,
      equipments: [
        { equipmentTypeId: 'TENNIS_RACKET', quantity: 2 },
        { equipmentTypeId: 'TENNIS_BALL', quantity: 3 }
      ]
    });
    if (res.status !== 422) throw new Error(`Expected 422 for maintenance court, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  // --- 6. Booking Lifecycle: Create, Collision, Edit, Cancel & Cooldown ---
  console.log('\n--- Test Suite 6: Full Booking Lifecycle (Collision, Edit, Cancel, Cooldown) ---');
  let createdResId = null;
  await assert('Create new reservation with valid parameters returns 201', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'CYCLING',
      facilityId: 'C1',
      bookingDate: '2026-11-10',
      startTime: '15:00',
      endTime: '16:00',
      automaticFacilitySelection: 0,
      equipments: [
        { equipmentTypeId: 'BICYCLE', quantity: 1 },
        { equipmentTypeId: 'HELMET', quantity: 1 },
        { equipmentTypeId: 'REPAIR_KIT', quantity: 1 }
      ]
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    createdResId = res.data.reservationId;
  });

  await assert('Collision: another booking on same court and slot returns 409', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'dave', password: 'password' });
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'CYCLING',
      facilityId: 'C1', // already booked above
      bookingDate: '2026-11-10',
      startTime: '15:00',
      endTime: '16:00',
      automaticFacilitySelection: 0,
      equipments: [
        { equipmentTypeId: 'BICYCLE', quantity: 1 },
        { equipmentTypeId: 'HELMET', quantity: 1 }
      ]
    });
    if (res.status !== 409) throw new Error(`Expected 409 for court collision, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await assert('Edit equipment: non-owner is rejected with 403', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'dave', password: 'password' });
    const res = await client.put(`/api/reservations/${createdResId}/equipment`, {
      equipments: [
        { equipmentTypeId: 'BICYCLE', quantity: 1 },
        { equipmentTypeId: 'HELMET', quantity: 1 }
      ]
    });
    if (res.status !== 403) throw new Error(`Expected 403 for non-owner edit, got ${res.status}`);
  });

  await assert('Edit equipment: reducing below mandatory minimum fails with 422', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.put(`/api/reservations/${createdResId}/equipment`, {
      equipments: [
        { equipmentTypeId: 'BICYCLE', quantity: 0 }, // min is 1
        { equipmentTypeId: 'HELMET', quantity: 1 }
      ]
    });
    if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}`);
  });

  await assert('Edit equipment: owner successfully updates optional equipment', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.put(`/api/reservations/${createdResId}/equipment`, {
      equipments: [
        { equipmentTypeId: 'BICYCLE', quantity: 1 },
        { equipmentTypeId: 'HELMET', quantity: 1 },
        { equipmentTypeId: 'REPAIR_KIT', quantity: 0 } // removed optional repair kit
      ]
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await assert('Edit reservation: owner successfully reschedules date and time slot', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.put(`/api/reservations/${createdResId}`, {
      bookingDate: '2026-11-20',
      startTime: '11:00',
      facilityId: 'C1',
      equipments: [
        { equipmentTypeId: 'BICYCLE', quantity: 1 },
        { equipmentTypeId: 'HELMET', quantity: 1 }
      ]
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.bookingDate !== '2026-11-20' || res.data.startTime !== '11:00') {
      throw new Error(`Date or timeSlot was not updated: ${JSON.stringify(res.data)}`);
    }

    // Verify through GET /api/reservations
    const listRes = await client.get('/api/reservations');
    const updated = listRes.data.find((r) => r.reservationId === createdResId);
    if (!updated || updated.bookingDate !== '2026-11-20' || updated.startTime !== '11:00') {
      throw new Error('Updated reservation not found with new schedule in list');
    }
  });

  await assert('Edit reservation: collision on new date and time slot returns 409', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    // In seed data: User 2 (bob) has reservation on B1 at 10:00 today.
    // User 4 (dave) has reservation 3 on V1 at 16:00 today.
    // Dave tries to edit reservation 3 to 10:00 today on B1? No, V1 is volleyball, B1 is basketball.
    // Let's have Dave try to move TT1 (reservation 4) to 18:00 today where TT1 is already booked!
    // Or Alice creates a second booking on C2 at 11:00 on 2026-11-20, then tries to move createdResId from C1 to C2!
    const resOther = await client.post('/api/reservations', {
      facilityTypeId: 'CYCLING',
      facilityId: 'C2',
      bookingDate: '2026-11-20',
      startTime: '11:00',
      automaticFacilitySelection: 0,
      equipments: [
        { equipmentTypeId: 'BICYCLE', quantity: 1 },
        { equipmentTypeId: 'HELMET', quantity: 1 }
      ]
    });
    const collisionRes = await client.put(`/api/reservations/${createdResId}`, {
      bookingDate: '2026-11-20',
      startTime: '11:00',
      facilityId: 'C2' // C2 is now booked by the second reservation
    });
    if (collisionRes.status !== 409) {
      throw new Error(`Expected 409 for collision on reschedule, got ${collisionRes.status}: ${JSON.stringify(collisionRes.data)}`);
    }

    // Clean up second reservation
    if (resOther.data.reservationId) {
      await client.delete(`/api/reservations/${resOther.data.reservationId}`);
    }
  });

  await assert('Edit reservation: rescheduling to a past date returns 422', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.put(`/api/reservations/${createdResId}`, {
      bookingDate: '2020-01-01',
      startTime: '11:00'
    });
    if (res.status !== 422) throw new Error(`Expected 422 for past date, got ${res.status}`);
  });

  await assert('Cancel reservation: non-owner is rejected with 403', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'dave', password: 'password' });
    const res = await client.delete(`/api/reservations/${createdResId}`);
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await assert('Cancel reservation: owner cancels, score decrements, and cooldown is returned', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const currentSession = await client.get('/api/sessions/current');
    const prevScore = currentSession.data.score;

    const res = await client.delete(`/api/reservations/${createdResId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.newScore !== prevScore - 1) throw new Error(`Expected score ${prevScore - 1}, got ${res.data.newScore}`);
    if (res.data.cooldownFacilityTypeId !== 'CYCLING') throw new Error('Expected CYCLING cooldown');
  });

  await assert('Cooldown constraint: immediate re-booking of same sport is blocked with 403', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'CYCLING',
      bookingDate: '2026-11-15',
      startTime: '10:00',
      endTime: '11:00',
      automaticFacilitySelection: 1,
      equipments: [
        { equipmentTypeId: 'BICYCLE', quantity: 1 },
        { equipmentTypeId: 'HELMET', quantity: 1 }
      ]
    });
    if (res.status !== 403) throw new Error(`Expected 403 during cooldown, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (!res.data.error || (!res.data.error.includes('cancelled a reservation') && !res.data.error.includes('wait'))) {
      throw new Error(`Expected error message to mention cancellation/wait constraint, got: ${res.data.error}`);
    }
  });

  await assert('Cooldown allows booking a DIFFERENT sport immediately', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.post('/api/reservations', {
      facilityTypeId: 'VOLLEYBALL', // different from CYCLING
      bookingDate: '2026-11-15',
      startTime: '10:00',
      endTime: '11:00',
      automaticFacilitySelection: 1,
      equipments: [
        { equipmentTypeId: 'VOLLEYBALL', quantity: 1 }
      ]
    });
    // Note: alice currently has score -1 (from cancel), but VOLLEYBALL has min 1 volleyball and 0 knee pads, so exact mandatory succeeds!
    if (res.status !== 201) throw new Error(`Expected 201 for different sport, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  // --- 7. Admin & Facility Operations (RBAC) ---
  console.log('\n--- Test Suite 7: Admin & Facility Operations (RBAC) ---');
  await assert('Regular user ("user" role) is denied access to admin endpoints with 403', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'dave', password: 'password' }); // role: 'user'
    const res = await client.get('/api/admin/analytics');
    if (res.status !== 403) throw new Error(`Expected 403 for user role, got ${res.status}`);
  });

  await assert('Staff user can access analytics, facilities, equipment and users with 200', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'staff', password: 'password' }); // role: 'staff'
    const aRes = await client.get('/api/admin/analytics');
    if (aRes.status !== 200) throw new Error(`Analytics expected 200, got ${aRes.status}`);
    if (!aRes.data.kpis || aRes.data.hourlyUtilization.length !== 14) throw new Error('Invalid analytics structure');

    const fRes = await client.get('/api/admin/facilities');
    if (fRes.status !== 200) throw new Error(`Facilities expected 200, got ${fRes.status}`);

    const eRes = await client.get('/api/admin/equipment');
    if (eRes.status !== 200) throw new Error(`Equipment expected 200, got ${eRes.status}`);

    const uRes = await client.get('/api/admin/users');
    if (uRes.status !== 200) throw new Error(`Users expected 200, got ${uRes.status}`);
  });

  await assert('Staff user cannot change user roles (admin-only) and gets 403', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'staff', password: 'password' });
    const res = await client.patch('/api/admin/users/2/role', { role: 'admin' });
    if (res.status !== 403) throw new Error(`Expected 403 for staff modifying role, got ${res.status}`);
  });

  await assert('Admin user can change user roles with 200', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'admin', password: 'password' });
    const res = await client.patch('/api/admin/users/4/role', { role: 'staff' });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    // Revert role back to user
    await client.patch('/api/admin/users/4/role', { role: 'user' });
  });

  await assert('Admin can toggle facility maintenance mode', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'admin', password: 'password' });
    // Put T1 into maintenance
    const toggleOn = await client.patch('/api/admin/facilities/T1/maintenance', {
      isMaintenance: true,
      maintenanceReason: 'Net repair and cleaning'
    });
    if (toggleOn.status !== 200) throw new Error(`Expected 200 on enable, got ${toggleOn.status}`);
    if (!toggleOn.data.isMaintenance) throw new Error('Expected isMaintenance true');

    // Turn off maintenance
    const toggleOff = await client.patch('/api/admin/facilities/T1/maintenance', {
      isMaintenance: false
    });
    if (toggleOff.status !== 200) throw new Error(`Expected 200 on disable, got ${toggleOff.status}`);
    if (toggleOff.data.isMaintenance) throw new Error('Expected isMaintenance false');
  });

  await assert('Admin equipment inventory: safely updates quantity', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'admin', password: 'password' });
    const res = await client.patch('/api/admin/equipment/TOWEL', { totalQuantity: 10 });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.totalQuantity !== 10) throw new Error('Quantity not updated');
    // Restore
    await client.patch('/api/admin/equipment/TOWEL', { totalQuantity: 4 });
  });

  await assert('Admin equipment inventory: rejects reduction below active reservations with 422', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'admin', password: 'password' });
    // BASKETBALL has 1 active reservation in seed data (user 2 at 10:00)
    const res = await client.patch('/api/admin/equipment/BASKETBALL', { totalQuantity: 0 });
    if (res.status !== 422) throw new Error(`Expected 422, got ${res.status}: ${JSON.stringify(res.data)}`);
  });

  // ==========================================
  // Test Suite 8: Virtual Wallet & Gamification
  // ==========================================
  console.log('\n--- Test Suite 8: Virtual Wallet & Gamification ---');

  await assert('Wallet: GET /api/wallet returns 200 with balance, streak, badges and transactions', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const res = await client.get('/api/wallet');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (typeof res.data.walletBalance !== 'number') throw new Error('Missing walletBalance');
    if (typeof res.data.bookingStreak !== 'number') throw new Error('Missing bookingStreak');
    if (!Array.isArray(res.data.badges)) throw new Error('Badges must be an array');
    if (!Array.isArray(res.data.transactions)) throw new Error('Transactions must be an array');
  });

  await assert('Wallet: POST /api/wallet/recharge increases balance and logs transaction', async () => {
    const client = new Client();
    const testUsername = 'w_' + Math.floor(Math.random() * 1000000);
    await client.post('/api/users', { username: testUsername, password: 'password123' });
    await client.post('/api/sessions', { username: testUsername, password: 'password123' });

    // Initial balance is 500
    const initialWallet = await client.get('/api/wallet');
    const prevBalance = initialWallet.data.walletBalance;

    const rechargeRes = await client.post('/api/wallet/recharge', { amount: 75 });
    if (rechargeRes.status !== 200) throw new Error(`Expected 200, got ${rechargeRes.status}`);
    if (rechargeRes.data.newBalance !== prevBalance + 75) {
      throw new Error(`Expected newBalance ${prevBalance + 75}, got ${rechargeRes.data.newBalance}`);
    }

    const txRes = await client.get('/api/wallet/transactions');
    const rechargeTx = txRes.data.find((t) => t.type === 'recharge' && t.amount === 75);
    if (!rechargeTx) throw new Error('Recharge transaction not recorded');
  });

  await assert('Wallet: POST /api/wallet/recharge rejects invalid amounts with 422', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    const resNeg = await client.post('/api/wallet/recharge', { amount: -50 });
    if (resNeg.status !== 422) throw new Error(`Expected 422 for negative amount, got ${resNeg.status}`);
    const resZero = await client.post('/api/wallet/recharge', { amount: 0 });
    if (resZero.status !== 422) throw new Error(`Expected 422 for 0 amount, got ${resZero.status}`);
  });

  await assert('Wallet: POST /api/wallet/calculate-cost returns court base and equipment price breakdown', async () => {
    const client = new Client();
    await client.post('/api/sessions', { username: 'alice', password: 'password' });
    // TENNIS base is 15. TENNIS_RACKET is 3 (x2 = 6). TENNIS_BALL is 1 (x3 = 3). Total = 24.
    const res = await client.post('/api/wallet/calculate-cost', {
      facilityTypeId: 'TENNIS',
      equipments: [
        { equipmentTypeId: 'TENNIS_RACKET', quantity: 2 },
        { equipmentTypeId: 'TENNIS_BALL', quantity: 3 }
      ]
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.basePrice !== 15) throw new Error(`Expected basePrice 15, got ${res.data.basePrice}`);
    if (res.data.equipmentCost !== 9) throw new Error(`Expected equipmentCost 9, got ${res.data.equipmentCost}`);
    if (res.data.totalCost !== 24) throw new Error(`Expected totalCost 24, got ${res.data.totalCost}`);
  });

  await assert('Wallet: Booking facility deducts exact credits and logs booking_payment', async () => {
    const client = new Client();
    const testUsername = 'pay_' + Math.floor(Math.random() * 1000000);
    await client.post('/api/users', { username: testUsername, password: 'password123' });
    await client.post('/api/sessions', { username: testUsername, password: 'password123' });

    const wBefore = await client.get('/api/wallet');
    const startBal = wBefore.data.walletBalance;

    // Book Basketball (Court: 12, 1 Basketball: 2 = 14 credits)
    const bookingDate = '2026-11-20';
    const bookRes = await client.post('/api/reservations', {
      facilityTypeId: 'BASKETBALL',
      facilityId: 'auto',
      automaticFacilitySelection: true,
      bookingDate,
      startTime: '13:00',
      endTime: '14:00',
      equipments: [{ equipmentTypeId: 'BASKETBALL', quantity: 1 }]
    });

    if (bookRes.status !== 201) throw new Error(`Expected 201, got ${bookRes.status}: ${JSON.stringify(bookRes.data)}`);
    if (bookRes.data.totalCost !== 14) throw new Error(`Expected totalCost 14, got ${bookRes.data.totalCost}`);
    if (bookRes.data.newWalletBalance !== startBal - 14) {
      throw new Error(`Expected newWalletBalance ${startBal - 14}, got ${bookRes.data.newWalletBalance}`);
    }

    const txRes = await client.get('/api/wallet/transactions');
    const paymentTx = txRes.data.find((t) => t.type === 'booking_payment' && t.amount === -14);
    if (!paymentTx) throw new Error('Payment transaction not found in history');
  });

  await assert('Wallet: Booking with insufficient credits is rejected with 402', async () => {
    const client = new Client();
    const poorUser = 'poor_' + Math.floor(Math.random() * 1000000);
    await client.post('/api/users', { username: poorUser, password: 'password123' });
    await client.post('/api/sessions', { username: poorUser, password: 'password123' });

    // Initial balance is 500. Let's spend all credits or create reservations until empty.
    // Instead, we book SOCCER with all 12 soccer shoes (20 + 2 + 12*4 = 70 each booking).
    // Let's create multiple bookings to exhaust balance.
    for (let i = 8; i <= 14; i++) {
      const slot = `${i < 10 ? '0' + i : i}:00`;
      const endSlot = `${i + 1 < 10 ? '0' + (i + 1) : i + 1}:00`;
      await client.post('/api/reservations', {
        facilityTypeId: 'SOCCER',
        facilityId: 'S1',
        automaticFacilitySelection: false,
        bookingDate: '2026-12-01',
        startTime: slot,
        endTime: endSlot,
        equipments: [
          { equipmentTypeId: 'SOCCER_BALL', quantity: 1 },
          { equipmentTypeId: 'SOCCER_SHOES', quantity: 12 }
        ]
      });
    }

    const wCheck = await client.get('/api/wallet');
    // Balance is 500 - 7*70 + 30 (streak bonuses) = 40 credits
    if (wCheck.data.walletBalance >= 70) throw new Error(`Expected balance < 70, got ${wCheck.data.walletBalance}`);

    // Attempting another booking requiring 70 credits should fail with 402
    const failRes = await client.post('/api/reservations', {
      facilityTypeId: 'SOCCER',
      facilityId: 'S1',
      automaticFacilitySelection: false,
      bookingDate: '2026-12-01',
      startTime: '15:00',
      endTime: '16:00',
      equipments: [
        { equipmentTypeId: 'SOCCER_BALL', quantity: 1 },
        { equipmentTypeId: 'SOCCER_SHOES', quantity: 12 }
      ]
    });

    if (failRes.status !== 402) {
      throw new Error(`Expected 402 Insufficient credits, got ${failRes.status}: ${JSON.stringify(failRes.data)}`);
    }
  });

  await assert('Gamification: Consecutive booking streak increments and awards +15 credits on 3rd booking', async () => {
    const client = new Client();
    const streakUser = 'strk_' + Math.floor(Math.random() * 1000000);
    await client.post('/api/users', { username: streakUser, password: 'password123' });
    await client.post('/api/sessions', { username: streakUser, password: 'password123' });

    // Booking 1: Volley (12 + 2 = 14 credits)
    const b1 = await client.post('/api/reservations', {
      facilityTypeId: 'VOLLEYBALL',
      facilityId: 'auto',
      automaticFacilitySelection: true,
      bookingDate: '2026-11-25',
      startTime: '09:00',
      endTime: '10:00',
      equipments: [{ equipmentTypeId: 'VOLLEYBALL', quantity: 1 }]
    });
    if (b1.status !== 201) throw new Error(`Expected 201, got ${b1.status}: ${JSON.stringify(b1.data)}`);
    if (b1.data.bookingStreak !== 1) throw new Error(`Expected streak 1, got ${b1.data.bookingStreak}`);
    if (b1.data.streakBonusAwarded !== 0) throw new Error('Unexpected bonus on streak 1');

    // Booking 2: Volley
    const b2 = await client.post('/api/reservations', {
      facilityTypeId: 'VOLLEYBALL',
      facilityId: 'auto',
      automaticFacilitySelection: true,
      bookingDate: '2026-11-25',
      startTime: '10:00',
      endTime: '11:00',
      equipments: [{ equipmentTypeId: 'VOLLEYBALL', quantity: 1 }]
    });
    if (b2.status !== 201) throw new Error(`Expected 201, got ${b2.status}: ${JSON.stringify(b2.data)}`);
    if (b2.data.bookingStreak !== 2) throw new Error(`Expected streak 2, got ${b2.data.bookingStreak}`);

    // Booking 3: Volley (Milestone!)
    const b3 = await client.post('/api/reservations', {
      facilityTypeId: 'VOLLEYBALL',
      facilityId: 'auto',
      automaticFacilitySelection: true,
      bookingDate: '2026-11-25',
      startTime: '11:00',
      endTime: '12:00',
      equipments: [{ equipmentTypeId: 'VOLLEYBALL', quantity: 1 }]
    });
    if (b3.status !== 201) throw new Error(`Expected 201, got ${b3.status}: ${JSON.stringify(b3.data)}`);
    if (b3.data.bookingStreak !== 3) throw new Error(`Expected streak 3, got ${b3.data.bookingStreak}`);
    if (b3.data.streakBonusAwarded !== 15) throw new Error(`Expected bonus 15, got ${b3.data.streakBonusAwarded}`);

    // Check that Reliable Player badge is unlocked
    const w = await client.get('/api/wallet');
    const reliableBadge = w.data.badges.find((b) => b.id === 'reliable_player');
    if (!reliableBadge || !reliableBadge.unlocked) throw new Error('Reliable player badge should be unlocked');

    // Check that bonus transaction was recorded
    const tx = await client.get('/api/wallet/transactions');
    const bonusTx = tx.data.find((t) => t.type === 'streak_bonus' && t.amount === 15);
    if (!bonusTx) throw new Error('Streak bonus transaction not logged');
  });

  await assert('Wallet: Cancelling reservation refunds totalCost and resets streak to 0', async () => {
    const client = new Client();
    const cancelUser = 'canc_' + Math.floor(Math.random() * 1000000);
    await client.post('/api/users', { username: cancelUser, password: 'password123' });
    await client.post('/api/sessions', { username: cancelUser, password: 'password123' });

    // Make booking (Cycling Track: 10 + 1 Bicycle: 5 + 1 Helmet: 2 = 17 credits)
    const bookRes = await client.post('/api/reservations', {
      facilityTypeId: 'CYCLING',
      facilityId: 'C1',
      automaticFacilitySelection: false,
      bookingDate: '2026-11-28',
      startTime: '14:00',
      endTime: '15:00',
      equipments: [
        { equipmentTypeId: 'BICYCLE', quantity: 1 },
        { equipmentTypeId: 'HELMET', quantity: 1 }
      ]
    });
    const reservationId = bookRes.data.reservationId;
    const preCancelWallet = await client.get('/api/wallet');

    // Cancel booking
    const cancelRes = await client.delete(`/api/reservations/${reservationId}`);
    if (cancelRes.status !== 200) throw new Error(`Expected 200, got ${cancelRes.status}`);
    if (cancelRes.data.refundAmount !== 17) throw new Error(`Expected refund 17, got ${cancelRes.data.refundAmount}`);
    if (cancelRes.data.bookingStreak !== 0) throw new Error('Expected streak to reset to 0');
    if (cancelRes.data.newWalletBalance !== preCancelWallet.data.walletBalance + 17) {
      throw new Error('Wallet balance did not increase by refund amount');
    }

    const tx = await client.get('/api/wallet/transactions');
    const refundTx = tx.data.find((t) => t.type === 'booking_refund' && t.amount === 17);
    if (!refundTx) throw new Error('Refund transaction not found in log');
  });

  await assert('Wallet: Editing reservation adjusts cost difference in wallet', async () => {
    const client = new Client();
    const editUser = 'edit_' + Math.floor(Math.random() * 1000000);
    await client.post('/api/users', { username: editUser, password: 'password123' });
    await client.post('/api/sessions', { username: editUser, password: 'password123' });

    // Book Table Tennis: base 8 + 2 TT_RACKET (4) + 1 TT_BALL (1) = 13 credits
    const bookRes = await client.post('/api/reservations', {
      facilityTypeId: 'TABLE_TENNIS',
      facilityId: 'TT1',
      automaticFacilitySelection: false,
      bookingDate: '2026-11-29',
      startTime: '10:00',
      endTime: '11:00',
      equipments: [
        { equipmentTypeId: 'TT_RACKET', quantity: 2 },
        { equipmentTypeId: 'TT_BALL', quantity: 1 }
      ]
    });
    const reservationId = bookRes.data.reservationId;
    const w1 = await client.get('/api/wallet');

    // Upgrade equipment: add 2 extra rackets (4 total, +4 credits)
    const editUpgrade = await client.put(`/api/reservations/${reservationId}`, {
      equipments: [
        { equipmentTypeId: 'TT_RACKET', quantity: 4 },
        { equipmentTypeId: 'TT_BALL', quantity: 1 }
      ]
    });
    if (editUpgrade.status !== 200) throw new Error(`Expected 200, got ${editUpgrade.status}: ${JSON.stringify(editUpgrade.data)}`);
    if (editUpgrade.data.costDelta !== 4) throw new Error(`Expected costDelta 4, got ${editUpgrade.data.costDelta}`);
    if (editUpgrade.data.totalCost !== 17) throw new Error(`Expected new totalCost 17, got ${editUpgrade.data.totalCost}`);
    if (editUpgrade.data.newWalletBalance !== w1.data.walletBalance - 4) {
      throw new Error('Wallet did not deduct delta 4');
    }

    // Downgrade equipment: reduce rackets back to 2 (-4 credits refund)
    const editDowngrade = await client.put(`/api/reservations/${reservationId}`, {
      equipments: [
        { equipmentTypeId: 'TT_RACKET', quantity: 2 },
        { equipmentTypeId: 'TT_BALL', quantity: 1 }
      ]
    });
    if (editDowngrade.status !== 200) throw new Error(`Expected 200, got ${editDowngrade.status}`);
    if (editDowngrade.data.costDelta !== -4) throw new Error(`Expected costDelta -4, got ${editDowngrade.data.costDelta}`);
    if (editDowngrade.data.totalCost !== 13) throw new Error(`Expected new totalCost 13, got ${editDowngrade.data.totalCost}`);
  });

  console.log('\n=== TEST RESULTS SUMMARY ===');
  console.log(`Total tests: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    failures.forEach((f) => console.log(`- ${f.testName}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('\nAll tests passed successfully! 🎉');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
