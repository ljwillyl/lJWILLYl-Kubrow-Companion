
'use strict';
const client=window.KubrowApp.getSupabaseClient();
let session=null,records=[],signedImages={};
const dnaUrl=r=>`dna.html?id=${encodeURIComponent(r.kdna_id||r.id)}`;

const $=id=>document.getElementById(id);
const msg=(id,text,type='')=>{$(id).textContent=text;$(id).className='message '+type};

$('signIn').onclick=async()=>{
  msg('authMessage','Signing in…');
  const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
  if(error)msg('authMessage',error.message,'error');
};
$('signUp').onclick=async()=>{
  msg('authMessage','Creating account…');
  const {data,error}=await client.auth.signUp({email:$('email').value.trim(),password:$('password').value});
  if(error)return msg('authMessage',error.message,'error');
  msg('authMessage',data.session?'Account created and signed in.':'Account created. Check your email if confirmation is enabled.','good');
};
$('signOut').onclick=()=>client.auth.signOut();

client.auth.onAuthStateChange((_event,newSession)=>{session=newSession;renderAuth();});
(async()=>{const {data}=await client.auth.getSession();session=data.session;renderAuth();})();

async function renderAuth(){
  const signed=!!session;
  $('authCard').hidden=signed;
  $('accountCard').hidden=!signed;
  $('app').hidden=!signed;
  if(!signed){records=[];return}
  $('accountEmail').textContent=session.user.email||'Breeder';
  await Promise.all([loadProfile(),loadKennel()]);
}

async function loadProfile(){
  const {data,error}=await client.from('breeder_profiles').select('display_name,platform,contact_handle,bio,is_public').eq('user_id',session.user.id).maybeSingle();
  if(error)return msg('profileMessage',error.message,'error');
  $('displayName').value=data?.display_name||'';
  $('profilePlatform').value=data?.platform||'';
  $('contactHandle').value=data?.contact_handle||'';
  $('profileBio').value=data?.bio||'';
  $('publicProfile').checked=!!data?.is_public;
}
$('saveProfile').onclick=async()=>{
  const payload={
    user_id:session.user.id,
    display_name:$('displayName').value.trim()||null,
    platform:$('profilePlatform').value||null,
    contact_handle:$('contactHandle').value.trim()||null,
    bio:$('profileBio').value.trim()||null,
    is_public:$('publicProfile').checked
  };
  const {error}=await client.from('breeder_profiles').upsert(payload,{onConflict:'user_id'});
  msg('profileMessage',error?error.message:'Profile saved.',error?'error':'good');
};

async function loadKennel(){
  const {data,error}=await client
    .from('kennel_kubrows')
    .select('*')
    .eq('owner_id',session.user.id)
    .order('created_at',{ascending:false});
  if(error)return msg('saveMessage',error.message,'error');
  records=data||[];
  signedImages={};
  await Promise.all(records.filter(r=>r.screenshot_path).map(async r=>{
    const {data:shot}=await client.storage.from(window.KUBROW_CONFIG.storageBucket).createSignedUrl(r.screenshot_path,3600);
    if(shot?.signedUrl)signedImages[r.id]=shot.signedUrl;
  }));
  renderList();
}

