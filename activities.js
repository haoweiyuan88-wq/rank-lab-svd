'use strict';

const galleryDialog = byId('galleryDialog');
const guessDialog = byId('guessDialog');
const guessCanvas = byId('guessCanvas');

function availableRanks(levels, capacity) {
  return [...new Set(levels.map(k => Math.min(k, capacity)))];
}

byId('openGallery').addEventListener('click', () => {
  if (!state.ready) return;
  const ranks = availableRanks([5,20,50,100], state.capacity);
  if (ranks.length === 1 && state.capacity > 1) ranks.unshift(1);
  byId('gallerySource').textContent = state.source.name + ' · ' + (state.mode === 'gray' ? 'Grayscale' : 'Color');
  byId('galleryGrid').replaceChildren();
  byId('galleryStatus').textContent = 'Preparing the reconstructions…';
  galleryDialog.showModal();
  state.job.postMessage({type:'gallery', ranks});
});

function displayGallery(message) {
  const status = byId('galleryStatus');
  if (message.type === 'gallery-error') {
    status.textContent = 'The comparisons could not be calculated. Close this view and try again.';
    return;
  }
  const total = state.energy[state.capacity];
  const cards = message.frames.map(({k,rgba}) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-option';
    button.setAttribute('aria-pressed', String(k === state.target));
    const canvas = document.createElement('canvas');
    canvas.width = state.width;
    canvas.height = state.height;
    canvas.setAttribute('aria-hidden','true');
    canvas.getContext('2d').putImageData(new ImageData(rgba,state.width,state.height),0,0);
    const caption = document.createElement('span');
    const rank = document.createElement('strong');
    rank.textContent = 'k = ' + k;
    const energy = document.createElement('small');
    energy.textContent = total ? (100*state.energy[k]/total).toFixed(1) + '% energy' : 'Zero image energy';
    caption.append(rank, energy);
    button.append(canvas, caption);
    button.addEventListener('click', () => {
      setRank(k);
      galleryDialog.close();
    });
    return button;
  });
  byId('galleryGrid').replaceChildren(...cards);
  status.textContent = '';
}

// Draw from all three examples before repeating one. An uploaded photo can be
// the first round without sending it anywhere or revealing its filename.
let remainingExamples = [];
let lastExample;
let activeRound = null;

function nextExample() {
  if (!remainingExamples.length) remainingExamples = sampleButtons.slice();
  const choices = remainingExamples.length > 1 ? remainingExamples.filter(b => b !== lastExample) : remainingExamples;
  const picked = choices[Math.floor(Math.random()*choices.length)];
  remainingExamples.splice(remainingExamples.indexOf(picked),1);
  lastExample = picked;
  return {image:picked.querySelector('img'), name:picked.textContent.trim(), key:picked.dataset.sample};
}

function stopRound() {
  activeRound?.worker?.terminate();
  activeRound = null;
}

function refreshGuessControls(round) {
  const finished = round.revealed || round.failed;
  const ready = round.ready && !finished;
  byId('guessHint').hidden = byId('guessReveal').hidden = finished;
  byId('guessHint').disabled = !ready || round.step === round.ranks.length-1;
  byId('guessReveal').disabled = !ready;
  byId('guessNext').hidden = !finished;
  byId('guessChoices').hidden = !round.source.key || finished;
  for (const choice of byId('guessChoices').children) {
    choice.disabled = !ready || round.tried.has(choice.dataset.guess);
  }
}

function drawClue(round) {
  round.ready = false;
  refreshGuessControls(round);
  byId('guessStatus').textContent = 'Preparing the clue…';
  round.worker.postMessage({type:'draw', k:round.ranks[round.step]});
}

function failRound(round) {
  if (activeRound !== round) return;
  round.worker?.terminate();
  round.failed = true;
  byId('guessStatus').textContent = 'This photo could not be prepared. Try the next one.';
  refreshGuessControls(round);
}

