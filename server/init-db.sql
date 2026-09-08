PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
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
    CONSTRAINT check_score CHECK (score <= 0)
);

-- Passwords for all users are 'password'
INSERT INTO users VALUES(1,'alice','26b0d1286ba396077d2372a6375b27d6be4834b20a5ab141cc34a9b17024f3bf','salt_alice_982347',0,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0);
INSERT INTO users VALUES(2,'bob','e50c1e8346cf266bfe9d40be12bc25c7eef64c611929a12d70c8152cd92e03e6','salt_bob_192837',-2,'LXBSMDTMSP2I5XFXIYRGFVWSFI',0);
INSERT INTO users VALUES(3,'carol','97b2c21b479773bdb8ac8b2b35e275f15b59ebea12cd00c34bb2331dd566b998','salt_charlie_583920',-1,'LXBSMDTMSP2I5XFXIYRGFVWSFI',59569451);
INSERT INTO users VALUES(4,'dave','f55aadff759bd12386d1484e393aa214ab0a2341e27002a34febe3a890a7f1c9','salt_diana_847291',0,'LXBSMDTMSP2I5XFXIYRGFVWSFI',59565691);

CREATE TABLE facility_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

INSERT INTO facility_types VALUES('TENNIS','Tennis Court');
INSERT INTO facility_types VALUES('BASKETBALL','Basketball Court');
INSERT INTO facility_types VALUES('VOLLEYBALL','Volleyball Court');
INSERT INTO facility_types VALUES('SOCCER','Soccer Field');
INSERT INTO facility_types VALUES('TABLE_TENNIS','Table Tennis Table');
INSERT INTO facility_types VALUES('CYCLING','Cycling Track');

CREATE TABLE facilities (
    id TEXT PRIMARY KEY,
    facility_type_id TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (facility_type_id) REFERENCES facility_types (id) ON DELETE CASCADE
);

INSERT INTO facilities VALUES('T1','TENNIS','Tennis Court #1');
INSERT INTO facilities VALUES('T2','TENNIS','Tennis Court #2');
INSERT INTO facilities VALUES('T3','TENNIS','Tennis Court #3');
INSERT INTO facilities VALUES('B1','BASKETBALL','Basketball Court #1');
INSERT INTO facilities VALUES('B2','BASKETBALL','Basketball Court #2');
INSERT INTO facilities VALUES('V1','VOLLEYBALL','Volleyball Court #1');
INSERT INTO facilities VALUES('V2','VOLLEYBALL','Volleyball Court #2');
INSERT INTO facilities VALUES('S1','SOCCER','Soccer Field #1');
INSERT INTO facilities VALUES('TT1','TABLE_TENNIS','Table Tennis Table #1');
INSERT INTO facilities VALUES('TT2','TABLE_TENNIS','Table Tennis Table #2');
INSERT INTO facilities VALUES('TT3','TABLE_TENNIS','Table Tennis Table #3');
INSERT INTO facilities VALUES('TT4','TABLE_TENNIS','Table Tennis Table #4');
INSERT INTO facilities VALUES('C1','CYCLING','Cycling Track #1');
INSERT INTO facilities VALUES('C2','CYCLING','Cycling Track #2');

CREATE TABLE equipment_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0)
);

INSERT INTO equipment_types VALUES('TENNIS_RACKET','Tennis Racket',8);
INSERT INTO equipment_types VALUES('TENNIS_BALL','Tennis Ball',7);
INSERT INTO equipment_types VALUES('TOWEL','Towel',4);
INSERT INTO equipment_types VALUES('BASKETBALL','Basketball',2);
INSERT INTO equipment_types VALUES('CONE','Cone',4);
INSERT INTO equipment_types VALUES('VOLLEYBALL','Volleyball',2);
INSERT INTO equipment_types VALUES('KNEE_PADS','Pair of Knee Pads',10);
INSERT INTO equipment_types VALUES('SOCCER_BALL','Soccer Ball',2);
INSERT INTO equipment_types VALUES('SOCCER_SHOES','Pair of Soccer Shoes',12);
INSERT INTO equipment_types VALUES('GK_GLOVES','Pair of Goalkeeper Gloves',2);
INSERT INTO equipment_types VALUES('TT_RACKET','Table Tennis Racket',8);
INSERT INTO equipment_types VALUES('TT_BALL','Table Tennis Ball',4);
INSERT INTO equipment_types VALUES('BICYCLE','Bicycle',4);
INSERT INTO equipment_types VALUES('HELMET','Helmet',4);
INSERT INTO equipment_types VALUES('REPAIR_KIT','Repair Kit',1);

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
    facility_id TEXT NOT NULL UNIQUE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (facility_id) REFERENCES facilities (id) ON DELETE RESTRICT
);

-- User 2 (bob): 1 reservation (B1)
INSERT INTO reservations VALUES(1,2,'B1');
-- User 3 (carol): 1 reservation (T3)
INSERT INTO reservations VALUES(2,3,'T3');
-- User 4 (dave): 2 reservations (V1, TT1)
INSERT INTO reservations VALUES(3,4,'V1');
INSERT INTO reservations VALUES(4,4,'TT1');

CREATE TABLE facility_release_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    facility_type_id TEXT NOT NULL,
    released_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (facility_type_id) REFERENCES facility_types (id) ON DELETE CASCADE
);

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

DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('users',4);
INSERT INTO sqlite_sequence VALUES('reservations',4);

CREATE UNIQUE INDEX idx_facility_release_user_facility 
ON facility_release_logs (user_id, facility_type_id);

COMMIT;