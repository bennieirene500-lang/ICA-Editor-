const input=document.getElementById('videoInput');
const dropZone=document.getElementById('dropZone');
const fileCard=document.getElementById('fileCard');
const fileName=document.getElementById('fileName');
const fileMeta=document.getElementById('fileMeta');
const removeFile=document.getElementById('removeFile');
const processBtn=document.getElementById('processBtn');
const emptyState=document.getElementById('emptyState');
const processingState=document.getElementById('processingState');
const processingTitle=document.getElementById('processingTitle');
const placeholderFrame=document.getElementById('placeholderFrame');
const videoPreviewWrap=document.getElementById('videoPreviewWrap');
const previewVideo=document.getElementById('previewVideo');
const resultPanel=document.getElementById('resultPanel');
const firstActions=document.getElementById('firstActions');
const newVideoBtn=document.getElementById('newVideoBtn');
const downloadBtn=document.getElementById('downloadBtn');
const downloadNoCaptionsBtn=document.getElementById('downloadNoCaptionsBtn');
const resultEyebrow=document.getElementById('resultEyebrow');
const resultTitle=document.getElementById('resultTitle');
const resultCopy=document.getElementById('resultCopy');
const uploadMessage=document.getElementById('uploadMessage');
const metadataCard=document.getElementById('metadataCard');
const metaDuration=document.getElementById('metaDuration');
const metaSize=document.getElementById('metaSize');
const metaFormat=document.getElementById('metaFormat');
const metaResolution=document.getElementById('metaResolution');
const readySummary=document.getElementById('readySummary');
const detailsToggle=document.getElementById('detailsToggle');
const metadataDetails=document.getElementById('metadataDetails');
const toggleMusic=document.getElementById('toggleMusic');
const toggleReframe=document.getElementById('toggleReframe');
const toggleTight=document.getElementById('toggleTight');
const goalModal=document.getElementById('goalModal');
const goalModalClose=document.getElementById('goalModalClose');
const goalChoices=[...document.querySelectorAll('.goal-choice')];
const produceHelp=document.querySelector('.produce-help');
const authGate=document.getElementById('authGate');
const loginForm=document.getElementById('loginForm');
const loginEmail=document.getElementById('loginEmail');
const loginPassword=document.getElementById('loginPassword');
const loginBtn=document.getElementById('loginBtn');
const authMessage=document.getElementById('authMessage');
const logoutBtn=document.getElementById('logoutBtn');
const usagePill=document.getElementById('usagePill');
const memberWelcome=document.getElementById('memberWelcome');
const memberAvatar=document.getElementById('memberAvatar');

const LIMITS={maxFileSizeBytes:500*1024*1024,minDurationSeconds:3,maxDurationSeconds:60};
let currentFile=null;
let currentMetadata=null;
let previewUrl=null;
let currentJobId=null;
let noCaptionUrl=null;
let lastFingerprint=null;
let selectedCommunicationGoal='';
let processingActive=false;
let authEnabled=false;
let memberState=null;
let rawPreviewUrl=null;

async function produceVideoStream(formData){
  const response=await fetch('/api/caption-video',{method:'POST',credentials:'same-origin',body:formData});
  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    const error=new Error(data.error||'ICA could not complete that request.');
    error.status=response.status;
    error.code=data.code;
    throw error;
  }

  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let buffer='';

  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    buffer+=decoder.decode(value,{stream:true});

    let boundary;
    while((boundary=buffer.indexOf('\n\n'))!==-1){
      const frame=buffer.slice(0,boundary);
      buffer=buffer.slice(boundary+2);
      const eventMatch=frame.match(/^event: (.+)$/m);
      const dataMatch=frame.match(/^data: (.+)$/m);
      if(!dataMatch)continue;
      const payload=JSON.parse(dataMatch[1]);
      const eventType=eventMatch?.[1]||'message';

      if(eventType==='result')return payload;
      if(eventType==='error'){
        const error=new Error(payload.error||'ICA could not prepare this video.');
        error.status=payload.status;
        error.code=payload.code;
        error.videosRemaining=payload.videosRemaining;
        throw error;
      }
      // heartbeat events are ignored — they exist only to keep the connection alive
    }
  }

  // Stream ended without ever sending a 'result' or 'error' event — the
  // connection was lost or the server exited mid-render. Don't silently
  // return undefined; surface it as an explicit failure.
  throw new Error('ICA lost connection while producing this video. Please try again.');
}

