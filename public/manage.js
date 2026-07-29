import { api, copyText, formatDateRange, fragmentKey, setMessage } from "./common.js";

const root = document.querySelector("#manage-app");
const listingId = root.dataset.listingId;
const key = fragmentKey();
const statusMessage = document.querySelector("#manage-status");
const applicantList = document.querySelector("#applicant-list");
const experienceLabels = {
  basic: "基本ルールが分かる",
  experienced: "定期的にプレー",
  first_time: "ほぼ初めて",
  league: "競技・リーグ経験",
};
const positionLabels = { either: "FP/GKどちらでも", field: "FP希望", keeper: "GK希望" };
const stateLabels = {
  accepted: "採用",
  declined: "見送り",
  pending: "確認待ち",
  waitlist: "キャンセル待ち",
  withdrawn: "辞退",
};

const ownerHeaders = () => ({ "X-Suketto-Owner": key });

function actionButton(label, action, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `mini-action ${className}`.trim();
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

async function decide(applicationId, status, assignedPosition = "") {
  try {
    await api(`/api/listings/${listingId}/applications/${applicationId}`, {
      body: { assignedPosition, status },
      headers: ownerHeaders(),
      method: "PATCH",
    });
    await loadManage();
  } catch (error) {
    setMessage(statusMessage, error.message, "error");
  }
}

function renderApplicant(application, index) {
  const card = document.createElement("article");
  card.className = "applicant-card";
  const heading = document.createElement("header");
  const number = document.createElement("span");
  number.textContent = String(index + 1).padStart(2, "0");
  const identity = document.createElement("div");
  const title = document.createElement("strong");
  const state = document.createElement("small");
  title.textContent = `${positionLabels[application.position]} · ${experienceLabels[application.experience]}`;
  state.textContent = stateLabels[application.status];
  state.dataset.state = application.status;
  identity.append(title, state);
  heading.append(number, identity);
  card.append(heading);
  if (application.note) {
    const note = document.createElement("p");
    note.textContent = application.note;
    card.append(note);
  }
  if (application.status !== "withdrawn") {
    const actions = document.createElement("div");
    actions.className = "applicant-actions";
    if (application.position !== "keeper") {
      actions.append(
        actionButton("FPで採用", () => decide(application.id, "accepted", "field"), "field"),
      );
    }
    if (application.position !== "field") {
      actions.append(
        actionButton("GKで採用", () => decide(application.id, "accepted", "keeper"), "keeper"),
      );
    }
    actions.append(
      actionButton("待機", () => decide(application.id, "waitlist")),
      actionButton("見送り", () => decide(application.id, "declined"), "muted"),
    );
    card.append(actions);
  }
  return card;
}

function render(data) {
  const { listing, applications } = data;
  document.querySelector("#manage-title").textContent = listing.title;
  document.querySelector("#manage-meta").textContent =
    `${formatDateRange(listing.startsAt, listing.endsAt)} · ${listing.prefecture} ${listing.city} · ${listing.venue}`;
  document.querySelector("#manage-field").textContent = listing.fieldRemaining;
  document.querySelector("#manage-keeper").textContent = listing.keeperRemaining;
  document.querySelector("#applicant-count").textContent = applications.length;
  document.querySelector("#public-link").href = `/games/${listing.id}`;
  document.querySelector("#cancel-listing").hidden = listing.status === "cancelled";
  document.querySelector("#reopen-listing").hidden = listing.status !== "cancelled";
  const publicUrl = `${location.origin}/games/${listing.id}`;
  document.querySelector("#share-text").value =
    `${listing.title}\n${formatDateRange(listing.startsAt, listing.endsAt)} / ${listing.prefecture} ${listing.city}\nFP残り${listing.fieldRemaining}・GK残り${listing.keeperRemaining} / ${listing.feeYen.toLocaleString("ja-JP")}円\n${publicUrl}`;
  applicantList.replaceChildren();
  if (applications.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-applicants";
    empty.textContent = "応募札が届くと、ここでFP/GKへの採否を決められます。";
    applicantList.append(empty);
  } else {
    applications.forEach((application, index) =>
      applicantList.append(renderApplicant(application, index)),
    );
  }
}

async function loadManage() {
  if (!key) {
    setMessage(
      statusMessage,
      "URLの#以降にある管理鍵がありません。作成時のURLを省略せず開いてください。",
      "error",
    );
    return;
  }
  try {
    const data = await api(`/api/listings/${listingId}/manage`, { headers: ownerHeaders() });
    render(data);
    setMessage(statusMessage, "最新の応募状況です。", "success");
  } catch (error) {
    setMessage(statusMessage, error.message, "error");
  }
}

async function changeStatus(status) {
  try {
    await api(`/api/listings/${listingId}/status`, {
      body: { status },
      headers: ownerHeaders(),
      method: "PATCH",
    });
    await loadManage();
  } catch (error) {
    setMessage(statusMessage, error.message, "error");
  }
}

document.querySelector("#cancel-listing").addEventListener("click", () => {
  if (confirm("この開催の募集を中止しますか？応募者の確認札にも中止が表示されます。")) {
    void changeStatus("cancelled");
  }
});
document.querySelector("#reopen-listing").addEventListener("click", () => changeStatus("open"));
document.querySelector("#copy-share").addEventListener("click", async () => {
  await copyText(document.querySelector("#share-text").value);
  setMessage(statusMessage, "募集文をコピーしました。", "success");
});
document.querySelector("#delete-listing").addEventListener("click", async () => {
  if (!confirm("募集とすべての応募札を削除します。元に戻せません。削除しますか？")) return;
  try {
    await api(`/api/listings/${listingId}`, {
      headers: ownerHeaders(),
      method: "DELETE",
    });
    location.assign("/");
  } catch (error) {
    setMessage(statusMessage, error.message, "error");
  }
});

void loadManage();