async function startRound(source) {
  stopRound();
  const round = {source, worker:null, step:0, ranks:[], ready:false, revealed:false, failed:false, tried:new Set()};
  activeRound = round;
  guessCanvas.width = guessCanvas.height = 1;
  guessCanvas.setAttribute('aria-label','Mystery reconstruction');
  byId('guessPrompt').textContent = source.key ? 'Which title matches this scene?' : 'What is in this photo?';
  byId('guessRank').textContent = '';
  byId('guessStatus').textContent = 'Preparing the first clue…';
  refreshGuessControls(round);
  try {
    if (!source.image.naturalWidth) await source.image.decode();
    if (activeRound !== round) return;
    const {width,height,channels,pixels} = makeMatrix(source.image,'gray');
    round.ranks = availableRanks([2,5,10,20,50,100], Math.min(width,height));
    round.worker = createSvdWorker();
    round.worker.addEventListener('error', () => failRound(round));
    round.worker.onmessage = ({data}) => {
      if (activeRound !== round || round.revealed || round.failed) return;
      if (data.type === 'error') { failRound(round); return; }
      if (data.type === 'ready') { drawClue(round); return; }
      if (data.type !== 'frame') return;
      guessCanvas.width = width;
      guessCanvas.height = height;
      guessCanvas.getContext('2d').putImageData(new ImageData(data.rgba,width,height),0,0);
      guessCanvas.setAttribute('aria-label','Mystery reconstruction at k = '+data.k);
      byId('guessRank').textContent = 'k = ' + data.k;
      const canAddDetail = round.step < round.ranks.length - 1;
      byId('guessStatus').textContent = !source.key ? 'Say your guess aloud before the reveal.'
        : canAddDetail ? 'Choose a title or add detail.' : 'Choose a title or reveal the photo.';
      round.ready = true;
      refreshGuessControls(round);
    };
    round.worker.postMessage({type:'init',width,height,channels,pixels},[pixels.buffer]);
  } catch { failRound(round); }
}

function revealRound(correct) {
  const round = activeRound;
  if (!round?.ready || round.revealed || round.failed) return;
  round.revealed = true;
  round.worker.terminate();
  const {image,name} = round.source;
  const [w,h] = fittedDimensions(image.naturalWidth,image.naturalHeight,1600);
  paintPhoto(guessCanvas,image,w,h);
  guessCanvas.setAttribute('aria-label',name+' in color');
  byId('guessPrompt').textContent = name;
  byId('guessRank').textContent = 'Original';
  byId('guessStatus').textContent = (correct ? 'Correct! You recognized it at k = ' : 'Revealed at k = ') + round.ranks[round.step] + '.';
  refreshGuessControls(round);
  byId('guessNext').focus();
}

for (const sample of sampleButtons) {
  const choice = document.createElement('button');
  choice.type = 'button';
  choice.className = 'guess-choice';
  choice.textContent = sample.querySelector('strong').textContent;
  choice.dataset.guess = sample.dataset.sample;
  choice.addEventListener('click', () => {
    const round = activeRound;
    if (!round?.ready || round.revealed || round.failed) return;
    if (choice.dataset.guess === round.source.key) { revealRound(true); return; }
    round.tried.add(choice.dataset.guess);
    refreshGuessControls(round);
    byId('guessStatus').textContent = 'Try another title or add more detail.';
  });
  byId('guessChoices').append(choice);
}

byId('openGuess').addEventListener('click', () => {
  guessDialog.showModal();
  startRound(state.source && !state.source.key ? state.source : nextExample());
});
byId('guessHint').addEventListener('click', () => {
  const round = activeRound;
  if (!round?.ready || round.revealed || round.failed || round.step+1 >= round.ranks.length) return;
  round.step++;
  drawClue(round);
});
byId('guessReveal').addEventListener('click', () => revealRound(false));
byId('guessNext').addEventListener('click', () => startRound(nextExample()));
guessDialog.addEventListener('close', () => {
  if (!guessDialog.open) stopRound();
});