async function api(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data.error||'ICA could not complete that request.');
    error.status=response.status;
    error.code=data.code;
    error.videosRemaining=data.videosRemaining;
    throw error;
  }
  return data;
}

function bytes(value){const units=['B','KB','MB','GB'];let index=0;let size=value;while(size>=1024&&index<units.length-1){size/=1024;index+=1;}return `${size.toFixed(index?1:0)} ${units[index]}`;}
function duration(seconds){const rounded=Math.round(seconds);return `${Math.floor(rounded/60)}:${String(rounded%60).padStart(2,'0')}`;}
function format(file){return (file.name.split('.').pop()||'Video').toUpperCase();}
function message(text='',type=''){uploadMessage.textContent=text;uploadMessage.className='upload-message';if(text)uploadMessage.classList.add('visible');if(type)uploadMessage.classList.add(type);}
function clearMeta(){metadataCard.classList.remove('visible');metadataDetails.hidden=true;detailsToggle.setAttribute('aria-expanded','false');detailsToggle.textContent='View details';}
function validateFile(file){if(!file)return'No video was selected.';if(!file.type.startsWith('video/'))return'ICA could not read this recording. Please choose another video.';if(file.size>LIMITS.maxFileSizeBytes)return'This recording is too large. Please choose a shorter recording.';return null;}

function readMetadata(file){return new Promise((resolve,reject)=>{const video=document.createElement('video');const objectUrl=URL.createObjectURL(file);const cleanup=()=>{URL.revokeObjectURL(objectUrl);video.removeAttribute('src');};const timer=setTimeout(()=>{cleanup();reject(new Error('ICA could not read this video. Please try another recording.'));},12000);video.preload='metadata';video.onloadedmetadata=()=>{clearTimeout(timer);const metadata={duration:video.duration,width:video.videoWidth,height:video.videoHeight,size:file.size,format:format(file)};cleanup();resolve(metadata);};video.onerror=()=>{clearTimeout(timer);cleanup();reject(new Error('ICA could not open this video. Please try another recording.'));};video.src=objectUrl;});}
function validateMetadata(metadata){if(metadata.duration<LIMITS.minDurationSeconds)return'This video is too short. Please use a recording longer than 3 seconds.';if(metadata.duration>LIMITS.maxDurationSeconds)return'This video is longer than 60 seconds. Please use a shorter recording.';return null;}

function setAuthMessage(text='',type=''){authMessage.textContent=text;authMessage.className='auth-message';if(text)authMessage.classList.add('visible');if(type)authMessage.classList.add(type);}
function showLogin(){document.body.classList.add('auth-locked');document.body.classList.remove('auth-loading');authGate.hidden=false;window.setTimeout(()=>loginEmail.focus(),50);}
function unlockApp(){authGate.hidden=true;document.body.classList.remove('auth-locked','auth-loading');}
function updateMember(member,user={}){
  memberState=member;
  const name=member?.displayName||user.displayName||user.email?.split('@')[0]||'ICA Member';
  memberWelcome.textContent=`Welcome back, ${name}`;
  memberAvatar.textContent=name.charAt(0).toUpperCase();
  if(member?.unlimited){usagePill.textContent='Founder preview';}
  else{const remaining=Math.max(0,Number(member?.videosRemaining||0));usagePill.textContent=`${remaining} video${remaining===1?'':'s'} left this month`;}
  applyAllowanceState();
}
function applyAllowanceState(){const exhausted=memberState&&!memberState.unlimited&&Number(memberState.videosRemaining)<=0;if(exhausted){processBtn.disabled=true;if(produceHelp)produceHelp.textContent='Your included videos for this month have been used.';}else if(currentFile){processBtn.disabled=false;if(produceHelp)produceHelp.textContent='Ready. Press the button to continue.';}}

async function bootstrap(){
  try{
    const config=await api('/api/config');
    authEnabled=Boolean(config.authEnabled);
    LIMITS.maxFileSizeBytes=Number(config.maxUploadMb||500)*1024*1024;
    const session=await api('/api/auth/session');
    if(authEnabled&&!session.authenticated){showLogin();return;}
    updateMember(session.member,session.user);
    unlockApp();
  }catch(error){showLogin();setAuthMessage(error.message,'error');}
}

