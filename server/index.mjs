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
import daoWallet from './dao-wallet.mjs';

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
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.role === 'admin' || req.user.role === 'staff') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Admin or Staff privileges required' });
};

const isAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.role === 'admin') {
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
  const walletBalance = freshUser && freshUser.walletBalance !== undefined ? freshUser.walletBalance : 500;
  const bookingStreak = freshUser && freshUser.bookingStreak !== undefined ? freshUser.bookingStreak : 0;
  return {
    id: user.id,
    username: user.username,
    name: user.username.charAt(0).toUpperCase() + user.username.slice(1),
    score: score,
    role: role,
    walletBalance: walletBalance,
    bookingStreak: bookingStreak,
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

// ==========================================
// VIRTUAL WALLET & GAMIFICATION API ROUTES
// ==========================================

// GET /api/wallet
// Get user's wallet balance, booking streak, badges, and recent transactions
app.get('/api/wallet', isLoggedIn, async (req, res) => {
  try {
    const wallet = await daoWallet.getUserWallet(req.user.id);
    if (!wallet) {
      return res.status(404).json({ error: 'User wallet not found' });
    }
    const reservations = await daoReservations.getUserReservations(req.user.id);
    const badges = daoWallet.getGamificationBadges(
      wallet.walletBalance,
      wallet.bookingStreak,
      wallet.score,
      reservations.length
    );
    const transactions = await daoWallet.getWalletTransactions(req.user.id, 20);

    return res.status(200).json({
      walletBalance: wallet.walletBalance,
      bookingStreak: wallet.bookingStreak,
      score: wallet.score,
      totalReservations: reservations.length,
      badges,
      transactions
    });
  } catch (err) {
    console.error('Error fetching wallet:', err);
    return res.status(500).json({ error: 'Internal server error while fetching wallet' });
  }
});

// POST /api/wallet/recharge
// Add mock credits to user wallet
app.post(
  '/api/wallet/recharge',
  isLoggedIn,
  [
    check('amount')
      .isInt({ min: 1, max: 2000 })
      .withMessage('Recharge amount must be an integer between 1 and 2000')
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array().join(', ') });
    }

    try {
      const amount = parseInt(req.body.amount, 10);
      const result = await daoWallet.rechargeWallet(req.user.id, amount);
      return res.status(200).json({
        message: `Successfully recharged ${amount} mock credits!`,
        amountAdded: amount,
        newBalance: result.newBalance
      });
    } catch (err) {
      console.error('Error recharging wallet:', err);
      return res.status(500).json({ error: 'Internal server error while recharging wallet' });
    }
  }
);

// GET /api/wallet/transactions
// Get transaction history
app.get('/api/wallet/transactions', isLoggedIn, async (req, res) => {
  try {
    const transactions = await daoWallet.getWalletTransactions(req.user.id, 100);
    return res.status(200).json(transactions);
  } catch (err) {
    console.error('Error fetching wallet transactions:', err);
    return res.status(500).json({ error: 'Internal server error while fetching transactions' });
  }
});