function formPayload(){
  return {
    owner_id:session.user.id,name:$('kubrowName').value.trim(),companion_type:$('companionType').value||'kubrow',body_form:$('buildType').value||null,channel4_role:$('channel4Role').value||null,breed:$('breed').value.trim()||null,
    pattern:$('pattern').value.trim()||null,gender:$('gender').value||null,
    build_type:$('buildType').value||null,
    build_notes:$('buildNotes').value.trim()||null,
    primary_colour:$('primaryColour').value.trim()||null,secondary_colour:$('secondaryColour').value.trim()||null,
    tertiary_colour:$('tertiaryColour').value.trim()||null,eye_colour:$('eyeColour').value.trim()||null,
    accent_colour:$('accentColour').value.trim()||null,verification_source:$('verification').value,
    imprints_remaining:$('imprints').value===''?null:Number($('imprints').value),
    trade_status:$('tradeStatus').value,asking_price:$('askingPrice').value===''?null:Number($('askingPrice').value),
    notes:$('notes').value.trim()||null,is_public:$('isPublic').checked,
    review_status:$('isPublic').checked?'pending':'pending'
  };
}
$('saveKubrow').onclick=async()=>{
  const p=formPayload();if(!p.name)return msg('saveMessage','Kubrow name is required.','error');
  const id=$('recordId').value;msg('saveMessage','Saving…');
  const q=id
    ? client
        .from('kennel_kubrows')
        .update(p)
        .eq('id',id)
        .eq('owner_id',session.user.id)
    : client
        .from('kennel_kubrows')
        .insert(p);
  const {error}=await q;
  if(error)return msg('saveMessage',error.message,'error');
  msg('saveMessage',id?'Kubrow updated.':'Kubrow saved to your private kennel.','good');
  clearForm();await loadKennel();
};
$('clearForm').onclick=clearForm;
function clearForm(){
  ['recordId','kubrowName','breed','pattern','buildNotes','primaryColour','secondaryColour','tertiaryColour','eyeColour','accentColour','askingPrice','notes'].forEach(id=>$(id).value='');
  $('companionType').value='kubrow';$('channel4Role').value='eye';$('gender').value='';$('buildType').value='';$('imprints').value='';$('verification').value='manual';$('tradeStatus').value='private';$('isPublic').checked=false;$('formTitle').textContent='New kennel record';const summary=$('formSummaryTitle');if(summary)summary.textContent='Manual kennel record';
}

function editRecord(id){
  const r=records.find(x=>x.id===id);if(!r)return;
  $('recordId').value=r.id;$('kubrowName').value=r.name||'';$('companionType').value=r.companion_type||'kubrow';$('breed').value=r.breed||'';$('pattern').value=r.pattern||'';
  $('gender').value=r.gender||'';$('buildType').value=r.build_type||'';$('buildNotes').value=r.build_notes||'';$('primaryColour').value=r.primary_colour||'';
  $('secondaryColour').value=r.secondary_colour||'';$('tertiaryColour').value=r.tertiary_colour||'';$('eyeColour').value=r.eye_colour||'';
  $('accentColour').value=r.accent_colour||'';$('channel4Role').value=r.channel4_role||'eye';window.updateCompanionFields?.();$('verification').value=r.verification_source||'manual';
  $('imprints').value=r.imprints_remaining??'';$('tradeStatus').value=r.trade_status||'private';$('askingPrice').value=r.asking_price??'';
  $('notes').value=r.notes||'';$('isPublic').checked=!!r.is_public;$('formTitle').textContent='Edit '+r.name;const summary=$('formSummaryTitle');if(summary)summary.textContent='Edit '+r.name;const editor=document.querySelector('.recordEditor');if(editor)editor.open=true;
  window.scrollTo({top:editor?.offsetTop||$('app').offsetTop+100,behavior:'smooth'});
}
async function deleteRecord(id,name){
  if(!confirm('Delete '+name+' from your kennel?'))return;
  const record=records.find(r=>String(r.id)===String(id));
  const {error}=await client
    .from('kennel_kubrows')
    .delete()
    .eq('id',id)
    .eq('owner_id',session.user.id);
  if(error)return alert(error.message);
  if(record?.screenshot_path)await client.storage.from(window.KUBROW_CONFIG.storageBucket).remove([record.screenshot_path]);
  await loadKennel();
}