loginForm.addEventListener('submit',async event=>{event.preventDefault();loginBtn.disabled=true;loginBtn.textContent='Signing in…';setAuthMessage('');try{const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:loginEmail.value,password:loginPassword.value})});loginPassword.value='';updateMember(data.member,data.user);unlockApp();}catch(error){setAuthMessage(error.message,'error');}finally{loginBtn.disabled=false;loginBtn.textContent='Sign In';}});
logoutBtn.addEventListener('click',async()=>{await api('/api/auth/logout',{method:'POST',body:'{}'}).catch(()=>{});startNew();showLogin();});

async function refreshMember(){try{const data=await api('/api/member');updateMember(data.member);}catch(error){if(error.status===401)showLogin();}}

function showRawPreview(file){if(rawPreviewUrl)URL.revokeObjectURL(rawPreviewUrl);rawPreviewUrl=URL.createObjectURL(file);previewVideo.src=rawPreviewUrl;previewVideo.load();placeholderFrame.style.display='none';videoPreviewWrap.classList.add('visible');}
function openGoalModal(){selectedCommunicationGoal='';goalModal.hidden=false;document.body.classList.add('modal-open');window.setTimeout(()=>goalChoices[0]?.focus(),40);}
function closeGoalModal(){if(processingActive)return;goalModal.hidden=true;document.body.classList.remove('modal-open');processBtn.focus();}

async function selectFile(file){const fileError=validateFile(file);if(fileError){message(fileError,'error');return;}const fingerprint=`${file.name}:${file.size}:${file.lastModified}`;if(fingerprint===lastFingerprint&&currentFile){message('This video is already selected.','error');return;}message('Checking your video…');dropZone.classList.add('busy');processBtn.disabled=true;clearMeta();try{const metadata=await readMetadata(file);const metadataError=validateMetadata(metadata);if(metadataError)throw new Error(metadataError);currentFile=file;currentMetadata=metadata;lastFingerprint=fingerprint;fileName.textContent=file.name;fileMeta.textContent='Ready to continue';fileCard.classList.add('visible');metaDuration.textContent=duration(metadata.duration);metaSize.textContent=bytes(metadata.size);metaFormat.textContent=metadata.format;metaResolution.textContent=`${metadata.width} × ${metadata.height}`;metadataCard.classList.add('visible');readySummary.textContent=`${duration(metadata.duration)} · Ready to continue`;message('ICA will optimise this video for the best result.','success');emptyState.style.display='none';showRawPreview(file);applyAllowanceState();}catch(error){currentFile=null;currentMetadata=null;fileCard.classList.remove('visible');processBtn.disabled=true;clearMeta();message(error.message,'error');input.value='';}finally{dropZone.classList.remove('busy');}}

async function produceVideo(){
  if(!currentFile||!currentMetadata||!selectedCommunicationGoal)return;
  emptyState.style.display='none';resultPanel.classList.remove('visible');
  const progressMessages=['Understanding your message…','Planning the production…','Shaping the pacing…','Directing the camera movement…','Designing supporting visuals…','Adding purposeful motion…','Creating supporting captions…','Producing your finished video…','Almost finished…'];
  let progressIndex=0;processingTitle.textContent=progressMessages[progressIndex];const progressTimer=window.setInterval(()=>{progressIndex=Math.min(progressIndex+1,progressMessages.length-1);processingTitle.textContent=progressMessages[progressIndex];},5000);
  processingState.classList.add('visible');processBtn.disabled=true;message('ICA is producing your video. Keep this page open.');
  try{
    const formData=new FormData();formData.append('video',currentFile,currentFile.name);formData.append('communicationGoal',selectedCommunicationGoal);formData.append('includeMusic',String(toggleMusic.checked));formData.append('includeReframe',String(toggleReframe.checked));formData.append('roughCutIntensity',toggleTight.checked?'tight':'balanced');
    const data=await produceVideoStream(formData);
    previewUrl=data.outputUrl;currentJobId=data.jobId;noCaptionUrl=null;if(rawPreviewUrl){URL.revokeObjectURL(rawPreviewUrl);rawPreviewUrl=null;}previewVideo.src=previewUrl;previewVideo.load();videoPreviewWrap.classList.add('visible');processingState.classList.remove('visible');resultPanel.classList.add('visible');firstActions.style.display='grid';downloadNoCaptionsBtn.hidden=!data.noCaptionAvailable;downloadNoCaptionsBtn.disabled=false;downloadNoCaptionsBtn.textContent='Prepare Without Captions';
    const outcomeNames={educational:'Teach',sales:'Sell',story:'Story',motivation:'Inspire'};const outcomeName=outcomeNames[data.producer?.goal]||'chosen';resultEyebrow.textContent='Your video is ready';resultTitle.textContent='Preview your finished ICA production.';resultCopy.textContent=`ICA used the ${outcomeName} strategy to strengthen clarity, pacing, captions and purposeful visual motion.`;message('Your finished video is ready.','success');if(data.usage)updateMember(data.usage);
  }catch(error){processingState.classList.remove('visible');emptyState.style.display='block';message(error.message||'ICA could not prepare this video.','error');if(error.status===401)showLogin();if(error.code==='VIDEO_ALLOWANCE_EXHAUSTED')await refreshMember();}
  finally{window.clearInterval(progressTimer);processBtn.disabled=false;applyAllowanceState();}
}

