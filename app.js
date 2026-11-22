'use strict';

const byId = (id) => document.getElementById(id);
const original = byId('original');
const result = byId('result');
const rankInput = byId('rank');
const focusRange = byId('focusRange');
const formatNumber = new Intl.NumberFormat('en-US');
const samples = {astronaut:'宇航员',garden:'古建筑',flower:'花卉'};
const presets = [...document.querySelectorAll('[data-k]')];
const sampleButtons = [...document.querySelectorAll('[data-sample]')];
const maxEdge = 384;
const state = {
  source:null, mode:'gray', job:null, width:0, height:0,
  capacity:1, target:5, shown:0, ready:false, drawing:false,
  originalData:null, point:null, energy:null
};
let selection = 0;
let dragDepth = 0;

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
  el.setAttribute('aria-valuetext', '保留 ' + k + ' 项，共 ' + cap + ' 项可选');
}

function reflectRank() {
  const {target:k,capacity:cap,mode,width,height,ready,energy} = state;
  const channels = mode === 'gray' ? 1 : 3;
  for (const el of [rankInput,focusRange]) {
    rangeStyle(el,k,cap);
    el.disabled = !ready || cap === 1;
  }
  byId('minus').disabled = !ready || k <= 1;
  byId('plus').disabled = !ready || k >= cap;
  byId('rankValue').value = k;
  byId('rankHelp').textContent = channels === 1 ? '保留的奇异值个数' : '每个颜色通道保留的奇异值个数';
  byId('rangeCount').textContent = '最多 ' + cap + ' 项';
  byId('maxRank').textContent = cap;
  byId('focusValue').textContent = 'k = ' + k;
  for (const e of document.querySelectorAll('[data-form-k]')) e.textContent = k;
  const formulaText = channels === 1
    ? '把最大的 ' + k + ' 个奇异值对应的成分相加。'
    : '红、绿、蓝三个通道各取前 ' + k + ' 项，再合成彩色图。';
  byId('formula').setAttribute('aria-label', 'A 下标 ' + k + ' 等于从第一项到第 ' + k + ' 项的加和');
  byId('formulaText').textContent = formulaText;
  // Numeric subscripts and the actual upper limit are also exposed in the enlarged view.
  const focusFormula = byId('focusFormula');
  focusFormula.replaceChildren('A');
  const sub = document.createElement('sub');
  sub.textContent = k;
  focusFormula.append(sub, ' = ');
  const sum = document.createElement('span');
  sum.textContent = '∑';
  const upper = document.createElement('sup');
  upper.textContent = k;
  const lower = document.createElement('sub');
  lower.textContent = 'i=1';
  focusFormula.append(sum, upper, lower, ' σᵢ uᵢ vᵢᵀ');
  if (channels === 3) focusFormula.append('　（每个颜色通道）');
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
  byId('storageCalc').textContent = (channels === 3 ? '3 × ' : '') + k + ' × (' + height + ' + ' + width + ' + 1) = ' + formatNumber.format(factorCount) + ' 个数';
  if (energy) {
    const total = energy[cap];
    const value = total > 0 ? (100 * Math.min(1, energy[k] / total)).toFixed(1) + '%' : '总能量为 0';
    byId('energy').textContent = total > 0 ? '保留能量 ' + value : value;
    byId('energy').hidden = false;
  } else byId('energy').hidden = true;
  byId('download').disabled = !ready || state.shown !== k;
}

function requestFrame() {
  if (!state.job || !state.ready || state.drawing || state.target === state.shown) return;
  state.drawing = true;
  state.job.postMessage({type:'draw',k:state.target});
}

function setRank(value) {
  if (!state.ready) return;
  const k = Math.max(1,Math.min(state.capacity,Math.round(Number(value))));
  if (!Number.isFinite(k)) return;
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
  const value = mode==='gray' ? '灰度值 ' + rgba[pi] : 'RGB ('+[rgba[pi],rgba[pi+1],rgba[pi+2]].join(', ')+')';
  byId('pixelInfo').textContent = '第 ' + (point.y+1) + ' 行，第 ' + (point.x+1) + ' 列 · ' + value;
  const rect = original.getBoundingClientRect();
  const scale = Math.min(rect.width/width,rect.height/height);
  if(scale > 0) {
    const marker = byId('pixelMarker');
    marker.style.left = ((rect.width-width*scale)/2+(point.x+.5)*scale)+'px';
    marker.style.top = ((rect.height-height*scale)/2+(point.y+.5)*scale)+'px';
    marker.hidden = false;
  }
}

