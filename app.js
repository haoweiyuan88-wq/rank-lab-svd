'use strict';

const byId = (id) => document.getElementById(id);
const original = byId('original');
const result = byId('result');
const rankInput = byId('rank');
const focusRange = byId('focusRange');
const formatNumber = new Intl.NumberFormat('en-US');
const samples = {astronaut:'Astronaut',garden:'Pavilion',flower:'Flower'};
const presets = [...document.querySelectorAll('[data-k]')];
const sampleButtons = [...document.querySelectorAll('[data-sample]')];
const maxEdge = 384;
const state = {
  source:null, mode:'gray', job:null, width:0, height:0,
  capacity:1, target:5, shown:0, ready:false, drawing:false,
  originalData:null, point:null, energy:null, from:4, channel:0, renderedKey:null
};
let selection = 0;
let dragDepth = 0;
let dragStartRank = null;
const channelNames = ['Red','Green','Blue'];
const factorFormat = new Intl.NumberFormat('en-US', {maximumSignificantDigits:4});

function pixelNumber(value) {
  const magnitude = Math.abs(value);
  if (magnitude < 1e-7) return '0.00';
  if (magnitude < .005) return value.toExponential(1).replace(/-/g, '−');
  return value.toFixed(2).replace('-', '−');
}

function factorNumber(value) {
  if (Math.abs(value) < 1e-9) return '0';
  if (Math.abs(value) < .001) return value.toExponential(2).replace(/-/g, '−');
  return factorFormat.format(value).replace('-', '−');
}

function frameKey() {
  return [state.from, state.target, state.point.x, state.point.y, state.channel].join('/');
}

function clearEvidence(message) {
  state.renderedKey = null;
  byId('stepDescription').textContent = message;
  byId('formula').textContent = '…';
  byId('formula').setAttribute('aria-label', message);
  byId('energy').hidden = byId('termDetail').hidden = true;
  byId('beforeLabel').textContent = 'Before';
  byId('afterLabel').textContent = 'After';
  byId('deltaSign').textContent = '+';
  for (const id of ['pixelBefore','pixelChange','pixelAfter']) byId(id).textContent = '—';
  byId('pixelEquation').setAttribute('aria-label', message);
  byId('probeLocation').textContent = 'Select a pixel in the original.';
  byId('mapStep').textContent = message;
  byId('changeMap').width = byId('changeMap').height = 1;
}

function showEvidence({before, after, delta, term, map}) {
  const {from, target:to, point, energy, capacity, mode, channel} = state;
  const count = Math.abs(to-from);
  const low = Math.min(from,to)+1, high = Math.max(from,to);
  const action = to >= from ? 'Added' : 'Removed';
  const symbol = to >= from ? '+' : '−';
  const description = count === 0 ? 'Same rank' : count === 1
    ? action + ' term ' + high : action + ' ' + count + ' terms (' + low + '–' + high + ')';
  byId('stepDescription').textContent = description;
  const matrix = (k) => '<span><i>A</i><sub>'+k+'</sub></span>';
  let equation = matrix(to) + '<span class="op">=</span>' + matrix(from);
  if (count) {
    const i = count === 1 ? high : 'i';
    const sum = count === 1 ? '' : '<span class="summation"><span class="sum-upper">'+high+'</span><span class="sigma">∑</span><span class="sum-lower">i = '+low+'</span></span>';
    equation += '<span class="op">'+symbol+'</span><span class="changed-term">'+sum+'<span>σ<sub>'+i+'</sub> <i>u</i><sub>'+i+'</sub> <i>v</i><sub>'+i+'</sub><sup>T</sup></span></span>';
  }
  const formula = byId('formula');
  formula.innerHTML = equation;
  formula.setAttribute('aria-label', 'Rank '+to+' from rank '+from+'. '+description+'.');
  const total = energy[capacity];
  byId('energy').textContent = total ? (100*Math.min(1,energy[to]/total)).toFixed(1)+'% energy' : 'Zero image energy';
  byId('energy').hidden = false;

  const channelLabel = mode === 'gray' ? 'Grayscale' : channelNames[channel];
  byId('probeLocation').textContent = 'Row '+(point.y+1)+' · Col '+(point.x+1);
  byId('beforeLabel').textContent = 'At k = '+from;
  byId('afterLabel').textContent = 'At k = '+to;
  const sign = delta < -1e-7 ? '−' : '+';
  const oldValue = pixelNumber(before), change = pixelNumber(Math.abs(delta)), newValue = pixelNumber(after);
  byId('pixelBefore').textContent = oldValue;
  byId('deltaSign').textContent = sign;
  byId('pixelChange').textContent = change;
  byId('pixelAfter').textContent = newValue;
  byId('pixelEquation').setAttribute('aria-label', channelLabel+' at row '+(point.y+1)+', column '+(point.x+1)+': '+oldValue+' '+sign+' '+change+' is approximately '+newValue);
  byId('termDetail').hidden = !term;
  if (term) {
    const t = term.index;
    byId('termCaption').textContent = 'Term '+t+(count > 1 ? ' alone' : '')+' at this pixel';
    const factors = byId('termFactors');
    if (term.sigma === 0) {
      factors.textContent = 'The singular value is zero. This term contributes 0.';
    } else {
      const factor = (label,value,title) => '<span class="factor" title="'+title+'"><small>'+label+'</small><b>'+value+'</b></span>';
      const times = '<span class="factor-op">×</span>';
      factors.innerHTML = factor('σ<sub>'+t+'</sub>',factorNumber(term.sigma),'Singular value')+times+
        factor('u<sub>'+t+'</sub>['+(point.y+1)+']',factorNumber(term.u),'Left singular vector at this row')+times+
        factor('v<sub>'+t+'</sub>['+(point.x+1)+']',factorNumber(term.v),'Right singular vector at this column')+
        '<span class="factor-op">≈</span>'+factor('Term value',pixelNumber(term.value),'Signed contribution of this term');
    }
  }
  byId('mapStep').textContent = 'k = '+from+' → '+to+' · '+channelLabel;
  const canvas = byId('changeMap');
  canvas.width = map.width;
  canvas.height = map.height;
  canvas.getContext('2d').putImageData(new ImageData(map.rgba,map.width,map.height),0,0);
  canvas.setAttribute('aria-label', channelLabel+' change map from rank '+from+' to '+to+'. Green means brighter and coral means darker.');
}

