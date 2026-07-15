
'use strict';

const COLOURS = {
  MundaneA:{name:'Ash Grey',hex:'#808079'}, MundaneB:{name:'Earth Brown',hex:'#806A5D'},
  MundaneC:{name:'Corpus Grey',hex:'#808080'}, MundaneD:{name:'Hek Green',hex:'#7E806A'},
  MundaneE:{name:'Kril Brown',hex:'#80745E'}, MundaneF:{name:'Gallium Grey',hex:'#78828C'},
  MundaneG:{name:'Grustrag Grey',hex:'#807A6C'}, MundaneH:{name:'Saturn Brown',hex:'#806753'},
  MidA:{name:'Sedna Grey',hex:'#807979'}, MidB:{name:'Derelict Black',hex:'#262626'},
  MidC:{name:'Mars Red',hex:'#805F44'}, MidD:{name:'Infested Black',hex:'#363333'},
  MidE:{name:'Void Black',hex:'#262020'}, MidF:{name:'Darvo Blue',hex:'#697280'},
  MidG:{name:'Ordis Grey',hex:'#72727A'}, MidH:{name:'Mercury Brown',hex:'#807461'},
  VibrantA:{name:'Anyo Grey',hex:'#363640'}, VibrantB:{name:'Ambulas Black',hex:'#342622'},
  VibrantC:{name:'Shadow Grey',hex:'#80736B'}, VibrantD:{name:'Sargas Brown',hex:'#C58D4D'},
  VibrantE:{name:'Jupiter Brown',hex:'#805A32'}, VibrantF:{name:'Phorid Red',hex:'#804330'},
  VibrantG:{name:'Alad Blue',hex:'#5B6B80'}, VibrantH:{name:'Venus Brown',hex:'#4D4146'},
  EyesA:{name:'Green',hex:'#9cad6c'}, EyesB:{name:'Light gold',hex:'#ad9365'},
  EyesC:{name:'Pink',hex:'#ad666f'}, EyesD:{name:'Purple',hex:'#9074ad'},
  EyesE:{name:'Blue',hex:'#6ca0ad'}, EyesF:{name:'Orange / Red',hex:'#ad6444'},
  EyesG:{name:'Lilac',hex:'#ad5aaa'}, EyesH:{name:'Black',hex:'#262626'},
  EyesI:{name:'Gold',hex:'#ad7c47'}
};


const connectLog = document.getElementById('connectLog');
const refreshLog = document.getElementById('refreshLog');
const forgetLog = document.getElementById('forgetLog');
const input = document.getElementById('logFile');
const help = document.getElementById('pickerHelp');
const deviceIntro = document.getElementById('deviceIntro');

const DB_NAME='willyguru-eelog';
const STORE='handles';
const HANDLE_KEY='eelog';
let connectedHandle=null;

function isMobile(){
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function supportsFileSystemAccess(){
  return typeof window.showOpenFilePicker==='function' && !isMobile();
}
function copyPathSynchronously(){
  const path = '%LocalAppData%\\Warframe';
  const area = document.createElement('textarea');
  area.value = path;
  area.style.position='fixed'; area.style.opacity='0';
  document.body.appendChild(area); area.select();
  let copied=false;
  try{copied=document.execCommand('copy')}catch(_){}
  area.remove();
  if(!copied && navigator.clipboard) navigator.clipboard.writeText(path).catch(()=>{});
}
function openHandleDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function saveHandle(handle){
  const db=await openHandleDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(handle,HANDLE_KEY);
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
  db.close();
}
async function loadHandle(){
  try{
    const db=await openHandleDb();
    const value=await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).get(HANDLE_KEY);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
    db.close();
    return value;
  }catch(_){ return null; }
}
async function clearHandle(){
  try{
    const db=await openHandleDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).delete(HANDLE_KEY);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }catch(_){}
}
async function ensurePermission(handle){
  if(!handle)return false;
  const opts={mode:'read'};
  if((await handle.queryPermission(opts))==='granted')return true;
  return (await handle.requestPermission(opts))==='granted';
}
function updateConnectedUi(){
  const connected=!!connectedHandle;
  refreshLog.hidden=!connected;
  forgetLog.hidden=!connected;
  connectLog.textContent=connected?'Choose a different EE.log':'Connect EE.log';
}
async function readFileObject(file){
  setStatus('Reading '+file.name+'…','Searching for the latest complete Kubrow colour block.');
  const text=await file.text();
  const parsed=parseLog(text);
  showResult(parsed,file.name);
}
async function readConnectedHandle(){
  if(!connectedHandle)throw new Error('No EE.log is connected.');
  if(!(await ensurePermission(connectedHandle)))throw new Error('Permission was not granted to read EE.log.');
  const file=await connectedHandle.getFile();
  await readFileObject(file);
}

connectLog.addEventListener('click',async()=>{
  help.hidden=false;
  if(supportsFileSystemAccess()){
    copyPathSynchronously();
    try{
      const [handle]=await window.showOpenFilePicker({
        multiple:false,
        types:[{description:'Warframe EE.log',accept:{'text/plain':['.log','.txt']}}]
      });
      connectedHandle=handle;
      await saveHandle(handle);
      updateConnectedUi();
      await readConnectedHandle();
    }catch(error){
      if(error&&error.name!=='AbortError')setStatus('Could not connect EE.log',error.message||String(error),true);
    }
  }else{
    input.value='';
    input.click();
  }
});

refreshLog.addEventListener('click',async()=>{
  try{await readConnectedHandle()}
  catch(error){setStatus('Could not refresh EE.log',error.message||String(error),true)}
});