function pickPixel(event) {
  if (!state.originalData) return;
  const rect = original.getBoundingClientRect();
  const scale = Math.min(rect.width/state.width,rect.height/state.height);
  if (!scale) return;
  const x = Math.floor((event.clientX-rect.left-(rect.width-state.width*scale)/2)/scale);
  const y = Math.floor((event.clientY-rect.top-(rect.height-state.height*scale)/2)/scale);
  if (x<0 || x>=state.width || y<0 || y>=state.height) return;
  state.point = {x,y};
  drawLoupe();
}

function workerError(message) {
  state.ready = false;
  state.drawing = false;
  state.job?.terminate();
  state.job = null;
  loading('本次分解未完成');
  notice(message || '本次计算未完成，请重新选择图片。');
  reflectRank();
}

function processImage(resetPoint) {
  if (!state.source) return;
  if (state.job) state.job.terminate();
  state.job = null; state.ready = false; state.drawing = false; state.shown = 0; state.energy = null;
  byId('expand').disabled = true;
  byId('download').disabled = true;
  byId('imageK').textContent = '…';
  loading('正在分解图像矩阵…');
  const {image,name,key} = state.source;
  const [width,height] = fittedDimensions(image.naturalWidth,image.naturalHeight);
  state.width = width; state.height = height;
  state.capacity = Math.min(width,height);
  state.target = Math.min(state.capacity,state.target);
  original.width = result.width = width;
  original.height = result.height = height;
  const ctx = original.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);
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
  original.setAttribute('aria-label',name+'的'+(channels===1?'灰度':'彩色')+'原图，使用方向键选择像素');
  byId('dimensions').textContent='计算尺寸 '+width+' × '+height;
  byId('dimensions').title=name+' · 源图 '+image.naturalWidth+' × '+image.naturalHeight+' 像素 · 计算图 '+width+' × '+height+' 像素';
  byId('gray').setAttribute('aria-pressed',String(channels===1));
  byId('rgb').setAttribute('aria-pressed',String(channels===3));
  sampleButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sample===key)));
  byId('sourceTitle').textContent=name;
  byId('sourceTitle').title=name;
  reflectRank(); drawLoupe();
  if(byId('focusDialog').open)copyCanvas(original,byId('originalLarge'));
  try {
    const worker=new Worker('svd-worker.js');
    state.job=worker;
    worker.addEventListener('error',()=> {if(state.job===worker)workerError('计算中断，请重新选择图片。');});
    worker.onmessage=({data})=>{
      if(state.job!==worker) return;
      if(data.type==='error'){workerError(data.message);return;}
      if(data.type==='ready'){
        state.ready=true; state.energy=data.cumulative;
        reflectRank(); requestFrame();
      } else if(data.type==='frame'){
        state.drawing=false;
        if(data.k===state.target) {
          result.getContext('2d').putImageData(new ImageData(data.rgba,width,height),0,0);
          delete result.dataset.empty;
          state.shown=data.k;
          byId('imageK').textContent=data.k;
          result.setAttribute('aria-label',name+'保留前 '+data.k+' 项的重建图');
          byId('focusK').textContent='k = '+data.k;
          if(byId('focusDialog').open)copyCanvas(result,byId('resultLarge'));
          byId('expand').disabled=false;
          loading();
          byId('download').disabled=false;
        }
        requestFrame();
      }
    };
    worker.postMessage({type:'init',width,height,channels,pixels},[pixels.buffer]);
  } catch {workerError('浏览器无法启动本地计算，请在新版浏览器中打开此页面。');}
}

