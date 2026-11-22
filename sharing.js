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
      ? 'Send this HTML file to classmates to open on a computer. For phone access, run Start-Class.command from the classroom pack on the presenting computer.'
      : 'Open the Wi-Fi address printed by the classroom launcher to generate a QR code for this computer.';
    qr.hidden = controls.hidden = true;
    if (enabled) enabled.hidden = true;
    return;
  }
  const host = address.hostname;
  const local = /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.endsWith('.local');
  text.textContent = local
    ? 'Connect phones and the presenting computer to the same Wi-Fi or hotspot with device-to-device access. Scan the code and keep the computer and launcher running.'
    : 'Scan with a phone camera or copy the link to your class chat.';
  if (enabled) enabled.hidden = local;
  field.value = address.href;
  try {
    drawClassroomQR(qr, address.href);
  } catch {
    qr.hidden = true;
    text.textContent += ' If the QR code is unavailable, copy the link below.';
  }
  if (new URLSearchParams(window.location.search).get('present') === '1' && !dialog.open) dialog.showModal();
}
prepareClassroomSharing();
