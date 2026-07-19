"use strict";

const sb = window.KubrowApp.getSupabaseClient();
const $ = (id) => document.getElementById(id);

let rows = [];

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[character]));

const stars = (value) => {
  const count = Math.max(1, Math.min(5, Number(value) || 1));
  return "★".repeat(count) + "☆".repeat(5 - count);
};

function showMessage(message, isError = false) {
  const box = $("message");
  if (!box) return;
  box.hidden = false;
  box.textContent = message;
  box.classList.toggle("bad", isError);
}

async function signed(path) {
  if (!path) return "";
  try {
    const { data, error } = await sb.storage
      .from(window.KUBROW_CONFIG.storageBucket)
      .createSignedUrl(path, 1800);

    if (error) {
      console.warn("Screenshot URL failed:", path, error.message);
      return "";
    }

    return data?.signedUrl || "";
  } catch (error) {
    console.warn("Screenshot URL exception:", path, error);
    return "";
  }
}

function populateOptions(id, key, label) {
  const select = $(id);
  if (!select) return;

  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort();
  select.innerHTML = `<option value="">${label}</option>` +
    values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
}

function cardHtml(row) {
  return `<article class="card" data-record-id="${esc(row.id)}">
    <div class="shot image-slot" aria-label="${esc(row.name)} screenshot"></div>
    <div class="body">
      <span class="pill kdna">${esc(row.kdna_id)}</span>
      <h3>${esc(row.name)}</h3>
      <div class="meta">${esc([row.breed, row.pattern, row.build_type].filter(Boolean).join(" · "))}</div>
      <div class="traits">
        <div class="trait"><small>Primary</small>${esc(row.primary_colour || "Unknown")}</div>
        <div class="trait"><small>Secondary</small>${esc(row.secondary_colour || "Unknown")}</div>
        <div class="trait"><small>Tertiary</small>${esc(row.tertiary_colour || "Unknown")}</div>
      </div>
      <div class="rarity">
        <span class="stars">${stars(row.rarity_stars)}</span>
        <span class="meta">${Number(row.combination_percent || 0).toFixed(2)}% combination frequency</span>
      </div>
      <div>
        <span class="pill">${row.verification_source === "screenshot" ? "PALETTE VERIFIED" : "MANUAL"}</span>
        ${row.featured ? '<span class="pill">FEATURED</span>' : ""}
      </div>
      <div class="actions">
        <a class="button" href="dna.html?id=${encodeURIComponent(row.kdna_id)}">View DNA</a>
        <a class="button ghost" href="certificate.html?id=${encodeURIComponent(row.kdna_id)}">Certificate</a>
      </div>
    </div>
  </article>`;
}

function render() {
  const query = $("search")?.value.trim().toLowerCase() || "";
  const filterIds = ["breed", "pattern", "build", "primary", "secondary", "tertiary"];
  const fieldMap = {
    primary: "primary_colour",
    secondary: "secondary_colour",
    tertiary: "tertiary_colour",
    build: "build_type"
  };

  const shown = rows.filter((row) => {
    const searchable = [
      row.kdna_id,
      row.name,
      row.breed,
      row.pattern,
      row.build_type,
      row.primary_colour,
      row.secondary_colour,
      row.tertiary_colour,
      row.owner_name
    ];

    const matchesSearch = !query || searchable.some((value) =>
      String(value || "").toLowerCase().includes(query)
    );

    const matchesFilters = filterIds.every((id) => {
      const selected = $(id)?.value || "";
      return !selected || row[fieldMap[id] || id] === selected;
    });

    const matchesVerification = !$("verifiedOnly")?.checked ||
      row.verification_source === "screenshot";

    return matchesSearch && matchesFilters && matchesVerification;
  });

  $("total").textContent = shown.length;
  $("rareCount").textContent = shown.filter((row) =>
    Number(row.combination_percent ?? 100) <= 5
  ).length;
  $("saleCount").textContent = shown.filter((row) =>
    ["for_sale", "open_to_offers"].includes(row.trade_status)
  ).length;

  $("grid").innerHTML = shown.length
    ? shown.map(cardHtml).join("")
    : '<div class="message">No records match the selected filters.</div>';

  loadVisibleImages(shown);
}

async function loadVisibleImages(records) {
  records.forEach(async (row) => {
    if (!row.screenshot_path) return;

    const url = await signed(row.screenshot_path);
    if (!url) return;

    const card = document.querySelector(`[data-record-id="${CSS.escape(String(row.id))}"]`);
    const slot = card?.querySelector(".image-slot");
    if (!slot) return;

    const image = document.createElement("img");
    image.className = "shot";
    image.alt = row.name || "Kubrow screenshot";
    image.loading = "lazy";
    image.src = url;
    image.onerror = () => image.remove();
    slot.replaceWith(image);
  });
}

