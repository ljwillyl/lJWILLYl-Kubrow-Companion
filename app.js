'use strict';
const SUPABASE_URL='https://mxboguiriifkmsmcusjt.supabase.co',KEY='sb_publishable_gZwUnRiKV2Ww2wqAXs9mBA_Z8lFw0LV';
const sb=window.supabase.createClient(SUPABASE_URL,KEY),$=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const P=[['Ash Grey','#808079'],['Earth Brown','#806A5D'],['Corpus Grey','#808080'],['Hek Green','#7E806A'],['Kril Brown','#80745E'],['Gallium Grey','#78828C'],['Grustrag Grey','#807A6C'],['Saturn Brown','#806753'],['Sedna Grey','#807979'],['Derelict Black','#262626'],['Mars Red','#805F44'],['Infested Black','#363333'],['Void Black','#262020'],['Darvo Blue','#697280'],['Ordis Grey','#72727A'],['Mercury Brown','#807461'],['Anyo Grey','#363640'],['Ambulas Black','#342622'],['Shadow Grey','#80736B'],['Sargas Brown','#C58D4D'],['Jupiter Brown','#805A32'],['Phorid Red','#804330'],['Alad Blue','#5B6B80'],['Venus Brown','#4D4146']].map(([name,hex])=>({name,hex,rgb:h2r(hex)}));
let img,file,session,pts=[{x:.436,y:.474},{x:.436,y:.519},{x:.436,y:.565}],matches=[];

$('upload').onclick=()=>$('file').click();
$('file').onchange=e=>{file=e.target.files?.[0];if(!file)return;const u=window.URL.createObjectURL(file),im=new Image();im.onload=()=>{img=im;canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;ctx.drawImage(im,0,0);window.URL.revokeObjectURL(u);$('workspace').hidden=$('resultCard').hidden=$('detailsCard').hidden=false;$('scanStatus').textContent=`Loaded ${file.name} · ${im.naturalWidth}×${im.naturalHeight}`;detect();ocr();$('workspace').scrollIntoView({behavior:'smooth'})};im.src=u};
$('rerun').onclick=detect;

function detect(){const rows=[.474,.519,.565];pts=rows.map(y=>best(.405,.466,y-.012,y+.012));place();results()}
function best(x1,x2,y1,y2){
  let b={s:-1e9,x:(x1+x2)/2,y:(y1+y2)/2};
  const sx=Math.max(1,Math.round(canvas.width/500)),sy=Math.max(1,Math.round(canvas.height/600));
  for(let y=Math.floor(y1*canvas.height);y<y2*canvas.height;y+=sy){
    for(let x=Math.floor(x1*canvas.width);x<x2*canvas.width;x+=sx){
      const c=med(x,y,Math.max(3,canvas.width*.0035));
      const mx=Math.max(...c),mn=Math.min(...c),lum=(c[0]+c[1]+c[2])/3;
      const flat=variance(x,y,Math.max(3,canvas.width*.003));
      const tooWhite=lum>225&&mx-mn<25;
      const tooDark=lum<24;
      const score=(tooWhite||tooDark?-1000:0)+(mx-mn)*.25-flat*1.8;
      if(score>b.s)b={s:score,x:x/canvas.width,y:y/canvas.height};
    }
  }
  return{x:b.x,y:b.y};
}
function place(){pts.forEach((p,i)=>{let m=$('marker'+i);m.style.left=p.x*100+'%';m.style.top=p.y*100+'%'})}
document.querySelectorAll('.marker').forEach(m=>{let d=false;m.onpointerdown=e=>{d=true;m.setPointerCapture(e.pointerId)};m.onpointermove=e=>{if(!d)return;const r=$('imageWrap').getBoundingClientRect(),h=canvas.height*(r.width/canvas.width),i=+m.dataset.i;pts[i]={x:clamp((e.clientX-r.left)/r.width),y:clamp((e.clientY-r.top)/h)};place();results()};m.onpointerup=m.onpointercancel=()=>d=false});
function results(){matches=pts.map(p=>{const rgb=med(p.x*canvas.width,p.y*canvas.height,Math.max(3,canvas.width*.004)),lab=toLab(rgb),rank=P.map(c=>({...c,d:de(lab,toLab(c.rgb))})).sort((a,b)=>a.d-b.d);return{rgb,b:rank[0]}});const s=['Primary / Base','Secondary','Tertiary'];$('results').innerHTML=matches.map((m,i)=>`<article class="result"><h3>${s[i]}</h3><div class="colourRow"><span class="swatch" style="background:${m.b.hex}"></span>${m.b.name}</div><div class="code">Sample RGB(${m.rgb.join(', ')}) · ${m.b.hex}</div><div class="distance">ΔE ${m.b.d.toFixed(1)}</div></article>`).join('');const weak=matches.some(m=>m.b.d>9);$('warning').hidden=!weak;if(weak)$('warning').textContent='A marker is not close to an official palette value. Drag it into the flat centre of its colour box.'}

