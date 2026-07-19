"use strict";

const sb = window.KubrowApp.getSupabaseClient();
const $ = (id) => document.getElementById(id);

let rows = [];

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]
  );

function withTimeout(promise, milliseconds, label) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${milliseconds / 1000} seconds.`)),
      milliseconds
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function counts(key) {
  return Object.entries(
    rows.reduce((totals, row) => {
      const value = row[key] || "Unknown";
      totals[value] = (totals[value] || 0) + 1;
      return totals;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
}

function bars(items, total) {
  if (!items.length) {
    return '<p class="meta">No verified records are available for this category yet.</p>';
  }

  return items
    .map(([name, count]) => {
      const percentage = total ? (count / total) * 100 : 0;

      return `
        <div class="frequencyRow">
          <b>${esc(name)}</b>
          <div class="frequencyTrack">
            <div class="frequencyFill" style="width:${percentage}%"></div>
          </div>
          <span class="meta">${count} · ${percentage.toFixed(1)}%</span>
        </div>
      `;
    })
    .join("");
}

async function queryStatistics() {
  const fields = [
    "kdna_id",
    "name",
    "breed",
    "pattern",
    "build_type",
    "primary_colour",
    "secondary_colour",
    "tertiary_colour",
    "owner_name",
    "trade_status",
    "combination_percent",
    "created_at",
    "verification_source",
  ].join(",");

  return withTimeout(
    sb
      .from("public_kubrow_dna_complete")
      .select(fields)
      .eq("verification_source", "screenshot")
      .order("created_at", { ascending: false })
      .limit(2000),
    20000,
    "Statistics request"
  );
}

async function queryFallback() {
  return withTimeout(
    sb
      .from("public_kubrow_dna_complete")
      .select(
        "kdna_id,name,breed,pattern,build_type,primary_colour,secondary_colour,tertiary_colour,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    15000,
    "Fallback statistics request"
  );
}

async function load() {
  const message = $("message");
  message.hidden = false;
  message.textContent = "Loading statistics…";

  try {
    let result = await queryStatistics();

    if (result.error) {
      console.warn("Full statistics request failed:", result.error);
      result = await queryFallback();
    }

    if (result.error) {
      throw result.error;
    }

    rows = result.data || [];
    render();

    message.hidden = true;
  } catch (error) {
    console.error("Statistics loading failed:", error);

    $("headline").innerHTML = "";
    $("colours").innerHTML = "";
    $("distributions").innerHTML = "";
    $("recent").innerHTML = "";

    message.hidden = false;
    message.innerHTML = `
      <strong>Statistics could not be loaded.</strong><br>
      ${esc(error?.message || "Unknown database error.")}<br><br>
      <button type="button" id="retryStatistics">Try again</button>
    `;

    $("retryStatistics")?.addEventListener("click", load);
  }
}

function render() {
  const availableForTrade = rows.filter((row) =>
    ["for_sale", "open_to_offers"].includes(row.trade_status)
  ).length;

  const rare = rows.filter(
    (row) =>
      row.combination_percent !== null &&
      row.combination_percent !== undefined &&
      Number(row.combination_percent) <= 5
  ).length;

  const publicBreeders = new Set(
    rows.map((row) => row.owner_name).filter(Boolean)
  ).size;

  $("headline").innerHTML = `
    <article class="stat">
      <strong>${rows.length}</strong>
      <span>Verified public Kubrows</span>
    </article>
    <article class="stat">
      <strong>${publicBreeders}</strong>
      <span>Public breeders</span>
    </article>
    <article class="stat">
      <strong>${rare}</strong>
      <span>Rare combinations ≤5%</span>
    </article>
    <article class="stat">
      <strong>${availableForTrade}</strong>
      <span>Available for trade</span>
    </article>
  `;

  renderColours();

  $("distributions").innerHTML = [
    ["Breed", "breed"],
    ["Pattern", "pattern"],
    ["Build", "build_type"],
  ]
    .map(
      ([title, key]) => `
        <article class="card">
          <div class="body">
            <h3>${title}</h3>
            ${bars(counts(key).slice(0, 12), rows.length)}
          </div>
        </article>
      `
    )
    .join("");

  if (!rows.length) {
    $("recent").innerHTML =
      '<p class="meta">No approved public Palette Verified records are available yet.</p>';
    return;
  }

  $("recent").innerHTML = rows
    .slice(0, 8)
    .map(
      (row) => `
        <article class="card">
          <div class="body">
            <span class="pill kdna">${esc(row.kdna_id)}</span>
            <h3>${esc(row.name)}</h3>
            <div class="meta">
              ${esc(
                [row.breed, row.pattern, row.build_type]
                  .filter(Boolean)
                  .join(" · ")
              )}
            </div>
            <a
              class="button ghost"
              style="margin-top:10px"
              href="dna.html?id=${encodeURIComponent(row.kdna_id)}"
            >View</a>
          </div>
        </article>
      `
    )
    .join("");
}

function renderColours() {
  $("colours").innerHTML = bars(counts($("slot").value), rows.length);
}

$("slot").addEventListener("change", renderColours);
load();
