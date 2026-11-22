'use strict';

// The smaller Gram matrix is symmetric. Reduce it to tridiagonal form by
// Householder reflections, then diagonalize it with implicit QL rotations.
// Each eigenvector ultimately gives one rank-one term of the image.
function symmetricEigen(matrix, n) {
  const q = matrix;
  const diag = new Float64Array(n);
  const off = new Float64Array(n);
  for (let i = n - 1; i >= 1; i--) {
    const last = i - 1;
    const row = i * n;
    let sum = 0;
    if (last > 0) {
      let scale = 0;
      for (let j = 0; j < i; j++) scale += Math.abs(q[row + j]);
      if (scale) {
        for (let j = 0; j < i; j++) {
          q[row + j] /= scale;
          sum += q[row + j] * q[row + j];
        }
        const tail = q[row + last];
        const root = tail >= 0 ? -Math.sqrt(sum) : Math.sqrt(sum);
        off[i] = scale * root;
        sum -= tail * root;
        q[row + last] = tail - root;
        let dot = 0;
        for (let j = 0; j < i; j++) {
          q[j * n + i] = q[row + j] / sum;
          let v = 0;
          for (let k = 0; k <= j; k++) v += q[j * n + k] * q[row + k];
          for (let k = j + 1; k < i; k++) v += q[k * n + j] * q[row + k];
          off[j] = v / sum;
          dot += off[j] * q[row + j];
        }
        const half = dot / (2 * sum);
        for (let j = 0; j < i; j++) off[j] -= half * q[row + j];
        for (let j = 0; j < i; j++) {
          for (let k = 0; k <= j; k++) {
            q[j * n + k] -= q[row + j] * off[k] + off[j] * q[row + k];
          }
        }
      } else {
        off[i] = q[row + last];
      }
    } else {
      off[i] = q[row + last];
    }
    diag[i] = sum;
  }
  for (let i = 0; i < n; i++) {
    const row = i * n;
    if (diag[i]) {
      for (let j = 0; j < i; j++) {
        let dot = 0;
        for (let k = 0; k < i; k++) dot += q[row + k] * q[k * n + j];
        for (let k = 0; k < i; k++) q[k * n + j] -= dot * q[k * n + i];
      }
    }
    diag[i] = q[row + i];
    q[row + i] = 1;
    for (let j = 0; j < i; j++) q[row + j] = q[j * n + i] = 0;
  }
  for (let i = 1; i < n; i++) off[i - 1] = off[i];
  off[n - 1] = 0;
  for (let first = 0; first < n; first++) {
    let iterations = 0;
    while (true) {
      let end = first;
      while (end < n - 1 && Math.abs(off[end]) > Number.EPSILON *
        (Math.abs(diag[end]) + Math.abs(diag[end + 1]))) end++;
      if (end === first) break;
      if (++iterations > 100) throw new Error('数值分解未收敛，请换一张图片重试。');
      let g = (diag[first + 1] - diag[first]) / (2 * off[first]);
      const shift = Math.hypot(g, 1);
      g = diag[end] - diag[first] + off[first] / (g + (g < 0 ? -shift : shift));
      let sine = 1;
      let cosine = 1;
      let correction = 0;
      let restart = false;
      for (let i = end - 1; i >= first; i--) {
        const f = sine * off[i];
        const b = cosine * off[i];
        const radius = Math.hypot(f, g);
        off[i + 1] = radius;
        if (radius === 0) {
          diag[i + 1] -= correction;
          off[end] = 0;
          restart = true;
          break;
        }
        sine = f / radius;
        cosine = g / radius;
        g = diag[i + 1] - correction;
        const delta = (diag[i] - g) * sine + 2 * cosine * b;
        correction = sine * delta;
        diag[i + 1] = g + correction;
        g = cosine * delta - b;
        for (let j = 0; j < n; j++) {
          const p = j * n + i;
          const a = q[p];
          const next = q[p + 1];
          q[p + 1] = sine * a + cosine * next;
          q[p] = cosine * a - sine * next;
        }
      }
      if (restart) continue;
      diag[first] -= correction;
      off[first] = g;
      off[end] = 0;
    }
  }
  return { eigenvectors: q, eigenvalues: diag };
}

