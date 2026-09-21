PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS reservation_equipment;
DROP TABLE IF EXISTS facility_release_logs;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS facility_equipment_rules;
DROP TABLE IF EXISTS equipment_types;
DROP TABLE IF EXISTS facilities;
DROP TABLE IF EXISTS facility_types;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    totp_secret TEXT NOT NULL DEFAULT 'LXBSMDTMSP2I5XFXIYRGFVWSFI',
    lastTotpStep INTEGER,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'staff')),
    wallet_balance INTEGER NOT NULL DEFAULT 500 CHECK (wallet_balance >= 0),
    booking_streak INTEGER NOT NULL DEFAULT 0 CHECK (booking_streak >= 0),
    CONSTRAINT check_score CHECK (score <= 0)
);

-- Passwords for all users are 'password'
INSERT INTO users (id, username, password_hash, salt, score, totp_secret, lastTotpStep, role, wallet_balance, booking_streak)
VALUES(1,'alice','18198222bfacc3c30780557a12fbb59967e54ebcd4e5d8cc65eec48279d6d0ea','2a264bf0a9c7a52e88bd943fd03464f4',0,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0,'admin',500,0);
INSERT INTO users (id, username, password_hash, salt, score, totp_secret, lastTotpStep, role, wallet_balance, booking_streak)
VALUES(2,'bob','e50c1e8346cf266bfe9d40be12bc25c7eef64c611929a12d70c8152cd92e03e6','salt_bob_192837',-2,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0,'user',486,1);
INSERT INTO users (id, username, password_hash, salt, score, totp_secret, lastTotpStep, role, wallet_balance, booking_streak)
VALUES(3,'carol','97b2c21b479773bdb8ac8b2b35e275f15b59ebea12cd00c34bb2331dd566b998','salt_charlie_583920',-1,'LXBSMDTMSP2I5XFXIYRGFVWSFI',59569451,'user',475,1);
INSERT INTO users (id, username, password_hash, salt, score, totp_secret, lastTotpStep, role, wallet_balance, booking_streak)
VALUES(4,'dave','f55aadff759bd12386d1484e393aa214ab0a2341e27002a34febe3a890a7f1c9','salt_diana_847291',0,'LXBSMDTMSP2I5XFXIYRGFVWSFI',59565691,'user',473,2);
INSERT INTO users (id, username, password_hash, salt, score, totp_secret, lastTotpStep, role, wallet_balance, booking_streak)
VALUES(5,'admin','99f4789e2ed346d685823f63d6cb10792fbfb4c8952d8ae6f8949eb0ac7f9212','b36303600f3336ff3fb7075084b0763a',0,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0,'admin',500,0);
INSERT INTO users (id, username, password_hash, salt, score, totp_secret, lastTotpStep, role, wallet_balance, booking_streak)
VALUES(6,'staff','682586fde87a88967a2766eb3aee62a5bea52c6dbb79033ad5789a8295e348d1','cc663d71bc86adba21de5f42a65549ac',0,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0,'staff',500,0);

CREATE TABLE facility_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_price INTEGER NOT NULL DEFAULT 10 CHECK (base_price >= 0)
);

INSERT INTO facility_types VALUES('TENNIS','Tennis Court', 15);
INSERT INTO facility_types VALUES('BASKETBALL','Basketball Court', 12);
INSERT INTO facility_types VALUES('VOLLEYBALL','Volleyball Court', 12);
INSERT INTO facility_types VALUES('SOCCER','Soccer Field', 20);
INSERT INTO facility_types VALUES('TABLE_TENNIS','Table Tennis Table', 8);
INSERT INTO facility_types VALUES('CYCLING','Cycling Track', 10);

CREATE TABLE facilities (
    id TEXT PRIMARY KEY,
    facility_type_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_maintenance INTEGER NOT NULL DEFAULT 0 CHECK (is_maintenance IN (0, 1)),
    maintenance_reason TEXT DEFAULT NULL,
    FOREIGN KEY (facility_type_id) REFERENCES facility_types (id) ON DELETE CASCADE
);

INSERT INTO facilities VALUES('T1','TENNIS','Tennis Court #1', 0, NULL);
INSERT INTO facilities VALUES('T2','TENNIS','Tennis Court #2', 1, 'Clay court resurfacing & line repainting');
INSERT INTO facilities VALUES('T3','TENNIS','Tennis Court #3', 0, NULL);
INSERT INTO facilities VALUES('B1','BASKETBALL','Basketball Court #1', 0, NULL);
INSERT INTO facilities VALUES('B2','BASKETBALL','Basketball Court #2', 0, NULL);
INSERT INTO facilities VALUES('V1','VOLLEYBALL','Volleyball Court #1', 0, NULL);
INSERT INTO facilities VALUES('V2','VOLLEYBALL','Volleyball Court #2', 0, NULL);
INSERT INTO facilities VALUES('S1','SOCCER','Soccer Field #1', 0, NULL);
INSERT INTO facilities VALUES('TT1','TABLE_TENNIS','Table Tennis Table #1', 0, NULL);
INSERT INTO facilities VALUES('TT2','TABLE_TENNIS','Table Tennis Table #2', 0, NULL);
INSERT INTO facilities VALUES('TT3','TABLE_TENNIS','Table Tennis Table #3', 0, NULL);
INSERT INTO facilities VALUES('TT4','TABLE_TENNIS','Table Tennis Table #4', 0, NULL);
INSERT INTO facilities VALUES('C1','CYCLING','Cycling Track #1', 0, NULL);
INSERT INTO facilities VALUES('C2','CYCLING','Cycling Track #2', 0, NULL);

