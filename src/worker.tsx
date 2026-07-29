import { Hono } from "hono";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

import { securityHeaders } from "./middleware/security";
import {
  ApplicationPage,
  type DirectoryListing,
  GuidePage,
  HomePage,
  ListingPage,
  ManagePage,
  NotFoundPage,
  PrivacyPage,
} from "./ui/pages";

export type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

type AppContext = Context<{ Bindings: Bindings; Variables: { requestId: string } }>;

type ListingRow = {
  access_note: string;
  accepted_field: number;
  accepted_keeper: number;
  beginner_welcome: number;
  bring: string;
  cancellation_policy: string;
  city: string;
  created_at: number;
  creator_session_id: string;
  ends_at: number;
  expires_at: number;
  fee_yen: number;
  field_slots: number;
  id: string;
  join_instructions: string;
  keeper_slots: number;
  minimum_experience: Experience;
  owner_token_hash: string;
  prefecture: string;
  public_note: string;
  starts_at: number;
  status: ListingStatus;
  style: Style;
  surface: Surface;
  team_label: string;
  title: string;
  updated_at: number;
  venue: string;
  venue_url: string;
  women_welcome: number;
};

type ApplicationRow = {
  applicant_token_hash: string;
  assigned_position: "" | Position;
  created_at: number;
  experience: Experience;
  id: string;
  listing_id: string;
  note: string;
  position: "either" | Position;
  session_id: string;
  status: ApplicationStatus;
  updated_at: number;
};

type ApplicationStatus = "accepted" | "declined" | "pending" | "waitlist" | "withdrawn";
type Experience = "basic" | "experienced" | "first_time" | "league";
type ListingStatus = "cancelled" | "full" | "hidden" | "open";
type Position = "field" | "keeper";
type Style = "beginner" | "competitive" | "enjoy" | "mix";
type Surface = "indoor" | "outdoor" | "unknown";

type PublicListing = DirectoryListing & {
  accessNote: string;
  beginnerWelcome: boolean;
  bring: string;
  cancellationPolicy: string;
  createdAt: number;
  minimumExperience: Experience;
  publicNote: string;
  surface: Surface;
  venueUrl: string;
};

class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 429,
  ) {
    super(code);
  }
}

const app = new Hono<{ Bindings: Bindings; Variables: { requestId: string } }>();
const idPattern = /^[0-9a-f]{32}$/;
const tokenPattern = /^[0-9a-f]{64}$/;
const browserSessionPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const contextPattern = /^(?:|[0-9a-f]{32})$/;
const emailPattern = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/iu;
const phonePattern = /(?:\+?81[-\s]?|0)\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/u;
const linkPattern = /(?:https?:\/\/|www\.)/iu;
const telemetryNames = new Set([
  "visited",
  "listing_created",
  "listing_opened",
  "application_saved",
  "application_accepted",
  "listing_filled",
  "returned",
]);
const styles = new Set<Style>(["beginner", "competitive", "enjoy", "mix"]);
const experiences = new Set<Experience>(["basic", "experienced", "first_time", "league"]);
const surfaces = new Set<Surface>(["indoor", "outdoor", "unknown"]);
const positions = new Set(["either", "field", "keeper"]);
const reportReasons = new Set(["other", "spam", "unsafe"]);

const listingColumns = `l.*,
  COALESCE(SUM(CASE WHEN a.status = 'accepted' AND a.assigned_position = 'field' THEN 1 ELSE 0 END), 0) AS accepted_field,
  COALESCE(SUM(CASE WHEN a.status = 'accepted' AND a.assigned_position = 'keeper' THEN 1 ELSE 0 END), 0) AS accepted_keeper`;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const jstDay = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const randomHex = (byteLength: number) => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const enforceSameOrigin = (c: AppContext) => {
  const fetchSite = c.req.header("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") throw new ApiError("cross_site_request", 403);
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) {
    throw new ApiError("cross_site_request", 403);
  }
};

const parseJson = async (c: AppContext, maximumBytes: number) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError("unsupported_media_type", 415);
  }
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > maximumBytes) throw new ApiError("payload_too_large", 413);
  const rawBody = await c.req.text();
  if (new TextEncoder().encode(rawBody).byteLength > maximumBytes) {
    throw new ApiError("payload_too_large", 413);
  }
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};

const objectPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError("invalid_request", 400);
  }
  return payload as Record<string, unknown>;
};

const textValue = (
  source: Record<string, unknown>,
  key: string,
  maximum: number,
  options: { allowEmpty?: boolean; allowLink?: boolean } = {},
) => {
  if (typeof source[key] !== "string") throw new ApiError(`invalid_${key}`, 400);
  const value = source[key].replace(/\r\n?/gu, "\n").trim();
  if ((!options.allowEmpty && value.length === 0) || value.length > maximum) {
    throw new ApiError(`invalid_${key}`, 400);
  }
  let hasUnsafeControl = false;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if ((codePoint < 32 && codePoint !== 9 && codePoint !== 10) || codePoint === 127) {
      hasUnsafeControl = true;
      break;
    }
  }
  if (hasUnsafeControl) throw new ApiError(`invalid_${key}`, 400);
  if (
    emailPattern.test(value) ||
    phonePattern.test(value) ||
    (!options.allowLink && linkPattern.test(value))
  ) {
    throw new ApiError(`contact_not_allowed_in_${key}`, 400);
  }
  return value;
};

const integerValue = (
  source: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
) => {
  const value = source[key];
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ApiError(`invalid_${key}`, 400);
  }
  return value as number;
};

const booleanValue = (source: Record<string, unknown>, key: string) => {
  if (typeof source[key] !== "boolean") throw new ApiError(`invalid_${key}`, 400);
  return source[key] as boolean;
};

const enumValue = <T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
) => {
  const value = source[key];
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new ApiError(`invalid_${key}`, 400);
  }
  return value as T;
};

const isPublicHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase().replace(/\.$/u, "");
  if (
    !normalized.includes(".") ||
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.includes(":")
  ) {
    return false;
  }
  const parts = normalized.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/u.test(part))) {
    const octets = parts.map(Number);
    if (octets.some((part) => part > 255)) return false;
    const [first = 0, second = 0] = octets;
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    );
  }
  return true;
};

const parsePublicHttpsUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !isPublicHostname(url.hostname)
    ) {
      throw new Error("not public https");
    }
    return url;
  } catch {
    throw new ApiError("invalid_public_url", 400);
  }
};

const publicHttpsUrl = (source: Record<string, unknown>, key: string) => {
  const value = textValue(source, key, 500, { allowEmpty: true, allowLink: true });
  if (!value) return "";
  try {
    return parsePublicHttpsUrl(value).toString();
  } catch {
    throw new ApiError(`invalid_${key}`, 400);
  }
};