forgetLog.addEventListener('click',async()=>{
  connectedHandle=null;
  await clearHandle();
  updateConnectedUi();
  setStatus('Connected file forgotten','Use Connect EE.log to choose it again.');
});

input.addEventListener('change',async()=>{
  const file=input.files&&input.files[0];
  if(!file)return;
  try{await readFileObject(file)}
  catch(error){setStatus('Could not read this log',error.message||String(error),true)}
});

(async function init(){
  if(isMobile()){
    deviceIntro.textContent='On mobile, select or share a copied EE.log from Downloads or Documents. Android normally cannot grant a website permanent access to Warframe’s protected game folder.';
    connectLog.textContent='Select copied EE.log';
  }else if(!supportsFileSystemAccess()){
    deviceIntro.textContent='Your browser requires you to select EE.log each time. Chrome or Edge on Windows supports connecting it once and refreshing later.';
  }else{
    connectedHandle=await loadHandle();
    updateConnectedUi();
    if(connectedHandle){
      setStatus('EE.log connection remembered','Press Refresh connected EE.log to read the latest version.');
    }
  }
})();
function setStatus(title,text,isError=false){
  document.getElementById('statusCard').hidden=false;
  const t=document.getElementById('statusTitle');
  t.textContent=title; t.className=isError?'error':'';
  document.getElementById('statusText').textContent=text;
}

function keyFromLine(line){
  const m=line.match(/KubrowPetColor(Eyes[A-I]|Mundane[A-H]|Mid[A-H]|Vibrant[A-H])\b/i);
  if(!m)return null;
  const raw=m[1];
  if(/^eyes/i.test(raw))return 'Eyes'+raw.slice(-1).toUpperCase();
  if(/^mundane/i.test(raw))return 'Mundane'+raw.slice(-1).toUpperCase();
  if(/^mid/i.test(raw))return 'Mid'+raw.slice(-1).toUpperCase();
  return 'Vibrant'+raw.slice(-1).toUpperCase();
}

function parseLog(text){
  const lines=text.split(/\r?\n/);
  const entries=[];
  lines.forEach((line,index)=>{
    const key=keyFromLine(line);
    if(key) entries.push({key,index,line});
  });

  const candidates=[];
  for(let i=0;i<=entries.length-5;i++){
    const w=entries.slice(i,i+5);
    const gaps=w.slice(1).map((x,j)=>x.index-w[j].index);
    const sequence=!w[0].key.startsWith('Eyes') &&
      !w[1].key.startsWith('Eyes') &&
      !w[2].key.startsWith('Eyes') &&
      w[3].key.startsWith('Eyes') &&
      !w[4].key.startsWith('Eyes');
    const close=gaps.every(g=>g>=1&&g<=2);
    if(!sequence||!close)continue;

    const near=lines.slice(Math.max(0,w[0].index-30),Math.min(lines.length,w[4].index+50)).join('\n');
    let score=w[4].index;
    if(/KubrowShipAvatar|FavouriteLoadOut|BuildLoadOut/i.test(near))score+=1000000;
    if(/CatbrowPetColor/i.test(near))score-=250000;
    candidates.push({entries:w,score,start:w[0].index,end:w[4].index});
  }

  if(!candidates.length){
    throw new Error('No complete five-entry Kubrow colour block was found. Equip the Kubrow, open its Appearance screen, then make a fresh copy of EE.log.');
  }
  candidates.sort((a,b)=>b.score-a.score);
  return {best:candidates[0],alternatives:candidates.slice(1,4),lines};
}

function decoded(candidate){
  const e=candidate.entries;
  // Confirmed by two controlled logs:
  // 1st fur = Primary, 2nd fur = Tertiary, 3rd fur = Secondary, 4th = Eyes, 5th fur = Accent/custom.
  return [
    {slot:'Primary',entry:e[0]},
    {slot:'Secondary',entry:e[2]},
    {slot:'Tertiary',entry:e[1]},
    {slot:'Eyes',entry:e[3]},
    {slot:'Accent / custom',entry:e[4]}
  ];
}

function resultHtml(item){
  const data=COLOURS[item.entry.key]||{name:'Unknown entry',hex:'#777'};
  return `<article class="result">
    <h3>${escapeHtml(item.slot)}</h3>
    <div class="colourLine"><span class="swatch" style="background:${data.hex}"></span>${escapeHtml(data.name)}</div>
    <div class="code">${escapeHtml(item.entry.key)} · ${data.hex}</div>
  </article>`;
}

function showResult(parsed,filename){
  setStatus('Log read successfully',`Loaded ${filename}. The highest-confidence complete colour block is shown below.`);
  document.getElementById('resultCard').hidden=false;
  document.getElementById('results').innerHTML=decoded(parsed.best).map(resultHtml).join('');
  document.getElementById('rawEvidence').textContent=parsed.best.entries.map(x=>x.line).join('\n');

  const altCard=document.getElementById('alternativesCard');
  const alt=document.getElementById('alternatives');
  if(parsed.alternatives.length){
    altCard.hidden=false;
    alt.innerHTML=parsed.alternatives.map((c,i)=>{
      const names=decoded(c).map(x=>`${x.slot}: ${(COLOURS[x.entry.key]||{}).name||x.entry.key}`).join(' · ');
      return `<div class="alt"><strong>Alternative ${i+1}</strong><div class="muted">${escapeHtml(names)}</div></div>`;
    }).join('');
  }else altCard.hidden=true;
  document.getElementById('resultCard').scrollIntoView({behavior:'smooth',block:'start'});
}

function escapeHtml(v){
  return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