CREATE TABLE equipment_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
    unit_price INTEGER NOT NULL DEFAULT 2 CHECK (unit_price >= 0)
);

INSERT INTO equipment_types VALUES('TENNIS_RACKET','Tennis Racket',8, 3);
INSERT INTO equipment_types VALUES('TENNIS_BALL','Tennis Ball',7, 1);
INSERT INTO equipment_types VALUES('TOWEL','Towel',4, 1);
INSERT INTO equipment_types VALUES('BASKETBALL','Basketball',2, 2);
INSERT INTO equipment_types VALUES('CONE','Cone',4, 1);
INSERT INTO equipment_types VALUES('VOLLEYBALL','Volleyball',2, 2);
INSERT INTO equipment_types VALUES('KNEE_PADS','Pair of Knee Pads',10, 1);
INSERT INTO equipment_types VALUES('SOCCER_BALL','Soccer Ball',2, 2);
INSERT INTO equipment_types VALUES('SOCCER_SHOES','Pair of Soccer Shoes',12, 4);
INSERT INTO equipment_types VALUES('GK_GLOVES','Pair of Goalkeeper Gloves',2, 2);
INSERT INTO equipment_types VALUES('TT_RACKET','Table Tennis Racket',8, 2);
INSERT INTO equipment_types VALUES('TT_BALL','Table Tennis Ball',4, 1);
INSERT INTO equipment_types VALUES('BICYCLE','Bicycle',4, 5);
INSERT INTO equipment_types VALUES('HELMET','Helmet',4, 2);
INSERT INTO equipment_types VALUES('REPAIR_KIT','Repair Kit',1, 1);

CREATE TABLE facility_equipment_rules (
    facility_type_id TEXT NOT NULL,
    equipment_type_id TEXT NOT NULL,
    min_quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (facility_type_id, equipment_type_id),
    FOREIGN KEY (facility_type_id) REFERENCES facility_types (id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_type_id) REFERENCES equipment_types (id) ON DELETE CASCADE
);

INSERT INTO facility_equipment_rules VALUES('TENNIS','TENNIS_RACKET',2);
INSERT INTO facility_equipment_rules VALUES('TENNIS','TENNIS_BALL',3);
INSERT INTO facility_equipment_rules VALUES('TENNIS','TOWEL',0);
INSERT INTO facility_equipment_rules VALUES('BASKETBALL','BASKETBALL',1);
INSERT INTO facility_equipment_rules VALUES('BASKETBALL','CONE',0);
INSERT INTO facility_equipment_rules VALUES('VOLLEYBALL','VOLLEYBALL',1);
INSERT INTO facility_equipment_rules VALUES('VOLLEYBALL','KNEE_PADS',0);
INSERT INTO facility_equipment_rules VALUES('SOCCER','SOCCER_BALL',1);
INSERT INTO facility_equipment_rules VALUES('SOCCER','SOCCER_SHOES',10);
INSERT INTO facility_equipment_rules VALUES('SOCCER','GK_GLOVES',0);
INSERT INTO facility_equipment_rules VALUES('TABLE_TENNIS','TT_RACKET',2);
INSERT INTO facility_equipment_rules VALUES('TABLE_TENNIS','TT_BALL',1);
INSERT INTO facility_equipment_rules VALUES('CYCLING','BICYCLE',1);
INSERT INTO facility_equipment_rules VALUES('CYCLING','HELMET',1);
INSERT INTO facility_equipment_rules VALUES('CYCLING','REPAIR_KIT',0);

CREATE TABLE reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    facility_id TEXT NOT NULL,
    booking_date TEXT NOT NULL DEFAULT (date('now')),
    start_time TEXT NOT NULL DEFAULT '10:00',
    end_time TEXT NOT NULL DEFAULT '11:00',
    total_cost INTEGER NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (facility_id) REFERENCES facilities (id) ON DELETE RESTRICT,
    UNIQUE (facility_id, booking_date, start_time)
);

