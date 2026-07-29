import { api, copyText, formatDateRange, fragmentKey, setMessage } from "./common.js";

const root = document.querySelector("#application-app");
const applicationId = root.dataset.applicationId;
const key = fragmentKey();
const message = document.querySelector("#status-message");
const acceptedNote = document.querySelector("#accepted-note");
let currentInstructions = "";

const statusCopy = {
  accepted: ["参加OK", "採用されました", "accepted"],
  declined: ["今回は見送り", "別の募集も確認できます", "declined"],
  pending: ["主催者の確認中", "採否が決まるまで、この札を残してください", "pending"],
  waitlist: ["キャンセル待ち", "空きが出ると主催者が採用へ変更します", "waitlist"],
  withdrawn: ["辞退済み", "この応募は取り下げられました", "withdrawn"],
};

async function loadStatus() {
  if (!key) {
    setMessage(
      message,
      "URLの#以降にある秘密鍵がありません。受け取ったURLを省略せず開いてください。",
      "error",
    );
    return;
  }
  try {
    const result = await api(`/api/applications/${applicationId}`, {
      headers: { "X-Suketto-Applicant": key },
    });
    const [label, title, className] = statusCopy[result.application.status];
    document.querySelector("#status-label").textContent = label;
    document.querySelector("#status-title").textContent = title;
    document.querySelector("#status-meta").textContent =
      `${formatDateRange(result.listing.startsAt, result.listing.endsAt)} · ${result.listing.prefecture} ${result.listing.city} · ${result.listing.venue}`;
    document.querySelector("#status-light").className = `status-light ${className}`;
    acceptedNote.hidden = result.application.status !== "accepted";
    currentInstructions = result.joinInstructions;
    document.querySelector("#join-instructions").textContent = currentInstructions;
    document.querySelector("#withdraw-button").disabled =
      result.application.status === "withdrawn" || result.listing.status === "cancelled";
    if (result.listing.status === "cancelled") {
      setMessage(message, "主催者がこの開催を中止しました。", "error");
    } else {
      setMessage(message, "最新の状態です。", "success");
    }
  } catch (error) {
    setMessage(message, error.message, "error");
  }
}

document.querySelector("#refresh-status").addEventListener("click", loadStatus);
document.querySelector("#copy-instructions").addEventListener("click", async () => {
  await copyText(currentInstructions);
  setMessage(message, "参加案内をコピーしました。", "success");
});
document.querySelector("#withdraw-button").addEventListener("click", async () => {
  if (!confirm("この応募を辞退しますか？")) return;
  try {
    await api(`/api/applications/${applicationId}`, {
      headers: { "X-Suketto-Applicant": key },
      method: "DELETE",
    });
    await loadStatus();
  } catch (error) {
    setMessage(message, error.message, "error");
  }
});

void loadStatus();