const validateEmbeddedPublicLinks = (value: string) => {
  const matches = value.match(/https?:\/\/[^\s<>"']+/giu) ?? [];
  if (linkPattern.test(value) && matches.length === 0) {
    throw new ApiError("invalid_public_url", 400);
  }
  for (const match of matches) parsePublicHttpsUrl(match);
};

const isAutomatedQa = (c: AppContext) => {
  if (c.req.header("x-automated-qa") === "1") return true;
  if (new URL(c.req.url).searchParams.get("qa") === "1") return true;
  const referer = c.req.header("referer");
  if (!referer) return false;
  try {
    return new URL(referer).searchParams.get("qa") === "1";
  } catch {
    return false;
  }
};

const readSessionId = (c: AppContext) => {
  const sessionId = c.req.header("x-suketto-session") ?? "";
  if (!browserSessionPattern.test(sessionId)) throw new ApiError("invalid_session", 400);
  return sessionId;
};

const readToken = (c: AppContext, header: string) => {
  const token = c.req.header(header) ?? "";
  if (!tokenPattern.test(token)) throw new ApiError("invalid_capability", 403);
  return token;
};

const recordEventStatements = (db: D1Database, sessionId: string, name: string, context = "") => [
  db
    .prepare(
      `INSERT OR IGNORE INTO product_events
       (session_id, name, context, occurred_on, created_at)
       VALUES (?, ?, ?, ?, unixepoch())`,
    )
    .bind(sessionId, name, context, jstDay()),
  db.prepare("DELETE FROM product_events WHERE created_at < unixepoch() - (45 * 86400)"),
];

const recordEvent = async (db: D1Database, sessionId: string, name: string, context = "") => {
  await db.batch(recordEventStatements(db, sessionId, name, context));
};

const publicListing = (row: ListingRow): PublicListing => {
  const fieldRemaining = Math.max(0, row.field_slots - Number(row.accepted_field));
  const keeperRemaining = Math.max(0, row.keeper_slots - Number(row.accepted_keeper));
  const computedStatus = fieldRemaining + keeperRemaining === 0 ? "full" : row.status;
  return {
    accessNote: row.access_note,
    beginnerWelcome: row.beginner_welcome === 1,
    bring: row.bring,
    cancellationPolicy: row.cancellation_policy,
    city: row.city,
    createdAt: row.created_at,
    endsAt: row.ends_at,
    feeYen: row.fee_yen,
    fieldRemaining,
    id: row.id,
    keeperRemaining,
    minimumExperience: row.minimum_experience,
    prefecture: row.prefecture,
    publicNote: row.public_note,
    startsAt: row.starts_at,
    status: computedStatus === "full" ? "full" : "open",
    style: row.style,
    surface: row.surface,
    teamLabel: row.team_label,
    title: row.title,
    venue: row.venue,
    venueUrl: row.venue_url,
    womenWelcome: row.women_welcome === 1,
  };
};

const getListing = async (db: D1Database, id: string, includeClosed = false) => {
  if (!idPattern.test(id)) return null;
  const visibility = includeClosed
    ? ""
    : "AND l.status IN ('open', 'full') AND l.starts_at > unixepoch() AND l.expires_at > unixepoch()";
  return db
    .prepare(
      `SELECT ${listingColumns}
       FROM listings l
       LEFT JOIN applications a ON a.listing_id = l.id
       WHERE l.id = ? ${visibility}
       GROUP BY l.id`,
    )
    .bind(id)
    .first<ListingRow>();
};

const authorizeListing = async (c: AppContext, id: string) => {
  const token = readToken(c, "x-suketto-owner");
  const listing = await getListing(c.env.DB, id, true);
  if (!listing || !constantTimeEqual(await sha256(token), listing.owner_token_hash)) {
    throw new ApiError("invalid_capability", 403);
  }
  return listing;
};

const authorizeApplication = async (c: AppContext, id: string) => {
  if (!idPattern.test(id)) throw new ApiError("not_found", 404);
  const token = readToken(c, "x-suketto-applicant");
  const application = await c.env.DB.prepare("SELECT * FROM applications WHERE id = ?")
    .bind(id)
    .first<ApplicationRow>();
  if (!application || !constantTimeEqual(await sha256(token), application.applicant_token_hash)) {
    throw new ApiError("invalid_capability", 403);
  }
  return application;
};

const cleanup = (db: D1Database) =>
  db.batch([
    db.prepare("DELETE FROM listings WHERE expires_at < unixepoch()"),
    db.prepare("DELETE FROM product_events WHERE created_at < unixepoch() - (45 * 86400)"),
  ]);

app.use("*", requestId());
app.use("*", securityHeaders);
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});

app.get("/", async (c) => {
  const prefecture = (c.req.query("prefecture") ?? "").trim().slice(0, 12);
  const requestedStyle = c.req.query("style") ?? "";
  const style = styles.has(requestedStyle as Style) ? (requestedStyle as Style) : "";
  const result = await c.env.DB.prepare(
    `SELECT ${listingColumns}
     FROM listings l
     LEFT JOIN applications a ON a.listing_id = l.id
     WHERE l.status IN ('open', 'full') AND l.starts_at > unixepoch() AND l.expires_at > unixepoch()
     GROUP BY l.id
     ORDER BY l.starts_at ASC
     LIMIT 60`,
  ).all<ListingRow>();
  const listings = result.results
    .map(publicListing)
    .filter((listing) => !prefecture || listing.prefecture === prefecture)
    .filter((listing) => !style || listing.style === style);
  c.header("Cache-Control", "public, max-age=30, s-maxage=60");
  return c.html(
    <HomePage listings={listings} selectedPrefecture={prefecture} selectedStyle={style} />,
  );
});

app.get("/guide", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<GuidePage />);
});

app.get("/privacy", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<PrivacyPage />);
});

