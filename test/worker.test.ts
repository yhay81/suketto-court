import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Miniflare } from "miniflare";

import { app, type Bindings } from "../src/worker";

const migrationPath = fileURLToPath(new URL("../migrations/0001_listings.sql", import.meta.url));
const origin = "http://localhost";
const sessionA = "a2d0e2f2-66fd-4fd4-8e87-b0ef67ad194a";
const sessionB = "b3d0e2f2-66fd-4fd4-8e87-b0ef67ad194b";
const sessionC = "c4d0e2f2-66fd-4fd4-8e87-b0ef67ad194c";
const sessionD = "d5d0e2f2-66fd-4fd4-8e87-b0ef67ad194d";

let miniflare: Miniflare;
let bindings: Bindings;

const jsonHeaders = (sessionId = sessionA) => ({
  "content-type": "application/json",
  origin,
  "x-suketto-session": sessionId,
});

const futureTimes = () => {
  const startsAt = Math.floor(Date.now() / 1000) + 3 * 3600;
  return { endsAt: startsAt + 2 * 3600, startsAt };
};

const validListing = (overrides: Record<string, unknown> = {}) => ({
  accessNote: "東口から徒歩5分",
  beginnerWelcome: true,
  bring: "屋内用シューズ",
  cancellationPolicy: "前日18時までに確認札から辞退してください",
  city: "江東区",
  feeYen: 1200,
  fieldSlots: 1,
  joinInstructions: "17時45分に施設1階ロビーへ集合してください",
  keeperSlots: 1,
  minimumExperience: "basic",
  prefecture: "東京都",
  publicNote: "ゲーム中心で休憩を挟みます",
  style: "enjoy",
  surface: "indoor",
  teamLabel: "西町フットサル",
  title: "土曜夕方のエンジョイゲーム",
  venue: "東砂スポーツセンター",
  venueUrl: "https://example.com/venue",
  website: "",
  womenWelcome: true,
  ...futureTimes(),
  ...overrides,
});

const createListing = async (overrides: Record<string, unknown> = {}, sessionId = sessionA) => {
  const response = await app.request(
    "/api/listings",
    {
      body: JSON.stringify(validListing(overrides)),
      headers: jsonHeaders(sessionId),
      method: "POST",
    },
    bindings,
  );
  expect(response.status).toBe(201);
  return response.json<{ id: string; manageUrl: string; publicUrl: string }>();
};

const keyFromUrl = (url: string) =>
  new URLSearchParams(new URL(url).hash.slice(1)).get("key") ?? "";

const createApplication = async (listingId: string, sessionId = sessionB, position = "either") => {
  const response = await app.request(
    `/api/listings/${listingId}/applications`,
    {
      body: JSON.stringify({
        experience: "basic",
        note: "月1回ほど参加しています",
        position,
        website: "",
      }),
      headers: jsonHeaders(sessionId),
      method: "POST",
    },
    bindings,
  );
  expect(response.status).toBe(201);
  return response.json<{ id: string; statusUrl: string }>();
};

beforeEach(async () => {
  miniflare = new Miniflare({
    d1Databases: { DB: "suketto-court-test" },
    modules: true,
    script: "export default { fetch() { return new Response('test') } }",
  });
  const database = await miniflare.getD1Database("DB");
  const migration = await readFile(migrationPath, "utf8");
  for (const statement of migration
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)) {
    await database.prepare(statement).run();
  }
  bindings = {
    ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher,
    DB: database as unknown as D1Database,
  };
});

afterEach(async () => {
  await miniflare.dispose();
});