async function selectSource(url,name,key,fromFile) {
  const id=++selection;
  if(byId('file').value)byId('file').value='';
  notice();
  loading('正在读取图片…');
  byId('download').disabled=true;
  try {
    const image = new Image();
    const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
    image.src=url;
    await loaded;
    if(selection!==id)return;
    if(!image.naturalWidth || !image.naturalHeight)throw Error('文件没有可读取的图像尺寸。');
    state.source={image,name,key};
    processImage(true);
  }catch{
    if(selection!==id)return;
    notice('这张图片暂时无法读取。请选择 JPG、PNG 或 WebP 图片，iPhone 的 HEIC 照片可以先导出为 JPEG。');
    if(state.source){loading(state.ready?'':'正在分解图像矩阵…'); byId('download').disabled=!state.ready || state.shown!==state.target;}
    else loading('请选择图片重试');
  }finally{if(fromFile)URL.revokeObjectURL(url);}
}

function acceptFile(file) {
  if(!file)return;
  const types=['image/jpeg','image/png','image/webp','image/gif','image/avif','image/bmp','image/x-ms-bmp'];
  const extension=/\.(jpe?g|png|webp|gif|avif|bmp)$/i;
  if(!(types.includes(file.type) || (!file.type && extension.test(file.name)))){
    notice('请选择 JPG、PNG、WebP、GIF、AVIF 或 BMP 图片。HEIC 照片可以先导出为 JPEG。'); return;
  }
  if(file.size>30*1024*1024){notice('图片超过 30 MB。请缩小照片或选择另一张图片。');return;}
  selectSource(URL.createObjectURL(file),file.name || '我的图片',null,true);
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
for(const input of [rankInput,focusRange])input.addEventListener('input',()=>setRank(input.value));
byId('minus').addEventListener('click',()=>setRank(state.target-1));
byId('plus').addEventListener('click',()=>setRank(state.target+1));
presets.forEach(b=>b.addEventListener('click',()=>setRank(b.dataset.k)));
function isFileDrag(event){return Array.from(event.dataTransfer?.types || []).includes('Files');}
document.addEventListener('dragenter',e=>{if(!isFileDrag(e))return;e.preventDefault();dragDepth++;byId('dropHint').hidden=false;});
document.addEventListener('dragover',e=>{if(isFileDrag(e)){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
document.addEventListener('dragleave',e=>{if(!isFileDrag(e))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)byId('dropHint').hidden=true;});
document.addEventListener('drop',e=>{if(!isFileDrag(e))return;e.preventDefault();dragDepth=0;byId('dropHint').hidden=true;acceptFile(e.dataTransfer.files[0]);});
original.addEventListener('click',pickPixel);
original.tabIndex=0;
original.addEventListener('keydown',e=>{
  const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(!offsets[e.key] || !state.point)return;
  e.preventDefault();
  const [dx,dy]=offsets[e.key];
  state.point={x:Math.max(0,Math.min(state.width-1,state.point.x+dx)),y:Math.max(0,Math.min(state.height-1,state.point.y+dy))};
  drawLoupe();
});
if('ResizeObserver' in window)new ResizeObserver(drawLoupe).observe(original);
else window.addEventListener('resize',drawLoupe);

byId('download').addEventListener('click',()=>{
  if(!state.ready || state.shown!==state.target)return;
  const title=(state.source.name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,55) || 'image');
  const filename=title+'-svd-'+state.mode+'-k'+state.shown+'.png';
  result.toBlob(blob=>{
    if(!blob){notice('保存图片时遇到问题，请重试。');return;}
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
  byId('focusDialog').showModal();
});
for(const button of document.querySelectorAll('.close-dialog'))button.addEventListener('click',()=>button.closest('dialog').close());
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{
  if(e.target!==dialog)return;
  const box=dialog.getBoundingClientRect();
  if(e.clientX<box.left || e.clientX>box.right || e.clientY<box.top || e.clientY>box.bottom)dialog.close();
});
byId('copyLink').addEventListener('click',async()=>{
  const input=byId('shareUrl'),status=byId('copyStatus');
  try{await navigator.clipboard.writeText(input.value);status.textContent='链接已复制，可以发到班群。';}
  catch {
    input.focus();
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    status.textContent = copied ? '链接已复制，可以发到班群。' : '网址已选中。可长按复制，或按 Ctrl/Cmd + C。';
  }
});

selectSource('assets/astronaut.jpg',samples.astronaut,'astronaut',false);
