'use strict';
const COLOURS=[['Ash Grey','#808079'],['Earth Brown','#806A5D'],['Corpus Grey','#808080'],['Hek Green','#7E806A'],['Kril Brown','#80745E'],['Gallium Grey','#78828C'],['Grustrag Grey','#807A6C'],['Saturn Brown','#806753'],['Sedna Grey','#807979'],['Derelict Black','#262626'],['Mars Brown','#805F44'],['Infested Black','#363333'],['Void Black','#262020'],['Darvo Blue','#697280'],['Ordis Grey','#72727A'],['Mercury Brown','#807461'],['Anyo Grey','#363640'],['Ambulas Black','#342622'],['Shadow Grey','#80736B'],['Sargas Brown','#C58D4D'],['Jupiter Brown','#805A32'],['Phorid Red','#804330'],['Alad Blue','#5B6B80'],['Venus Brown','#4D4146']];
const SLOTS=['Primary','Secondary','Tertiary'];
const DBKEY='willyguruVerifiedDbV2',SUBKEY='willyguruSubmissionsV2',ONLINEKEY='willyguruApprovedOnlineV4';
const SUPABASE_URL='https://mxboguiriifkmsmcusjt.supabase.co';
const SUPABASE_KEY='sb_publishable_gZwUnRiKV2Ww2wqAXs9mBA_Z8lFw0LV';
const SCANNER_VERSION='7.0.0',DATABASE_VERSION='7',SCREENSHOT_BUCKET='kubrow-screenshots';
const supabaseClient=(window.supabase&&window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)
  : null;
