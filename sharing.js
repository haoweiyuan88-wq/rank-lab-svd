'use strict';

function classroomAddress(href) {
  const address = new URL(href);
  if (!['http:', 'https:'].includes(address.protocol)) return null;
  const host = address.hostname;
  if (host === 'localhost' || host === '[::1]' || /^127\./.test(host)) return null;
  address.search = '';
  address.hash = '';
  address.pathname = address.pathname.replace(/\/index\.html$/i, '/');
  return address;
}

function drawClassroomQR(canvas, url) {
  const code = classroomQR(url);
  const cells = code.getModuleCount();
  const quiet = 4;
  const scale = 12;
  canvas.width = canvas.height = (cells + 2 * quiet) * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111';
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      if (code.isDark(row, col)) ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
    }
  }
}

function prepareClassroomSharing() {
  const dialog = document.getElementById('shareDialog');
  const text = document.getElementById('shareHelp');
  const controls = document.getElementById('shareControls');
  const qr = document.getElementById('shareQR');
  const field = document.getElementById('shareUrl');
  const enabled = document.getElementById('classroomDownload');
  const address = classroomAddress(window.location.href);
  if (!address) {
    text.textContent = location.protocol === 'file:'
      ? '可以把这个 HTML 文件发给同学，各自在电脑上打开。需要手机扫码时，在演示电脑上运行课堂包里的 Start-Class.command。'
      : '请用课堂启动程序显示的 Wi-Fi 地址打开，手机就能扫到这台电脑。';
    qr.hidden = controls.hidden = true;
    if (enabled) enabled.hidden = true;
    return;
  }
  const host = address.hostname;
  const local = /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.endsWith('.local');
  text.textContent = local
    ? '让手机和演示电脑连到同一个可互访的 Wi-Fi 或热点，打开相机扫码。演示期间保持电脑和启动窗口开启。'
    : '用手机相机扫码，或复制下方网址发到班群。';
  if (enabled) enabled.hidden = local;
  field.value = address.href;
  try {
    drawClassroomQR(qr, address.href);
  } catch {
    qr.hidden = true;
    text.textContent += ' 如二维码无法显示，可以直接复制网址。';
  }
  if (new URLSearchParams(window.location.search).get('present') === '1' && !dialog.open) dialog.showModal();
}
prepareClassroomSharing();
