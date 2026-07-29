PRAGMA foreign_keys = ON;

CREATE TABLE listings (
  id TEXT PRIMARY KEY CHECK(length(id) = 32),
  owner_token_hash TEXT NOT NULL CHECK(length(owner_token_hash) = 64),
  creator_session_id TEXT NOT NULL CHECK(length(creator_session_id) = 36),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 80),
  team_label TEXT NOT NULL DEFAULT '' CHECK(length(team_label) <= 60),
  prefecture TEXT NOT NULL CHECK(length(prefecture) BETWEEN 1 AND 12),
  city TEXT NOT NULL CHECK(length(city) BETWEEN 1 AND 40),
  venue TEXT NOT NULL CHECK(length(venue) BETWEEN 1 AND 80),
  venue_url TEXT NOT NULL DEFAULT '' CHECK(length(venue_url) <= 500),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  style TEXT NOT NULL CHECK(style IN ('beginner', 'enjoy', 'mix', 'competitive')),
  minimum_experience TEXT NOT NULL CHECK(minimum_experience IN ('first_time', 'basic', 'experienced', 'league')),
  fee_yen INTEGER NOT NULL CHECK(fee_yen BETWEEN 0 AND 10000),
  field_slots INTEGER NOT NULL CHECK(field_slots BETWEEN 0 AND 30),
  keeper_slots INTEGER NOT NULL CHECK(keeper_slots BETWEEN 0 AND 10),
  surface TEXT NOT NULL CHECK(surface IN ('indoor', 'outdoor', 'unknown')),
  beginner_welcome INTEGER NOT NULL CHECK(beginner_welcome IN (0, 1)),
  women_welcome INTEGER NOT NULL CHECK(women_welcome IN (0, 1)),
  bring TEXT NOT NULL DEFAULT '' CHECK(length(bring) <= 240),
  cancellation_policy TEXT NOT NULL CHECK(length(cancellation_policy) BETWEEN 1 AND 240),
  access_note TEXT NOT NULL DEFAULT '' CHECK(length(access_note) <= 240),
  public_note TEXT NOT NULL DEFAULT '' CHECK(length(public_note) <= 600),
  join_instructions TEXT NOT NULL CHECK(length(join_instructions) BETWEEN 1 AND 600),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('cancelled', 'full', 'hidden', 'open')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  CHECK(ends_at > starts_at),
  CHECK(field_slots + keeper_slots > 0)
);

CREATE INDEX listings_public_idx ON listings(status, starts_at);
CREATE INDEX listings_creator_idx ON listings(creator_session_id, created_at);
CREATE INDEX listings_expiry_idx ON listings(expires_at);

CREATE TABLE applications (
  id TEXT PRIMARY KEY CHECK(length(id) = 32),
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL CHECK(length(session_id) = 36),
  applicant_token_hash TEXT NOT NULL CHECK(length(applicant_token_hash) = 64),
  position TEXT NOT NULL CHECK(position IN ('either', 'field', 'keeper')),
  experience TEXT NOT NULL CHECK(experience IN ('first_time', 'basic', 'experienced', 'league')),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 240),
  assigned_position TEXT NOT NULL DEFAULT '' CHECK(assigned_position IN ('', 'field', 'keeper')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
    'accepted',
    'declined',
    'pending',
    'waitlist',
    'withdrawn'
  )),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(listing_id, session_id)
);

CREATE INDEX applications_listing_idx ON applications(listing_id, status, created_at);

CREATE TABLE reports (
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reporter_session_id TEXT NOT NULL CHECK(length(reporter_session_id) = 36),
  reason TEXT NOT NULL CHECK(reason IN ('spam', 'unsafe', 'other')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY(listing_id, reporter_session_id)
);

CREATE TABLE product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL CHECK(length(session_id) = 36),
  name TEXT NOT NULL CHECK(name IN (
    'visited',
    'listing_created',
    'listing_opened',
    'application_saved',
    'application_accepted',
    'listing_filled',
    'returned'
  )),
  context TEXT NOT NULL DEFAULT '' CHECK(length(context) <= 32),
  occurred_on TEXT NOT NULL CHECK(length(occurred_on) = 10),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(session_id, name, context, occurred_on)
);

CREATE INDEX product_events_created_at_idx ON product_events(created_at);
CREATE INDEX product_events_name_day_idx ON product_events(name, occurred_on);