const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),empty=document.getElementById('empty');
let image=null,currentFile=null,currentFilename='',active=0,samples=[[],[],[]],onlineSamples=[];
function hexRgb(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16))}function median(a){if(!a.length)return 0;let b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2}function srgb(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}function lab(rgb){let [r,g,b]=rgb.map(srgb),x=(.4124*r+.3576*g+.1805*b)/.95047,y=(.2126*r+.7152*g+.0722*b),z=(.0193*r+.1192*g+.9505*b)/1.08883,f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;return [116*f(y)-16,500*(f(x)-f(y)),200*(f(y)-f(z))]}function de(a,b){
  // CIEDE2000 perceptual colour difference.
  const [L1,a1,b1]=a,[L2,a2,b2]=b,rad=x=>x*Math.PI/180,deg=x=>x*180/Math.PI;
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cbar=(C1+C2)/2;
  const G=.5*(1-Math.sqrt(Math.pow(Cbar,7)/(Math.pow(Cbar,7)+Math.pow(25,7))));
  const ap1=(1+G)*a1,ap2=(1+G)*a2,Cp1=Math.hypot(ap1,b1),Cp2=Math.hypot(ap2,b2);
  const hp=(x,y)=>{if(x===0&&y===0)return 0;let h=deg(Math.atan2(y,x));return h<0?h+360:h};
  const h1=hp(ap1,b1),h2=hp(ap2,b2),dL=L2-L1,dC=Cp2-Cp1;
  let dh;if(Cp1*Cp2===0)dh=0;else if(Math.abs(h2-h1)<=180)dh=h2-h1;else dh=h2<=h1?h2-h1+360:h2-h1-360;
  const dH=2*Math.sqrt(Cp1*Cp2)*Math.sin(rad(dh/2)),Lb=(L1+L2)/2,Cpb=(Cp1+Cp2)/2;
  let hb;if(Cp1*Cp2===0)hb=h1+h2;else if(Math.abs(h1-h2)<=180)hb=(h1+h2)/2;else hb=(h1+h2<360?(h1+h2+360)/2:(h1+h2-360)/2);
  const T=1-.17*Math.cos(rad(hb-30))+.24*Math.cos(rad(2*hb))+.32*Math.cos(rad(3*hb+6))-.20*Math.cos(rad(4*hb-63));
  const dTheta=30*Math.exp(-Math.pow((hb-275)/25,2)),Rc=2*Math.sqrt(Math.pow(Cpb,7)/(Math.pow(Cpb,7)+Math.pow(25,7)));
  const Sl=1+.015*Math.pow(Lb-50,2)/Math.sqrt(20+Math.pow(Lb-50,2)),Sc=1+.045*Cpb,Sh=1+.015*Cpb*T,Rt=-Math.sin(rad(2*dTheta))*Rc;
  const x=dL/Sl,y=dC/Sc,z=dH/Sh;return Math.sqrt(x*x+y*y+z*z+Rt*y*z)
}function blankDb(){return {version:2,created:new Date().toISOString(),samples:[]}}function getDb(){try{return JSON.parse(localStorage.getItem(DBKEY))||blankDb()}catch{return blankDb()}}function setDb(d){localStorage.setItem(DBKEY,JSON.stringify(d));renderDb()}function getSubs(){try{return JSON.parse(localStorage.getItem(SUBKEY))||[]}catch{return []}}function setSubs(s){localStorage.setItem(SUBKEY,JSON.stringify(s));renderDb()}function aggregate(arr){if(!arr.length)return null;return [0,1,2].map(j=>median(arr.map(x=>x.rgb[j])))}
const BASELINES=COLOURS.map(([name,hex])=>({name,hex,rgb:hexRgb(hex),lab:lab(hexRgb(hex))}));
function allRefs(name,slot){return [...getDb().samples,...onlineSamples].filter(x=>x.colour===name&&x.slot===slot&&Array.isArray(x.lab))}
function rank(rgb,slot){let target=lab(rgb);return BASELINES.map(r=>{let refs=allRefs(r.name,slot),ds=refs.map(v=>de(target,v.lab)).sort((a,b)=>a-b),baseline=de(target,r.lab),nearest=ds.slice(0,Math.min(5,ds.length)),learned=nearest.length?nearest.reduce((sum,d,i)=>sum+d/(i+1),0)/nearest.reduce((sum,_,i)=>sum+1/(i+1),0):baseline,distance=ds.length?(.88*learned+.12*baseline):baseline;return {...r,d:distance,verified:refs.length}}).sort((a,b)=>a.d-b.d)}
function confidenceLabel(r){if(!r[1])return ['Uncertain','bad'];let margin=r[1].d-r[0].d;if(r[0].d<3.5&&margin>2)return ['High confidence','good'];if(r[0].d<7&&margin>1)return ['Likely','warn'];return ['Uncertain','bad']}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);if(!image)return;ctx.drawImage(image,0,0,canvas.width,canvas.height);samples.forEach((arr,i)=>arr.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fillStyle=['#ff4058','#438cff','#36d05a'][i];ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke()}))}
function renderSlots(){document.getElementById('slots').innerHTML=SLOTS.map((slot,i)=>{let avg=aggregate(samples[i]),ranking=avg?rank(avg,slot):[],top=ranking[0],label=ranking.length?confidenceLabel(ranking):['Not sampled',''];return `<div class="slot ${active===i?'active':''}" data-slot="${i}"><div class="slothead"><h3>${slot}</h3><span>${samples[i].length} points</span></div>${avg?`<div class="result"><span class="sample" style="background:rgb(${avg.join(',')})"></span><div><strong>${top.name}</strong><div class="meta">${top.verified} verified reference(s) · ΔE00 ${top.d.toFixed(1)}</div><div class="confidence ${label[1]}">${label[0]}</div></div></div>`:'<div class="meta" style="margin-top:8px">Tap this panel, then sample the matching Nexus region.</div>'}</div>`}).join('');document.querySelectorAll('.slot').forEach(x=>x.onclick=()=>{active=Number(x.dataset.slot);renderSlots()});renderTrainingSlots()}
function renderTrainingSlots(){let host=document.getElementById('trainingSlots');if(!host)return;host.innerHTML=SLOTS.map((slot,i)=>{let avg=aggregate(samples[i]),guess=avg?rank(avg,slot)[0].name:'Not sampled';return `<div class="trainSlot"><h3>${slot}</h3><div class="meta">Scanner prediction: <b>${guess}</b> · ${samples[i].length} sampled point(s)</div><label class="field" style="margin-top:8px">Confirmed correct colour<select id="truth-${i}"><option value="">Choose verified colour…</option>${COLOURS.map(c=>`<option>${c[0]}</option>`).join('')}</select></label></div>`}).join('')}
function sampleAt(x,y){let r=Number(document.getElementById('radius').value),d=ctx.getImageData(Math.max(0,x-r),Math.max(0,y-r),Math.min(canvas.width,x+r)-Math.max(0,x-r),Math.min(canvas.height,y+r)-Math.max(0,y-r)).data,px=[];for(let i=0;i<d.length;i+=4)if(d[i+3]>240)px.push([d[i],d[i+1],d[i+2]]);if(!px.length)return;let centre=[0,1,2].map(j=>median(px.map(p=>p[j]))),filtered=px.filter(p=>Math.hypot(p[0]-centre[0],p[1]-centre[1],p[2]-centre[2])<55),src=filtered.length?filtered:px,rgb=[0,1,2].map(j=>median(src.map(p=>p[j])));samples[active].push({x,y,rgb});draw();renderSlots()}
canvas.addEventListener('click',e=>{if(!image)return;let r=canvas.getBoundingClientRect();sampleAt(Math.round((e.clientX-r.left)*canvas.width/r.width),Math.round((e.clientY-r.top)*canvas.height/r.height))});
document.getElementById('file').onchange=async e=>{
  const f=e.target.files&&e.target.files[0];
  if(!f)return;

  if(!f.type.startsWith('image/')){
    alert('Please choose a PNG, JPG or WebP image.');
    e.target.value='';
    return;
  }

  currentFile=f;
  currentFilename=f.name||'kubrow-screenshot';
  const filenameField=document.getElementById('filename');
  if(filenameField)filenameField.value=currentFilename;

  const showImage=source=>{
    image=source;
    const width=source.naturalWidth||source.width;
    const height=source.naturalHeight||source.height;
    const scale=Math.min(1,1600/width);
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    empty.style.display='none';
    samples.forEach(a=>a.length=0);
    draw();
    renderSlots();
  };

  try{
    if('createImageBitmap' in window){
      try{
        const bitmap=await createImageBitmap(f);
        showImage(bitmap);
        return;
      }catch(bitmapError){
        console.warn('createImageBitmap failed; trying FileReader.',bitmapError);
      }
    }

    await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(reader.error||new Error('Could not read the selected image.'));
      reader.onload=()=>{
        const im=new Image();
        im.onload=()=>{showImage(im);resolve()};
        im.onerror=()=>reject(new Error('This image format could not be opened. Please use a direct PNG or JPG screenshot.'));
        im.src=reader.result;
      };
      reader.readAsDataURL(f);
    });
  }catch(error){
    console.error(error);
    currentFile=null;
    image=null;
    alert(error.message||'The selected image could not be loaded.');
    e.target.value='';
  }
};
document.getElementById('undo').onclick=()=>{samples[active].pop();draw();renderSlots()};document.getElementById('clear').onclick=()=>{samples[active]=[];draw();renderSlots()};document.getElementById('reset').onclick=()=>{samples.forEach(a=>a.length=0);draw();renderSlots()};document.getElementById('radius').oninput=e=>document.getElementById('radiusValue').textContent=e.target.value+' px';document.getElementById('copy').onclick=async()=>{let text=SLOTS.map((n,i)=>{let a=aggregate(samples[i]);return `${n}: ${a?rank(a,n)[0].name:'not sampled'}`}).join('\n');try{await navigator.clipboard.writeText(text);document.getElementById('copy').textContent='Copied!';setTimeout(()=>document.getElementById('copy').textContent='Copy results',1200)}catch{alert(text)}};
function boolSetting(v){return v==='on'?true:v==='off'?false:null}function collectSubmission(){let confirmed=[];SLOTS.forEach((slot,i)=>{let el=document.getElementById(`truth-${i}`),avg=aggregate(samples[i]);if(el?.value&&avg)confirmed.push({slot,colour:el.value,rgb:avg.map(Math.round),lab:lab(avg),points:samples[i].length})});return {id:crypto.randomUUID?crypto.randomUUID():Date.now().toString(36),created:new Date().toISOString(),meta:{tester:document.getElementById('tester').value.trim(),platform:document.getElementById('platform').value,hdr:document.getElementById('hdr').value,colourCorrection:document.getElementById('correction').value,sourceId:document.getElementById('sourceId').value.trim(),filename:currentFilename,notes:document.getElementById('notes').value.trim()},confirmed}}
function saveLocal(sub=collectSubmission()){if(!sub.confirmed.length){document.getElementById('saveMessage').textContent='Nothing saved.';return}let db=getDb();sub.confirmed.forEach(c=>db.samples.push({...c,submissionId:sub.id,created:sub.created,meta:sub.meta}));setDb(db);let ss=getSubs();ss.push(sub);setSubs(ss);document.getElementById('saveMessage').textContent=`Saved ${sub.confirmed.length} verified sample(s) locally.`}
function safeFilePart(v){return String(v||'image').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'image'}
function screenshotBlob(){return new Promise((resolve,reject)=>{if(!image)return reject(Error('No screenshot loaded.'));let max=1800,scale=Math.min(1,max/image.width,max/image.height),c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));let x=c.getContext('2d');x.drawImage(image,0,0,c.width,c.height);c.toBlob(b=>b?resolve(b):reject(Error('Could not prepare screenshot.')),'image/jpeg',0.88)})}
async function uploadScreenshot(sub){if(!supabaseClient)throw Error('Supabase upload library did not load. Refresh the page and try again.');let blob=await screenshotBlob();if(blob.size>6*1024*1024)throw Error('Prepared screenshot is larger than 6 MB.');let base=safeFilePart(currentFilename.replace(/\.[^.]+$/,'')),path=`pending/${sub.id}/${base}.jpg`;let {error}=await supabaseClient.storage.from(SCREENSHOT_BUCKET).upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});if(error)throw error;return {path,mime:'image/jpeg',size:blob.size}}
async function submitCloud(){let status=document.getElementById('cloudStatus'),btn=document.getElementById('submitCloud');if(!document.getElementById('consent').checked){status.className='notice';status.textContent='Tick the colour confirmation box first.';return}if(!document.getElementById('imageConsent').checked){status.className='notice';status.textContent='Screenshot permission is required so the moderator can verify the submission.';return}if(!currentFile||!image){status.className='notice';status.textContent='Upload a screenshot first.';return}let sub=collectSubmission();if(sub.confirmed.length!==3){status.className='notice';status.textContent='Sample and confirm all three slots.';return}let by=s=>sub.confirmed.find(x=>x.slot===s),p=by('Primary'),s=by('Secondary'),t=by('Tertiary'),pred=slot=>{let i=SLOTS.indexOf(slot),a=aggregate(samples[i]);return a?rank(a,slot)[0].name:null};btn.disabled=true;btn.textContent='Uploading screenshot…';try{let shot=await uploadScreenshot(sub);btn.textContent='Submitting result…';let payload={client_submission_id:sub.id,tester_name:sub.meta.tester||null,platform:sub.meta.platform,scanner_version:SCANNER_VERSION,database_version:DATABASE_VERSION,hdr:boolSetting(sub.meta.hdr),colour_correction:boolSetting(sub.meta.colourCorrection),predicted_primary:pred('Primary'),predicted_secondary:pred('Secondary'),predicted_tertiary:pred('Tertiary'),confirmed_primary:p.colour,confirmed_secondary:s.colour,confirmed_tertiary:t.colour,primary_rgb:p.rgb,secondary_rgb:s.rgb,tertiary_rgb:t.rgb,primary_lab:p.lab,secondary_lab:s.lab,tertiary_lab:t.lab,source_id:sub.meta.sourceId||null,screenshot_filename:sub.meta.filename||null,screenshot_url:shot.path,screenshot_mime:shot.mime,screenshot_size_bytes:shot.size,screenshot_consent:true,notes:sub.meta.notes||null,status:'pending'};let res=await fetch(`${SUPABASE_URL}/rest/v1/kubrow_submissions`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,Prefer:'return=minimal'},body:JSON.stringify(payload)});if(!res.ok)throw Error(`${res.status}: ${await res.text()}`);saveLocal(sub);status.className='info';status.innerHTML='<b>Submitted successfully.</b> Screenshot uploaded privately and result is pending review.';document.getElementById('consent').checked=false;document.getElementById('imageConsent').checked=false}catch(e){saveLocal(sub);status.className='notice';status.textContent='Online submission failed; local colour backup saved. '+(e.message||e)}finally{btn.disabled=false;btn.textContent='Submit verified result'}}
document.getElementById('submitCloud').onclick=submitCloud;document.getElementById('saveConfirmed').onclick=()=>saveLocal();
function download(name,data,type='application/json'){let b=new Blob([data],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}document.getElementById('downloadSubmission').onclick=()=>{let s=collectSubmission();if(!s.confirmed.length)return alert('Choose at least one confirmed colour.');download(`willyguru-submission-${s.id}.json`,JSON.stringify(s,null,2))};document.getElementById('exportDb').onclick=()=>download('willyguru-local-references.json',JSON.stringify(getDb(),null,2));document.getElementById('exportCsv').onclick=()=>{let rows=[['colour','slot','r','g','b','L','a','bLab','platform','created']];getDb().samples.forEach(x=>rows.push([x.colour,x.slot,...x.rgb,...x.lab,x.meta?.platform||'',x.created||'']));download('willyguru-local-references.csv',rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'),'text/csv')};document.getElementById('importDb').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let incoming=JSON.parse(await f.text());if(!Array.isArray(incoming.samples))throw Error('Invalid database');let db=getDb(),seen=new Set(db.samples.map(x=>`${x.submissionId}|${x.slot}|${x.colour}|${x.rgb}`)),added=0;incoming.samples.forEach(x=>{let k=`${x.submissionId}|${x.slot}|${x.colour}|${x.rgb}`;if(!seen.has(k)){db.samples.push(x);seen.add(k);added++}});setDb(db);alert(`Imported ${added} new samples.`)}catch(err){alert(err.message)}e.target.value=''};document.getElementById('clearDb').onclick=()=>{if(confirm('Delete local references and submissions on this device?')){localStorage.removeItem(DBKEY);localStorage.removeItem(SUBKEY);renderDb();renderSlots()}};
async function loadOnline(){let status=document.getElementById('onlineStatus');try{let res=await fetch(`${SUPABASE_URL}/rest/v1/approved_reference_samples?select=id,colour,slot,rgb,lab,platform,hdr,colour_correction,created_at&order=id.asc`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});if(!res.ok)throw Error(`${res.status}: ${await res.text()}`);let rows=await res.json();onlineSamples=rows.map(x=>({colour:x.colour,slot:x.slot,rgb:x.rgb,lab:x.lab,platform:x.platform,created:x.created_at}));localStorage.setItem(ONLINEKEY,JSON.stringify(onlineSamples));status.innerHTML=`<span class="statusDot online"></span>${onlineSamples.length} approved online references loaded`;renderDb();renderSlots()}catch(e){try{onlineSamples=JSON.parse(localStorage.getItem(ONLINEKEY))||[]}catch{onlineSamples=[]}status.innerHTML=`<span class="statusDot"></span>Online refresh failed; using ${onlineSamples.length} cached references`;renderDb();renderSlots()}}
document.getElementById('refreshOnline').onclick=loadOnline;
function renderDb(){let local=getDb().samples,all=[...local,...onlineSamples],covered=new Set(all.map(x=>x.colour));document.getElementById('onlineRefs').textContent=onlineSamples.length;document.getElementById('localRefs').textContent=local.length;document.getElementById('coveredColours').textContent=covered.size;document.getElementById('localSubmissions').textContent=getSubs().length;document.getElementById('dbRows').innerHTML=COLOURS.map(c=>{let counts=SLOTS.map(s=>all.filter(x=>x.colour===c[0]&&x.slot===s).length);return `<tr><td><span class="swatch" style="background:${c[1]};display:inline-block;vertical-align:middle;margin-right:7px"></span>${c[0]}</td><td>${counts[0]}</td><td>${counts[1]}</td><td>${counts[2]}</td><td><b>${counts.reduce((a,b)=>a+b,0)}</b></td></tr>`}).join('')}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));document.querySelectorAll('.panelPage').forEach(p=>p.classList.remove('active'));document.getElementById('page-'+t.dataset.page).classList.add('active');if(t.dataset.page==='confirm')renderTrainingSlots();if(t.dataset.page==='database')renderDb()});document.getElementById('palette').innerHTML=COLOURS.map(c=>`<div class="chip"><span class="swatch" style="background:${c[1]}"></span><span>${c[0]}<br><small>${c[1]}</small></span></div>`).join('');renderSlots();renderDb();loadOnline();
