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


const errorFormatter = ({ msg, path, location }) => `${location}[${path}]: ${msg}`;


async function formatClientUserInfo(req) {
  const user = req.user;
  const freshUser = await daoUsers.getUserById(user.id);
  const score = freshUser ? freshUser.score : 0;
  return {
    id: user.id,
    username: user.username,
    name: user.username.charAt(0).toUpperCase() + user.username.slice(1),
    score: score,
    canDoTotp: true,
    isTotp: req.session.method === 'totp'
  };
}

// GET /api/public/availability
app.get('/api/public/availability', async (req, res) => {
  try {
    const data = await daoFacilities.getPublicAvailability();
    res.status(200).json(data);
  } catch (err) {
    console.error('Error in /api/public/availability:', err);
    res.status(500).json({ error: 'Internal server error while fetching availability' });
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
    const facilities = await daoFacilities.getAllFacilities();
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
      const rules = await daoFacilities.getFacilityEquipmentRules(req.params.typeId);
      res.status(200).json(rules);
    } catch (err) {
      console.error('Error fetching facility rules:', err);
      res.status(500).json({ error: 'Database error' });
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

    const { facilityTypeId, facilityId, automaticFacilitySelection, equipments } = req.body;

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

      // check equipment rules for facility type
      const rules = await daoFacilities.getFacilityEquipmentRules(facilityTypeId);
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

      // check stock availability in sports center
      for (const r of rules) {
        const reqQty = reqEquipmentMap.get(r.equipmentTypeId) || 0;
        if (reqQty > r.availableQuantity) {
          return res.status(422).json({
            error: `Not enough stock: ${r.equipmentName} requested ${reqQty}, but only ${r.availableQuantity} unit(s) available.`
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
        selectedFacility = await daoFacilities.getFacilityAutomaticSelection(facilityTypeId);
        if (!selectedFacility) {
          return res.status(422).json({ error: `No available facilities of type ${facilityTypeId} at this time.` });
        }
      } else {
        selectedFacility = await daoFacilities.getFacilityManualSelection(facilityId);
        if (!selectedFacility) {
          return res.status(422).json({ error: `Facility ${facilityId} is not available or does not exist.` });
        }
        if (selectedFacility.facilityTypeId !== facilityTypeId) {
          return res.status(422).json({ error: `Facility ${facilityId} is not of type ${facilityTypeId}.` });
        }
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
      const result = await daoReservations.createReservation(req.user.id, selectedFacility.id, equipmentsToSave);

      return res.status(201).json({
        message: 'Facility and equipment reserved successfully!',
        reservationId: result.id,
        facilityId: selectedFacility.id,
        facilityName: selectedFacility.name
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

      // fetch rules and current reservation equipment
      const rules = await daoFacilities.getFacilityEquipmentRules(facilityTypeId);
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


const PORT = 3001;
app.listen(PORT, (err) => {
  if (err) {
    console.error('Error starting server:', err);
  } else {
    console.log(`Sports Center API Server listening at http://localhost:${PORT}`);
  }
});