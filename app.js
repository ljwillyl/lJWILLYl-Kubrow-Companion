'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const fileInput = $('file');
  const canvas = $('canvas');
  const scanStatus = $('scanStatus');

  if (!fileInput || !canvas) {
    console.error('Scanner HTML is missing #file or #canvas.');
    return;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const P = [
    ['Ash Grey','#808079'],['Earth Brown','#806A5D'],['Corpus Grey','#808080'],['Hek Green','#7E806A'],
    ['Kril Brown','#80745E'],['Gallium Grey','#78828C'],['Grustrag Grey','#807A6C'],['Saturn Brown','#806753'],
    ['Sedna Grey','#807979'],['Derelict Black','#262626'],['Mars Red','#805F44'],['Infested Black','#363333'],
    ['Void Black','#262020'],['Darvo Blue','#697280'],['Ordis Grey','#72727A'],['Mercury Brown','#807461'],
    ['Anyo Grey','#363640'],['Ambulas Black','#342622'],['Shadow Grey','#80736B'],['Sargas Brown','#C58D4D'],
    ['Jupiter Brown','#805A32'],['Phorid Red','#804330'],['Alad Blue','#5B6B80'],['Venus Brown','#4D4146']
  ].map(([name,hex]) => ({ name, hex, rgb: hexToRgb(hex) }));

  let selectedFile = null;
  let session = null;
  let supabaseClient = null;
  let points = [{x:.215,y:.395},{x:.215,y:.432},{x:.215,y:.469}];
  let matches = [];
  let sampleRadius = 3;

  fileInput.addEventListener('change', handleFile);

  function handleFile(event) {
    selectedFile = event.target.files && event.target.files[0];
    if (!selectedFile) {
      scanStatus.textContent = 'No screenshot selected.';
      return;
    }

    scanStatus.textContent = 'Opening screenshot…';
    const objectUrl = window.URL.createObjectURL(selectedFile);
    const image = new Image();

    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0);
      window.URL.revokeObjectURL(objectUrl);

      ['workspace','resultCard','detailsCard'].forEach(id => {
        const el = $(id);
        if (el) el.hidden = false;
      });

      scanStatus.textContent =
        `Loaded ${selectedFile.name} · ${image.naturalWidth} × ${image.naturalHeight}`;

      resetSamplerPositions();
      runOcrSafely();

      const workspace = $('workspace');
      if (workspace) workspace.scrollIntoView({ behavior:'smooth', block:'start' });
    };

    image.onerror = () => {
      window.URL.revokeObjectURL(objectUrl);
      scanStatus.textContent = 'Could not open that image. Try a PNG or JPG screenshot.';
    };

    image.src = objectUrl;
  }

  function resetSamplerPositions() {
    points = [{x:.215,y:.395},{x:.215,y:.432},{x:.215,y:.469}];
    placeMarkers();
    updateResults();
  }

  function placeMarkers() {
    if (!canvas.width) return;
    const displayScale = canvas.getBoundingClientRect().width / canvas.width;
    const visualSize = Math.max(12, Math.min(30, (sampleRadius*2+4) * Math.max(1,displayScale*3)));

    points.forEach((point,index) => {
      const marker = $('marker'+index);
      if (!marker) return;
      marker.style.left = point.x*100 + '%';
      marker.style.top = point.y*100 + '%';
      marker.style.setProperty('--marker-size',visualSize+'px');
    });
  }

  document.querySelectorAll('.marker').forEach(marker => {
    let dragging = false;

    const update = event => {
      if (!dragging || !canvas.width) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const index = Number(marker.dataset.i);

      points[index] = {
        x: clamp((event.clientX-rect.left)/rect.width),
        y: clamp((event.clientY-rect.top)/rect.height)
      };

      placeMarkers();
      updateResults();
    };

    marker.addEventListener('pointerdown', event => {
      dragging = true;
      marker.setPointerCapture(event.pointerId);
      update(event);
    });
    marker.addEventListener('pointermove', update);
    marker.addEventListener('pointerup', () => dragging = false);
    marker.addEventListener('pointercancel', () => dragging = false);
  });

  function updateResults() {
    if (!canvas.width) return;

    matches = points.map(point => {
      const rgb = medianPatch(
        point.x*canvas.width,
        point.y*canvas.height,
        sampleRadius
      );

      const lab = rgbToLab(rgb);
      const ranked = P.map(colour => ({
        ...colour,
        distance: deltaE(lab,rgbToLab(colour.rgb))
      })).sort((a,b) => a.distance-b.distance);

      return { rgb, best: ranked[0] };
    });

    const resultHost = $('results');
    if (!resultHost) return;

    const slots = ['Primary / Base','Secondary','Tertiary'];
    resultHost.innerHTML = matches.map((match,index) => `
      <article class="result">
        <h3>${slots[index]}</h3>
        <div class="colourRow">
          <span class="swatch" style="background:${match.best.hex}"></span>
          ${match.best.name}
        </div>
        <div class="code">Sample RGB(${match.rgb.join(', ')}) · ${match.best.hex}</div>
        <div class="distance">ΔE ${match.best.distance.toFixed(1)}</div>
      </article>
    `).join('');

    const warning = $('warning');
    if (warning) {
      const weak = matches.some(match => match.best.distance > 9);
      warning.hidden = !weak;
      if (weak) {
        warning.textContent =
          'Move each crosshair fully inside its coloured rectangle and reduce the sampling area if required.';
      }
    }
  }

  const sampleSlider = $('sampleSize');
  if (sampleSlider) {
    sampleSlider.addEventListener('input', event => {
      sampleRadius = Number(event.target.value);
      if ($('sampleSizeValue')) $('sampleSizeValue').textContent = sampleRadius;
      placeMarkers();
      updateResults();
    });
  }

  if ($('smallestSample')) {
    $('smallestSample').addEventListener('click', () => {
      sampleRadius = 1;
      if (sampleSlider) sampleSlider.value = '1';
      if ($('sampleSizeValue')) $('sampleSizeValue').textContent = '1';
      placeMarkers();
      updateResults();
    });
  }

  if ($('resetMarkers')) $('resetMarkers').addEventListener('click',resetSamplerPositions);
  if ($('rerun')) $('rerun').addEventListener('click',resetSamplerPositions);
  window.addEventListener('resize',placeMarkers);

  async function runOcrSafely() {
    const badge = $('ocrBadge');

    if (!window.Tesseract) {
      if (badge) badge.textContent = 'Enter name and pattern manually';
      return;
    }

    try {
      if (badge) badge.textContent = 'Reading name and fur pattern…';

      const nameCrop = cropCanvas(.048,.145,.225,.225);
      const patternCrop = cropCanvas(.045,.328,.235,.373);

      const nameResult = await window.Tesseract.recognize(nameCrop,'eng',{
        tessedit_pageseg_mode:7,
        tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_'
      });

      const detectedName = (nameResult.data.text || '')
        .toUpperCase()
        .replace(/[^A-Z0-9 _-]/g,' ')
        .replace(/\s+/g,' ')
        .trim();

      const blocked =
        /^(MAX RANK|ATTACHMENTS|SIGILS|BASE COLOR|SECONDARY COLOR|TERTIARY COLOR|EMISSIVE|ENERGY)$/;

      if (detectedName && !blocked.test(detectedName) && $('kubrowName')) {
        $('kubrowName').value = detectedName;
      }

      const patternResult = await window.Tesseract.recognize(patternCrop,'eng',{
        tessedit_pageseg_mode:7
      });

      const patternText = (patternResult.data.text || '')
        .replace(/fur\s*pattern/ig,'')
        .replace(/[^a-z -]/ig,' ')
        .replace(/\s+/g,' ')
        .trim();

      const known = ['Lotus','Merle','Patchy','Striped','Hound'];
      const normalized = known.find(pattern =>
        patternText.toLowerCase().includes(pattern.toLowerCase())
      );

      if ($('pattern')) {
        if (normalized) $('pattern').value = normalized;
        else if (patternText.length >= 3) {
          $('pattern').value =
            patternText.replace(/\b\w/g,character => character.toUpperCase());
        }
      }

      if (badge) badge.textContent = 'Name and pattern read — check before saving';
    } catch (error) {
      console.warn('OCR unavailable:',error);
      if (badge) badge.textContent = 'Enter name and pattern manually';
    }
  }

  function cropCanvas(x1,y1,x2,y2) {
    const crop = document.createElement('canvas');
    const sx = Math.round(x1*canvas.width);
    const sy = Math.round(y1*canvas.height);
    const sw = Math.max(1,Math.round((x2-x1)*canvas.width));
    const sh = Math.max(1,Math.round((y2-y1)*canvas.height));

    crop.width = sw*3;
    crop.height = sh*3;

    crop.getContext('2d').drawImage(
      canvas,sx,sy,sw,sh,0,0,crop.width,crop.height
    );

    return crop;
  }

  function initialiseSupabase() {
    if (!window.supabase) {
      console.warn('Supabase did not load. Screenshot scanning still works.');
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(
        'https://mxboguiriifkmsmcusjt.supabase.co',
        'sb_publishable_gZwUnRiKV2Ww2wqAXs9mBA_Z8lFw0LV'
      );

      supabaseClient.auth.onAuthStateChange((_event,currentSession) => {
        session = currentSession;
        renderAuth();
      });

      supabaseClient.auth.getSession().then(response => {
        session = response.data.session;
        renderAuth();
      });
    } catch (error) {
      console.warn('Supabase unavailable:',error);
    }
  }

  function renderAuth() {
    if ($('signedOut')) $('signedOut').hidden = Boolean(session);
    if ($('signedIn')) $('signedIn').hidden = !session;
    if (session && $('accountEmail')) {
      $('accountEmail').textContent = session.user.email || 'breeder';
    }
  }

  if ($('signIn')) {
    $('signIn').addEventListener('click',async () => {
      if (!supabaseClient) return setSaveStatus('Sign-in service has not loaded.');
      setSaveStatus('Signing in…');

      const response = await supabaseClient.auth.signInWithPassword({
        email:$('email').value.trim(),
        password:$('password').value
      });

      setSaveStatus(response.error ? response.error.message : 'Signed in.');
    });
  }

  if ($('signOut')) {
    $('signOut').addEventListener('click',() => {
      if (supabaseClient) supabaseClient.auth.signOut();
    });
  }

  if ($('saveKennel')) {
    $('saveKennel').addEventListener('click',async () => {
      if (!supabaseClient || !session) return setSaveStatus('Sign in first.');
      if (!selectedFile || matches.length !== 3) {
        return setSaveStatus('Upload and position the samplers first.');
      }

      const name = $('kubrowName').value.trim();
      const breed = $('breed').value;
      const pattern = $('pattern').value.trim();

      if (!name) return setSaveStatus('Enter and check the Kubrow name.');
      if (!breed) return setSaveStatus('Choose the Kubrow breed.');
      if (!pattern) return setSaveStatus('Enter and check the fur pattern.');
      if (!$('detailsConfirmed') || !$('detailsConfirmed').checked) {
        return setSaveStatus('Confirm that the name, breed and pattern are correct.');
      }

      setSaveStatus('Uploading screenshot…');

      const extension =
        (selectedFile.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi,'');

      const path =
        `${session.user.id}/${crypto.randomUUID()}.${extension}`;

      const upload = await supabaseClient.storage
        .from('kennel-screenshots')
        .upload(path,selectedFile,{
          contentType:selectedFile.type || 'image/jpeg'
        });

      if (upload.error) return setSaveStatus(upload.error.message);

      const payload = {
        owner_id:session.user.id,
        name,
        breed,
        pattern,
        build_type:$('buildType').value || null,
        gender:$('gender').value || null,
        primary_colour:matches[0].best.name,
        secondary_colour:matches[1].best.name,
        tertiary_colour:matches[2].best.name,
        eye_colour:$('eyes').value || null,
        primary_id:matches[0].best.hex,
        secondary_id:matches[1].best.hex,
        tertiary_id:matches[2].best.hex,
        verification_source:'screenshot',
        imprints_remaining:
          $('imprints').value === '' ? null : Number($('imprints').value),
        trade_status:$('tradeStatus').value,
        asking_price:
          $('askingPrice').value === '' ? null : Number($('askingPrice').value),
        notes:$('notes').value.trim() || null,
        screenshot_path:path,
        is_public:false
      };

      setSaveStatus('Saving kennel record…');

      const insert =
        await supabaseClient.from('kennel_kubrows').insert(payload);

      if (insert.error) {
        await supabaseClient.storage
          .from('kennel-screenshots')
          .remove([path]);

        return setSaveStatus(insert.error.message);
      }

      setSaveStatus('Saved to My Kennel.');
    });
  }

  function setSaveStatus(message) {
    if ($('saveStatus')) $('saveStatus').textContent = message;
  }

  function clamp(value) {
    return Math.max(0,Math.min(1,value));
  }

  function medianPatch(cx,cy,radius) {
    const x = Math.max(0,Math.round(cx-radius));
    const y = Math.max(0,Math.round(cy-radius));
    const width = Math.min(canvas.width-x,Math.round(radius*2+1));
    const height = Math.min(canvas.height-y,Math.round(radius*2+1));
    const data = ctx.getImageData(x,y,width,height).data;
    const channels = [[],[],[]];

    for (let i=0;i<data.length;i+=4) {
      const maximum = Math.max(data[i],data[i+1],data[i+2]);
      const minimum = Math.min(data[i],data[i+1],data[i+2]);

      if (maximum > 238 && maximum-minimum < 28) continue;

      channels[0].push(data[i]);
      channels[1].push(data[i+1]);
      channels[2].push(data[i+2]);
    }

    return channels.map(channel => {
      channel.sort((a,b) => a-b);
      return channel.length
        ? channel[Math.floor(channel.length/2)]
        : 0;
    });
  }

  function hexToRgb(hex) {
    return [1,3,5].map(index =>
      parseInt(hex.slice(index,index+2),16)
    );
  }

  function linearise(value) {
    value /= 255;
    return value <= .04045
      ? value/12.92
      : Math.pow((value+.055)/1.055,2.4);
  }

  function rgbToLab(colour) {
    let [r,g,b] = colour.map(linearise);

    const x = (.4124*r+.3576*g+.1805*b)/.95047;
    const y = .2126*r+.7152*g+.0722*b;
    const z = (.0193*r+.1192*g+.9505*b)/1.08883;
    const f = value =>
      value > .008856
        ? Math.cbrt(value)
        : 7.787*value+16/116;

    return [
      116*f(y)-16,
      500*(f(x)-f(y)),
      200*(f(y)-f(z))
    ];
  }

  function deltaE(a,b) {
    return Math.hypot(
      a[0]-b[0],
      a[1]-b[1],
      a[2]-b[2]
    );
  }

  initialiseSupabase();
});
