import { api, setMessage } from "./common.js";

const form = document.querySelector("#create-form");
const button = document.querySelector("#create-button");
const status = document.querySelector("#create-status");
const value = (id) => document.querySelector(`#${id}`).value;
const checked = (id) => document.querySelector(`#${id}`).checked;
const integer = (id) => Number.parseInt(value(id), 10);
const timestamp = (id) => Math.floor(new Date(value(id)).getTime() / 1000);

function setSuggestedTimes() {
  const starts = document.querySelector("#starts-at");
  const ends = document.querySelector("#ends-at");
  const start = new Date(Date.now() + 3 * 3600_000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 2 * 3600_000);
  const localValue = (date) => {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };
  starts.value = localValue(start);
  ends.value = localValue(end);
}

setSuggestedTimes();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  setMessage(status, "コート札を用意しています…");
  try {
    const result = await api("/api/listings", {
      body: {
        accessNote: value("access-note"),
        beginnerWelcome: checked("beginner-welcome"),
        bring: value("bring"),
        cancellationPolicy: value("cancellation-policy"),
        city: value("city"),
        endsAt: timestamp("ends-at"),
        feeYen: integer("fee-yen"),
        fieldSlots: integer("field-slots"),
        joinInstructions: value("join-instructions"),
        keeperSlots: integer("keeper-slots"),
        minimumExperience: value("minimum-experience"),
        prefecture: value("prefecture"),
        publicNote: value("public-note"),
        startsAt: timestamp("starts-at"),
        style: value("style"),
        surface: value("surface"),
        teamLabel: value("team-label"),
        title: value("title"),
        venue: value("venue"),
        venueUrl: value("venue-url"),
        website: value("website"),
        womenWelcome: checked("women-welcome"),
      },
      method: "POST",
    });
    location.assign(result.manageUrl);
  } catch (error) {
    setMessage(status, error.message, "error");
    button.disabled = false;
  }
});
