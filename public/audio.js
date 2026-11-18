/* Sâm Dứa 2.0 — Audio Manager
 * - Một AudioContext duy nhất, mở khoá sau tương tác đầu tiên (chính sách autoplay của trình duyệt).
 * - Nhóm âm lượng: master → music / ambient / sfx / voice.
 * - Tải trước âm thanh quan trọng, tải lười âm thanh ít dùng; cache buffer.
 * - Chống phát trùng, giới hạn số âm thanh đồng thời, có độ ưu tiên.
 * - Stereo panning đơn giản theo vị trí ghế.
 * - Fallback: tự tổng hợp tiếng "tick" bằng oscillator nếu file không tải được.
 */
'use strict';
const Sound = (function () {
  // tên -> [nhóm, độ ưu tiên (cao hơn = quan trọng hơn), tải trước?]
  const CAT = {
    select: ['sfx', 1, 1], deal: ['sfx', 2, 1], shuffle: ['sfx', 2, 1], play: ['sfx', 3, 1], play_big: ['sfx', 3, 1], place: ['sfx', 2, 0],
    pass: ['sfx', 2, 1], collect: ['sfx', 2, 1], turn: ['sfx', 1, 1], myturn: ['sfx', 4, 1], warn5: ['sfx', 4, 1],
    chop2: ['sfx', 6, 1], chopde: ['sfx', 6, 1], chopde2: ['sfx', 7, 0], bao_sam: ['sfx', 6, 0], bat_sam: ['sfx', 6, 0],
    sam_win: ['sfx', 6, 0], sam_fail: ['sfx', 6, 0], cong: ['sfx', 5, 0], thoi2: ['sfx', 5, 0], win: ['sfx', 6, 0], lose: ['sfx', 6, 0],
    notify: ['sfx', 3, 0], pause: ['sfx', 4, 0], resume: ['sfx', 4, 0], disconnect: ['sfx', 2, 0], reconnect: ['sfx', 2, 0],
    end: ['sfx', 5, 0], start: ['sfx', 4, 1], phase: ['sfx', 2, 0], coins: ['sfx', 4, 0],
    music: ['music', 0, 0], ambient: ['ambient', 0, 0],
  };
  const MAX_VOICES = 8;
  let ctx = null, unlocked = false, master, groups = {}, buffers = new Map(), loading = new Map(), failed = new Set();
  let ext = 'mp3', st = {}, active = [], lastPlay = new Map(), musicSrc = null, ambSrc = null, wantMusic = false, voiceBusyUntil = 0;

  function pickExt() {
    const a = document.createElement('audio');
    // Safari/iOS không giải mã tốt Vorbis qua WebAudio → dùng MP3
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || /iPad|iPhone|iPod/.test(navigator.userAgent);
    ext = !isSafari && a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    for (const g of ['music', 'ambient', 'sfx', 'mc', 'male', 'female']) { groups[g] = ctx.createGain(); groups[g].connect(master); }
    pickExt();
    applyGains();
  }

  function unlock() {
    if (!ctx) init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (unlocked) return;
    unlocked = true;
    // iOS: phát 1 buffer rỗng để mở khoá
    try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
    // tải trước âm quan trọng
    Object.keys(CAT).filter(k => CAT[k][2]).forEach(load);
    fetch('/audio/voices.json?v=' + Date.now().toString(36).slice(0, 5)).then(r => (r.ok ? r.json() : {})).then(j => { manifest = j || {}; }).catch(() => {});
    if (wantMusic) music(true);
  }

  function url(name) { return `/audio/${name}.${ext}?v=4`; }
  function load(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (loading.has(name)) return loading.get(name);
    if (!ctx || failed.has(name)) return Promise.resolve(null);
    const p = fetch(url(name))
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then(buf => { buffers.set(name, buf); loading.delete(name); return buf; })
      .catch(() => { failed.add(name); loading.delete(name); return null; });
    loading.set(name, p);
    return p;
  }

  function applyGains() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const m = st.mute ? 0 : (st.master ?? 80) / 100;
    master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(m, t);
    groups.sfx.gain.setValueAtTime((st.sfx ?? 85) / 100, t);
    groups.mc.gain.setValueAtTime(st.voice ? (st.mcVol ?? 90) / 100 : 0, t);
    groups.male.gain.setValueAtTime(st.pvoice ? (st.maleVol ?? 85) / 100 : 0, t);
    groups.female.gain.setValueAtTime(st.pvoice ? (st.femaleVol ?? 85) / 100 : 0, t);
    // nhạc nền luôn nhỏ hơn rõ rệt so với hiệu ứng
    groups.music.gain.setValueAtTime(st.perf ? 0 : ((st.music ?? 30) / 100) * 0.35, t);
    groups.ambient.gain.setValueAtTime(st.ambient && !st.perf ? ((st.music ?? 30) / 100) * 0.3 + 0.05 : 0, t);
  }

  function apply(s) {
    st = Object.assign({}, s);
    applyGains();
    if (st.mute) stopLoops(); else if (wantMusic) music(true);
  }

  // Âm dự phòng khi không tải được file
  function synth(name, group, pan) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    const hi = /chop|sam|win|bat/.test(name);
    o.type = hi ? 'square' : 'triangle';
    o.frequency.setValueAtTime(hi ? 660 : 420, t);
    if (hi) o.frequency.exponentialRampToValueAtTime(220, t + 0.25);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + (hi ? 0.35 : 0.12));
    route(o, g, group, pan);
    o.start(t); o.stop(t + 0.4);
  }

  function route(src, gain, group, pan) {
    let node = gain;
    src.connect(gain);
    if (pan && st.spatial !== false && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); gain.connect(p); node = p;
    }
    node.connect(groups[group]);
  }

  function start(name, buf, group, pr, pan, vol) {
    // giới hạn số âm đồng thời: bỏ âm có độ ưu tiên thấp nhất
    active = active.filter(a => a.end > ctx.currentTime);
    if (active.length >= MAX_VOICES) {
      active.sort((a, b) => a.pr - b.pr);
      if (active[0].pr > pr) return;
      try { active[0].src.stop(); } catch (e) {}
      active.shift();
    }
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf; g.gain.value = vol;
    route(s, g, group, pan);
    s.start();
    active.push({ src: s, pr, end: ctx.currentTime + buf.duration });
  }

  /** Phát hiệu ứng. Chỉ gọi khi server đã xác nhận sự kiện. */
  function play(name, opt = {}) {
    if (!ctx || !unlocked || st.mute) return;
    const c = CAT[name] || ['sfx', 2, 0];
    const now = performance.now();
    if (now - (lastPlay.get(name) || 0) < 90) return;   // chống phát chồng cùng một âm
    lastPlay.set(name, now);
    const pan = opt.pan || 0, vol = opt.vol ?? 1;
    const buf = buffers.get(name);
    if (buf) return start(name, buf, c[0], c[1], pan, vol);
    const asked = performance.now();
    load(name).then(b => {
      if (b) { if (performance.now() - asked < 700) start(name, b, c[0], c[1], pan, vol); }
      else synth(name, c[0], pan);
    });
  }

  /* ---------- giọng đọc: MC + người chơi (Nam/Nữ) ----------
   * Một kênh thoại duy nhất: không đọc chồng nhau. Câu có độ ưu tiên cao hơn được cắt ngang câu thấp hơn.
   * Câu đến muộn (> 1,2 giây sau sự kiện) bị bỏ để không lệch với bàn chơi. */
  let curVoice = null, manifest = {}, lastPlayLine = 0;
  function speak(name, group, pri, pan) {
    if (!ctx || !unlocked || st.mute) return;
    const now = performance.now();
    if (now < voiceBusyUntil && curVoice && curVoice.pri >= pri) return;
    const asked = now;
    const prev = curVoice;
    curVoice = { src: prev && now < voiceBusyUntil ? prev.src : null, pri, name };   // giữ chỗ ngay để câu thấp hơn không chen vào
    voiceBusyUntil = Math.max(voiceBusyUntil, now + 700);
    load(name).then(b => {
      if (!b || performance.now() - asked > 1200) return;
      if (curVoice && curVoice.name !== name && curVoice.pri >= pri && performance.now() < voiceBusyUntil) return;
      if (curVoice && curVoice.src) try { curVoice.src.stop(); } catch (e) {}
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = b; s.connect(g);
      let node = g;
      if (pan && st.spatial !== false && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
      node.connect(groups[group]); s.start();
      curVoice = { src: s, pri, name };
      voiceBusyUntil = performance.now() + b.duration * 1000;
    });
  }
  /** Bộ giọng có câu này không (theo voices.json). pack: 'f' | 'm' */
  function has(pack, key) { return !!(manifest[pack] && manifest[pack].includes(key)); }
  /**
   * Đọc một câu. role 'mc' → nhóm âm lượng MC; role 'player' → nhóm giọng Nam/Nữ theo bộ giọng.
   * Câu 'play' (ra bài thường) chỉ thỉnh thoảng mới đọc để không spam.
   */
  function line(pack, key, role, pri = 1, pan = 0) {
    if (!has(pack, key)) return false;
    if (role === 'mc' ? !st.voice : !st.pvoice) return false;
    if (key === 'play') {
      const now = performance.now();
      if (now - lastPlayLine < 6000 || Math.random() > 0.35) return false;
      lastPlayLine = now;
    }
    const group = role === 'mc' ? 'mc' : pack === 'f' ? 'female' : 'male';
    speak(pack + '_' + key, group, pri, role === 'mc' ? 0 : pan);
    return true;
  }

  function loop(name, group) {
    return load(name).then(buf => {
      if (!buf || !wantMusic || st.mute) return null;
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; s.loop = true;
      g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2);
      s.connect(g); g.connect(groups[group]); s.start();
      return s;
    });
  }
  function stopLoops() {
    for (const s of [musicSrc, ambSrc]) if (s) try { s.stop(); } catch (e) {}
    musicSrc = ambSrc = null;
  }
  /** Bật/tắt nhạc nền + ambient (chỉ chạy khi đã được trình duyệt cho phép phát). */
  function music(on) {
    wantMusic = on;
    if (!on) return stopLoops();
    if (!ctx || !unlocked || st.mute || st.perf) return;
    if (!musicSrc && (st.music ?? 30) > 0) { musicSrc = 'pending'; loop('music', 'music').then(s => { musicSrc = s; if (s && !wantMusic) stopLoops(); }); }
    if (!ambSrc && st.ambient) { ambSrc = 'pending'; loop('ambient', 'ambient').then(s => { ambSrc = s; if (s && !wantMusic) stopLoops(); }); }
  }

  return { init, unlock, play, line, has, music, apply, _state: () => ({ ctx: ctx && ctx.state, unlocked, ext, loaded: [...buffers.keys()], failed: [...failed] }) };
})();