function notice(text = '') {
  byId('message').textContent = text;
  byId('message').hidden = !text;
}

function loading(text = '') {
  byId('loading').textContent = text;
  byId('loading').hidden = !text;
  byId('resultWell').setAttribute('aria-busy', String(Boolean(text)));
}

function fittedDimensions(width, height) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

function rangeStyle(el, k, cap) {
  el.max = String(cap);
  el.value = String(k);
  const progress = cap > 1 ? (k-1) * 100 / (cap-1) : 100;
  el.style.setProperty('--progress', progress + '%');
  el.setAttribute('aria-valuetext', k + ' of ' + cap + ' terms');
}

function reflectRank() {
  const {target:k,capacity:cap,mode,width,height,ready} = state;
  const channels = mode === 'gray' ? 1 : 3;
  for (const el of [rankInput,focusRange]) {
    rangeStyle(el,k,cap);
    el.disabled = !ready || cap === 1;
  }
  byId('minus').disabled = !ready || k <= 1;
  byId('plus').disabled = !ready || k >= cap;
  byId('rankValue').value = k;
  byId('rankHelp').textContent = channels === 1 ? 'Number of singular values to keep' : 'Singular values kept per color channel';
  byId('rangeCount').textContent = cap + ' available';
  byId('maxRank').textContent = cap;
  byId('focusValue').textContent = 'k = ' + k;
  for (const button of presets) {
    const rank = Number(button.dataset.k);
    button.disabled = !ready || rank > cap;
    button.setAttribute('aria-pressed', String(k === rank));
  }
  const originalCount = height * width * channels;
  const factorCount = k * (height + width + 1) * channels;
  byId('originalCount').textContent = formatNumber.format(originalCount);
  byId('factorCount').textContent = formatNumber.format(factorCount);
  const share = originalCount ? factorCount * 100 / originalCount : 0;
  byId('storageRatio').textContent = share.toFixed(1) + '%';
  byId('storageCalc').textContent = (channels === 3 ? '3 × ' : '') + k + ' × (' + height + ' + ' + width + ' + 1) = ' + formatNumber.format(factorCount) + ' values';
  byId('download').disabled = !ready || state.shown !== k;
}

function requestFrame() {
  if (!state.job || !state.ready || state.drawing) return;
  const key = frameKey();
  if (key === state.renderedKey) return;
  state.drawing = true;
  state.job.postMessage({type:'draw', key, k:state.target, from:state.from, x:state.point.x, y:state.point.y,
    channel:state.channel, includeImage:state.target !== state.shown});
}

function setRank(value, from=state.target) {
  if (!state.ready) return;
  const k = Math.max(1,Math.min(state.capacity,Math.round(Number(value))));
  if (!Number.isFinite(k) || k === state.target) return;
  state.from = from;
  state.target = k;
  reflectRank();
  requestFrame();
}