describe("suketto-court worker", () => {
  it.each([
    ["/", 'class="court-stage"', "https://suketto-court.yhay81.com"],
    ["/guide", 'class="guide-steps"', "https://suketto-court.yhay81.com/guide"],
    ["/privacy", "秘密のURL", "https://suketto-court.yhay81.com/privacy"],
  ])("%sを製品固有の公開ページとして返す", async (path, marker, canonical) => {
    const response = await app.request(path, undefined, bindings);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(html).toContain(marker);
    expect(html).toContain(`href="${canonical}"`);
    expect(html).not.toMatch(/成功条件|検証仮説|市場スコア|移行候補/);
    expect(html).not.toContain('class="hero"');
  });

  it("募集を作成し、公開情報と秘密の管理情報を分離する", async () => {
    const created = await createListing();
    expect(created.id).toMatch(/^[0-9a-f]{32}$/);
    expect(keyFromUrl(created.manageUrl)).toMatch(/^[0-9a-f]{64}$/);

    const publicResponse = await app.request(`/api/listings/${created.id}`, undefined, bindings);
    const publicText = await publicResponse.text();
    expect(publicResponse.status).toBe(200);
    expect(publicText).toContain("東砂スポーツセンター");
    expect(publicText).not.toContain("joinInstructions");
    expect(publicText).not.toContain("owner");
    expect(publicText).not.toContain("creator_session");

    const manageResponse = await app.request(
      `/api/listings/${created.id}/manage`,
      { headers: { "x-suketto-owner": keyFromUrl(created.manageUrl) } },
      bindings,
    );
    expect(manageResponse.status).toBe(200);
    expect(await manageResponse.json()).toMatchObject({
      applications: [],
      joinInstructions: "17時45分に施設1階ロビーへ集合してください",
    });
  });

  it("匿名応募を確認札へ結び、採用後だけ参加案内を返す", async () => {
    const listing = await createListing();
    const application = await createApplication(listing.id);
    const applicantKey = keyFromUrl(application.statusUrl);
    const applicantHeaders = { "x-suketto-applicant": applicantKey };

    const pending = await app.request(
      `/api/applications/${application.id}`,
      { headers: applicantHeaders },
      bindings,
    );
    expect(await pending.json()).toMatchObject({
      application: { status: "pending" },
      joinInstructions: "",
    });

    const accepted = await app.request(
      `/api/listings/${listing.id}/applications/${application.id}`,
      {
        body: JSON.stringify({ assignedPosition: "field", status: "accepted" }),
        headers: {
          ...jsonHeaders(),
          "x-suketto-owner": keyFromUrl(listing.manageUrl),
        },
        method: "PATCH",
      },
      bindings,
    );
    expect(accepted.status).toBe(200);

    const decided = await app.request(
      `/api/applications/${application.id}`,
      { headers: applicantHeaders },
      bindings,
    );
    expect(await decided.json()).toMatchObject({
      application: { assignedPosition: "field", status: "accepted" },
      joinInstructions: "17時45分に施設1階ロビーへ集合してください",
    });
  });

  it("FPとGKの枠を別々に守り、全枠採用で満員にする", async () => {
    const listing = await createListing();
    const field = await createApplication(listing.id, sessionB, "field");
    const keeper = await createApplication(listing.id, sessionC, "keeper");
    const owner = keyFromUrl(listing.manageUrl);
    for (const [application, assignedPosition] of [
      [field, "field"],
      [keeper, "keeper"],
    ] as const) {
      const response = await app.request(
        `/api/listings/${listing.id}/applications/${application.id}`,
        {
          body: JSON.stringify({ assignedPosition, status: "accepted" }),
          headers: { ...jsonHeaders(), "x-suketto-owner": owner },
          method: "PATCH",
        },
        bindings,
      );
      expect(response.status).toBe(200);
    }
    const publicResponse = await app.request(`/api/listings/${listing.id}`, undefined, bindings);
    expect(await publicResponse.json()).toMatchObject({
      listing: { fieldRemaining: 0, keeperRemaining: 0, status: "full" },
    });

    const extra = await app.request(
      `/api/listings/${listing.id}/applications`,
      {
        body: JSON.stringify({
          experience: "basic",
          note: "",
          position: "either",
          website: "",
        }),
        headers: jsonHeaders(sessionD),
        method: "POST",
      },
      bindings,
    );
    expect(extra.status).toBe(409);
  });

  it("同時採用でも1つのFP枠を超えない", async () => {
    const listing = await createListing({ keeperSlots: 0 });
    const first = await createApplication(listing.id, sessionB, "field");
    const second = await createApplication(listing.id, sessionC, "field");
    const ownerHeaders = {
      ...jsonHeaders(),
      "x-suketto-owner": keyFromUrl(listing.manageUrl),
    };
    const responses = await Promise.all(
      [first, second].map(async (application) =>
        app.request(
          `/api/listings/${listing.id}/applications/${application.id}`,
          {
            body: JSON.stringify({ assignedPosition: "field", status: "accepted" }),
            headers: ownerHeaders,
            method: "PATCH",
          },
          bindings,
        ),
      ),
    );
    expect(
      responses.map((response) => response.status).sort((left, right) => left - right),
    ).toEqual([200, 409]);
    const accepted = await bindings.DB.prepare(
      "SELECT COUNT(*) AS count FROM applications WHERE listing_id = ? AND status = 'accepted'",
    )
      .bind(listing.id)
      .first<{ count: number }>();
    expect(Number(accepted?.count ?? 0)).toBe(1);
  });

  it("希望と異なるポジションへの採用を拒否する", async () => {
    const listing = await createListing();
    const application = await createApplication(listing.id, sessionB, "field");
    const response = await app.request(
      `/api/listings/${listing.id}/applications/${application.id}`,
      {
        body: JSON.stringify({ assignedPosition: "keeper", status: "accepted" }),
        headers: {
          ...jsonHeaders(),
          "x-suketto-owner": keyFromUrl(listing.manageUrl),
        },
        method: "PATCH",
      },
      bindings,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "position_mismatch" });
  });

  it("応募者が辞退すると採用枠を再び空ける", async () => {
    const listing = await createListing({ keeperSlots: 0 });
    const application = await createApplication(listing.id, sessionB, "field");
    const applicantKey = keyFromUrl(application.statusUrl);
    await app.request(
      `/api/listings/${listing.id}/applications/${application.id}`,
      {
        body: JSON.stringify({ assignedPosition: "field", status: "accepted" }),
        headers: {
          ...jsonHeaders(),
          "x-suketto-owner": keyFromUrl(listing.manageUrl),
        },
        method: "PATCH",
      },
      bindings,
    );
    const withdrawn = await app.request(
      `/api/applications/${application.id}`,
      {
        headers: { ...jsonHeaders(sessionB), "x-suketto-applicant": applicantKey },
        method: "DELETE",
      },
      bindings,
    );
    expect(withdrawn.status).toBe(204);
    const publicResponse = await app.request(`/api/listings/${listing.id}`, undefined, bindings);
    expect(await publicResponse.json()).toMatchObject({
      listing: { fieldRemaining: 1, status: "open" },
    });
  });

  it("秘密鍵なし・誤った秘密鍵で管理情報と応募状態を返さない", async () => {
    const listing = await createListing();
    const application = await createApplication(listing.id);
    const responses = await Promise.all([
      app.request(`/api/listings/${listing.id}/manage`, undefined, bindings),
      app.request(
        `/api/applications/${application.id}`,
        { headers: { "x-suketto-applicant": "0".repeat(64) } },
        bindings,
      ),
    ]);
    expect(responses.map((response) => response.status)).toEqual([403, 403]);
  });

  it("公開文と応募文への連絡先・URL混入を拒否する", async () => {
    for (const overrides of [
      { publicNote: "連絡は test@example.com へ" },
      { title: "詳細 https://example.com/private" },
      { joinInstructions: "電話 090-1234-5678" },
      { joinInstructions: "集合案内 http://example.com/group" },
      { venueUrl: "https://127.0.0.1/venue" },
    ]) {
      const response = await app.request(
        "/api/listings",
        {
          body: JSON.stringify(validListing(overrides)),
          headers: jsonHeaders(crypto.randomUUID()),
          method: "POST",
        },
        bindings,
      );
      expect(response.status).toBe(400);
    }
    const listing = await createListing();
    const response = await app.request(
      `/api/listings/${listing.id}/applications`,
      {
        body: JSON.stringify({
          experience: "basic",
          note: "連絡先 https://example.com/me",
          position: "either",
          website: "",
        }),
        headers: jsonHeaders(sessionB),
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(400);
  });

  it("作成を1セッション1日3件に制限する", async () => {
    for (let index = 0; index < 3; index += 1) {
      await createListing({ title: `募集 ${index}` });
    }
    const fourth = await app.request(
      "/api/listings",
      {
        body: JSON.stringify(validListing({ title: "募集 4" })),
        headers: jsonHeaders(),
        method: "POST",
      },
      bindings,
    );
    expect(fourth.status).toBe(429);
    expect(await fourth.json()).toMatchObject({ error: "listing_rate_limited" });
  });

  it("同じブラウザから同じ募集への重複応募を拒否する", async () => {
    const listing = await createListing();
    await createApplication(listing.id);
    const duplicate = await app.request(
      `/api/listings/${listing.id}/applications`,
      {
        body: JSON.stringify({
          experience: "basic",
          note: "",
          position: "either",
          website: "",
        }),
        headers: jsonHeaders(sessionB),
        method: "POST",
      },
      bindings,
    );
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ error: "already_applied" });
  });

  it("3ブラウザからの報告で公開一覧から隠す", async () => {
    const listing = await createListing();
    for (const sessionId of [sessionB, sessionC, sessionD]) {
      const response = await app.request(
        `/api/listings/${listing.id}/report`,
        {
          body: JSON.stringify({ reason: "unsafe" }),
          headers: jsonHeaders(sessionId),
          method: "POST",
        },
        bindings,
      );
      expect(response.status).toBe(202);
    }
    expect((await app.request(`/api/listings/${listing.id}`, undefined, bindings)).status).toBe(
      404,
    );
  });

  it("操作イベントは許可名だけ保存し、自動QAを除外する", async () => {
    const automated = await app.request(
      "/api/telemetry?qa=1",
      {
        body: JSON.stringify({ context: "", name: "visited", sessionId: sessionA }),
        headers: jsonHeaders(),
        method: "POST",
      },
      bindings,
    );
    expect(automated.status).toBe(204);
    const database = bindings.DB;
    expect(
      Number(
        (
          await database.prepare("SELECT COUNT(*) AS count FROM product_events").first<{
            count: number;
          }>()
        )?.count ?? 0,
      ),
    ).toBe(0);

    const invalid = await app.request(
      "/api/telemetry",
      {
        body: JSON.stringify({
          context: "search words",
          name: "private_note",
          sessionId: sessionA,
        }),
        headers: jsonHeaders(),
        method: "POST",
      },
      bindings,
    );
    expect(invalid.status).toBe(400);
  });

  it("自動QAによる募集・応募・採用を利用指標へ含めない", async () => {
    const qaHeaders = { ...jsonHeaders(), "x-automated-qa": "1" };
    const createdResponse = await app.request(
      "/api/listings",
      {
        body: JSON.stringify(validListing()),
        headers: qaHeaders,
        method: "POST",
      },
      bindings,
    );
    const listing = await createdResponse.json<{
      id: string;
      manageUrl: string;
    }>();
    const appliedResponse = await app.request(
      `/api/listings/${listing.id}/applications`,
      {
        body: JSON.stringify({
          experience: "basic",
          note: "",
          position: "field",
          website: "",
        }),
        headers: { ...jsonHeaders(sessionB), "x-automated-qa": "1" },
        method: "POST",
      },
      bindings,
    );
    const application = await appliedResponse.json<{ id: string }>();
    await app.request(
      `/api/listings/${listing.id}/applications/${application.id}`,
      {
        body: JSON.stringify({ assignedPosition: "field", status: "accepted" }),
        headers: {
          ...qaHeaders,
          "x-suketto-owner": keyFromUrl(listing.manageUrl),
        },
        method: "PATCH",
      },
      bindings,
    );
    const events = await bindings.DB.prepare("SELECT COUNT(*) AS count FROM product_events").first<{
      count: number;
    }>();
    expect(Number(events?.count ?? 0)).toBe(0);
  });

  it("越境書き込みを拒否し、ヘルスと未定義APIをJSONで返す", async () => {
    const crossSite = await app.request(
      "/api/listings",
      {
        body: JSON.stringify(validListing()),
        headers: { ...jsonHeaders(), origin: "https://evil.example" },
        method: "POST",
      },
      bindings,
    );
    expect(crossSite.status).toBe(403);
    const health = await app.request("/healthz", undefined, bindings);
    expect(await health.json()).toMatchObject({ healthy: true, service: "suketto-court" });
    const missing = await app.request("/api/missing", undefined, bindings);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: "not_found" });
  });
});
