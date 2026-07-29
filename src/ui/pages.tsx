import { product } from "../config/product";
import { Layout } from "./layout";

export type DirectoryListing = {
  beginnerWelcome: boolean;
  city: string;
  endsAt: number;
  feeYen: number;
  fieldRemaining: number;
  id: string;
  keeperRemaining: number;
  prefecture: string;
  startsAt: number;
  status: "full" | "open";
  style: "beginner" | "competitive" | "enjoy" | "mix";
  teamLabel: string;
  title: string;
  venue: string;
  womenWelcome: boolean;
};

const styleLabels = {
  beginner: "はじめて中心",
  competitive: "競技志向",
  enjoy: "エンジョイ",
  mix: "MIX",
} as const;

const formatDay = (timestamp: number) =>
  new Intl.DateTimeFormat("ja-JP", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(new Date(timestamp * 1000));

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(timestamp * 1000));

function CourtStage() {
  return (
    <section aria-label="空いたFPとGKの枠へ助っ人が入るイメージ" class="court-stage">
      <div aria-hidden="true" class="court-lines">
        <i class="goal left"></i>
        <i class="center-circle"></i>
        <i class="goal right"></i>
        <span class="ball"></span>
      </div>
      <div aria-hidden="true" class="vacancy-board">
        <small>ONE GAME / OPEN SLOTS</small>
        <div>
          <span class="bib field">FP</span>
          <strong>あと 2</strong>
        </div>
        <div>
          <span class="bib keeper">GK</span>
          <strong>あと 1</strong>
        </div>
        <p>
          <i></i>土 18:00
          <i></i>エンジョイ
          <i></i>¥1,200
        </p>
      </div>
      <div aria-hidden="true" class="entry-lane">
        <span class="cone"></span>
        <i></i>
        <i></i>
        <i></i>
      </div>
      <div aria-hidden="true" class="helper-pair">
        <article>
          <span>FP</span>
          <i></i>
          <b>参加OK</b>
        </article>
        <article>
          <span>GK</span>
          <i></i>
          <b>確認中</b>
        </article>
      </div>
    </section>
  );
}

function ListingCard({ listing }: { listing: DirectoryListing }) {
  return (
    <article class="listing-card" data-style={listing.style}>
      <a aria-label={`${listing.title}の募集を見る`} href={`/games/${listing.id}`}>
        <header>
          <time datetime={new Date(listing.startsAt * 1000).toISOString()}>
            <strong>{formatDay(listing.startsAt)}</strong>
            <span>
              {formatTime(listing.startsAt)}–{formatTime(listing.endsAt)}
            </span>
          </time>
          <span class={listing.status === "full" ? "freshness full" : "freshness"}>
            {listing.status === "full" ? "満員" : "募集中"}
          </span>
        </header>
        <div class="listing-place">
          <span>
            {listing.prefecture} {listing.city}
          </span>
          <strong>{listing.venue}</strong>
        </div>
        <h3>{listing.title}</h3>
        {listing.teamLabel ? <p>{listing.teamLabel}</p> : null}
        <div class="slot-row">
          <span class="slot field">
            FP <b>{listing.fieldRemaining}</b>
          </span>
          <span class="slot keeper">
            GK <b>{listing.keeperRemaining}</b>
          </span>
          <span class="fee">¥{listing.feeYen.toLocaleString("ja-JP")}</span>
        </div>
        <div class="fact-row">
          <span>{styleLabels[listing.style]}</span>
          {listing.beginnerWelcome ? <span>初心者歓迎</span> : null}
          {listing.womenWelcome ? <span>女性歓迎</span> : null}
        </div>
      </a>
    </article>
  );
}