app.get("/games/:id", async (c) => {
  const listing = await getListing(c.env.DB, c.req.param("id"));
  if (!listing) return c.html(<NotFoundPage />, 404);
  c.header("Cache-Control", "private, no-store");
  return c.html(<ListingPage listing={publicListing(listing)} />);
});

app.get("/manage/:id", async (c) => {
  if (!idPattern.test(c.req.param("id"))) return c.html(<NotFoundPage />, 404);
  c.header("Cache-Control", "private, no-store");
  return c.html(<ManagePage listingId={c.req.param("id")} />);
});

app.get("/applications/:id", async (c) => {
  if (!idPattern.test(c.req.param("id"))) return c.html(<NotFoundPage />, 404);
  c.header("Cache-Control", "private, no-store");
  return c.html(<ApplicationPage applicationId={c.req.param("id")} />);
});

app.get("/api/listings/:id", async (c) => {
  const listing = await getListing(c.env.DB, c.req.param("id"));
  if (!listing) throw new ApiError("not_found", 404);
  return c.json({ listing: publicListing(listing) });
});

app.post("/api/listings", async (c) => {
  enforceSameOrigin(c);
  const sessionId = readSessionId(c);
  const source = objectPayload(await parseJson(c, 8192));
  if (source.website) throw new ApiError("spam_rejected", 400);

  const startsAt = integerValue(source, "startsAt", 0, 4_102_444_800);
  const endsAt = integerValue(source, "endsAt", 0, 4_102_444_800);
  const current = nowSeconds();
  if (
    startsAt < current + 2 * 3600 ||
    startsAt > current + 90 * 86400 ||
    endsAt < startsAt + 30 * 60 ||
    endsAt > startsAt + 6 * 3600
  ) {
    throw new ApiError("invalid_event_time", 400);
  }

  const fieldSlots = integerValue(source, "fieldSlots", 0, 30);
  const keeperSlots = integerValue(source, "keeperSlots", 0, 10);
  if (fieldSlots + keeperSlots === 0) throw new ApiError("no_open_slots", 400);

  const created = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM listings WHERE creator_session_id = ? AND created_at > unixepoch() - 86400",
  )
    .bind(sessionId)
    .first<{ count: number }>();
  if (Number(created?.count ?? 0) >= 3) throw new ApiError("listing_rate_limited", 429);

  const values = {
    accessNote: textValue(source, "accessNote", 240, { allowEmpty: true }),
    beginnerWelcome: booleanValue(source, "beginnerWelcome"),
    bring: textValue(source, "bring", 240, { allowEmpty: true }),
    cancellationPolicy: textValue(source, "cancellationPolicy", 240),
    city: textValue(source, "city", 40),
    feeYen: integerValue(source, "feeYen", 0, 10_000),
    minimumExperience: enumValue(source, "minimumExperience", experiences),
    prefecture: textValue(source, "prefecture", 12),
    publicNote: textValue(source, "publicNote", 600, { allowEmpty: true }),
    style: enumValue(source, "style", styles),
    surface: enumValue(source, "surface", surfaces),
    teamLabel: textValue(source, "teamLabel", 60, { allowEmpty: true }),
    title: textValue(source, "title", 80),
    venue: textValue(source, "venue", 80),
    venueUrl: publicHttpsUrl(source, "venueUrl"),
    womenWelcome: booleanValue(source, "womenWelcome"),
  };
  const joinInstructions = textValue(source, "joinInstructions", 600, { allowLink: true });
  validateEmbeddedPublicLinks(joinInstructions);

  const id = randomHex(16);
  const ownerToken = randomHex(32);
  const ownerHash = await sha256(ownerToken);
  const expiresAt = endsAt + 30 * 86400;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO listings (
        id, owner_token_hash, creator_session_id, title, team_label, prefecture, city,
        venue, venue_url, starts_at, ends_at, style, minimum_experience, fee_yen,
        field_slots, keeper_slots, surface, beginner_welcome, women_welcome, bring,
        cancellation_policy, access_note, public_note, join_instructions, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      ownerHash,
      sessionId,
      values.title,
      values.teamLabel,
      values.prefecture,
      values.city,
      values.venue,
      values.venueUrl,
      startsAt,
      endsAt,
      values.style,
      values.minimumExperience,
      values.feeYen,
      fieldSlots,
      keeperSlots,
      values.surface,
      values.beginnerWelcome ? 1 : 0,
      values.womenWelcome ? 1 : 0,
      values.bring,
      values.cancellationPolicy,
      values.accessNote,
      values.publicNote,
      joinInstructions,
      expiresAt,
    ),
    ...(isAutomatedQa(c) ? [] : recordEventStatements(c.env.DB, sessionId, "listing_created", id)),
  ]);

  const origin = new URL(c.req.url).origin;
  c.header("Location", `${origin}/games/${id}`);
  return c.json(
    {
      id,
      manageUrl: `${origin}/manage/${id}#key=${ownerToken}`,
      publicUrl: `${origin}/games/${id}`,
    },
    201,
  );
});