function startNew(){selectedCommunicationGoal='';input.value='';currentFile=null;currentMetadata=null;lastFingerprint=null;previewUrl=null;noCaptionUrl=null;currentJobId=null;if(rawPreviewUrl){URL.revokeObjectURL(rawPreviewUrl);rawPreviewUrl=null;}fileCard.classList.remove('visible');processBtn.disabled=true;message('');clearMeta();previewVideo.removeAttribute('src');previewVideo.load();emptyState.style.display='block';processingState.classList.remove('visible');resultPanel.classList.remove('visible');videoPreviewWrap.classList.remove('visible');placeholderFrame.style.display='block';if(produceHelp)produceHelp.textContent='Add your video first. ICA will guide the next step.';}
function download(url){if(!url)return;const link=document.createElement('a');link.href=`${url}${url.includes('?')?'&':'?'}download=1`;document.body.appendChild(link);link.click();link.remove();}

input.addEventListener('change',event=>selectFile(event.target.files[0]));
['dragenter','dragover'].forEach(name=>dropZone.addEventListener(name,event=>{event.preventDefault();dropZone.classList.add('dragging');}));
['dragleave','drop'].forEach(name=>dropZone.addEventListener(name,event=>{event.preventDefault();dropZone.classList.remove('dragging');}));
dropZone.addEventListener('drop',event=>{const file=event.dataTransfer.files[0];if(file)selectFile(file);});
removeFile.addEventListener('click',event=>{event.preventDefault();startNew();});
processBtn.addEventListener('click',()=>{if(currentFile&&currentMetadata)openGoalModal();});
goalChoices.forEach(choice=>choice.addEventListener('click',async()=>{if(processingActive)return;selectedCommunicationGoal=choice.dataset.goal||'';if(!selectedCommunicationGoal)return;processingActive=true;goalChoices.forEach(item=>item.disabled=true);goalModalClose.disabled=true;goalModal.hidden=true;document.body.classList.remove('modal-open');try{await produceVideo();}finally{processingActive=false;goalChoices.forEach(item=>item.disabled=false);goalModalClose.disabled=false;}}));
goalModalClose.addEventListener('click',closeGoalModal);goalModal.addEventListener('click',event=>{if(event.target?.hasAttribute('data-close-goal-modal'))closeGoalModal();});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!goalModal.hidden)closeGoalModal();});
detailsToggle.addEventListener('click',()=>{const expanded=detailsToggle.getAttribute('aria-expanded')==='true';detailsToggle.setAttribute('aria-expanded',String(!expanded));metadataDetails.hidden=expanded;detailsToggle.textContent=expanded?'View details':'Hide details';});
newVideoBtn.addEventListener('click',startNew);downloadBtn.addEventListener('click',()=>download(previewUrl));
downloadNoCaptionsBtn.addEventListener('click',async()=>{if(!currentJobId)return;downloadNoCaptionsBtn.disabled=true;downloadNoCaptionsBtn.textContent='Preparing…';try{if(!noCaptionUrl){const data=await api(`/api/jobs/${currentJobId}/no-captions`,{method:'POST',body:'{}'});noCaptionUrl=data.url;}download(noCaptionUrl);downloadNoCaptionsBtn.textContent='Download Without Captions';}catch(error){message(error.message,'error');downloadNoCaptionsBtn.textContent='Prepare Without Captions';}finally{downloadNoCaptionsBtn.disabled=false;}});

void bootstrap();
