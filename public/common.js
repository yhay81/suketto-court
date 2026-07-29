const SESSION_KEY = "suketto-court:session";
const VISIT_KEY = "suketto-court:last-visit";

export const sessionId = (() => {
  const stored = localStorage.getItem(SESSION_KEY);
  if (/^[0-9a-f-]{36}$/i.test(stored ?? "")) return stored;
  const created = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, created);
  return created;
})();

const errorMessages = {
  already_applied: "このブラウザからは、すでに応募しています。",
  application_limit_reached: "この募集は応募受付数の上限に達しました。",
  application_withdrawn: "この応募はすでに辞退されています。",
  contact_not_allowed_in_accessNote: "会場補足に連絡先やURLは書けません。",
  contact_not_allowed_in_bring: "持ち物に連絡先やURLは書けません。",
  contact_not_allowed_in_cancellationPolicy: "キャンセル条件に連絡先やURLは書けません。",
  contact_not_allowed_in_city: "市区町村に連絡先やURLは書けません。",
  contact_not_allowed_in_note: "一言に連絡先やURLは書けません。",
  contact_not_allowed_in_prefecture: "都道府県に連絡先やURLは書けません。",
  contact_not_allowed_in_publicNote: "公開補足に連絡先やURLは書けません。",
  contact_not_allowed_in_teamLabel: "主催名に連絡先やURLは書けません。",
  contact_not_allowed_in_title: "見出しに連絡先やURLは書けません。",
  contact_not_allowed_in_venue: "施設名に連絡先やURLは書けません。",
  event_started: "開始済みの募集は再開できません。",
  invalid_capability: "この確認URLの秘密鍵を確認できません。URLを省略せず開いてください。",
  invalid_event_time: "開始は2時間後から90日以内、開催時間は30分から6時間にしてください。",
  invalid_joinInstructions: "採用者向けの参加案内を入力してください。",
  invalid_public_url: "URLは公開HTTPSページを指定してください。ローカル・社内向けURLは使えません。",
  invalid_request: "入力内容を確認してください。",
  listing_full: "この募集は満員になりました。",
  listing_hidden: "報告により非公開となった募集は再開できません。",
  listing_rate_limited: "募集の作成は1日3件までです。",
  listing_unavailable: "この募集では採用操作ができません。",
  no_open_slots: "FPまたはGKの残枠を1以上にしてください。",
  not_found: "募集または応募札が見つかりません。",
  personal_contact_not_allowed: "参加案内に氏名・メール・電話番号は書けません。",
  contact_not_allowed_in_joinInstructions: "参加案内にメールアドレスや電話番号は書けません。",
  position_full: "そのポジションは満員です。",
  position_mismatch: "応募者の希望と異なるポジションには採用できません。",
  spam_rejected: "送信できませんでした。",
};

export function fragmentKey() {
  const key = new URLSearchParams(location.hash.slice(1)).get("key") ?? "";
  return /^[0-9a-f]{64}$/.test(key) ? key : "";
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("X-Suketto-Session", sessionId);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
  });
  if (!response.ok) {
    let code = "invalid_request";
    try {
      code = (await response.json()).error ?? code;
    } catch {
      // Keep the generic message for non-JSON failures.
    }
    const error = new Error(
      errorMessages[code] ?? "処理を完了できませんでした。少し待って再度お試しください。",
    );
    error.code = code;
    throw error;
  }
  if (response.status === 204 || response.status === 202) return null;
  return response.json();
}

export async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

export function formatDateRange(startsAt, endsAt) {
  const date = new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(startsAt * 1000));
  const time = (value) =>
    new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    }).format(new Date(value * 1000));
  return `${date} ${time(startsAt)}–${time(endsAt)}`;
}

export function setMessage(element, message, kind = "") {
  element.textContent = message;
  element.dataset.kind = kind;
}

export function textBlock(title, value) {
  if (!value) return null;
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const paragraph = document.createElement("p");
  heading.textContent = title;
  paragraph.textContent = value;
  section.append(heading, paragraph);
  return section;
}

export function sendTelemetry(name, context = "") {
  if (new URLSearchParams(location.search).get("qa") === "1") return;
  void api("/api/telemetry", { body: { context, name, sessionId }, method: "POST" }).catch(
    () => undefined,
  );
}

const today = new Date().toISOString().slice(0, 10);
const previousVisit = localStorage.getItem(VISIT_KEY);
sendTelemetry("visited");
if (previousVisit && previousVisit !== today) sendTelemetry("returned");
localStorage.setItem(VISIT_KEY, today);
