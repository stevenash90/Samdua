// Voice chat trong phòng (kiểu Liên Quân): 🎧 nghe cả bàn, 🎙️ bật mic. Mặc định tắt cả hai.
// WebRTC nối thẳng giữa các máy (lưới, tối đa ~6 người), máy chủ chỉ chuyển tín hiệu bắt tay.
// Chạy trên Safari/Chrome/Cốc Cốc (iPhone iOS 14.3+), Chrome/Cốc Cốc/Samsung (Android), mọi trình duyệt máy tính.
/* global act, toast, api, Net, S, $ */
const Voice = (() => {
  let joined = false, micOn = false, myVid = null, ice = null, stream = null, micTrack = null;
  const peers = new Map();           // vid -> {pc, polite, makingOffer, ignoreOffer, sender, audio, an, level}
  const muted = new Set(JSON.parse(localStorage.getItem('sam_vmute') || '[]'));   // vid đã tắt tiếng riêng
  let spkOff = false, actx = null, meter = null, members = [], forced = false;

  const supported = () => !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const inApp = () => /FBAN|FBAV|FB_IAB|Messenger|Instagram|Zalo|Line\/|MicroMessenger/i.test(navigator.userAgent);
  const send = (to, data) => { if (Net.ws && Net.ws.readyState === 1) Net.ws.send(JSON.stringify({ t: 'vsig', to, data })); };
  const iosSession = t => { try { if (navigator.audioSession) navigator.audioSession.type = t; } catch (e) {} };

  async function iceServers() {
    if (ice) return ice;
    try { const j = await api('ice', {}); if (j && j.iceServers && j.iceServers.length) ice = j.iceServers; } catch (e) {}
    return ice || [{ urls: 'stun:stun.l.google.com:19302' }];
  }

  /* ---------- đo âm lượng để sáng viền người đang nói ---------- */
  function analyser(src) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state !== 'running') actx.resume().catch(() => {});
      const an = actx.createAnalyser(); an.fftSize = 512;
      actx.createMediaStreamSource(src).connect(an);
      return an;
    } catch (e) { return null; }
  }
  const buf = new Uint8Array(512);
  function levelOf(an) {
    if (!an) return 0;
    an.getByteTimeDomainData(buf);
    let s = 0; for (let k = 0; k < buf.length; k++) { const v = (buf[k] - 128) / 128; s += v * v; }
    return Math.sqrt(s / buf.length);
  }
  let myAn = null;
  function startMeter() {
    if (meter) return;
    meter = setInterval(() => {
      const talking = new Set();
      if (micOn && !forced && myAn && levelOf(myAn) > 0.04) talking.add(myVid);
      for (const [vid, p] of peers) if (!muted.has(vid) && !spkOff && levelOf(p.an) > 0.04) talking.add(vid);
      paint(talking);
    }, 180);
  }
  function stopMeter() { clearInterval(meter); meter = null; paint(new Set()); }

  /* ---------- kết nối từng người (perfect negotiation) ---------- */
  async function peer(vid) {
    if (peers.has(vid)) return peers.get(vid);
    const pc = new RTCPeerConnection({ iceServers: await iceServers() });
    if (peers.has(vid)) { pc.close(); return peers.get(vid); }
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
    const audio = document.createElement('audio');
    audio.autoplay = true; audio.setAttribute('playsinline', ''); audio.muted = spkOff || muted.has(vid);
    document.body.append(audio);
    const p = { pc, polite: myVid < vid, makingOffer: false, ignoreOffer: false, sender: tr.sender, audio, an: null };
    peers.set(vid, p);
    if (micTrack && !forced) tr.sender.replaceTrack(micTrack).catch(() => {});
    pc.onnegotiationneeded = async () => {
      try {
        p.makingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        send(vid, { desc: pc.localDescription });
      } catch (e) { /* bỏ qua, lần sau thử lại */ } finally { p.makingOffer = false; }
    };
    pc.onicecandidate = e => { if (e.candidate) send(vid, { cand: e.candidate }); };
    pc.ontrack = e => {
      const st = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
      if (audio.srcObject !== st) { audio.srcObject = st; p.an = analyser(st); }
      audio.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') { try { pc.restartIce(); } catch (e) {} }
    };
    return p;
  }
  function drop(vid) {
    const p = peers.get(vid); if (!p) return;
    try { p.pc.close(); } catch (e) {}
    p.audio.srcObject = null; p.audio.remove();
    peers.delete(vid);
  }
  async function onSignal(from, data) {
    if (!joined || !data) return;
    const p = await peer(from);
    const pc = p.pc;
    try {
      if (data.desc) {
        const collision = data.desc.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
        p.ignoreOffer = !p.polite && collision;
        if (p.ignoreOffer) return;
        if (collision) await Promise.all([pc.setLocalDescription({ type: 'rollback' }).catch(() => {}), pc.setRemoteDescription(data.desc)]);
        else await pc.setRemoteDescription(data.desc);
        if (data.desc.type === 'offer') {
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          send(from, { desc: pc.localDescription });
        }
      } else if (data.cand) {
        try { await pc.addIceCandidate(data.cand); } catch (e) { if (!p.ignoreOffer) throw e; }
      }
    } catch (e) { /* tín hiệu lỗi: kết nối sẽ tự thử lại */ }
  }

  /* ---------- bật / tắt ---------- */
  function unlockPlayback() {
    // iPhone: phát âm thanh phải bắt đầu từ một lần chạm
    for (const p of peers.values()) p.audio.play().catch(() => {});
    if (actx && actx.state !== 'running') actx.resume().catch(() => {});
  }
  async function join() {
    if (!supported()) { toast('Trình duyệt này chưa hỗ trợ voice. Dùng Safari/Chrome bản mới (iPhone cần iOS 14.3+)'); return false; }
    if (inApp()) toast('Đang mở trong Zalo/Messenger: voice có thể không chạy, nên mở link bằng Safari hoặc Chrome');
    joined = true; spkOff = false;
    unlockPlayback();
    await act('vjoin', { mic: micOn });
    startMeter(); render();
    return true;
  }
  async function leave() {
    joined = false;
    await setMic(false, true);
    for (const vid of [...peers.keys()]) drop(vid);
    act('vleave', {});
    stopMeter(); render();
  }
  async function setMic(on, quiet) {
    if (on) {
      if (!supported()) { toast('Trình duyệt này chưa hỗ trợ voice. Dùng Safari/Chrome bản mới (iPhone cần iOS 14.3+)'); return; }
      // iPhone: phải chuyển sang chế độ ghi âm TRƯỚC khi xin micro, và xin ngay trong lần chạm (chưa chờ mạng)
      window.__samMic = true;
      iosSession('play-and-record');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        window.__samMic = false; iosSession('playback');
        const n = e && e.name;
        toast(n === 'NotAllowedError' || n === 'SecurityError'
          ? 'Micro đang bị chặn. iPhone: Cài đặt → Safari → Micro → Hỏi/Cho phép, rồi tải lại trang. Hoặc bấm "aA" trên thanh địa chỉ → Cài đặt trang web → Micro'
          : n === 'NotFoundError' ? 'Không tìm thấy micro trên máy' : n === 'NotReadableError' ? 'Micro đang bị app khác dùng (cuộc gọi, ghi âm…)' : 'Không mở được micro (' + (n || 'lỗi') + ')', 5000);
        return;
      }
      if (!joined && !(await join())) { stream.getTracks().forEach(t => t.stop()); stream = null; window.__samMic = false; iosSession('playback'); return; }
      micTrack = stream.getAudioTracks()[0];
      micTrack.onended = () => { if (micOn) { setMic(false); toast('Micro đã tắt (máy chuyển sang app khác hoặc có cuộc gọi). Bấm 🎙️ để bật lại'); } };
      myAn = analyser(stream);
      if (!forced) for (const p of peers.values()) p.sender.replaceTrack(micTrack).catch(() => {});
      micOn = true;
    } else {
      for (const p of peers.values()) p.sender.replaceTrack(null).catch(() => {});
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null; micTrack = null; myAn = null; micOn = false;
      window.__samMic = false;
      iosSession('playback');
    }
    if (joined && !quiet) act('vmic', { on: micOn });
    render();
  }
  function setSpeaker(on) {
    spkOff = !on;
    for (const [vid, p] of peers) p.audio.muted = spkOff || muted.has(vid);
    if (on) unlockPlayback();
    render();
  }
  function toggleMute(vid) {
    if (muted.has(vid)) muted.delete(vid); else muted.add(vid);
    localStorage.setItem('sam_vmute', JSON.stringify([...muted].slice(-50)));
    const p = peers.get(vid); if (p) p.audio.muted = spkOff || muted.has(vid);
    renderList();
  }

  /* ---------- đồng bộ với danh sách voice từ máy chủ ---------- */
  function sync(state) {
    members = (state && state.voice) || [];
    if (!joined || !myVid) { render(); return; }
    const want = new Set(members.filter(m => m.vid !== myVid).map(m => m.vid));
    for (const vid of [...peers.keys()]) if (!want.has(vid)) drop(vid);
    for (const vid of want) if (!peers.has(vid)) peer(vid);
    render();
  }
  function setMe(vid) {
    myVid = vid;
    if (joined) act('vjoin', { mic: micOn });   // vừa kết nối lại: vào lại voice
  }
  function reset() { if (joined) { joined = false; micOn = false; window.__samMic = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; micTrack = null; iosSession('playback'); for (const vid of [...peers.keys()]) drop(vid); stopMeter(); } members = []; render(); }

  /* ---------- giao diện ---------- */
  let ui = null, list = null;
  function build() {
    if (ui) return;
    ui = document.createElement('div'); ui.className = 'vbar';
    ui.innerHTML = '<button class="vb spk" title="Nghe voice cả bàn">🎧</button><button class="vb mic" title="Bật mic">🎙️</button><button class="vb vn" title="Ai đang trong voice"></button>';
    document.body.append(ui);
    ui.querySelector('.spk').onclick = () => { if (!joined) join(); else if (spkOff) setSpeaker(true); else leave(); };
    ui.querySelector('.mic').onclick = () => setMic(!micOn);
    ui.querySelector('.vn').onclick = () => { list.classList.toggle('on'); renderList(); };
    list = document.createElement('div'); list.className = 'vlist';
    document.body.append(list);
    document.addEventListener('pointerdown', e => { if (list.classList.contains('on') && !list.contains(e.target) && !ui.contains(e.target)) list.classList.remove('on'); });
    document.addEventListener('click', () => { if (joined) unlockPlayback(); }, true);
  }
  function render() {
    build();
    const inRoom = !!(state() && state().code);
    ui.classList.toggle('on', inRoom);
    ui.classList.toggle('joined', joined);
    const spk = ui.querySelector('.spk'), mic = ui.querySelector('.mic'), cnt = ui.querySelector('.vn');
    spk.textContent = !joined ? '🎧' : spkOff ? '🔇' : '🔊';
    spk.classList.toggle('lit', joined && !spkOff);
    spk.title = !joined ? 'Vào voice (nghe cả bàn)' : 'Rời voice';
    mic.classList.toggle('lit', micOn);
    mic.textContent = micOn ? '🎙️' : '🎙️';
    mic.classList.toggle('off', !micOn);
    const isSpec = state() && state().you < 0;
    mic.hidden = !!isSpec;
    const n = members.length;
    cnt.textContent = n ? String(n) : '';
    cnt.hidden = !n;
    if (!meter) paint(new Set());
    renderList();
  }
  function renderList() {
    if (!list || !list.classList.contains('on')) return;
    list.textContent = '';
    const h3 = document.createElement('b'); h3.textContent = members.length ? 'Đang trong voice' : 'Chưa ai vào voice'; list.append(h3);
    members.forEach(m => {
      const row = document.createElement('div'); row.className = 'vrow';
      const nm = document.createElement('span'); nm.textContent = (m.mic ? '🎙️ ' : '🎧 ') + m.name + (m.vid === myVid ? ' (bạn)' : '');
      row.append(nm);
      if (m.vid !== myVid) {
        const bt = document.createElement('button'); bt.className = 'btn slim'; bt.textContent = muted.has(m.vid) ? 'Bật tiếng' : 'Tắt tiếng';
        bt.onclick = () => toggleMute(m.vid);
        row.append(bt);
      }
      list.append(row);
    });
  }
  function paint(talking) {
    const bySeat = new Map(members.map(m => [m.seat, m]));
    document.querySelectorAll('[data-seat]').forEach(el => {
      const m = bySeat.get(+el.dataset.seat);
      el.classList.toggle('invoice', !!m);
      el.classList.toggle('talking', !!(m && talking.has(m.vid)));
    });
  }
  const state = () => (typeof S !== 'undefined' ? S : null);

  // game yêu cầu tắt mic tạm thời (Ma Sói: ban đêm, hoặc đã chết) — mic vẫn bật lại khi hết lệnh
  function forceMute(on) {
    on = !!on;
    if (on === forced) return;
    forced = on;
    for (const p of peers.values()) p.sender.replaceTrack(on ? null : micTrack).catch(() => {});
    if (ui) { const m = ui.querySelector('.mic'); m.classList.toggle('forced', on); m.title = on ? 'Đang tạm tắt mic (đêm / đã chết)' : 'Bật mic'; }
  }
  return { forceMute, sync, onSignal, setMe, reset, supported, get joined() { return joined; }, debug: () => [...peers].map(([vid, p]) => ({ vid, state: p.pc.connectionState, muted: p.audio.muted })),
    async bytesIn() { let n = 0; for (const p of peers.values()) (await p.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') n += r.bytesReceived || 0; }); return n; } };
})();