// POST /api/wallet/calculate-cost
// Calculate booking price breakdown before reservation
app.post('/api/wallet/calculate-cost', isLoggedIn, async (req, res) => {
  try {
    const { facilityTypeId, equipments } = req.body;
    if (!facilityTypeId) {
      return res.status(422).json({ error: 'facilityTypeId is required' });
    }
    const costDetails = await daoWallet.calculateBookingCost(facilityTypeId, equipments || []);
    return res.status(200).json(costDetails);
  } catch (err) {
    console.error('Error calculating cost:', err);
    return res.status(500).json({ error: 'Internal server error while calculating cost' });
  }
});

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
        selectedFacility = await daoFacilities.getFacilityManualSelection(facilityId);
        if (!selectedFacility) {
          return res.status(422).json({
            error: `Facility ${facilityId} does not exist.`
          });
        }
        if (selectedFacility.facilityTypeId !== facilityTypeId) {
          return res.status(422).json({ error: `Facility ${facilityId} is not of type ${facilityTypeId}.` });
        }
        if (selectedFacility.isMaintenance === 1) {
          return res.status(422).json({
            error: `Facility ${selectedFacility.name} is currently under maintenance (${selectedFacility.maintenanceReason || 'Scheduled maintenance'}).`
          });
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

      // calculate pricing and check wallet balance
      const pricing = await daoWallet.calculateBookingCost(facilityTypeId, equipmentsToSave);
      const totalCost = pricing.totalCost;

      const userWallet = await daoWallet.getUserWallet(req.user.id);
      if (userWallet && userWallet.walletBalance < totalCost) {
        return res.status(402).json({
          error: `Insufficient wallet balance: This booking requires ${totalCost} credits, but you only have ${userWallet.walletBalance} credits. Please recharge your wallet.`
        });
      }

      // deduct credits
      await daoWallet.deductCredits(
        req.user.id,
        totalCost,
        `Booking: ${selectedFacility.name} (${resolvedDate} ${resolvedStartTime})`
      );

      // create reservation
      const result = await daoReservations.createReservation(
        req.user.id,
        selectedFacility.id,
        resolvedDate,
        resolvedStartTime,
        resolvedEndTime,
        equipmentsToSave,
        totalCost
      );

      // increment streak & reward milestone bonus if applicable
      const streakResult = await daoWallet.incrementBookingStreak(req.user.id);

      let successMsg = 'Facility and equipment reserved successfully!';
      if (streakResult.bonusAwarded > 0) {
        successMsg += ` 🎉 Streak bonus earned: +${streakResult.bonusAwarded} credits for reaching a ${streakResult.streak}-booking streak!`;
      }

      return res.status(201).json({
        message: successMsg,
        reservationId: result.id,
        facilityId: selectedFacility.id,
        facilityName: selectedFacility.name,
        bookingDate: resolvedDate,
        startTime: resolvedStartTime,
        endTime: resolvedEndTime,
        totalCost,
        newWalletBalance: streakResult.newBalance,
        bookingStreak: streakResult.streak,
        streakBonusAwarded: streakResult.bonusAwarded
      });
    } catch (err) {
      console.error('Error creating reservation:', err);
      return res.status(500).json({ error: 'Internal server error while creating reservation' });
    }
  }
);