-- User 2 (bob): 1 reservation (B1: 12 + 1 Basketball * 2 = 14) at 10:00-11:00
INSERT INTO reservations (id, user_id, facility_id, booking_date, start_time, end_time, total_cost) 
VALUES(1, 2, 'B1', date('now'), '10:00', '11:00', 14);
-- User 3 (carol): 1 reservation (T3: 15 + 2*3 + 3*1 + 1*1 = 25) at 14:00-15:00
INSERT INTO reservations (id, user_id, facility_id, booking_date, start_time, end_time, total_cost) 
VALUES(2, 3, 'T3', date('now'), '14:00', '15:00', 25);
-- User 4 (dave): 2 reservations (V1: 12 + 1*2 = 14; TT1: 8 + 2*2 + 1*1 = 13)
INSERT INTO reservations (id, user_id, facility_id, booking_date, start_time, end_time, total_cost) 
VALUES(3, 4, 'V1', date('now'), '16:00', '17:00', 14);
INSERT INTO reservations (id, user_id, facility_id, booking_date, start_time, end_time, total_cost) 
VALUES(4, 4, 'TT1', date('now'), '18:00', '19:00', 13);

CREATE TABLE facility_release_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    facility_type_id TEXT NOT NULL,
    released_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (facility_type_id) REFERENCES facility_types (id) ON DELETE CASCADE
);

-- Seed release logs for cancellation analytics
INSERT INTO facility_release_logs (id, user_id, facility_type_id, released_at) VALUES(1, 2, 'BASKETBALL', datetime('now', '-2 hours'));
INSERT INTO facility_release_logs (id, user_id, facility_type_id, released_at) VALUES(2, 3, 'TENNIS', datetime('now', '-4 hours'));

CREATE TABLE IF NOT EXISTS "reservation_equipment" (
    reservation_id INTEGER NOT NULL,
    equipment_type_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    PRIMARY KEY (reservation_id, equipment_type_id),
    FOREIGN KEY (reservation_id) REFERENCES reservations (id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_type_id) REFERENCES equipment_types (id) ON DELETE RESTRICT
);

-- Equipments for reservation 1 (bob -> B1): 1 Basketball
INSERT INTO reservation_equipment VALUES(1,'BASKETBALL',1);
-- Equipments for reservation 2 (carol -> T3): 2 Tennis Rackets, 3 Tennis Balls, 1 Towel
INSERT INTO reservation_equipment VALUES(2,'TENNIS_RACKET',2);
INSERT INTO reservation_equipment VALUES(2,'TENNIS_BALL',3);
INSERT INTO reservation_equipment VALUES(2,'TOWEL',1);
-- Equipments for reservation 3 (dave -> V1): 1 Volleyball
INSERT INTO reservation_equipment VALUES(3,'VOLLEYBALL',1);
-- Equipments for reservation 4 (dave -> TT1): 2 Table Tennis Rackets, 1 Table Tennis Ball
INSERT INTO reservation_equipment VALUES(4,'TT_RACKET',2);
INSERT INTO reservation_equipment VALUES(4,'TT_BALL',1);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('recharge', 'booking_payment', 'booking_refund', 'booking_adjustment', 'streak_bonus')),
    description TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Initial seed transactions:
INSERT INTO wallet_transactions (id, user_id, amount, type, description, created_at)
VALUES(1, 1, 500, 'recharge', 'Welcome bonus credit allocation', datetime('now', '-5 days'));
INSERT INTO wallet_transactions (id, user_id, amount, type, description, created_at)
VALUES(2, 2, 500, 'recharge', 'Welcome bonus credit allocation', datetime('now', '-5 days'));
INSERT INTO wallet_transactions (id, user_id, amount, type, description, created_at)
VALUES(3, 2, -14, 'booking_payment', 'Booking #1: Basketball Court #1', datetime('now', '-1 day'));
INSERT INTO wallet_transactions (id, user_id, amount, type, description, created_at)
VALUES(4, 3, 500, 'recharge', 'Welcome bonus credit allocation', datetime('now', '-5 days'));
INSERT INTO wallet_transactions (id, user_id, amount, type, description, created_at)
VALUES(5, 3, -25, 'booking_payment', 'Booking #2: Tennis Court #3', datetime('now', '-1 day'));
INSERT INTO wallet_transactions (id, user_id, amount, type, description, created_at)
VALUES(6, 4, 500, 'recharge', 'Welcome bonus credit allocation', datetime('now', '-5 days'));
INSERT INTO wallet_transactions (id, user_id, amount, type, description, created_at)
VALUES(7, 4, -14, 'booking_payment', 'Booking #3: Volleyball Court #1', datetime('now', '-2 days'));
INSERT INTO wallet_transactions (id, user_id, amount, type, description, created_at)
VALUES(8, 4, -13, 'booking_payment', 'Booking #4: Table Tennis Table #1', datetime('now', '-1 day'));

DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('users',6);
INSERT INTO sqlite_sequence VALUES('reservations',4);
INSERT INTO sqlite_sequence VALUES('facility_release_logs',2);
INSERT INTO sqlite_sequence VALUES('wallet_transactions',8);

CREATE UNIQUE INDEX idx_facility_release_user_facility 
ON facility_release_logs (user_id, facility_type_id);

COMMIT;