app.get("/api/listings/:id/manage", async (c) => {
  const listing = await authorizeListing(c, c.req.param("id"));
  const applications = await c.env.DB.prepare(
    `SELECT id, position, experience, note, assigned_position, status, created_at, updated_at
     FROM applications WHERE listing_id = ? ORDER BY created_at ASC`,
  )
    .bind(listing.id)
    .all<
      Pick<
        ApplicationRow,
        | "assigned_position"
        | "created_at"
        | "experience"
        | "id"
        | "note"
        | "position"
        | "status"
        | "updated_at"
      >
    >();
  return c.json({
    applications: applications.results.map((application) => ({
      assignedPosition: application.assigned_position,
      createdAt: application.created_at,
      experience: application.experience,
      id: application.id,
      note: application.note,
      position: application.position,
      status: application.status,
      updatedAt: application.updated_at,
    })),
    joinInstructions: listing.join_instructions,
    listing: {
      ...publicListing(listing),
      status: listing.status,
    },
  });
});

app.patch("/api/listings/:id/status", async (c) => {
  enforceSameOrigin(c);
  const listing = await authorizeListing(c, c.req.param("id"));
  const source = objectPayload(await parseJson(c, 512));
  const requestedStatus = source.status;
  if (requestedStatus !== "cancelled" && requestedStatus !== "open") {
    throw new ApiError("invalid_status", 400);
  }
  if (listing.status === "hidden") throw new ApiError("listing_hidden", 409);
  if (requestedStatus === "open" && listing.starts_at <= nowSeconds()) {
    throw new ApiError("event_started", 409);
  }
  const remaining =
    listing.field_slots -
    Number(listing.accepted_field) +
    listing.keeper_slots -
    Number(listing.accepted_keeper);
  const finalStatus = requestedStatus === "open" && remaining === 0 ? "full" : requestedStatus;
  await c.env.DB.prepare("UPDATE listings SET status = ?, updated_at = unixepoch() WHERE id = ?")
    .bind(finalStatus, listing.id)
    .run();
  return c.json({ status: finalStatus });
});

app.delete("/api/listings/:id", async (c) => {
  enforceSameOrigin(c);
  const listing = await authorizeListing(c, c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM listings WHERE id = ?").bind(listing.id).run();
  return c.body(null, 204);
});

app.post("/api/listings/:id/applications", async (c) => {
  enforceSameOrigin(c);
  const sessionId = readSessionId(c);
  const listing = await getListing(c.env.DB, c.req.param("id"));
  if (!listing) throw new ApiError("not_found", 404);
  if (
    listing.status !== "open" ||
    Number(listing.accepted_field) + Number(listing.accepted_keeper) >=
      listing.field_slots + listing.keeper_slots
  ) {
    throw new ApiError("listing_full", 409);
  }
  const total = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM applications WHERE listing_id = ?",
  )
    .bind(listing.id)
    .first<{ count: number }>();
  if (Number(total?.count ?? 0) >= 60) throw new ApiError("application_limit_reached", 429);

  const source = objectPayload(await parseJson(c, 2048));
  if (source.website) throw new ApiError("spam_rejected", 400);
  const position = enumValue(source, "position", positions) as "either" | Position;
  const experience = enumValue(source, "experience", experiences);
  const note = textValue(source, "note", 240, { allowEmpty: true });
  const id = randomHex(16);
  const applicantToken = randomHex(32);
  const applicantHash = await sha256(applicantToken);

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO applications
         (id, listing_id, session_id, applicant_token_hash, position, experience, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, listing.id, sessionId, applicantHash, position, experience, note),
      ...(isAutomatedQa(c)
        ? []
        : recordEventStatements(c.env.DB, sessionId, "application_saved", listing.id)),
    ]);
  } catch (error) {
    if (error instanceof Error && /unique|constraint/iu.test(error.message)) {
      throw new ApiError("already_applied", 409);
    }
    throw error;
  }

  const origin = new URL(c.req.url).origin;
  return c.json(
    {
      id,
      statusUrl: `${origin}/applications/${id}#key=${applicantToken}`,
    },
    201,
  );
});