// PUT /api/reservations/:reservationId
// PUT /api/reservations/:reservationId/equipment
// Edit reservation details (date, time slot, facility, and/or equipment)
const updateReservationHandler = async (req, res) => {
  const errors = validationResult(req).formatWith(errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: errors.array().join(', ') });
  }

  const reservationId = parseInt(req.params.reservationId, 10);
  const {
    bookingDate,
    startTime,
    endTime,
    facilityId,
    automaticFacilitySelection,
    equipments
  } = req.body;

  try {
    // 1. Verify reservation ownership
    const reservation = await daoReservations.verifyReservationOwnership(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    if (reservation.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this reservation' });
    }

    const facilityTypeId = reservation.facility_type_id;

    // 2. Resolve target date and time slot
    const targetDate = bookingDate || reservation.bookingDate;
    const targetStartTime = startTime || reservation.startTime;
    const calcEndTime = (sTime) => {
      const [h, m] = sTime.split(':').map(Number);
      const endH = String(h + 1).padStart(2, '0');
      return `${endH}:${String(m).padStart(2, '0')}`;
    };
    const targetEndTime = endTime || calcEndTime(targetStartTime);

    // Validate that target date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (targetDate < today) {
      return res.status(422).json({ error: 'Cannot reschedule a reservation to a past date.' });
    }

    // 3. Resolve target facility
    let selectedFacility = null;
    const isAuto =
      automaticFacilitySelection === 1 ||
      automaticFacilitySelection === true ||
      facilityId === 'auto';

    if (isAuto) {
      selectedFacility = await daoFacilities.getFacilityAutomaticSelection(
        facilityTypeId,
        targetDate,
        targetStartTime
      );
      if (!selectedFacility) {
        return res.status(422).json({
          error: `No available facilities of type ${facilityTypeId} on ${targetDate} at ${targetStartTime}.`
        });
      }
    } else {
      const targetFacilityId = facilityId || reservation.facility_id;
      selectedFacility = await daoFacilities.getFacilityManualSelection(targetFacilityId);
      if (!selectedFacility) {
        return res.status(422).json({ error: `Facility ${targetFacilityId} does not exist.` });
      }
      if (selectedFacility.facilityTypeId !== facilityTypeId) {
        return res.status(422).json({ error: `Facility ${targetFacilityId} is not of type ${facilityTypeId}.` });
      }
      if (selectedFacility.isMaintenance === 1) {
        return res.status(422).json({
          error: `Facility ${selectedFacility.name} is currently under maintenance (${selectedFacility.maintenanceReason || 'Scheduled maintenance'}).`
        });
      }
    }

    // Collision check: exclude current reservation so it doesn't collide with itself if same court and slot
    const collision = await daoReservations.checkCourtCollision(
      selectedFacility.id,
      targetDate,
      targetStartTime,
      reservationId
    );
    if (collision) {
      return res.status(409).json({
        error: `Collision detected: Facility ${selectedFacility.name} is already booked on ${targetDate} at ${targetStartTime}.`
      });
    }

    // 4. Fetch fresh user score
    const userScoreObj = await daoUsers.getUserScore(req.user.id);
    const userScore = userScoreObj.score;

    // 5. Fetch rules and equipment stock for target date and time slot (excluding current reservation)
    const rules = await daoFacilities.getFacilityEquipmentRules(
      facilityTypeId,
      targetDate,
      targetStartTime,
      reservationId
    );
    const currentReservedEquipments = await daoReservations.getReservedEquipmentsbyReservation(reservationId);
    const currentQtyMap = new Map();
    for (const eq of currentReservedEquipments) {
      currentQtyMap.set(eq.equipmentTypeId, eq.quantity);
    }

    const reqQtyMap = new Map();
    if (Array.isArray(equipments)) {
      for (const item of equipments) {
        reqQtyMap.set(item.equipmentTypeId, parseInt(item.quantity, 10) || 0);
      }
    }

    // Check mandatory minimums
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

    // Check negative score constraint
    if (userScore < 0) {
      for (const r of rules) {
        const oldQty = currentQtyMap.get(r.equipmentTypeId) || 0;
        const reqQty = reqQtyMap.has(r.equipmentTypeId)
          ? reqQtyMap.get(r.equipmentTypeId)
          : oldQty;

        if (r.minQuantity === 0 && reqQty > 0) {
          return res.status(403).json({
            error: `Users with negative score (${userScore}) cannot request optional equipment (${r.equipmentName}).`
          });
        }
        if (reqQty > oldQty && reqQty > r.minQuantity) {
          return res.status(403).json({
            error: `Users with negative score (${userScore}) cannot add equipment (${r.equipmentName}). You may only remove or decrease equipment.`
          });
        }
      }
    }

    // Check inventory availability in target slot
    for (const r of rules) {
      const reqQty = reqQtyMap.has(r.equipmentTypeId)
        ? reqQtyMap.get(r.equipmentTypeId)
        : (currentQtyMap.get(r.equipmentTypeId) || 0);

      if (reqQty > r.availableQuantity) {
        return res.status(422).json({
          error: `Not enough stock: need ${reqQty} ${r.equipmentName}, but only ${r.availableQuantity} available on ${targetDate} at ${targetStartTime}.`
        });
      }
    }

    // Build updated equipment list
    const updatedEquipments = [];
    for (const r of rules) {
      const qty = reqQtyMap.has(r.equipmentTypeId)
        ? reqQtyMap.get(r.equipmentTypeId)
        : currentQtyMap.get(r.equipmentTypeId) || 0;
      if (qty > 0) {
        updatedEquipments.push({ equipmentTypeId: r.equipmentTypeId, quantity: qty });
      }
    }

    // Calculate new total cost and handle credit difference
    const pricing = await daoWallet.calculateBookingCost(facilityTypeId, updatedEquipments);
    const newTotalCost = pricing.totalCost;
    const oldTotalCost = reservation.totalCost || 0;
    const delta = newTotalCost - oldTotalCost;

    if (delta > 0) {
      const userWallet = await daoWallet.getUserWallet(req.user.id);
      if (userWallet && userWallet.walletBalance < delta) {
        return res.status(402).json({
          error: `Insufficient wallet balance for update: Additional cost is ${delta} credits, but you only have ${userWallet.walletBalance} credits. Please recharge your wallet.`
        });
      }
      await daoWallet.deductCredits(
        req.user.id,
        delta,
        `Modification upgrade for booking #${reservationId}: ${selectedFacility.name}`,
        'booking_adjustment'
      );
    } else if (delta < 0) {
      await daoWallet.refundCredits(
        req.user.id,
        Math.abs(delta),
        `Modification refund for booking #${reservationId}: ${selectedFacility.name}`,
        'booking_adjustment'
      );
    }

    // Update reservation in database
    await daoReservations.updateReservation(
      reservationId,
      selectedFacility.id,
      targetDate,
      targetStartTime,
      targetEndTime,
      updatedEquipments,
      newTotalCost
    );

    const freshWallet = await daoWallet.getUserWallet(req.user.id);

    return res.status(200).json({
      message: 'Reservation updated successfully!',
      reservationId,
      facilityId: selectedFacility.id,
      facilityName: selectedFacility.name,
      bookingDate: targetDate,
      startTime: targetStartTime,
      endTime: targetEndTime,
      equipments: updatedEquipments,
      totalCost: newTotalCost,
      costDelta: delta,
      newWalletBalance: freshWallet ? freshWallet.walletBalance : undefined
    });
  } catch (err) {
    console.error('Error modifying reservation:', err);
    return res.status(500).json({ error: 'Internal server error while modifying reservation' });
  }
};