function copyCanvas(source, target) {
  target.width = source.width;
  target.height = source.height;
  target.getContext('2d').drawImage(source,0,0);
}

function drawLoupe() {
  if (!state.originalData || !state.point) return;
  const {width,height,originalData,point,mode} = state;
  const cols = Math.min(width,8), rows = Math.min(height,8);
  const startX = Math.max(0,Math.min(width-cols,point.x - Math.floor(cols/2)));
  const startY = Math.max(0,Math.min(height-rows,point.y - Math.floor(rows/2)));
  const grid = byId('pixelGrid');
  const cell = 14;
  grid.width = cols * cell;
  grid.height = rows * cell;
  byId('gridSize').textContent = cols + ' × ' + rows;
  const ctx = grid.getContext('2d');
  const rgba = originalData.data;
  for (let y=0;y<rows;y++) for(let x=0;x<cols;x++) {
    const p = ((startY+y)*width+startX+x)*4;
    ctx.fillStyle = 'rgb(' + rgba[p] + ',' + rgba[p+1] + ',' + rgba[p+2] + ')';
    ctx.fillRect(x*cell,y*cell,cell,cell);
  }
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(174,188,173,.5)';
  ctx.beginPath();
  for(let x=1;x<cols;x++){ ctx.moveTo(x*cell+.5,0); ctx.lineTo(x*cell+.5,grid.height); }
  for(let y=1;y<rows;y++){ ctx.moveTo(0,y*cell+.5); ctx.lineTo(grid.width,y*cell+.5); }
  ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = '#cefe7b';
  ctx.strokeRect((point.x-startX)*cell+1,(point.y-startY)*cell+1,cell-2,cell-2);
  const pi = (point.y*width+point.x)*4;
  const value = mode==='gray' ? 'Brightness ' + rgba[pi] : 'RGB ('+[rgba[pi],rgba[pi+1],rgba[pi+2]].join(', ')+')';
  byId('pixelInfo').textContent = 'Row ' + (point.y+1) + ', column ' + (point.x+1) + ' · ' + value;
  for (const [canvas,marker] of [[original,byId('pixelMarker')],[byId('originalLarge'),byId('focusMarker')]]) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width/width,rect.height/height);
    if (scale > 0) {
      marker.style.left = ((rect.width-width*scale)/2+(point.x+.5)*scale)+'px';
      marker.style.top = ((rect.height-height*scale)/2+(point.y+.5)*scale)+'px';
      marker.hidden = false;
    }
  }
}

function pickPixel(event) {
  if (!state.originalData) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const scale = Math.min(rect.width/state.width,rect.height/state.height);
  if (!scale) return;
  const x = Math.floor((event.clientX-rect.left-(rect.width-state.width*scale)/2)/scale);
  const y = Math.floor((event.clientY-rect.top-(rect.height-state.height*scale)/2)/scale);
  if (x<0 || x>=state.width || y<0 || y>=state.height) return;
  state.point = {x,y};
  drawLoupe();
  requestFrame();
}

function workerError(message) {
  state.ready = false;
  state.drawing = false;
  state.job?.terminate();
  state.job = null;
  loading('Decomposition interrupted');
  clearEvidence('Calculation unavailable');
  notice(message || 'Processing stopped. Choose an image to try again.');
  reflectRank();
}