export function HomePage({
  listings,
  selectedPrefecture = "",
  selectedStyle = "",
}: {
  listings: DirectoryListing[];
  selectedPrefecture?: string;
  selectedStyle?: string;
}) {
  return (
    <Layout>
      <CourtStage />
      <section class="directory-shell">
        <header class="directory-heading">
          <div>
            <span class="eyebrow">FRESH FUTSAL SLOTS</span>
            <h1>{product.headline}</h1>
            <p>未来の一開催だけ。FP/GKの残枠と条件を見て、匿名の確認札から応募できます。</p>
          </div>
          <a class="button accent" href="#recruit">
            募集枠をつくる
          </a>
        </header>
        <form action="/" class="directory-filter" method="get">
          <label>
            <span>都道府県</span>
            <input
              maxlength={12}
              name="prefecture"
              placeholder="例：東京都"
              value={selectedPrefecture}
            />
          </label>
          <label>
            <span>雰囲気</span>
            <select name="style">
              <option value="">すべて</option>
              {Object.entries(styleLabels).map(([value, label]) => (
                <option selected={selectedStyle === value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">絞り込む</button>
          {selectedPrefecture || selectedStyle ? <a href="/">条件を戻す</a> : null}
        </form>
        {listings.length > 0 ? (
          <div class="listing-grid">
            {listings.map((listing) => (
              <ListingCard listing={listing} />
            ))}
          </div>
        ) : (
          <div class="empty-directory">
            <span aria-hidden="true" class="empty-goal"></span>
            <strong>条件に合う未来の募集はまだありません</strong>
            <p>最初の一開催を作り、いつもの仲間や募集投稿へURLを置けます。</p>
          </div>
        )}
      </section>

      <section class="recruit-shell" id="recruit">
        <div class="recruit-intro">
          <span class="eyebrow">OPEN ONE COURT</span>
          <h2>一開催の空きだけを出す。</h2>
          <ol>
            <li>
              <span>01</span>日時と残りポジション
            </li>
            <li>
              <span>02</span>レベルと参加条件
            </li>
            <li>
              <span>03</span>採用者だけに参加案内
            </li>
          </ol>
          <div class="privacy-bibs">
            <span>氏名なし</span>
            <span>公開連絡先なし</span>
            <span>現地精算</span>
          </div>
        </div>
        <form class="recruit-form" id="create-form">
          <header>
            <span aria-hidden="true" class="form-ball"></span>
            <div>
              <span class="eyebrow">NEW GAME</span>
              <h2>募集枠をつくる</h2>
            </div>
          </header>
          <label class="field">
            <span>募集の見出し</span>
            <input
              id="title"
              maxlength={80}
              placeholder="土曜夕方、エンジョイゲームの助っ人"
              required
            />
          </label>
          <label class="field">
            <span>
              チーム・主催名 <small>任意</small>
            </span>
            <input id="team-label" maxlength={60} placeholder="西町フットサル" />
          </label>
          <div class="field-grid two">
            <label class="field">
              <span>開始</span>
              <input id="starts-at" required type="datetime-local" />
            </label>
            <label class="field">
              <span>終了</span>
              <input id="ends-at" required type="datetime-local" />
            </label>
          </div>
          <div class="field-grid two">
            <label class="field">
              <span>都道府県</span>
              <input id="prefecture" maxlength={12} placeholder="東京都" required />
            </label>
            <label class="field">
              <span>市区町村</span>
              <input id="city" maxlength={40} placeholder="江東区" required />
            </label>
          </div>
          <label class="field">
            <span>公開施設名</span>
            <input id="venue" maxlength={80} placeholder="東砂スポーツセンター" required />
          </label>
          <label class="field">
            <span>
              施設の公開URL <small>任意・HTTPS</small>
            </span>
            <input id="venue-url" inputmode="url" maxlength={500} placeholder="https://..." />
          </label>
          <label class="field">
            <span>
              会場までの補足 <small>任意</small>
            </span>
            <input
              id="access-note"
              maxlength={240}
              placeholder="東口から徒歩5分。施設駐車場はありません。"
            />
          </label>
          <div class="field-grid two">
            <label class="field">
              <span>雰囲気</span>
              <select id="style" required>
                <option value="beginner">はじめて中心</option>
                <option selected value="enjoy">
                  エンジョイ
                </option>
                <option value="mix">MIX</option>
                <option value="competitive">競技志向</option>
              </select>
            </label>
            <label class="field">
              <span>最低経験</span>
              <select id="minimum-experience" required>
                <option value="first_time">未経験OK</option>
                <option selected value="basic">
                  基本ルールが分かる
                </option>
                <option value="experienced">定期的にプレー</option>
                <option value="league">競技・リーグ経験</option>
              </select>
            </label>
          </div>
          <div class="field-grid three">
            <label class="field">
              <span>FP残枠</span>
              <input id="field-slots" max={30} min={0} required type="number" value={2} />
            </label>
            <label class="field">
              <span>GK残枠</span>
              <input id="keeper-slots" max={10} min={0} required type="number" value={1} />
            </label>
            <label class="field">
              <span>参加費（円）</span>
              <input
                id="fee-yen"
                max={10000}
                min={0}
                required
                step={100}
                type="number"
                value={1200}
              />
            </label>
          </div>
          <div class="field-grid three">
            <label class="field">
              <span>コート</span>
              <select id="surface">
                <option value="indoor">屋内</option>
                <option value="outdoor">屋外</option>
                <option value="unknown">未確認</option>
              </select>
            </label>
            <label class="check-field">
              <input checked id="beginner-welcome" type="checkbox" />
              <span>初心者歓迎</span>
            </label>
            <label class="check-field">
              <input checked id="women-welcome" type="checkbox" />
              <span>女性歓迎</span>
            </label>
          </div>
          <label class="field">
            <span>
              持ち物 <small>任意</small>
            </span>
            <textarea
              id="bring"
              maxlength={240}
              placeholder="屋内用シューズ、白と濃色のシャツ。ビブスとボールはあります。"
              rows={3}
            ></textarea>
          </label>
          <label class="field">
            <span>キャンセルの約束</span>
            <textarea
              id="cancellation-policy"
              maxlength={240}
              placeholder="前日18時までに確認札から辞退してください。当日の無断欠席は避けてください。"
              required
              rows={3}
            ></textarea>
          </label>
          <label class="field">
            <span>
              公開する補足 <small>任意</small>
            </span>
            <textarea
              id="public-note"
              maxlength={600}
              placeholder="強い接触プレーや勧誘行為はありません。ゲーム中心で休憩を挟みます。"
              rows={4}
            ></textarea>
          </label>
          <label class="field private-field">
            <span>採用者だけに見せる参加案内</span>
            <textarea
              id="join-instructions"
              maxlength={600}
              placeholder="17:45に施設1階ロビーへ。受付で『西町フットサル』と伝えてください。"
              required
              rows={4}
            ></textarea>
            <small>
              氏名・個人メール・電話番号は入れず、集合場所や公開グループURLを記載します。
            </small>
          </label>
          <label aria-hidden="true" class="honeypot">
            Website
            <input id="website" tabindex={-1} />
          </label>
          <button class="button primary" id="create-button" type="submit">
            募集枠を公開する
          </button>
          <p aria-live="polite" class="action-status" id="create-status"></p>
        </form>
      </section>
      <script src="/common.js?v=1" type="module"></script>
      <script src="/home.js?v=1" type="module"></script>
    </Layout>
  );
}

export function ListingPage({ listing }: { listing: DirectoryListing }) {
  return (
    <Layout
      bodyClass="private-page"
      canonical={`${product.url}/games/${listing.id}`}
      noindex
      title={`${listing.title} | ${product.name}`}
    >
      <section class="game-shell" data-listing-id={listing.id} id="game-app">
        <header class="game-heading">
          <div>
            <span class="eyebrow">OPEN FUTSAL SLOT</span>
            <h1>{listing.title}</h1>
            <p>
              {formatDay(listing.startsAt)} {formatTime(listing.startsAt)}–
              {formatTime(listing.endsAt)} · {listing.prefecture} {listing.city}
            </p>
          </div>
          <span class={listing.status === "full" ? "freshness full" : "freshness"} id="game-status">
            {listing.status === "full" ? "満員" : "募集中"}
          </span>
        </header>
        <div class="game-grid">
          <section class="game-board">
            <div aria-hidden="true" class="mini-court">
              <i></i>
              <b></b>
              <em></em>
            </div>
            <dl id="game-facts">
              <div>
                <dt>会場</dt>
                <dd id="game-venue">{listing.venue}</dd>
              </div>
              <div>
                <dt>雰囲気</dt>
                <dd id="game-style">{styleLabels[listing.style]}</dd>
              </div>
              <div>
                <dt>参加費</dt>
                <dd>¥{listing.feeYen.toLocaleString("ja-JP")}</dd>
              </div>
            </dl>
            <div class="big-slots">
              <span class="slot field">
                FP 残り <b id="field-remaining">{listing.fieldRemaining}</b>
              </span>
              <span class="slot keeper">
                GK 残り <b id="keeper-remaining">{listing.keeperRemaining}</b>
              </span>
            </div>
            <section class="game-notes" id="game-notes"></section>
          </section>
          <form class="apply-form" id="apply-form">
            <header>
              <span class="eyebrow">TAKE A SLOT</span>
              <h2>匿名の確認札で応募</h2>
              <p>名前や連絡先は不要です。採否は発行される確認URLで見ます。</p>
            </header>
            <label class="field">
              <span>希望ポジション</span>
              <select id="position" required>
                <option value="either">どちらでも</option>
                <option value="field">FP</option>
                <option value="keeper">GK</option>
              </select>
            </label>
            <label class="field">
              <span>経験</span>
              <select id="experience" required>
                <option value="first_time">ほぼ初めて</option>
                <option value="basic">基本ルールが分かる</option>
                <option value="experienced">定期的にプレー</option>
                <option value="league">競技・リーグ経験</option>
              </select>
            </label>
            <label class="field">
              <span>
                主催者への一言 <small>任意</small>
              </span>
              <textarea
                id="application-note"
                maxlength={240}
                placeholder="FP希望です。月1回ほどエンジョイで参加しています。"
                rows={4}
              ></textarea>
            </label>
            <label aria-hidden="true" class="honeypot">
              Website
              <input id="application-website" tabindex={-1} />
            </label>
            <button class="button primary" id="apply-button" type="submit">
              応募して確認札を受け取る
            </button>
            <p aria-live="polite" class="action-status" id="apply-status"></p>
          </form>
        </div>
        <button class="report-link" id="report-button" type="button">
          この募集を報告
        </button>
      </section>
      <script src="/common.js?v=1" type="module"></script>
      <script src="/listing.js?v=1" type="module"></script>
    </Layout>
  );
}

export function ApplicationPage({ applicationId }: { applicationId: string }) {
  return (
    <Layout
      bodyClass="private-page"
      canonical={`${product.url}/applications/${applicationId}`}
      noindex
      title={`応募の確認札 | ${product.name}`}
    >
      <section class="status-shell" data-application-id={applicationId} id="application-app">
        <header>
          <span aria-hidden="true" class="status-bib"></span>
          <div>
            <span class="eyebrow">PRIVATE STATUS CARD</span>
            <h1>応募の確認札</h1>
            <p>このURLを残しておくと、採否と参加案内を確認できます。</p>
          </div>
        </header>
        <section class="status-card" id="status-card">
          <span class="status-light" id="status-light"></span>
          <div>
            <small id="status-label">読み込んでいます</small>
            <h2 id="status-title">募集を確認中</h2>
            <p id="status-meta"></p>
          </div>
        </section>
        <section class="accepted-note" hidden id="accepted-note">
          <span class="eyebrow">JOIN INSTRUCTIONS</span>
          <h2>参加案内</h2>
          <p id="join-instructions"></p>
          <button class="button" id="copy-instructions" type="button">
            案内をコピー
          </button>
        </section>
        <section class="status-actions">
          <button class="button" id="refresh-status" type="button">
            状態を更新
          </button>
          <button class="button danger" id="withdraw-button" type="button">
            応募を辞退
          </button>
          <p aria-live="polite" class="action-status" id="status-message"></p>
        </section>
      </section>
      <script src="/common.js?v=1" type="module"></script>
      <script src="/application.js?v=1" type="module"></script>
    </Layout>
  );
}

export function ManagePage({ listingId }: { listingId: string }) {
  return (
    <Layout
      bodyClass="private-page"
      canonical={`${product.url}/manage/${listingId}`}
      noindex
      title={`募集の管理 | ${product.name}`}
    >
      <section class="manage-shell" data-listing-id={listingId} id="manage-app">
        <header class="manage-heading">
          <div>
            <span class="eyebrow">ORGANIZER DESK</span>
            <h1 id="manage-title">募集を読み込んでいます</h1>
            <p id="manage-meta"></p>
          </div>
          <a class="button" href="#" id="public-link">
            公開募集を見る
          </a>
        </header>
        <div class="manage-grid">
          <section class="slot-control">
            <span class="eyebrow">COURT CAPACITY</span>
            <div class="big-slots">
              <span class="slot field">
                FP 残り <b id="manage-field">—</b>
              </span>
              <span class="slot keeper">
                GK 残り <b id="manage-keeper">—</b>
              </span>
            </div>
            <div class="listing-controls">
              <button class="button danger" id="cancel-listing" type="button">
                募集を中止
              </button>
              <button class="button" hidden id="reopen-listing" type="button">
                募集を再開
              </button>
            </div>
          </section>
          <section class="applicant-panel">
            <header>
              <div>
                <span class="eyebrow">APPLICATIONS</span>
                <h2>応募札</h2>
              </div>
              <strong id="applicant-count">0</strong>
            </header>
            <div class="applicant-list" id="applicant-list"></div>
          </section>
          <section class="share-panel">
            <span class="eyebrow">SHARE THIS GAME</span>
            <h2>募集URLを置く</h2>
            <textarea id="share-text" readonly rows={4}></textarea>
            <button class="button accent" id="copy-share" type="button">
              募集文をコピー
            </button>
            <p aria-live="polite" class="action-status" id="manage-status"></p>
          </section>
        </div>
        <section class="danger-zone">
          <div>
            <strong>募集を削除</strong>
            <p>募集、応募札、報告をすべて削除します。元に戻せません。</p>
          </div>
          <button class="button danger" id="delete-listing" type="button">
            削除する
          </button>
        </section>
      </section>
      <script src="/common.js?v=1" type="module"></script>
      <script src="/manage.js?v=1" type="module"></script>
    </Layout>
  );
}

export function GuidePage() {
  return (
    <Layout canonical={`${product.url}/guide`} title={`使い方 | ${product.name}`}>
      <article class="guide-board">
        <header>
          <span class="eyebrow">ONE GAME / THREE CARDS</span>
          <h1>募集、応募、採用を一開催で閉じる。</h1>
        </header>
        <ol class="guide-steps">
          <li>
            <span class="guide-icon board"></span>
            <div>
              <small>01</small>
              <strong>未来の一開催を公開</strong>
              <p>日時、公開施設、レベル、参加費、FP/GK残枠を置きます。終了後は一覧から消えます。</p>
            </div>
          </li>
          <li>
            <span class="guide-icon bib"></span>
            <div>
              <small>02</small>
              <strong>匿名の確認札で応募</strong>
              <p>応募者は希望ポジションと経験だけを伝え、発行された確認URLを残します。</p>
            </div>
          </li>
          <li>
            <span class="guide-icon whistle"></span>
            <div>
              <small>03</small>
              <strong>採用者だけに参加案内</strong>
              <p>主催者がFP/GKへ採用すると、確認札に集合場所などの案内が現れます。</p>
            </div>
          </li>
        </ol>
        <section class="guide-note">
          <strong>安全は募集文だけでは決まりません</strong>
          <p>
            施設の利用規則を守り、強い接触、無断欠席、勧誘、参加費未払いを避けてください。危険を感じた場合は参加せず、施設や関係機関へ相談してください。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function PrivacyPage() {
  return (
    <Layout canonical={`${product.url}/privacy`} title={`プライバシー | ${product.name}`}>
      <article class="prose">
        <header>
          <span class="eyebrow">MINIMUM PLAYER DATA</span>
          <h1>参加に不要な身元を、応募札へ持ち込まない。</h1>
        </header>
        <section>
          <h2>公開される情報</h2>
          <p>
            募集の見出し、任意のチーム名、都道府県、市区町村、公開施設、日時、レベル、参加費、残枠、持ち物、キャンセル条件、公開補足です。
          </p>
        </section>
        <section>
          <h2>応募で扱う情報</h2>
          <p>
            希望ポジション、経験、短い一言、採否だけです。氏名、メール、電話番号、年齢、性別、写真、恒久プロフィールは求めません。
          </p>
        </section>
        <section>
          <h2>秘密のURL</h2>
          <p>
            主催者の管理URLと応募者の確認URLは十分に長い秘密を含みます。秘密はURLの#以降に置かれ、サーバーにはハッシュだけを保存します。URLを他人へ渡さないでください。
          </p>
        </section>
        <section>
          <h2>保存期間</h2>
          <p>
            募集、応募、報告は開催終了から30日以内に削除します。匿名の操作イベントは45日で削除します。自動テストは利用指標へ含めません。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function NotFoundPage() {
  return (
    <Layout title={`見つかりません | ${product.name}`}>
      <section class="not-found">
        <span aria-hidden="true" class="empty-goal"></span>
        <h1>この募集札は見つかりません。</h1>
        <a class="button" href="/">
          助っ人コートへ戻る
        </a>
      </section>
    </Layout>
  );
}