app.get("/api/applications/:id", async (c) => {
  const application = await authorizeApplication(c, c.req.param("id"));
  const listing = await getListing(c.env.DB, application.listing_id, true);
  if (!listing) throw new ApiError("not_found", 404);
  return c.json({
    application: {
      assignedPosition: application.assigned_position,
      experience: application.experience,
      position: application.position,
      status: application.status,
    },
    joinInstructions: application.status === "accepted" ? listing.join_instructions : "",
    listing: {
      city: listing.city,
      endsAt: listing.ends_at,
      prefecture: listing.prefecture,
      startsAt: listing.starts_at,
      status: listing.status,
      title: listing.title,
      venue: listing.venue,
    },
  });
});

app.delete("/api/applications/:id", async (c) => {
  enforceSameOrigin(c);
  const application = await authorizeApplication(c, c.req.param("id"));
  const listing = await getListing(c.env.DB, application.listing_id, true);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE applications
       SET status = 'withdrawn', assigned_position = '', updated_at = unixepoch()
       WHERE id = ?`,
    ).bind(application.id),
    c.env.DB.prepare(
      `UPDATE listings SET status = 'open', updated_at = unixepoch()
       WHERE id = ? AND status = 'full' AND starts_at > unixepoch()`,
    ).bind(application.listing_id),
  ]);
  if (!listing) throw new ApiError("not_found", 404);
  return c.body(null, 204);
});

app.patch("/api/listings/:id/applications/:applicationId", async (c) => {
  enforceSameOrigin(c);
  const listing = await authorizeListing(c, c.req.param("id"));
  const applicationId = c.req.param("applicationId");
  if (!idPattern.test(applicationId)) throw new ApiError("not_found", 404);
  const application = await c.env.DB.prepare(
    "SELECT * FROM applications WHERE id = ? AND listing_id = ?",
  )
    .bind(applicationId, listing.id)
    .first<ApplicationRow>();
  if (!application) throw new ApiError("not_found", 404);
  if (application.status === "withdrawn") throw new ApiError("application_withdrawn", 409);

  const source = objectPayload(await parseJson(c, 512));
  const status = source.status;
  if (status !== "accepted" && status !== "declined" && status !== "waitlist") {
    throw new ApiError("invalid_status", 400);
  }
  let assignedPosition: "" | Position = "";
  if (status === "accepted") {
    if (listing.status === "cancelled" || listing.status === "hidden") {
      throw new ApiError("listing_unavailable", 409);
    }
    if (source.assignedPosition !== "field" && source.assignedPosition !== "keeper") {
      throw new ApiError("invalid_assigned_position", 400);
    }
    assignedPosition = source.assignedPosition;
    if (application.position !== "either" && application.position !== assignedPosition) {
      throw new ApiError("position_mismatch", 409);
    }
    const accepted = await c.env.DB.prepare(
      `UPDATE applications
       SET status = 'accepted', assigned_position = ?, updated_at = unixepoch()
       WHERE id = ? AND listing_id = ? AND status <> 'withdrawn'
         AND EXISTS (
           SELECT 1 FROM listings
           WHERE id = ? AND status IN ('open', 'full') AND starts_at > unixepoch()
         )
         AND (
           SELECT COUNT(*) FROM applications
           WHERE listing_id = ? AND status = 'accepted' AND assigned_position = ? AND id <> ?
         ) < (
           SELECT CASE WHEN ? = 'field' THEN field_slots ELSE keeper_slots END
           FROM listings WHERE id = ?
         )`,
    )
      .bind(
        assignedPosition,
        application.id,
        listing.id,
        listing.id,
        listing.id,
        assignedPosition,
        application.id,
        assignedPosition,
        listing.id,
      )
      .run();
    if (Number(accepted.meta.changes) !== 1) {
      throw new ApiError("position_full", 409);
    }
  } else {
    await c.env.DB.prepare(
      `UPDATE applications
       SET status = ?, assigned_position = '', updated_at = unixepoch()
       WHERE id = ? AND listing_id = ? AND status <> 'withdrawn'`,
    )
      .bind(status, application.id, listing.id)
      .run();
  }
  const refreshed = await getListing(c.env.DB, listing.id, true);
  if (!refreshed) throw new ApiError("not_found", 404);
  const acceptedField = Number(refreshed.accepted_field);
  const acceptedKeeper = Number(refreshed.accepted_keeper);
  const isFull = acceptedField >= listing.field_slots && acceptedKeeper >= listing.keeper_slots;
  const listingStatus =
    listing.status === "cancelled" || listing.status === "hidden"
      ? listing.status
      : isFull
        ? "full"
        : "open";
  const statements = [
    c.env.DB.prepare("UPDATE listings SET status = ?, updated_at = unixepoch() WHERE id = ?").bind(
      listingStatus,
      listing.id,
    ),
  ];
  if (status === "accepted" && application.status !== "accepted" && !isAutomatedQa(c)) {
    statements.push(
      ...recordEventStatements(
        c.env.DB,
        application.session_id,
        "application_accepted",
        listing.id,
      ),
    );
  }
  if (isFull && listing.status !== "full" && !isAutomatedQa(c)) {
    statements.push(
      ...recordEventStatements(c.env.DB, listing.creator_session_id, "listing_filled", listing.id),
    );
  }
  await c.env.DB.batch(statements);
  return c.json({ assignedPosition, listingStatus, status });
});

app.post("/api/listings/:id/report", async (c) => {
  enforceSameOrigin(c);
  const sessionId = readSessionId(c);
  const listing = await getListing(c.env.DB, c.req.param("id"));
  if (!listing) throw new ApiError("not_found", 404);
  const source = objectPayload(await parseJson(c, 256));
  const reason = source.reason;
  if (typeof reason !== "string" || !reportReasons.has(reason)) {
    throw new ApiError("invalid_reason", 400);
  }
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO reports (listing_id, reporter_session_id, reason)
     VALUES (?, ?, ?)`,
  )
    .bind(listing.id, sessionId, reason)
    .run();
  const reportCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM reports WHERE listing_id = ?",
  )
    .bind(listing.id)
    .first<{ count: number }>();
  if (Number(reportCount?.count ?? 0) >= 3) {
    await c.env.DB.prepare(
      "UPDATE listings SET status = 'hidden', updated_at = unixepoch() WHERE id = ?",
    )
      .bind(listing.id)
      .run();
  }
  return c.body(null, 202);
});