function processImage(resetPoint) {
  if (!state.source) return;
  if (state.job) state.job.terminate();
  state.job = null; state.ready = false; state.drawing = false; state.shown = 0; state.energy = null;
  dragStartRank = null;
  clearEvidence('Calculating…');
  byId('expand').disabled = true;
  byId('download').disabled = true;
  byId('imageK').textContent = '…';
  loading('Decomposing the image…');
  const {image,name,key} = state.source;
  const [width,height] = fittedDimensions(image.naturalWidth,image.naturalHeight);
  state.width = width; state.height = height;
  state.capacity = Math.min(width,height);
  state.target = Math.min(state.capacity,state.target);
  state.from = Math.max(0,state.target-1);
  state.channel = state.mode === 'gray' ? 0 : Number(byId('probeChannel').value);
  byId('channelControl').hidden = state.mode === 'gray';
  original.width = result.width = width;
  original.height = result.height = height;
  const ctx = original.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);
  ctx.imageSmoothingEnabled = width !== image.naturalWidth || height !== image.naturalHeight;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image,0,0,width,height);
  const data = ctx.getImageData(0,0,width,height);
  const rgba = data.data;
  const channels = state.mode === 'gray' ? 1 : 3;
  const pixels = new Uint8Array(width*height*channels);
  for(let p=0;p<width*height;p++){
    const offset=4*p;
    if(channels === 1){
      const g=Math.round(.299*rgba[offset]+.587*rgba[offset+1]+.114*rgba[offset+2]);
      rgba[offset]=rgba[offset+1]=rgba[offset+2]=pixels[p]=g;
    } else {
      pixels[3*p]=rgba[offset]; pixels[3*p+1]=rgba[offset+1]; pixels[3*p+2]=rgba[offset+2];
    }
  }
  if(channels===1) ctx.putImageData(data,0,0);
  delete original.dataset.empty;
  result.dataset.empty="true";
  state.originalData=data;
  if(resetPoint || !state.point) state.point={x:Math.floor(width*.52),y:Math.floor(height*.46)};
  original.setAttribute('aria-label',name+' in '+(channels===1?'grayscale':'color')+'. Use the arrow keys to select a pixel.');
  byId('dimensions').textContent='Working size '+width+' × '+height;
  byId('dimensions').title=name+' · Original '+image.naturalWidth+' × '+image.naturalHeight+' pixels · Working size '+width+' × '+height+' pixels';
  byId('gray').setAttribute('aria-pressed',String(channels===1));
  byId('rgb').setAttribute('aria-pressed',String(channels===3));
  sampleButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sample===key)));
  byId('sourceTitle').textContent=name;
  byId('sourceTitle').title=name;
  reflectRank(); drawLoupe();
  if(byId('focusDialog').open)copyCanvas(original,byId('originalLarge'));
  try {
    const worker=new Worker('svd-worker.js?v=2');
    state.job=worker;
    worker.addEventListener('error',()=> {if(state.job===worker)workerError('Processing stopped. Choose the image again.');});
    worker.onmessage=({data})=>{
      if(state.job!==worker) return;
      if(data.type==='error'){workerError(data.message);return;}
      if(data.type==='ready'){
        state.ready=true; state.energy=data.cumulative;
        reflectRank(); requestFrame();
      } else if(data.type==='frame'){
        state.drawing=false;
        if(data.key===frameKey()) {
          if (data.rgba) {
            result.getContext('2d').putImageData(new ImageData(data.rgba,width,height),0,0);
            delete result.dataset.empty;
            if(byId('focusDialog').open)copyCanvas(result,byId('resultLarge'));
          }
          state.shown=data.k;
          state.renderedKey=data.key;
          showEvidence(data.evidence);
          byId('imageK').textContent=data.k;
          result.setAttribute('aria-label',name+' reconstructed from '+data.k+' terms');
          byId('focusK').textContent='k = '+data.k;
          byId('expand').disabled=false;
          loading();
          byId('download').disabled=false;
        }
        requestFrame();
      }
    };
    worker.postMessage({type:'init',width,height,channels,pixels},[pixels.buffer]);
  } catch {workerError('Your browser could not start the calculation. Open this page in a current browser.');}
}

async function selectSource(url,name,key,fromFile) {
  const id=++selection;
  if(byId('file').value)byId('file').value='';
  notice();
  loading('Reading image…');
  byId('download').disabled=true;
  try {
    const image = new Image();
    const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
    image.src=url;
    await loaded;
    if(selection!==id)return;
    if(!image.naturalWidth || !image.naturalHeight)throw Error('Image dimensions are unavailable.');
    state.source={image,name,key};
    processImage(true);
  }catch{
    if(selection!==id)return;
    notice('This image could not be read. Try a JPG, PNG or WebP file. For iPhone HEIC photos, export a JPEG first.');
    if(state.source){loading(state.ready?'':'Decomposing the image…'); byId('download').disabled=!state.ready || state.shown!==state.target;}
    else loading('Choose an image to try again');
  }finally{if(fromFile)URL.revokeObjectURL(url);}
}

function acceptFile(file) {
  if(!file)return;
  const types=['image/jpeg','image/png','image/webp','image/gif','image/avif','image/bmp','image/x-ms-bmp'];
  const extension=/\.(jpe?g|png|webp|gif|avif|bmp)$/i;
  if(!(types.includes(file.type) || (!file.type && extension.test(file.name)))){
    notice('Choose a JPG, PNG, WebP, GIF, AVIF or BMP image. Export HEIC photos as JPEG first.'); return;
  }
  if(file.size>30*1024*1024){notice('This image is over 30 MB. Resize it or choose a smaller file.');return;}
  selectSource(URL.createObjectURL(file),file.name || 'My image',null,true);
}