const ACTIVE_LISTINGS=['for_sale','open_to_offers','reserved'];
function isListed(record){return !!record?.is_public&&ACTIVE_LISTINGS.includes(record?.trade_status)}
function openSellModal(id){
  const r=records.find(x=>String(x.id)===String(id));if(!r)return;
  $('sellRecordId').value=r.id;
  $('sellModalTitle').textContent=isListed(r)?'Edit '+r.name+' listing':'Sell '+r.name;
  $('sellKubrowSummary').innerHTML=`<strong>${esc(r.name)}</strong><span>${esc([r.breed,r.pattern,r.build_type].filter(Boolean).join(' · ')||'Traits not recorded')}</span>`;
  $('sellTradeStatus').value=ACTIVE_LISTINGS.includes(r.trade_status)?r.trade_status:'for_sale';
  $('sellAskingPrice').value=r.asking_price??'';
  $('sellListingNotes').value=r.listing_notes||'';
  $('publishListing').textContent=isListed(r)?'Save listing':'Publish listing';
  $('removeListing').hidden=!isListed(r);
  msg('sellMessage','');
  $('sellModal').hidden=false;document.body.classList.add('modalOpen');
}
function closeSellModal(){$('sellModal').hidden=true;document.body.classList.remove('modalOpen')}
document.querySelectorAll('[data-close-sell]').forEach(el=>el.addEventListener('click',closeSellModal));
$('publishListing').onclick=async()=>{
  const id=$('sellRecordId').value,status=$('sellTradeStatus').value;
  const price=$('sellAskingPrice').value===''?null:Number($('sellAskingPrice').value);
  if(status==='for_sale'&&price===null)return msg('sellMessage','Enter a price or choose Open to offers.','error');
  msg('sellMessage','Publishing listing…');
  const {error}=await client.from('kennel_kubrows').update({is_public:true,trade_status:status,asking_price:price,listing_notes:$('sellListingNotes').value.trim()||null}).eq('id',id).eq('owner_id',session.user.id);
  if(error)return msg('sellMessage',error.message,'error');
  msg('sellMessage','Listing published.','good');await loadKennel();setTimeout(closeSellModal,500);
};
$('removeListing').onclick=async()=>{
  const id=$('sellRecordId').value;if(!confirm('Remove this Kubrow from the Marketplace?'))return;
  msg('sellMessage','Removing listing…');
  const {error}=await client.from('kennel_kubrows').update({trade_status:'not_for_sale',asking_price:null,listing_notes:null}).eq('id',id).eq('owner_id',session.user.id);
  if(error)return msg('sellMessage',error.message,'error');
  await loadKennel();closeSellModal();
};

