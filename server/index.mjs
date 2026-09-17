import express from 'express';
import morgan from 'morgan';
import { check, validationResult } from 'express-validator';
import cors from 'cors';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import session from 'express-session';
import { TOTP } from 'otpauth';

import daoUsers from './dao-users.mjs';
import daoFacilities from './dao-facilities.mjs';
import daoReservations from './dao-reservations.mjs';

const app = express();
app.use(morgan('dev'));
app.use(express.json());

const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));

passport.use(
  new LocalStrategy({ usernameField: 'username', passwordField: 'password' }, async function verify (
    username,
    password,
    callback
  ) {
    try {
      const user = await daoUsers.getUser(username, password);
      if (!user) {
        return callback(null, false, 'Incorrect username or password');
      }
      return callback(null, user);
    } catch (err) {
      return callback(err);
    }
  })
);

passport.serializeUser((user, callback) => {
  callback(null, { id: user.id, username: user.username });
});

passport.deserializeUser(async (serializedUser, callback) => {
  try {
    const user = await daoUsers.getUserById(serializedUser.id);
    if (!user) {
      return callback(null, false);
    }
    return callback(null, user);
  } catch (err) {
    return callback(err);
  }
});


app.use(
  session({
    secret: 'LXBSMDTMSP2I5XFXIYRGFVWSFI',
    resave: false,
    saveUninitialized: false
  })
);

app.use(passport.authenticate('session'));

function verifyTotpToken(user, token) {
  const totp = new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: 'LXBSMDTMSP2I5XFXIYRGFVWSFI'
  });

  const delta = totp.validate({ token: String(token).trim(), window: 1 });
  if (delta === null) {
    return false;
  }

  const currentCounter = totp.counter();
  const actualStep = currentCounter + delta;

  if (actualStep <= (user.lastTotpStep || 0)) {
    return false;
  }

  user.lastTotpStep = actualStep;
  return true;
}

const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
};

const isAdminOrStaff = (req, res, next) => {
  if (req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'staff')) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Admin or Staff privileges required' });
};

const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Admin privileges required' });
};

const errorFormatter = ({ msg, path, location }) => `${location}[${path}]: ${msg}`;

async function formatClientUserInfo(req) {
  const user = req.user;
  const freshUser = await daoUsers.getUserById(user.id);
  const score = freshUser ? freshUser.score : 0;
  const role = freshUser ? freshUser.role : 'user';
  return {
    id: user.id,
    username: user.username,
    name: user.username.charAt(0).toUpperCase() + user.username.slice(1),
    score: score,
    role: role,
    canDoTotp: true,
    isTotp: req.session.method === 'totp'
  };
}

// GET /api/public/availability
app.get('/api/public/availability', async (req, res) => {
  try {
    const { date, timeSlot } = req.query;
    const data = await daoFacilities.getPublicAvailability(date, timeSlot);
    res.status(200).json(data);
  } catch (err) {
    console.error('Error in /api/public/availability:', err);
    res.status(500).json({ error: 'Internal server error while fetching availability' });
  }
});

// GET /api/schedule/calendar
// Get schedule matrix for interactive calendar / timeline
app.get('/api/schedule/calendar', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate || today;
    const defaultEnd = new Date(new Date(startDate).getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const endDate = req.query.endDate || defaultEnd;
    const facilityTypeId = req.query.facilityTypeId || null;

    const currentUserId = req.isAuthenticated() ? req.user.id : null;

    const rawReservations = await daoReservations.getScheduleMatrix(startDate, endDate, facilityTypeId);
    const facilities = await daoFacilities.getAllFacilities();
    const facilityTypes = await daoFacilities.getAllFacilityTypes();

    const reservations = rawReservations.map((r) => ({
      ...r,
      isMine: currentUserId !== null && r.userId === currentUserId
    }));

    return res.status(200).json({
      startDate,
      endDate,
      facilities,
      facilityTypes,
      reservations
    });
  } catch (err) {
    console.error('Error fetching calendar schedule:', err);
    return res.status(500).json({ error: 'Internal server error while fetching calendar schedule' });
  }
});