byId('upload').addEventListener('click',()=>byId('file').click());
byId('file').addEventListener('change',({target})=>{const file=target.files[0];target.value='';acceptFile(file);});
for(const button of sampleButtons)button.addEventListener('click',()=>{
  const key=button.dataset.sample;
  selectSource('assets/'+key+'.jpg',samples[key],key,false);
});
for(const [id,mode] of [['gray','gray'],['rgb','rgb']])byId(id).addEventListener('click',()=>{
  if(state.mode===mode || !state.source)return;
  state.mode=mode;notice();processImage(false);
});
for (const input of [rankInput,focusRange]) {
  input.addEventListener('pointerdown',()=>{dragStartRank=state.target;});
  input.addEventListener('input',()=>setRank(input.value,dragStartRank ?? state.target));
}
for (const event of ['pointerup','pointercancel','blur']) window.addEventListener(event,()=>{dragStartRank=null;});
byId('probeChannel').addEventListener('change',({target})=>{
  state.channel = state.mode === 'gray' ? 0 : Number(target.value);
  requestFrame();
});
byId('minus').addEventListener('click',()=>setRank(state.target-1));
byId('plus').addEventListener('click',()=>setRank(state.target+1));
presets.forEach(b=>b.addEventListener('click',()=>setRank(b.dataset.k)));
function isFileDrag(event){return Array.from(event.dataTransfer?.types || []).includes('Files');}
document.addEventListener('dragenter',e=>{if(!isFileDrag(e))return;e.preventDefault();dragDepth++;byId('dropHint').hidden=false;});
document.addEventListener('dragover',e=>{if(isFileDrag(e)){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
document.addEventListener('dragleave',e=>{if(!isFileDrag(e))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)byId('dropHint').hidden=true;});
document.addEventListener('drop',e=>{if(!isFileDrag(e))return;e.preventDefault();dragDepth=0;byId('dropHint').hidden=true;acceptFile(e.dataTransfer.files[0]);});
function movePixel(e) {
  const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(!offsets[e.key] || !state.point)return;
  e.preventDefault();
  const [dx,dy]=offsets[e.key];
  state.point={x:Math.max(0,Math.min(state.width-1,state.point.x+dx)),y:Math.max(0,Math.min(state.height-1,state.point.y+dy))};
  drawLoupe();
  requestFrame();
}
const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(drawLoupe) : null;
for (const canvas of [original,byId('originalLarge')]) {
  canvas.tabIndex=0;
  canvas.addEventListener('click',pickPixel);
  canvas.addEventListener('keydown',movePixel);
  resizeObserver?.observe(canvas);
}
if (!resizeObserver) window.addEventListener('resize',drawLoupe);

byId('download').addEventListener('click',()=>{
  if(!state.ready || state.shown!==state.target)return;
  const title=(state.source.name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,55) || 'image');
  const filename=title+'-svd-'+state.mode+'-k'+state.shown+'.png';
  result.toBlob(blob=>{
    if(!blob){notice('The image could not be saved. Try again.');return;}
    const url=URL.createObjectURL(blob), anchor=document.createElement('a');
    anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  },'image/png');
});
for(const [button,dialog] of [['openInfo','infoDialog'],['openShare','shareDialog'],['credits','creditDialog']]){
  byId(button).addEventListener('click',()=>{if(dialog==='shareDialog')byId('copyStatus').textContent='';byId(dialog).showModal();});
}
byId('expand').addEventListener('click',()=>{
  copyCanvas(original,byId('originalLarge'));copyCanvas(result,byId('resultLarge'));
  byId('focusMathHost').append(byId('liveFormula'));
  byId('focusMapHost').append(byId('liveMap'));
  byId('focusDialog').showModal();
  drawLoupe();
});
byId('focusDialog').addEventListener('close',()=>{
  byId('formulaHome').append(byId('liveFormula'));
  byId('comparison').insertBefore(byId('liveMap'),byId('examples'));
});
for(const button of document.querySelectorAll('.close-dialog'))button.addEventListener('click',()=>button.closest('dialog').close());
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{
  if(e.target!==dialog)return;
  const box=dialog.getBoundingClientRect();
  if(e.clientX<box.left || e.clientX>box.right || e.clientY<box.top || e.clientY>box.bottom)dialog.close();
});
byId('copyLink').addEventListener('click',async()=>{
  const input=byId('shareUrl'),status=byId('copyStatus');
  try{await navigator.clipboard.writeText(input.value);status.textContent='Link copied. It is ready to share.';}
  catch {
    input.focus();
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    status.textContent = copied ? 'Link copied. It is ready to share.' : 'Link selected. Press and hold to copy, or use Ctrl/Cmd + C.';
  }
});

selectSource('assets/astronaut.jpg',samples.astronaut,'astronaut',false);
