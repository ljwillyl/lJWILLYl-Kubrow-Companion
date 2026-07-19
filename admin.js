"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const loginForm = $("loginForm");
  const loginButton = $("signIn");
  const loginMessage = $("loginMessage");

  if (!window.KubrowApp) {
    loginMessage.textContent =
      "Supabase failed to load. Refresh the page or disable any script blocker.";
    return;
  }

  const sb = window.KubrowApp.getSupabaseClient();
  let session = null;
  let rows = [];
  let profiles = [];
  let images = {};
  let activeEvidence = null;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  const setLoginMessage = (message, isError = false) => {
    loginMessage.textContent = message;
    loginMessage.style.color = isError ? "#ff9ca8" : "#9ff2df";
  };

  async function boot(currentSession) {
    session = currentSession;
    $("login").hidden = Boolean(session);
    $("dashboard").hidden = true;
    $("denied").hidden = true;

    if (!session) return;

    try {
      const { data, error } = await sb.rpc("is_kubrow_admin");

      if (error) {
        $("login").hidden = false;
        setLoginMessage(`Admin check failed: ${error.message}`, true);
        return;
      }

      if (!data) {
        $("denied").hidden = false;
        return;
      }

      $("dashboard").hidden = false;
      $("accountEmail").textContent = session.user.email || "Administrator";
      await load();
    } catch (error) {
      $("login").hidden = false;
      setLoginMessage(`Unable to open dashboard: ${error.message}`, true);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email || !password) {
      setLoginMessage("Enter your email address and password.", true);
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Signing in…";
    setLoginMessage("Checking your account…");

    try {
      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoginMessage(error.message, true);
        return;
      }

      setLoginMessage("Signed in successfully.");
      await boot(data.session);
    } catch (error) {
      setLoginMessage(`Login failed: ${error.message}`, true);
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Sign in";
    }
  });

  $("signOut").addEventListener("click", async () => {
    await sb.auth.signOut();
    await boot(null);
  });

  sb.auth.onAuthStateChange((_event, newSession) => {
    if (newSession?.access_token !== session?.access_token) {
      setTimeout(() => boot(newSession), 0);
    }
  });

  async function load() {
    $("adminMessage").textContent = "Loading…";

    const [recordResult, profileResult] = await Promise.all([
      sb.from("admin_kubrow_records").select("*").order("created_at", { ascending: false }),
      sb.from("admin_breeder_summary").select("*").order("kubrow_count", { ascending: false }),
    ]);

    if (recordResult.error) {
      $("adminMessage").textContent = recordResult.error.message;
      return;
    }

    rows = recordResult.data || [];
    profiles = profileResult.error ? [] : (profileResult.data || []);
    images = {};

    await Promise.all(
      rows.filter((row) => row.screenshot_path).map(async (row) => {
        const { data } = await sb.storage
          .from(window.KUBROW_CONFIG.storageBucket)
          .createSignedUrl(row.screenshot_path, 1800);
        images[row.id] = data?.signedUrl || "";
      })
    );

    $("adminMessage").textContent = profileResult.error
      ? `Records loaded. Breeder summary warning: ${profileResult.error.message}`
      : "";

    renderStats();
    renderRecords();
    renderBreeders();
  }

  function renderStats() {
    const today = new Date().toISOString().slice(0, 10);
    $("statKubrows").textContent = rows.length;
    $("statPublic").textContent = rows.filter((row) => row.is_public).length;
    $("statVerified").textContent = rows.filter(
      (row) => row.verification_source === "screenshot"
    ).length;
    $("statPending").textContent = rows.filter(
      (row) => (row.review_status || "pending") === "pending"
    ).length;
    $("statBreeders").textContent = profiles.length;
    $("statToday").textContent = rows.filter(
      (row) => (row.created_at || "").slice(0, 10) === today
    ).length;
  }

  function renderRecords() {
    const query = $("search").value.trim().toLowerCase();
    const status = $("status").value;
    const publicOnly = $("publicOnly").checked;

    const shown = rows.filter((row) => {
      const searchable = [
        row.kdna_id,
        row.name,
        row.breed,
        row.pattern,
        row.primary_colour,
        row.secondary_colour,
        row.tertiary_colour,
      ];

      return (
        (!query ||
          searchable.some((value) =>
            String(value || "").toLowerCase().includes(query)
          )) &&
        (!status || (row.review_status || "pending") === status) &&
        (!publicOnly || row.is_public)
      );
    });

    $("recordList").innerHTML =
      shown.map((row) => `
        <article class="record"><label class="check"><input type="checkbox" class="selectRecord" value="${row.id}"></label>
          ${
            images[row.id]
              ? `<img class="thumb" src="${images[row.id]}" alt="">`
              : '<div class="thumb"></div>'
          }
          <div>
            <div class="recordHead">
              <h3>${esc(row.name)}</h3>
              <span class="pill ${esc(row.review_status || "pending")}">
                ${esc(row.review_status || "pending")}
              </span>
            </div>
            <div class="meta">
              ${esc(row.kdna_id)} ·
              ${esc([row.breed, row.pattern, row.build_type].filter(Boolean).join(" · "))}
            </div>
            <div class="meta">
              ${esc(row.primary_colour)} · ${esc(row.secondary_colour)} ·
              ${esc(row.tertiary_colour)}
            </div>
            <div>
              <span class="pill">
                ${row.verification_source === "screenshot" ? "PALETTE VERIFIED" : "MANUAL"}
              </span>
              <span class="pill">${row.is_public ? "PUBLIC" : "PRIVATE"}</span>${row.featured?'<span class="pill">FEATURED</span>':""}
            </div>
          </div>
          <div class="recordActions">
            <button class="ghost" type="button" data-edit="${row.id}">Edit</button>
            <a class="button ghost" href="dna.html?id=${encodeURIComponent(row.kdna_id)}" target="_blank" rel="noopener">DNA</a>
          </div>
        </article>
      `).join("") || "<p>No matching records.</p>";

    document.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => edit(button.dataset.edit));
    });
  }

  function renderBreeders() {
    $("breederList").innerHTML =
      profiles.map((profile) => `
        <article class="breeder">
          <b>${esc(profile.display_name || "Unnamed breeder")}</b>
          <div class="meta">${esc(profile.platform || "Platform not set")}</div>
          <div class="meta">
            ${profile.kubrow_count} Kubrows · ${profile.public_count} public ·
            ${profile.verified_count} verified
          </div>
        </article>
      `).join("") || "<p>No breeder profiles yet.</p>";
  }

  function edit(id) {
    const row = rows.find((item) => String(item.id) === String(id));
    if (!row) return;

    $("editId").value = row.id;
    $("editName").value = row.name || "";
    $("editKdna").value = row.kdna_id || "";
    $("editBreed").value = row.breed || "";
    $("editPattern").value = row.pattern || "";
    $("editBuild").value = row.build_type || "";
    $("editPrimary").value = row.primary_colour || "";
    $("editSecondary").value = row.secondary_colour || "";
    $("editTertiary").value = row.tertiary_colour || "";
    $("editReview").value = row.review_status || "pending";
    $("editPublic").value = String(Boolean(row.is_public));
    $("editAdminNotes").value = row.admin_notes || "";
    $("editor").showModal();
    loadEvidence(row.id);
  }

  async function loadEvidence(kubrowId){const evidenceBox=$("editEvidence");if(!evidenceBox)return;activeEvidence=null;evidenceBox.textContent="Loading evidence…";const{data,error}=await sb.from("kubrow_scan_evidence").select("*").eq("kubrow_id",kubrowId).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error){evidenceBox.textContent=error.message;return}if(!data){evidenceBox.textContent="Legacy record: no V3.1 scan evidence.";return}activeEvidence=data;evidenceBox.innerHTML=`<div><b>Overall:</b> ${data.overall_confidence??"—"}%</div><div><b>Primary:</b> ${data.primary_confidence??"—"}% · RGB ${(data.primary_rgb||[]).join(", ")}</div><div><b>Secondary:</b> ${data.secondary_confidence??"—"}% · RGB ${(data.secondary_rgb||[]).join(", ")}</div><div><b>Tertiary:</b> ${data.tertiary_confidence??"—"}% · RGB ${(data.tertiary_rgb||[]).join(", ")}</div><div><b>Sample radius:</b> ${data.sample_radius??"—"} px · <b>Scanner:</b> ${esc(data.scanner_version)}</div>`}
  $("saveCorrection")?.addEventListener("click",async()=>{const id=$("editId").value,row=rows.find(x=>String(x.id)===String(id)),slot=$("correctionSlot").value,corrected=$("correctedColour").value.trim(),reason=$("correctionReason").value.trim()||null;if(!row||!corrected){$("correctionMessage").textContent="Enter the corrected colour.";return}const field=`${slot}_colour`,scanner=row[field]||null;const c=await sb.from("kubrow_colour_corrections").insert({kubrow_id:row.id,evidence_id:activeEvidence?.id||null,admin_id:session.user.id,colour_slot:slot,scanner_colour:scanner,corrected_colour:corrected,reason});if(c.error){$("correctionMessage").textContent=c.error.message;return}const u=await sb.from("kennel_kubrows").update({[field]:corrected,review_status:"approved",reviewed_at:new Date().toISOString(),reviewed_by:session.user.id,admin_notes:[row.admin_notes,`${slot} corrected from ${scanner||"unknown"} to ${corrected}${reason?` — ${reason}`:""}`].filter(Boolean).join("\n")}).eq("id",row.id);if(u.error){$("correctionMessage").textContent=u.error.message;return}$("correctionMessage").textContent="Correction saved and record updated.";$("correctedColour").value="";$("correctionReason").value="";await load()});
  $("saveEdit").addEventListener("click", async (event) => {
    event.preventDefault();

    const id = $("editId").value;
    const payload = {
      name: $("editName").value.trim(),
      breed: $("editBreed").value.trim() || null,
      pattern: $("editPattern").value.trim() || null,
      build_type: $("editBuild").value || null,
      primary_colour: $("editPrimary").value.trim() || null,
      secondary_colour: $("editSecondary").value.trim() || null,
      tertiary_colour: $("editTertiary").value.trim() || null,
      review_status: $("editReview").value,
      is_public: $("editPublic").value === "true",
      admin_notes: $("editAdminNotes").value.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user.id,
    };

    const { error } = await sb.from("kennel_kubrows").update(payload).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    $("editor").close();
    await load();
  });

  $("deleteRecord").addEventListener("click", async (event) => {
    event.preventDefault();

    const id = $("editId").value;
    const row = rows.find((item) => String(item.id) === String(id));

    if (!confirm(`Permanently delete ${row?.name || "this record"}?`)) return;

    const { error } = await sb.from("kennel_kubrows").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    if (row?.screenshot_path) {
      await sb.storage.from(window.KUBROW_CONFIG.storageBucket).remove([row.screenshot_path]);
    }

    $("editor").close();
    await load();
  });

  $("refresh").addEventListener("click", load);
  $("search").addEventListener("input", renderRecords);
  $("status").addEventListener("change", renderRecords);
  $("publicOnly").addEventListener("change", renderRecords);


  function selectedIds(){return [...document.querySelectorAll(".selectRecord:checked")].map(x=>x.value)}
  async function bulkUpdate(payload){
    const ids=selectedIds();if(!ids.length){alert("Select at least one record.");return}
    const {error}=await sb.from("kennel_kubrows").update({...payload,reviewed_at:new Date().toISOString(),reviewed_by:session.user.id}).in("id",ids);
    if(error){alert(error.message);return}await load();
  }
  $("bulkApprove").addEventListener("click",()=>bulkUpdate({review_status:"approved"}));
  $("bulkReject").addEventListener("click",()=>bulkUpdate({review_status:"rejected"}));
  $("bulkFeature").addEventListener("click",async()=>{
    const ids=selectedIds();if(!ids.length){alert("Select at least one record.");return}
    const chosen=rows.filter(r=>ids.includes(String(r.id)));for(const r of chosen){const{error}=await sb.from("kennel_kubrows").update({featured:!r.featured}).eq("id",r.id);if(error){alert(error.message);return}}await load();
  });

  const { data, error } = await sb.auth.getSession();
  if (error) {
    setLoginMessage(error.message, true);
  }
  await boot(data?.session || null);
});
