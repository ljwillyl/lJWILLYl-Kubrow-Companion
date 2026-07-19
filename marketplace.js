'use strict';

(() => {
  const BUCKET = window.KUBROW_CONFIG.storageBucket;
  const ACTIVE_STATUSES = ['for_sale', 'open_to_offers', 'reserved'];

  const $ = (id) => document.getElementById(id);
  const client = window.KubrowApp?.getSupabaseClient();
  let records = [];
  let signedImages = {};

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const pretty = (value) => String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  function setMessage(text, type = '') {
    const host = $('message');
    if (!host) return;
    host.className = `message marketplaceMessage ${type}`.trim();
    host.innerHTML = text;
  }

  function dnaUrl(record) {
    const value = record.kdna_id || record.id;
    return `dna.html?id=${encodeURIComponent(value)}`;
  }

  function statusLabel(status) {
    return {
      for_sale: 'For sale',
      open_to_offers: 'Open to offers',
      reserved: 'Reserved'
    }[status] || pretty(status);
  }

  function priceLabel(record) {
    if (record.asking_price === null || record.asking_price === undefined || record.asking_price === '') {
      return record.trade_status === 'open_to_offers' ? 'Offers invited' : 'Price not listed';
    }
    return `${Number(record.asking_price).toLocaleString()} platinum`;
  }

  function searchText(record) {
    return [
      record.name, record.kdna_id, record.breed, record.pattern, record.build_type,
      record.primary_colour, record.secondary_colour, record.tertiary_colour,
      record.eye_colour, record.accent_colour, record.companion_type,
      record.notes
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function rarityScore(record) {
    let score = 0;
    if (record.verification_source === 'screenshot') score += 3;
    if (record.pattern === 'Lotus') score += 3;
    if (record.build_type === 'Bulky') score += 2;
    if (record.companion_type === 'hybrid') score += 4;
    if (record.accent_colour) score += 1;
    return score;
  }

  function filteredRecords() {
    const query = $('search').value.trim().toLowerCase();
    const status = $('status').value;
    const build = $('build').value;
    const sort = $('sort').value;

    const result = records.filter((record) => {
      if (query && !searchText(record).includes(query)) return false;
      if (status && record.trade_status !== status) return false;
      if (build && record.build_type !== build) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sort === 'price_low') {
        return (a.asking_price ?? Number.MAX_SAFE_INTEGER) - (b.asking_price ?? Number.MAX_SAFE_INTEGER);
      }
      if (sort === 'price_high') {
        return (b.asking_price ?? -1) - (a.asking_price ?? -1);
      }
      if (sort === 'rare') return rarityScore(b) - rarityScore(a);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return result;
  }

  function colourCell(label, value) {
    return `<div class="marketColour"><small>${esc(label)}</small><strong>${esc(value || 'Unknown')}</strong></div>`;
  }

  function render() {
    const visible = filteredRecords();
    $('count').textContent = visible.length;
    $('priced').textContent = visible.filter((r) => r.asking_price !== null && r.asking_price !== undefined).length;
    $('offers').textContent = visible.filter((r) => r.trade_status === 'open_to_offers').length;

    if (!records.length) {
      $('grid').innerHTML = '';
      setMessage(
        '<strong>No active listings yet.</strong><span>Players can publish a Kubrow from My Kennel by marking it public and choosing For sale or Open to offers.</span>',
        'empty'
      );
      return;
    }

    if (!visible.length) {
      $('grid').innerHTML = '';
      setMessage('<strong>No listings match these filters.</strong><span>Try clearing the search or selecting All builds.</span>', 'empty');
      return;
    }

    setMessage(`<strong>${visible.length} active ${visible.length === 1 ? 'listing' : 'listings'}</strong><span>Trade arrangements are made directly between players.</span>`, 'ready');
    $('grid').innerHTML = visible.map((record) => {
      const image = signedImages[record.id];
      const type = pretty(record.companion_type || 'kubrow');
      const traits = [type, record.breed, record.pattern, record.build_type].filter(Boolean).join(' · ');
      return `<article class="marketCard">
        <div class="marketImage">
          ${image ? `<img src="${esc(image)}" alt="Appearance screenshot for ${esc(record.name)}" loading="lazy">` : '<div class="marketPlaceholder"><span>W</span><small>No screenshot available</small></div>'}
          <span class="marketStatus ${esc(record.trade_status)}">${esc(statusLabel(record.trade_status))}</span>
        </div>
        <div class="marketBody">
          <div class="marketHeading">
            <div><div class="eyebrow">${esc(record.kdna_id || 'DNA pending')}</div><h2>${esc(record.name || 'Unnamed companion')}</h2></div>
            <strong class="marketPrice">${esc(priceLabel(record))}</strong>
          </div>
          <p class="marketTraits">${esc(traits || 'Traits not recorded')}</p>
          <div class="marketColours">
            ${colourCell('Primary', record.primary_colour)}
            ${colourCell('Secondary', record.secondary_colour)}
            ${colourCell('Tertiary', record.tertiary_colour)}
          </div>
          <div class="marketMeta">
            <span>${record.verification_source === 'screenshot' ? '✓ Palette Verified' : 'Manual record'}</span>
            <span>${record.imprints_remaining ?? 'Unknown'} imprints</span>
            ${record.gender ? `<span>${esc(record.gender)}</span>` : ''}
          </div>
          <div class="marketActions"><a class="button" href="${dnaUrl(record)}">View DNA profile</a></div>
        </div>
      </article>`;
    }).join('');
  }

  async function signImages(rows) {
    signedImages = {};
    await Promise.all(rows.filter((row) => row.screenshot_path).map(async (row) => {
      try {
        const { data, error } = await client.storage.from(BUCKET).createSignedUrl(row.screenshot_path, 3600);
        if (!error && data?.signedUrl) signedImages[row.id] = data.signedUrl;
      } catch (error) {
        console.warn('Marketplace image could not be signed', error);
      }
    }));
  }

  async function loadMarketplace() {
    if (!client) {
      setMessage('<strong>Marketplace could not start.</strong><span>The Supabase library did not load. Refresh the page or check your connection.</span><button id="retryMarketplace" class="ghost">Retry</button>', 'error');
      $('retryMarketplace')?.addEventListener('click', loadMarketplace);
      return;
    }

    setMessage('<span class="marketSpinner" aria-hidden="true"></span><strong>Loading marketplace…</strong><span>Fetching active public listings.</span>', 'loading');
    $('grid').innerHTML = '';

    try {
      const { data, error } = await client
        .from('kennel_kubrows')
        .select('*')
        .eq('is_public', true)
        .in('trade_status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false });

      if (error) throw error;
      records = data || [];
      await signImages(records);
      render();
    } catch (error) {
      console.error('Marketplace load failed:', error);
      records = [];
      signedImages = {};
      $('count').textContent = '0';
      $('priced').textContent = '0';
      $('offers').textContent = '0';
      setMessage(`<strong>Marketplace failed to load.</strong><span>${esc(error.message || 'The database request could not be completed.')}</span><button id="retryMarketplace" class="ghost">Try again</button>`, 'error');
      $('retryMarketplace')?.addEventListener('click', loadMarketplace);
    }
  }

  ['search', 'status', 'build', 'sort'].forEach((id) => {
    $(id)?.addEventListener(id === 'search' ? 'input' : 'change', render);
  });

  window.addEventListener('online', loadMarketplace);
  loadMarketplace();
})();