app.post("/api/telemetry", async (c) => {
  enforceSameOrigin(c);
  if (isAutomatedQa(c)) return c.body(null, 204);
  const source = objectPayload(await parseJson(c, 512));
  const sessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const name = typeof source.name === "string" ? source.name : "";
  const context = typeof source.context === "string" ? source.context : "";
  if (
    !browserSessionPattern.test(sessionId) ||
    !telemetryNames.has(name) ||
    !contextPattern.test(context)
  ) {
    throw new ApiError("invalid_telemetry", 400);
  }
  await recordEvent(c.env.DB, sessionId, name, context);
  return c.body(null, 204);
});

app.get("/healthz", (c) =>
  c.json({ healthy: true, service: "suketto-court", time: new Date().toISOString() }),
);

app.notFound((c) => {
  if (c.req.method === "GET" && !c.req.path.startsWith("/api/")) {
    return c.html(<NotFoundPage />, 404);
  }
  return c.json({ error: "not_found", requestId: c.get("requestId") }, 404);
});

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: error.code, requestId: c.get("requestId") }, error.status);
  }
  console.error(
    JSON.stringify({
      event: "request_failed",
      message: error.message,
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export { app };
export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Bindings, context: ExecutionContext) {
    context.waitUntil(cleanup(env.DB));
  },
};