const filterToggle=$('toggleKennelFilters');
if(filterToggle){filterToggle.onclick=()=>{const panel=$('kennelFilters'),open=panel.hidden;panel.hidden=!open;filterToggle.setAttribute('aria-expanded',String(open));filterToggle.textContent=open?'Filters −':'Filters +';};}
$('search').oninput=renderList;['filterBuild','filterTrade','filterVerified'].forEach(id=>{const el=$(id);if(el)el.onchange=renderList;});
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function colourToCss(name){
  const value=String(name||'').trim().toLowerCase();
  const known={black:'#17191d',white:'#e8edf1',grey:'#7c8791',gray:'#7c8791',red:'#9f3340',orange:'#b9652d',yellow:'#c6a53a',gold:'#b88a37',brown:'#72503a',tan:'#a57d58',beige:'#bda886',green:'#4f805e',emerald:'#237867',blue:'#416f9e',navy:'#263f68',purple:'#72558c',pink:'#a75d7f'};
  for(const [key,colour] of Object.entries(known))if(value.includes(key))return colour;
  let hash=0;for(const char of value)hash=((hash<<5)-hash)+char.charCodeAt(0);
  return `hsl(${Math.abs(hash)%360} 32% 48%)`;
}
function renderList(){
  const q=$('search').value.trim().toLowerCase(),build=$('filterBuild')?.value||'',trade=$('filterTrade')?.value||'',verified=$('filterVerified')?.checked;
  const shown=records.filter(r=>(!q||[r.name,r.breed,r.pattern,r.primary_colour,r.secondary_colour,r.tertiary_colour].some(v=>(v||'').toLowerCase().includes(q)))&&(!build||r.build_type===build)&&(!trade||r.trade_status===trade)&&(!verified||r.verification_source==='screenshot'));
  $('emptyKennel').hidden=shown.length>0;
  $('kennelList').innerHTML=shown.map(r=>{
    const traits=[r.companion_type&&r.companion_type!=='kubrow'?r.companion_type.replaceAll('_',' '):null,r.breed,r.pattern,r.build_type].filter(Boolean).join(' · ')||'Traits not recorded';
    const listed=isListed(r);
    const swatches=[['Primary',r.primary_colour],['Secondary',r.secondary_colour],['Tertiary',r.tertiary_colour]].map(([label,value])=>`<div class="colourSwatch"><span class="swatchDot" style="--swatch:${colourToCss(value)}"></span><div><small>${label}</small><strong>${esc(value||'Unknown')}</strong></div></div>`).join('');
    return `<article class="kubrow kubrowWithImage">
      <div class="kubrowMedia">${signedImages[r.id]?`<img class="kennelShot" src="${signedImages[r.id]}" alt="Appearance screenshot for ${esc(r.name)}">`:`<div class="shotPlaceholder">No appearance screenshot saved</div>`}<span class="listingRibbon ${listed?'live':''}">${listed?'Marketplace live':'Private collection'}</span></div>
      <div class="kubrowCardBody">
        <div class="kubrowCardTop"><div class="kubrowTitle"><h3>${esc(r.name)}</h3><a class="kdnaPill" href="${dnaUrl(r)}">${esc(r.kdna_id||'DNA pending')}</a><div class="kubrowTraits">${esc(traits)}</div></div>
        <div class="tags compactTags"><span class="tag ${r.verification_source==='screenshot'?'paletteBadge':''}">${r.verification_source==='screenshot'?'VERIFIED':'MANUAL'}</span><span class="tag review-${esc(r.review_status||'pending')}">${r.is_public?esc(r.review_status||'pending'):'PRIVATE'}</span></div></div>
        <div class="colourSwatches">${swatches}</div>
        <div class="kubrowFacts"><div class="kubrowFact"><small>Gender</small><strong>${esc(r.gender||'Unknown')}</strong></div><div class="kubrowFact"><small>Imprints</small><strong>${r.imprints_remaining??'Unknown'}</strong></div><div class="kubrowFact"><small>Status</small><strong>${esc((r.trade_status||'private').replaceAll('_',' '))}</strong></div></div>
        <div class="kubrowActions"><a class="secondary buttonLink" href="${dnaUrl(r)}">View DNA</a><button class="primary" data-sell="${r.id}">${listed?'Edit listing':'Sell Kubrow'}</button><button class="secondary" data-edit="${r.id}">Edit details</button><button class="secondary" data-share="${r.id}">Share card</button><button class="danger" data-delete="${r.id}" data-name="${esc(r.name)}">Delete Kubrow</button></div>
      </div>
    </article>`;
  }).join('');
  document.querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>openSellModal(b.dataset.sell));
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editRecord(b.dataset.edit));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteRecord(b.dataset.delete,b.dataset.name));
  document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>shareRecord(b.dataset.share));
  $('totalCount').textContent=records.length;
  $('verifiedCount').textContent=records.filter(r=>r.verification_source==='screenshot').length;
  $('lotusCount').textContent=records.filter(r=>(r.pattern||'').toLowerCase()==='lotus').length;
  $('bulkyCount').textContent=records.filter(r=>(r.build_type||'').toLowerCase()==='bulky').length;
  $('saleCount').textContent=records.filter(isListed).length;
}
function shareRecord(id){
  const r=records.find(x=>String(x.id)===String(id));if(!r)return;
  const text=`${r.name}
${r.kdna_id||'DNA ID pending'}
${[r.breed,r.pattern,r.build_type].filter(Boolean).join(' · ')}
Primary: ${r.primary_colour||'Unknown'}
Secondary: ${r.secondary_colour||'Unknown'}
Tertiary: ${r.tertiary_colour||'Unknown'}
Eyes: ${r.eye_colour||'Unknown'}
Imprints: ${r.imprints_remaining??'Unknown'}
${r.verification_source==='screenshot'?'Palette Verified':'Manual record'}
View DNA: ${new URL(dnaUrl(r),location.href).href}
lJWILLYl Kubrow Companion`;
  if(navigator.share){navigator.share({title:r.name,text}).catch(()=>{});}
  else navigator.clipboard.writeText(text).then(()=>alert('Kubrow card copied to clipboard.'));
}