const reservationUpdateValidators = [
  check('reservationId').isInt({ min: 1 }).withMessage('Valid reservationId required'),
  check('bookingDate').optional().isDate().withMessage('bookingDate must be YYYY-MM-DD format'),
  check('startTime').optional().matches(/^(0[8-9]|1[0-9]|2[0-1]):00$/).withMessage('startTime must be on the hour between 08:00 and 21:00'),
  check('endTime').optional().matches(/^(0[9]|1[0-9]|2[0-2]):00$/).withMessage('endTime must be on the hour between 09:00 and 22:00'),
  check('equipments').optional().isArray().withMessage('Equipments must be an array'),
  check('equipments.*.equipmentTypeId').optional().matches(/^[A-Z_]+$/)
        .withMessage('equipmentTypeId must contain only uppercase letters and underscores'),
  check('equipments.*.quantity').optional().isInt({ min: 0 })
        .withMessage('quantity must be an integer greater than or equal to 0')
];

app.put('/api/reservations/:reservationId', isLoggedIn, reservationUpdateValidators, updateReservationHandler);
app.put('/api/reservations/:reservationId/equipment', isLoggedIn, reservationUpdateValidators, updateReservationHandler);

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
      const refundAmount = reservation.totalCost || 0;
     
      await daoReservations.deleteReservationAndRelatedEquipments(reservationId);

      // Refund credits to user wallet
      if (refundAmount > 0) {
        await daoWallet.refundCredits(
          req.user.id,
          refundAmount,
          `Refund for cancelled booking #${reservationId}: ${reservation.facilityName} (${reservation.bookingDate} ${reservation.startTime})`
        );
      }

      // Reset consecutive booking streak to 0
      await daoWallet.resetBookingStreak(req.user.id);

      await daoUsers.decreaseUserScore(req.user.id);

      await daoReservations.recordCooldownTimestamp(req.user.id, facilityTypeId);

      const freshScore = await daoUsers.getUserScore(req.user.id);
      const freshWallet = await daoWallet.getUserWallet(req.user.id);

      return res.status(200).json({
        message: `Reservation cancelled successfully. Refunded ${refundAmount} credits to your wallet. Your score was reduced by 1 and streak was reset to 0.`,
        newScore: freshScore.score,
        refundAmount,
        newWalletBalance: freshWallet ? freshWallet.walletBalance : undefined,
        bookingStreak: 0,
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