import { api, sendTelemetry, setMessage, textBlock } from "./common.js";

const root = document.querySelector("#game-app");
const listingId = root.dataset.listingId;
const form = document.querySelector("#apply-form");
const button = document.querySelector("#apply-button");
const status = document.querySelector("#apply-status");
let currentListing;

const labels = {
  basic: "基本ルールが分かる",
  competitive: "競技志向",
  enjoy: "エンジョイ",
  experienced: "定期的にプレー",
  first_time: "未経験OK",
  indoor: "屋内",
  league: "競技・リーグ経験",
  mix: "MIX",
  outdoor: "屋外",
  unknown: "未確認",
};

function renderListing(listing) {
  currentListing = listing;
  document.querySelector("#field-remaining").textContent = listing.fieldRemaining;
  document.querySelector("#keeper-remaining").textContent = listing.keeperRemaining;
  const statusPill = document.querySelector("#game-status");
  statusPill.textContent = listing.status === "full" ? "満員" : "募集中";
  statusPill.classList.toggle("full", listing.status === "full");
  button.disabled = listing.status === "full";
  if (listing.status === "full") button.textContent = "現在は満員です";

  const venue = document.querySelector("#game-venue");
  venue.textContent = "";
  if (listing.venueUrl) {
    const link = document.createElement("a");
    link.href = listing.venueUrl;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    link.textContent = listing.venue;
    venue.append(link);
  } else {
    venue.textContent = listing.venue;
  }
  const notes = document.querySelector("#game-notes");
  notes.replaceChildren();
  const entries = [
    ["参加条件", labels[listing.minimumExperience]],
    ["コート", labels[listing.surface]],
    ["会場まで", listing.accessNote],
    ["持ち物", listing.bring],
    ["キャンセル", listing.cancellationPolicy],
    ["主催者から", listing.publicNote],
  ];
  for (const [title, value] of entries) {
    const block = textBlock(title, value);
    if (block) notes.append(block);
  }
}

api(`/api/listings/${listingId}`)
  .then(({ listing }) => renderListing(listing))
  .catch((error) => setMessage(status, error.message, "error"));
sendTelemetry("listing_opened", listingId);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  setMessage(status, "確認札を発行しています…");
  try {
    const result = await api(`/api/listings/${listingId}/applications`, {
      body: {
        experience: document.querySelector("#experience").value,
        note: document.querySelector("#application-note").value,
        position: document.querySelector("#position").value,
        website: document.querySelector("#application-website").value,
      },
      method: "POST",
    });
    location.assign(result.statusUrl);
  } catch (error) {
    setMessage(status, error.message, "error");
    button.disabled = currentListing?.status === "full";
  }
});

document.querySelector("#report-button").addEventListener("click", async () => {
  const confirmed = confirm(
    "迷惑な募集、危険な内容、サービスの目的と異なる募集として報告しますか？",
  );
  if (!confirmed) return;
  try {
    await api(`/api/listings/${listingId}/report`, {
      body: { reason: "unsafe" },
      method: "POST",
    });
    document.querySelector("#report-button").textContent = "報告を受け付けました";
    document.querySelector("#report-button").disabled = true;
  } catch (error) {
    setMessage(status, error.message, "error");
  }
});