async function loadExplorer() {
  showMessage("Loading DNA records…");

  try {
    const queryPromise = sb
      .from("public_kubrow_dna_complete")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("The database request timed out after 20 seconds.")), 20000)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) throw error;

    rows = Array.isArray(data) ? data : [];

    populateOptions("breed", "breed", "All breeds");
    populateOptions("pattern", "pattern", "All patterns");
    populateOptions("primary", "primary_colour", "Any primary");
    populateOptions("secondary", "secondary_colour", "Any secondary");
    populateOptions("tertiary", "tertiary_colour", "Any tertiary");

    $("message").hidden = true;
    render();
  } catch (error) {
    console.error("DNA Explorer load failed:", error);
    showMessage(`DNA records could not be loaded: ${error.message || error}`, true);
  }
}

async function loadProfile(kdnaId) {
  $("explorer").hidden = true;
  $("single").hidden = false;

  try {
    const { data, error } = await sb
      .from("public_kubrow_dna_complete")
      .select("*")
      .eq("kdna_id", kdnaId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("This DNA record is private, unapproved or unavailable.");

    const imageUrl = await signed(data.screenshot_path);
    const gene = (label, value) =>
      `<div class="gene"><span>${label}</span><b>${esc(value ?? "Unknown")}</b></div>`;

    $("profile").innerHTML = `<article class="card profile">
      <div class="profileGrid">
        ${imageUrl
          ? `<img class="profileShot" src="${imageUrl}" alt="${esc(data.name)}">`
          : '<div class="profileShot"></div>'}
        <div class="profileBody">
          <span class="pill kdna">${esc(data.kdna_id)}</span>
          <h2>${esc(data.name)}</h2>
          <div>
            <span class="pill">${data.verification_source === "screenshot" ? "PALETTE VERIFIED" : "MANUAL"}</span>
            ${data.featured ? '<span class="pill">FEATURED</span>' : ""}
          </div>
          <div class="rarity">
            <span class="stars">${stars(data.rarity_stars)}</span>
            <b>${Number(data.combination_percent || 0).toFixed(2)}%</b>
          </div>
          ${gene("Breed", data.breed)}
          ${gene("Pattern", data.pattern)}
          ${gene("Build", data.build_type)}
          ${gene("Primary", data.primary_colour)}
          ${gene("Secondary", data.secondary_colour)}
          ${gene("Tertiary", data.tertiary_colour)}
          ${gene("Eyes", data.eye_colour)}
          ${gene("Gender", data.gender)}
          ${gene("Imprints remaining", data.imprints_remaining)}
          ${gene("Trade status", (data.trade_status || "private").replaceAll("_", " "))}
          ${data.asking_price != null ? gene("Asking price", `${data.asking_price} Platinum`) : ""}
          ${data.owner_name ? `<div class="ownerBox">
            <b>${esc(data.owner_name)}</b>
            <div class="meta">${esc(data.owner_platform || "")}</div>
            ${data.owner_bio ? `<p>${esc(data.owner_bio)}</p>` : ""}
            ${data.owner_contact ? `<div>Contact: <b>${esc(data.owner_contact)}</b></div>` : ""}
          </div>` : ""}
        </div>
      </div>
    </article>`;

    const certificateLink = document.createElement("a");
    certificateLink.className = "button ghost";
    certificateLink.href = `certificate.html?id=${encodeURIComponent(data.kdna_id)}`;
    certificateLink.textContent = "DNA certificate";
    $("copyLink").insertAdjacentElement("afterend", certificateLink);

    $("copyLink").onclick = () => navigator.clipboard
      .writeText(location.href)
      .then(() => $("copyLink").textContent = "Copied");
  } catch (error) {
    console.error("DNA profile load failed:", error);
    $("profile").innerHTML = `<div class="panel bad">${esc(error.message || error)}</div>`;
  }
}

function bindFilters() {
  ["search", "breed", "pattern", "build", "primary", "secondary", "tertiary", "verifiedOnly"]
    .forEach((id) => {
      const element = $(id);
      if (!element) return;
      element.addEventListener(id === "search" ? "input" : "change", render);
    });
}

bindFilters();

const profileId = new URLSearchParams(location.search).get("id");
if (profileId) {
  loadProfile(profileId);
} else {
  loadExplorer();
}