// GET /api/facility-types
app.get('/api/facility-types', isLoggedIn, async (req, res) => {
  try {
    const types = await daoFacilities.getAllFacilityTypes();
    res.status(200).json(types);
  } catch (err) {
    console.error('Error fetching facility types:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/facilities
app.get('/api/facilities', isLoggedIn, async (req, res) => {
  try {
    const { date, timeSlot } = req.query;
    const facilities = await daoFacilities.getAllFacilities(date, timeSlot);
    res.status(200).json(facilities);
  } catch (err) {
    console.error('Error fetching facilities:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/facility-types/:typeId/rules
app.get(
  '/api/facility-types/:typeId/rules',
  isLoggedIn,
  [
    check('typeId')
      .isString()
      .notEmpty()
      .matches(/^[A-Z_]+$/)
      .withMessage('typeId must contain only uppercase letters and underscores')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    try {
      const { date, timeSlot } = req.query;
      const rules = await daoFacilities.getFacilityEquipmentRules(req.params.typeId, date, timeSlot);
      res.status(200).json(rules);
    } catch (err) {
      console.error('Error fetching facility rules:', err);
      res.status(500).json({ error: 'Database error' });
    }
  }
);



// POST /api/users
// Register a new user
app.post(
  '/api/users',
  [
    check('username')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be between 3 and 20 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain alphanumeric characters and underscores'),
    check('password')
      .isString()
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    const { username, password } = req.body;

    try {
      const existingUser = await daoUsers.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: 'Username is already taken' });
      }

      const newUser = await daoUsers.createUser(username, password);
      return res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        message: 'User registered successfully'
      });
    } catch (err) {
      console.error('Error creating user:', err);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// PUT /api/users/current/password
// Edit password for the logged-in user
app.put(
  '/api/users/current/password',
  isLoggedIn,
  [
    check('oldPassword')
      .isString()
      .notEmpty()
      .withMessage('Current password is required'),
    check('newPassword')
      .isString()
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    const { oldPassword, newPassword } = req.body;

    if (oldPassword === newPassword) {
      return res.status(422).json({ error: 'New password must be different from current password' });
    }

    try {
      const result = await daoUsers.updatePassword(req.user.id, oldPassword, newPassword);
      if (!result.success) {
        return res.status(401).json({ error: result.error || 'Failed to update password' });
      }

      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error('Error updating password:', err);
      return res.status(500).json({ error: 'Internal server error while updating password' });
    }
  }
);

// POST /api/sessions
// login without TOTP/2FA
app.post('/api/sessions', (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: info || 'Incorrect username or password' });
    }
    req.login(user, async (loginErr) => {
      if (loginErr) return next(loginErr);
      req.session.method = 'password';
      const userInfo = await formatClientUserInfo(req);
      return res.status(200).json(userInfo);
    });
  })(req, res, next);
});

// POST /api/login-totp
// 2-Factor TOTP step
app.post(
  '/api/login-totp',
  isLoggedIn,
  [
    check('code')
      .isString()
      .matches(/^\d{6}$/)
      .withMessage('TOTP code must be exactly 6 digits')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    try {
      const user = await daoUsers.getUserById(req.user.id);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      const isValid = verifyTotpToken(user, req.body.code);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid or expired TOTP code' });
      }

      // valid TOTP: reset negative score to 0 and update last step
      req.session.method = 'totp';
      await daoUsers.updateLastTotpStep(user.id, user.lastTotpStep);
      await daoUsers.resetUserScoreToZero(user.id);

      const userInfo = await formatClientUserInfo(req);
      return res.status(200).json({ otp: 'authorized', user: userInfo });
    } catch (err) {
      console.error('Error during TOTP verification:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/sessions/current
// check if current user is logged or not
app.get('/api/sessions/current', async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const userInfo = await formatClientUserInfo(req);
      return res.status(200).json(userInfo);
    } catch (err) {
      console.error('Error fetching current session:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

// DELETE /api/sessions/current
// logout endpoint
app.delete('/api/sessions/current', isLoggedIn, (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.status(200).json({ message: 'Logged out successfully' });
    });
  });
});



// GET /api/reservations
// get all reservations for the logged-in user
app.get('/api/reservations', isLoggedIn, async (req, res) => {
  try {
    const reservations = await daoReservations.getUserReservations(req.user.id);
    return res.status(200).json(reservations);
  } catch (err) {
    console.error('Error fetching user reservations:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/reservations
// create a new facility reservation with equipment included
app.post(
  '/api/reservations',
  isLoggedIn,
  [
    check('facilityTypeId').notEmpty().withMessage('facilityTypeId is required'),
    check('equipments').isArray().withMessage('Equipments must be an array'),
    check('equipments.*.equipmentTypeId').matches(/^[A-Z_]+$/)
          .withMessage('equipmentTypeId must contain only uppercase letters and underscores'),
    check('equipments.*.quantity').isInt({ min: 0 })
          .withMessage('quantity must be an integer greater than or equal to 0')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    const {
      facilityTypeId,
      facilityId,
      automaticFacilitySelection,
      equipments,
      bookingDate,
      startTime,
      endTime
    } = req.body;

    const resolvedDate = bookingDate || new Date().toISOString().split('T')[0];
    const resolvedStartTime = startTime || '10:00';
    const calcEndTime = (sTime) => {
      const [h, m] = sTime.split(':').map(Number);
      const endH = String(h + 1).padStart(2, '0');
      return `${endH}:${String(m).padStart(2, '0')}`;
    };
    const resolvedEndTime = endTime || calcEndTime(resolvedStartTime);

    try {
      // check 30-second cooldown constraint for this facility type
      const cooldown = await daoReservations.checkCooldownConstraint(req.user.id, facilityTypeId);
      if (cooldown.inCooldown) {
        return res.status(403).json({
          error: `You recently cancelled a reservation for facility type ${facilityTypeId}. Please wait ${cooldown.remainingSeconds} second(s) before booking again.`
        });
      }

      // fetch fresh user score
      const userScoreObj = await daoUsers.getUserScore(req.user.id);
      const userScore = userScoreObj.score;

      // check equipment rules for facility type in that specific date and time slot
      const rules = await daoFacilities.getFacilityEquipmentRules(
        facilityTypeId,
        resolvedDate,
        resolvedStartTime
      );
      if (!rules || rules.length === 0) {
        return res.status(422).json({ error: `Unknown facility type: ${facilityTypeId}` });
      }

      // validate requested equipments against rules
      const ruleMap = new Map();
      for (const r of rules) {
        ruleMap.set(r.equipmentTypeId, r);
      }

      const reqEquipmentMap = new Map();
      for (const item of equipments || []) {
        reqEquipmentMap.set(item.equipmentTypeId, parseInt(item.quantity, 10) || 0);
      }

      // check mandatory minimums
      for (const r of rules) {
        const reqQty = reqEquipmentMap.get(r.equipmentTypeId) || 0;
        if (r.minQuantity > 0 && reqQty < r.minQuantity) {
          return res.status(422).json({
            error: `Mandatory minimum not met: ${r.equipmentName} requires at least ${r.minQuantity} unit(s), requested ${reqQty}.`
          });
        }
      }

      // check user score constraint: negative score allows only mandatory minimums
      if (userScore < 0) {
        for (const r of rules) {
          const reqQty = reqEquipmentMap.get(r.equipmentTypeId) || 0;
          if (r.minQuantity > 0 && reqQty > r.minQuantity) {
            return res.status(403).json({
              error: `Users with negative score (${userScore}) cannot request extra quantities of mandatory equipment (${r.equipmentName}: max ${r.minQuantity}).`
            });
          }
          if (r.minQuantity === 0 && reqQty > 0) {
            return res.status(403).json({
              error: `Users with negative score (${userScore}) cannot request optional equipment (${r.equipmentName}).`
            });
          }
        }
      }

      // check stock availability in sports center for this slot
      for (const r of rules) {
        const reqQty = reqEquipmentMap.get(r.equipmentTypeId) || 0;
        if (reqQty > r.availableQuantity) {
          return res.status(422).json({
            error: `Not enough stock: ${r.equipmentName} requested ${reqQty}, but only ${r.availableQuantity} unit(s) available on ${resolvedDate} at ${resolvedStartTime}.`
          });
        }
      }

      // select facility
      let selectedFacility = null;
      const isAuto =
        automaticFacilitySelection === 1 ||
        automaticFacilitySelection === true ||
        !facilityId ||
        facilityId === 'auto';

      if (isAuto) {
        selectedFacility = await daoFacilities.getFacilityAutomaticSelection(
          facilityTypeId,
          resolvedDate,
          resolvedStartTime
        );
        if (!selectedFacility) {
          return res.status(422).json({
            error: `No available facilities of type ${facilityTypeId} on ${resolvedDate} at ${resolvedStartTime}.`
          });
        }
      } else {
        selectedFacility = await daoFacilities.getFacilityManualSelection(
          facilityId,
          resolvedDate,
          resolvedStartTime
        );
        if (!selectedFacility) {
          return res.status(422).json({
            error: `Facility ${facilityId} is not available on ${resolvedDate} at ${resolvedStartTime} or does not exist.`
          });
        }
        if (selectedFacility.facilityTypeId !== facilityTypeId) {
          return res.status(422).json({ error: `Facility ${facilityId} is not of type ${facilityTypeId}.` });
        }
      }

      // Collision detection check
      const collision = await daoReservations.checkCourtCollision(
        selectedFacility.id,
        resolvedDate,
        resolvedStartTime
      );
      if (collision) {
        return res.status(409).json({
          error: `Collision detected: Facility ${selectedFacility.name} is already booked on ${resolvedDate} at ${resolvedStartTime}.`
        });
      }

      // prepare final equipment list to save
      const equipmentsToSave = [];
      for (const r of rules) {
        const qty = reqEquipmentMap.get(r.equipmentTypeId) || 0;
        if (qty > 0) {
          equipmentsToSave.push({ equipmentTypeId: r.equipmentTypeId, quantity: qty });
        }
      }

      // create reservation
      const result = await daoReservations.createReservation(
        req.user.id,
        selectedFacility.id,
        resolvedDate,
        resolvedStartTime,
        resolvedEndTime,
        equipmentsToSave
      );

      return res.status(201).json({
        message: 'Facility and equipment reserved successfully!',
        reservationId: result.id,
        facilityId: selectedFacility.id,
        facilityName: selectedFacility.name,
        bookingDate: resolvedDate,
        startTime: resolvedStartTime,
        endTime: resolvedEndTime
      });
    } catch (err) {
      console.error('Error creating reservation:', err);
      return res.status(500).json({ error: 'Internal server error while creating reservation' });
    }
  }
);

// PUT /api/reservations/:reservationId/equipment
// edit equipment for an active reservation
app.put(
  '/api/reservations/:reservationId/equipment',
  isLoggedIn,
  [
    check('reservationId').isInt({ min: 1 }).withMessage('Valid reservationId required'),
    check('equipments').isArray().withMessage('Equipments array is required'),
    check('equipments.*.equipmentTypeId').matches(/^[A-Z_]+$/)
          .withMessage('equipmentTypeId must contain only uppercase letters and underscores'),
    check('equipments.*.quantity').isInt({ min: 0 })
          .withMessage('quantity must be an integer greater than or equal to 0')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    const reservationId = parseInt(req.params.reservationId, 10);
    const { equipments } = req.body;

    try {
      // verify reservation ownership
      const reservation = await daoReservations.verifyReservationOwnership(reservationId);
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      if (reservation.user_id !== req.user.id) {
        return res.status(403).json({ error: 'You do not own this reservation' });
      }

      const facilityTypeId = reservation.facility_type_id;

      // fetch fresh user score
      const userScoreObj = await daoUsers.getUserScore(req.user.id);
      const userScore = userScoreObj.score;

      // fetch rules and stock for that specific reservation's slot
      const rules = await daoFacilities.getFacilityEquipmentRules(
        facilityTypeId,
        reservation.bookingDate,
        reservation.startTime,
        reservationId
      );
      const currentReservedEquipments = await daoReservations.getReservedEquipmentsbyReservation(reservationId);
      const currentQtyMap = new Map();
      for (const eq of currentReservedEquipments) {
        currentQtyMap.set(eq.equipmentTypeId, eq.quantity);
      }

      const reqQtyMap = new Map();
      for (const item of equipments) {
        reqQtyMap.set(item.equipmentTypeId, parseInt(item.quantity, 10) || 0);
      }

      // check mandatory minimums
      for (const r of rules) {
        const reqQty = reqQtyMap.has(r.equipmentTypeId)
          ? reqQtyMap.get(r.equipmentTypeId)
          : currentQtyMap.get(r.equipmentTypeId) || 0;

        if (r.minQuantity > 0 && reqQty < r.minQuantity) {
          return res.status(422).json({
            error: `Cannot reduce ${r.equipmentName} below mandatory minimum of ${r.minQuantity}.`
          });
        }
      }

      // check negative score constraint
      // users with negative score may still edit reservations
      // only to remove equipment, not to add them
      if (userScore < 0) {
        for (const r of rules) {
          const oldQty = currentQtyMap.get(r.equipmentTypeId) || 0;
          const reqQty = reqQtyMap.has(r.equipmentTypeId)
            ? reqQtyMap.get(r.equipmentTypeId)
            : oldQty;

          if (reqQty > oldQty) {
            return res.status(403).json({
              error: `Users with negative score (${userScore}) cannot add equipment (${r.equipmentName}). You may only remove or decrease equipment.`
            });
          }
        }
      }

      // check inventory availability
      for (const r of rules) {
        const oldQty = currentQtyMap.get(r.equipmentTypeId) || 0;
        const newQty = reqQtyMap.has(r.equipmentTypeId) ? reqQtyMap.get(r.equipmentTypeId) : oldQty;
        const delta = newQty - oldQty;

        if (delta > 0 && delta > r.availableQuantity) {
          return res.status(422).json({
            error: `Not enough stock: need +${delta} more ${r.equipmentName}, but only ${r.availableQuantity} available.`
          });
        }
      }

      // build updated equipment list
      const updatedEquipments = [];
      for (const r of rules) {
        const qty = reqQtyMap.has(r.equipmentTypeId)
          ? reqQtyMap.get(r.equipmentTypeId)
          : currentQtyMap.get(r.equipmentTypeId) || 0;
        if (qty > 0) {
          updatedEquipments.push({ equipmentTypeId: r.equipmentTypeId, quantity: qty });
        }
      }

      // update equipments in database
      await daoReservations.updateReservationEquipments(reservationId, updatedEquipments);

      return res.status(200).json({ message: 'Reservation equipment modified successfully!' });
    } catch (err) {
      console.error('Error modifying reservation equipment:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/reservations/:reservationId
// delete reservation, decrement score
// start 30 seconds cooldown window
app.delete(
  '/api/reservations/:reservationId',
  isLoggedIn,
  [ check('reservationId').isInt({ min: 1 }).withMessage('Valid reservationId required') ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    const reservationId = parseInt(req.params.reservationId, 10);

    try {
      // verify ownership
      const reservation = await daoReservations.verifyReservationOwnership(reservationId);
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      if (reservation.user_id !== req.user.id) {
        return res.status(403).json({ error: 'You do not own this reservation' });
      }

      const facilityTypeId = reservation.facility_type_id;
     
      await daoReservations.deleteReservationAndRelatedEquipments(reservationId);

      await daoUsers.decreaseUserScore(req.user.id);

      await daoReservations.recordCooldownTimestamp(req.user.id, facilityTypeId);

      const freshScore = await daoUsers.getUserScore(req.user.id);

      return res.status(200).json({
        message: 'Reservation cancelled successfully. Your score has been reduced by 1.',
        newScore: freshScore.score,
        cooldownFacilityTypeId: facilityTypeId
      });
    } catch (err) {
      console.error('Error deleting reservation:', err);
      return res.status(500).json({ error: 'Internal server error while deleting reservation' });
    }
  }
);

// ==========================================
// ADMIN & FACILITY MANAGER API ROUTES
// ==========================================

// GET /api/admin/analytics
// Get overall operational KPIs, sport popularity, peak utilization, and cancellation trends
app.get('/api/admin/analytics', isAdminOrStaff, async (req, res) => {
  try {
    const analytics = await daoReservations.getAdminAnalytics();
    return res.status(200).json(analytics);
  } catch (err) {
    console.error('Error fetching admin analytics:', err);
    return res.status(500).json({ error: 'Internal server error while fetching analytics' });
  }
});

// GET /api/admin/facilities
// Get all facilities with maintenance status and booking stats
app.get('/api/admin/facilities', isAdminOrStaff, async (req, res) => {
  try {
    const facilities = await daoFacilities.getAllAdminFacilities();
    return res.status(200).json(facilities);
  } catch (err) {
    console.error('Error fetching admin facilities:', err);
    return res.status(500).json({ error: 'Internal server error while fetching facilities' });
  }
});

// PATCH /api/admin/facilities/:id/maintenance
// Toggle maintenance mode for an individual court/field with custom reason banner
app.patch(
  '/api/admin/facilities/:id/maintenance',
  isAdminOrStaff,
  [
    check('isMaintenance').isBoolean().withMessage('isMaintenance must be a boolean')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    try {
      const facilityId = req.params.id;
      const { isMaintenance, maintenanceReason } = req.body;
      const result = await daoFacilities.toggleFacilityMaintenance(
        facilityId,
        isMaintenance,
        maintenanceReason
      );
      return res.status(200).json({
        message: `Facility ${facilityId} maintenance mode successfully ${isMaintenance ? 'enabled' : 'disabled'}.`,
        ...result
      });
    } catch (err) {
      console.error('Error updating facility maintenance mode:', err);
      return res.status(500).json({ error: 'Failed to update maintenance mode' });
    }
  }
);

// GET /api/admin/equipment
// Get equipment stock inventory and active rental allocations
app.get('/api/admin/equipment', isAdminOrStaff, async (req, res) => {
  try {
    const equipment = await daoFacilities.getAllAdminEquipment();
    return res.status(200).json(equipment);
  } catch (err) {
    console.error('Error fetching admin equipment:', err);
    return res.status(500).json({ error: 'Internal server error while fetching equipment inventory' });
  }
});

// PATCH /api/admin/equipment/:id
// Adjust total inventory quantity with validation against active bookings
app.patch(
  '/api/admin/equipment/:id',
  isAdminOrStaff,
  [
    check('totalQuantity').isInt({ min: 1 }).withMessage('totalQuantity must be an integer of at least 1')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    try {
      const equipmentTypeId = req.params.id;
      const totalQuantity = parseInt(req.body.totalQuantity, 10);
      const result = await daoFacilities.updateEquipmentQuantity(equipmentTypeId, totalQuantity);
      return res.status(200).json({
        message: `Equipment ${equipmentTypeId} total inventory adjusted to ${totalQuantity}.`,
        ...result
      });
    } catch (err) {
      console.error('Error updating equipment inventory:', err);
      return res.status(422).json({ error: err.message || 'Failed to update equipment inventory' });
    }
  }
);

// GET /api/admin/users
// Get user management list with scores, roles, and reservations
app.get('/api/admin/users', isAdminOrStaff, async (req, res) => {
  try {
    const users = await daoUsers.getAllUsers();
    return res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: 'Internal server error while fetching users' });
  }
});

// PATCH /api/admin/users/:id/role
// Update user role (admin-only)
app.patch(
  '/api/admin/users/:id/role',
  isAdmin,
  [
    check('role').isIn(['user', 'admin', 'staff']).withMessage('Role must be user, admin, or staff')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    try {
      const userId = parseInt(req.params.id, 10);
      const { role } = req.body;
      const result = await daoUsers.updateUserRole(userId, role);
      return res.status(200).json({
        message: `User #${userId} role successfully updated to ${role}.`,
        ...result
      });
    } catch (err) {
      console.error('Error updating user role:', err);
      return res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);


const PORT = 3001;
app.listen(PORT, (err) => {
  if (err) {
    console.error('Error starting server:', err);
  } else {
    console.log(`Sports Center API Server listening at http://localhost:${PORT}`);
  }
});