async function ocr(){const b=$('ocrBadge');try{const r=await Tesseract.recognize(canvas,'eng',{logger:m=>{if(m.status==='recognizing text')b.textContent=`Reading text ${Math.round((m.progress||0)*100)}%`}}),lines=(r.data.text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),ignore=/^(MAX RANK|ATTACHMENTS|SIGILS|BASE|SECONDARY|TERTIARY|EMISSIVE|ENERGY|RANDOM|DEFAULT|APPEARANCE)/i,name=lines.find(x=>/^[A-Z0-9 _-]{3,30}$/.test(x)&&!ignore.test(x)),pat=lines.find(x=>/FUR PATTERN/i.test(x));if(name)$('kubrowName').value=name;if(pat)$('pattern').value=pat.replace(/FUR PATTERN.*/i,'').replace(/[^A-Z -]/gi,'').trim();b.textContent='Text read — please check it'}catch(e){b.textContent='Text reading unavailable — enter manually'}}

sb.auth.onAuthStateChange((_e,s)=>{session=s;auth()});sb.auth.getSession().then(x=>{session=x.data.session;auth()});
function auth(){$('signedOut').hidden=!!session;$('signedIn').hidden=!session;if(session)$('accountEmail').textContent=session.user.email||'breeder'}
$('signIn').onclick=async()=>{setSave('Signing in…');const{error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});setSave(error?error.message:'Signed in.')};$('signOut').onclick=()=>sb.auth.signOut();
$('saveKennel').onclick=async()=>{if(!session||!file||matches.length!==3)return setSave('Upload a screenshot and sign in first.');const name=$('kubrowName').value.trim();if(!name)return setSave('Enter the Kubrow name.');setSave('Uploading screenshot…');const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,''),path=`${session.user.id}/${crypto.randomUUID()}.${ext}`,up=await sb.storage.from('kennel-screenshots').upload(path,file,{contentType:file.type||'image/jpeg'});if(up.error)return setSave(up.error.message);const payload={owner_id:session.user.id,name,breed:$('breed').value||null,pattern:$('pattern').value.trim()||null,build_type:$('buildType').value||null,gender:$('gender').value||null,primary_colour:matches[0].b.name,secondary_colour:matches[1].b.name,tertiary_colour:matches[2].b.name,eye_colour:$('eyes').value||null,primary_id:matches[0].b.hex,secondary_id:matches[1].b.hex,tertiary_id:matches[2].b.hex,verification_source:'screenshot',imprints_remaining:$('imprints').value===''?null:+$('imprints').value,trade_status:$('tradeStatus').value,asking_price:$('askingPrice').value===''?null:+$('askingPrice').value,notes:$('notes').value.trim()||null,screenshot_path:path,is_public:false};setSave('Saving kennel record…');const{error}=await sb.from('kennel_kubrows').insert(payload);if(error){await sb.storage.from('kennel-screenshots').remove([path]);return setSave(error.message)}setSave('Saved to My Kennel with the original screenshot.')};
function setSave(t){$('saveStatus').textContent=t}
function clamp(v){return Math.max(0,Math.min(1,v))}
function med(cx,cy,r){let x=Math.max(0,Math.round(cx-r)),y=Math.max(0,Math.round(cy-r)),w=Math.min(canvas.width-x,Math.round(r*2+1)),h=Math.min(canvas.height-y,Math.round(r*2+1)),d=ctx.getImageData(x,y,w,h).data,a=[[],[],[]];for(let i=0;i<d.length;i+=4){let mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);if(mx>238&&mx-mn<28)continue;a[0].push(d[i]);a[1].push(d[i+1]);a[2].push(d[i+2])}return a.map(v=>{v.sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:0})}
function variance(cx,cy,r){let x=Math.max(0,Math.round(cx-r)),y=Math.max(0,Math.round(cy-r)),w=Math.min(canvas.width-x,Math.round(r*2+1)),h=Math.min(canvas.height-y,Math.round(r*2+1)),d=ctx.getImageData(x,y,w,h).data,n=0,s=0,q=0;for(let i=0;i<d.length;i+=16){let v=(d[i]+d[i+1]+d[i+2])/3;n++;s+=v;q+=v*v}return n?Math.sqrt(Math.max(0,q/n-(s/n)**2)):999}
function h2r(h){return[1,3,5].map(i=>parseInt(h.slice(i,i+2),16))}function lin(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}function toLab(c){let[r,g,b]=c.map(lin),x=(.4124*r+.3576*g+.1805*b)/.95047,y=.2126*r+.7152*g+.0722*b,z=(.0193*r+.1192*g+.9505*b)/1.08883,f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;return[116*f(y)-16,500*(f(x)-f(y)),200*(f(y)-f(z))]}function de(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])}