function decompose(pixels, width, height, channel, stride) {
  const useRows = height <= width;
  const n = Math.min(height, width);
  const m = Math.max(height, width);
  const rows = new Float64Array(n * m);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = useRows ? y * m + x : x * m + y;
      rows[index] = pixels[(y * width + x) * stride + channel];
    }
  }
  const gram = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    const a = i * m;
    for (let j = 0; j <= i; j++) {
      const b = j * m;
      let value = 0;
      for (let k = 0; k < m; k++) value += rows[a + k] * rows[b + k];
      gram[i * n + j] = value;
    }
  }
  const {eigenvectors, eigenvalues} = symmetricEigen(gram, n);
  const order = Array.from({length: n}, (_, i) => i).sort((a, b) => eigenvalues[b] - eigenvalues[a]);
  const left = new Float32Array(n * height);
  const right = new Float32Array(n * width);
  const energy = new Float64Array(n);
  for (let rank = 0; rank < n; rank++) {
    const idx = order[rank];
    const small = new Float64Array(n);
    const projected = new Float64Array(m);
    for (let j = 0; j < n; j++) {
      const v = eigenvectors[j * n + idx];
      small[j] = v;
      const start = j * m;
      for (let k = 0; k < m; k++) projected[k] += v * rows[start + k];
    }
    left.set(useRows ? small : projected, rank * height);
    right.set(useRows ? projected : small, rank * width);
    // ||A' q||² or ||A q||² equals the squared singular value.
    for (const value of projected) energy[rank] += value * value;
  }
  return { left, right, energy };
}

let model;
function initialize({width, height, channels, pixels}) {
  const length = width * height;
  const cap = Math.min(width, height);
  const factors = [];
  const cumulative = new Float64Array(cap + 1);
  for (let c = 0; c < channels; c++) {
    const f = decompose(pixels, width, height, c, channels);
    factors.push(f);
    for (let i = 0; i < cap; i++) cumulative[i + 1] += f.energy[i];
  }
  for (let i = 1; i <= cap; i++) cumulative[i] += cumulative[i - 1];
  // For inexpensive dragging, keep a floating-point reconstruction and change
  // only the terms between successive positions. The original is also a full-rank checkpoint.
  let rank = 0;
  const sums = Array.from({length: channels}, () => new Float64Array(length));
  function reset(atFull) {
    rank = atFull ? cap : 0;
    for (let c = 0; c < channels; c++) {
      if (!atFull) sums[c].fill(0);
      else for (let i = 0; i < length; i++) sums[c][i] = pixels[i * channels + c];
    }
  }
  function render(target) {
    const k = Math.max(1, Math.min(cap, Math.round(target)));
    const distance = Math.abs(k - rank);
    if (Math.min(k, cap - k) < distance || k === cap) reset(cap - k < k);
    const start = Math.min(k, rank), end = Math.max(k, rank);
    const sign = k >= rank ? 1 : -1;
    for (let c = 0; c < channels; c++) {
      const {left, right} = factors[c];
      const sum = sums[c];
      for (let t = start; t < end; t++) {
        const a = t * height, b = t * width;
        for (let y = 0; y < height; y++) {
          const v = sign * left[a + y];
          let p = y * width;
          for (let x = 0; x < width; x++) sum[p++] += v * right[b + x];
        }
      }
    }
    rank = k;
    const rgba = new Uint8ClampedArray(length * 4);
    const [red, green = red, blue = red] = sums;
    for (let p = 0; p < length; p++) {
      rgba[4 * p] = red[p];
      rgba[4 * p + 1] = green[p];
      rgba[4 * p + 2] = blue[p];
      rgba[4 * p + 3] = 255;
    }
    return {k, rgba};
  }
  return {cumulative, render};
}
self.onmessage = ({data}) => {
  try {
    if (data.type === 'init') {
      model = initialize(data);
      self.postMessage({type:'ready', cumulative: model.cumulative});
    } else if (data.type === 'draw' && model) {
      const frame = model.render(data.k);
      self.postMessage({type:'frame', ...frame}, [frame.rgba.buffer]);
    }
  } catch (error) {
    self.postMessage({type:'error', message: error.message});
  }
};
