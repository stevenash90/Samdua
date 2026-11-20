/* Game Ma Sói — giao diện phía trình duyệt. Dùng các hàm nền tảng trong core/app.js (h, $, act, toast, show, S…). */
'use strict';
const MS = (() => {
  let base = { at: 0, left: 0, total: 1 }, ticker = null, lastGameNo = 0, lastPhase = '', witchHeal = false, witchPoison = null, poisonMode = false;
  const R = () => (S && S.roleInfo) || {};
  const nm = k => (S.players[k] ? S.players[k].name : '?');
  const me = () => S.me || null;
  const alive = k => S.players[k] && S.players[k].alive;
  const inGame = () => S.phase !== 'lobby' && S.phase !== 'over';
  const spec = () => S.role === 'spec';

  /* ---------- âm thanh: người dẫn truyện + nhạc nền (bật/tắt riêng, nhớ trên máy) ---------- */
  const VOICE = k => `/games/masoi/voice/${k}.mp3?v=1`;
  const BGM = ['/games/masoi/bgm/bg_1.mp3?v=1'];
  const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
  let narrOn = pref('ms_narr', true), bgmOn = pref('ms_bgm', true), bgmPick = null, preloaded = false;
  function syncAudio() {
    $('btMsNarr').classList.toggle('off', !narrOn);
    $('btMsBgm').classList.toggle('off', !bgmOn);
    const want = bgmOn && S && S.game === 'masoi' && S.phase !== 'lobby';
    if (want) { if (!bgmPick) bgmPick = BGM[Math.floor(Math.random() * BGM.length)]; Sound.bgm(bgmPick); }
    else { Sound.bgm(null); if (S && S.phase === 'lobby') bgmPick = null; }
    if (narrOn && !preloaded) { preloaded = true; Sound.preload(['intro_1', 'intro_2', 'night_1', 'night_2', 'night_3'].map(VOICE)); }
  }

  function onState(s, evs, first) {
    S = s;
    const away = ['sHistory', 'sStats', 'sReplay', 'sRules'].includes(current);
    if (!away) show('sMasoi');
    const g = S.g;
    base = g && g.timer ? { at: performance.now(), left: g.timer.left, total: g.timer.total || 1 } : { at: 0, left: 0, total: 1 };
    if (g && g.no !== lastGameNo) { lastGameNo = g.no; if (!first && me()) revealCard(me().role); witchHeal = false; witchPoison = null; if (!first) bgmPick = null; }
    if (S.phase !== lastPhase) {
      if (!first && lastPhase) { try { navigator.vibrate && navigator.vibrate(S.phase === 'night' ? [60, 60, 60] : 40); } catch (e) {} }
      lastPhase = S.phase; poisonMode = false;
      if (S.phase !== 'witch') { witchHeal = false; witchPoison = null; }
    }
    if (!first) for (const e of evs || []) handleEvent(e);
    render();
    onChatState(first);
    syncVoice();
    if (!ticker) ticker = setInterval(tickTimer, 250);
    syncAudio();
  }
  // Voice theo luật Ma Sói (lọc ở máy gửi): ban ngày cả làng nghe nhau; ban đêm chỉ bầy Sói nghe nhau, dân im;
  // người đã chết chỉ nói được với người chết khác và người xem (kênh hồn ma).
  function syncVoice() {
    const m = me(), night = S.phase === 'night' || S.phase === 'witch';
    let pol = null, label = '';
    if (inGame() && m && !spec()) {
      if (!m.alive) { pol = x => x.seat < 0 || (S.players[x.seat] && !S.players[x.seat].alive); label = 'ghost'; }
      else if (night && m.role === 'wolf') { const mates = new Set(m.mates || []); pol = x => mates.has(x.seat); label = 'wolf'; }
      else if (night) { pol = () => false; label = 'sleep'; }
    }
    try { Voice.forceMute(false); Voice.setPolicy(pol, label); } catch (e) {}
  }
  function handleEvent(e) {
    if (e.type === 'narr' && narrOn) Sound.narrate(VOICE(e.key + '_' + e.n));
    if (e.type === 'dawn' && e.deaths && me() && e.deaths.length && !alive(S.you)) toast('💀 Bạn đã chết. Giờ bạn ở kênh hồn ma 👻', 3500);
    if (e.type === 'exec' && e.t === S.you) toast('⚖️ Bạn bị làng treo cổ!', 3000);
    if (e.type === 'over') { try { Sound.play(S.g && me() && ((S.g.winner === 'wolf') === (me().role === 'wolf')) ? 'win' : 'lose'); } catch (x) {} }
  }
  function leave() { clearInterval(ticker); ticker = null; lastGameNo = 0; lastPhase = ''; bgmPick = null; try { Voice.forceMute(false); Voice.setPolicy(null, ''); } catch (e) {} try { Sound.narrStop(); Sound.bgm(null); } catch (e) {} }

  /* ---------- banner + đồng hồ ---------- */
  function phaseText() {
    const g = S.g, m = me(), r = m && m.role;
    switch (S.phase) {
      case 'lobby': return ['🐺 Làng Ma Sói', `${S.players.length}/${S.max} người · cần ít nhất ${S.min}`];
      case 'night': {
        let sub = 'Bạn đang ngủ… 😴 (mic tạm tắt)';
        if (!m || spec()) sub = 'Cả làng đang ngủ, người chơi đặc biệt đang hành động';
        else if (!m.alive) sub = 'Bạn đã chết — xem các vai hành động 👻 (voice chỉ người chết nghe)';
        else if (r === 'wolf') sub = 'Chọn người để cắn — bàn với bầy ở kênh 🐺 hoặc voice (chỉ Sói nghe)';
        else if (r === 'seer') sub = m.done ? 'Đã soi, chờ trời sáng' : 'Chọn một người để soi';
        else if (r === 'guard') sub = m.target !== null && m.target !== undefined ? `Đang che ${nm(m.target)}` : 'Chọn một người để che chở';
        return [`🌙 Đêm ${g.day}`, sub];
      }
      case 'witch': return [`🌙 Đêm ${g.day}`, r === 'witch' && m.alive ? (m.victim !== null && m.victim !== undefined ? `Sói vừa cắn ${nm(m.victim)}. Cứu không? Đầu độc ai không?` : 'Đêm nay Sói không cắn ai. Có đầu độc ai không?') : 'Phù thủy đang thức…'];
      case 'dawn': return ['☀️ Trời sáng', 'Xem đêm qua ai đã ra đi'];
      case 'discuss': return [`🗣️ Ngày ${g.day} · Thảo luận`, 'Bàn bạc, tố, cãi (chat hoặc voice). Xong thì bấm Sẵn sàng'];
      case 'vote': return ['🗳️ Bỏ phiếu treo cổ', 'Chạm vào người bạn nghi là Sói'];
      case 'exec': return ['⚖️ Kết quả bỏ phiếu', 'Đêm sắp buông xuống…'];
      case 'hunter': return ['🏹 Thợ săn', g.hunter === S.you ? 'Bạn được bắn chết theo một người — chạm để chọn' : `${nm(g.hunter)} đang chọn người để bắn`];
      case 'over': return [g && g.winner === 'wolf' ? '🐺 BẦY SÓI THẮNG' : '🎉 DÂN LÀNG THẮNG', 'Lật bài: xem vai của mọi người'];
    }
    return ['Ma Sói', ''];
  }
  function renderBanner() {
    const [t, sub] = phaseText();
    const b = $('msBanner'); b.textContent = '';
    b.className = 'ms-banner ph-' + S.phase + (S.g && S.g.winner ? ' win-' + S.g.winner : '');
    b.append(h('b', '', t), h('small', '', sub));
    const bar = h('div', 'ms-bar'); bar.append(h('i', '')); b.append(bar);
    bar.hidden = !(S.g && S.g.timer);
    $('msTitle').textContent = `Ma Sói · ${S.code}`;
    tickTimer();
  }
  function tickTimer() {
    if (!S || S.game !== 'masoi') return;
    const bar = document.querySelector('#msBanner .ms-bar i'); if (!bar) return;
    const left = Math.max(0, base.left - (performance.now() - base.at));
    bar.style.width = (100 * left / base.total) + '%';
    bar.parentElement.dataset.s = Math.ceil(left / 1000) + 's';
  }

  /* ---------- người chơi ---------- */
  function targetMode() {
    const m = me(), g = S.g;
    if (!m || spec() || !inGame()) return null;
    if (S.phase === 'hunter') return g.hunter === S.you ? 'shoot' : null;
    if (!m.alive) return null;
    if (S.phase === 'night') {
      if (m.role === 'wolf') return 'wolf';
      if (m.role === 'seer' && !m.done) return 'seer';
      if (m.role === 'guard' && (m.target === null || m.target === undefined)) return 'guard';
    }
    if (S.phase === 'witch' && m.role === 'witch' && poisonMode) return 'poison';
    if (S.phase === 'vote') return 'vote';
    return null;
  }
  function renderGrid() {
    const box = $('msGrid'); box.textContent = '';
    const m = me(), mode = targetMode();
    const tally = {};
    S.players.forEach(p => { if (p.vote !== null && p.vote >= 0) tally[p.vote] = (tally[p.vote] || 0) + 1; });
    const wolfTally = {};
    if (m && m.wolfVotes) Object.values(m.wolfVotes).forEach(t => { wolfTally[t] = (wolfTally[t] || 0) + 1; });
    const seen = {};
    if (m && m.seen) m.seen.forEach(x => { seen[x.t] = x.wolf; });
    S.players.forEach((p, k) => {
      const c = h('div', 'mcard' + (p.alive ? '' : ' dead') + (k === S.you ? ' me' : '') + (p.role === 'wolf' && m && m.role === 'wolf' && k !== S.you ? ' mate' : ''));
      c.dataset.seat = k;
      const showArt = p.role && R()[p.role] && R()[p.role].art && (S.phase === 'over' || !p.alive);
      const av = h('div', 'mav' + (showArt ? ' art' : ''), showArt ? '' : p.av);
      if (showArt) av.style.backgroundImage = `url(${R()[p.role].art})`;
      av.append(h('i', 'dot ' + (p.bot || p.online ? (p.afk ? 'afk' : 'on') : '')));
      if (!p.alive) av.append(h('span', 'skull', '💀'));
      c.append(av, h('div', 'mnm', p.name));
      const tags = h('div', 'mtags');
      if (p.role && R()[p.role]) tags.append(h('span', 'mrole r-' + p.role, R()[p.role].icon + ' ' + R()[p.role].name));
      else if (inGame() || S.phase === 'over') tags.append(h('span', 'mrole unk', '❔'));
      if (k === S.host && S.phase === 'lobby') tags.append(h('span', 'mt g', 'Chủ phòng'));
      if (k === S.you) tags.append(h('span', 'mt', 'Bạn'));
      if (p.bot) tags.append(h('span', 'mt', 'Máy'));
      if (seen[k] !== undefined) tags.append(h('span', 'mt ' + (seen[k] ? 'bad' : 'ok'), seen[k] ? '🔮 SÓI' : '🔮 Dân'));
      if (p.ready) tags.append(h('span', 'mt ok', '✓ Sẵn sàng'));
      if (m && m.role === 'guard' && m.guardLast === k && S.phase === 'night') tags.append(h('span', 'mt', 'Đã che đêm trước'));
      c.append(tags);
      if (tally[k]) c.append(h('div', 'mvotes', `${tally[k]} phiếu`));
      if (wolfTally[k] && S.phase === 'night') c.append(h('div', 'mvotes wolf', `🐺×${wolfTally[k]}`));
      if (p.vote !== null && p.vote !== undefined && (S.phase === 'vote' || S.phase === 'exec')) c.append(h('div', 'mvote-to', p.vote >= 0 ? '→ ' + nm(p.vote) : '→ bỏ qua'));
      if (S.phase === 'witch' && m && m.role === 'witch' && m.victim === k) c.classList.add('victim');
      if (witchPoison === k && S.phase === 'witch') c.classList.add('poisoned');
      const pickable = mode && p.alive && k !== S.you && !(mode === 'wolf' && p.role === 'wolf') && !(mode === 'guard' && m.guardLast === k);
      const pickableSelf = mode === 'guard' && k === S.you && m.guardLast !== k;
      if (pickable || pickableSelf) {
        c.classList.add('pick');
        if ((mode === 'vote' && m.myVote === k) || (mode === 'wolf' && m.wolfVotes && m.wolfVotes[S.you] === k)) c.classList.add('chosen');
        c.onclick = () => choose(mode, k);
      }
      box.append(c);
    });
  }
  async function choose(mode, k) {
    let r;
    if (mode === 'wolf' || mode === 'seer' || mode === 'guard') {
      r = await act('night', { kind: mode, target: k });
      if (!r.err && mode === 'seer') { const w = S.players[k] && S.me && S.me.seen && S.me.seen.find(x => x.t === k); toast(`🔮 Đã soi ${nm(k)}${w ? (w.wolf ? ': LÀ SÓI 🐺' : ': là dân') : ''}`, 3500); }
      if (!r.err && mode === 'guard') toast(`🛡️ Đêm nay che ${nm(k)}`);
    } else if (mode === 'vote') r = await act('vote', { target: k });
    else if (mode === 'shoot') r = await act('shoot', { target: k });
    else if (mode === 'poison') { witchPoison = witchPoison === k ? null : k; poisonMode = false; render(); return; }
    if (r && r.err) toast(r.err);
  }

  /* ---------- bảng hành động ---------- */
  function renderPanel() {
    const box = $('msPanel'); box.textContent = '';
    const m = me(), isHost = S.you === S.host;
    if (m && m.role && R()[m.role]) {
      const ri = R()[m.role];
      const rc = h('div', 'mrolecard r-' + m.role + (m.alive ? '' : ' dead'));
      const pic = h('div', 'pic'); if (ri.art) pic.style.backgroundImage = `url(${ri.art})`; else pic.textContent = ri.icon;
      rc.append(pic, h('div', 'tx'));
      rc.lastChild.append(h('b', '', 'Bạn là ' + ri.name + (m.alive ? '' : ' (đã chết)')), h('small', '', ri.desc));
      if (m.mates && m.mates.length) rc.lastChild.append(h('small', 'mates', '🐺 Đồng bọn: ' + m.mates.map(nm).join(', ')));
      if (m.role === 'witch' && m.potions) rc.lastChild.append(h('small', 'mates', `Bình cứu: ${m.potions.heal ? 'còn' : 'hết'} · Bình độc: ${m.potions.poison ? 'còn' : 'hết'}`));
      box.append(rc);
    }
    const row = h('div', 'mact');
    if (S.phase === 'lobby') {
      if (isHost) {
        const add = h('button', 'btn', '🤖 Thêm máy'); add.disabled = S.players.length >= S.max;
        add.onclick = async () => { const r = await act('addBot', {}); if (r.err) toast(r.err); };
        const st = h('button', 'btn gold', '▶ Bắt đầu'); st.disabled = S.players.length < S.min;
        st.onclick = async () => { const r = await act('start', {}); if (r.err) toast(r.err); };
        row.append(add, st);
      } else row.append(h('div', 'note', 'Chờ chủ phòng bắt đầu…'));
      box.append(row);
      const setup = S.setup || {};
      box.append(h('div', 'note', 'Vai ván này: ' + Object.entries(setup).map(([r, c]) => `${c} ${R()[r] ? R()[r].icon + ' ' + R()[r].name : r}`).join(' · ')));
      box.append(h('div', 'note', `Thảo luận ${Math.round(S.settings.discussMs / 1000)}s/ngày · ${S.settings.revealRole ? 'Lộ vai khi chết' : 'Giấu vai khi chết'} · Mời bạn: mã phòng ${S.code}`));
      return;
    }
    if (S.phase === 'over') {
      if (isHost) {
        const again = h('button', 'btn gold', '🔁 Ván mới'); again.onclick = async () => { const r = await act('start', {}); if (r.err) toast(r.err); };
        const lb = h('button', 'btn', 'Về phòng chờ'); lb.onclick = () => act('lobby', {});
        row.append(lb, again);
      } else row.append(h('div', 'note', 'Chờ chủ phòng mở ván mới…'));
      box.append(row);
      return;
    }
    if (!m || spec()) { box.append(h('div', 'note', '👀 Bạn đang xem. Chat của bạn chỉ người chết và người xem thấy.')); return; }
    if (S.phase === 'witch' && m.role === 'witch' && m.alive) {
      const v = m.victim;
      if (v !== null && v !== undefined && m.potions.heal) {
        const hb = h('button', 'btn' + (witchHeal ? ' green' : ''), witchHeal ? `✓ Sẽ cứu ${nm(v)}` : `🧪 Cứu ${nm(v)}`);
        hb.onclick = () => { witchHeal = !witchHeal; render(); };
        row.append(hb);
      }
      if (m.potions.poison) {
        const pb = h('button', 'btn' + (witchPoison !== null ? ' red' : ''), witchPoison !== null ? `☠️ Độc ${nm(witchPoison)} (bỏ)` : poisonMode ? 'Chạm người để đầu độc…' : '☠️ Đầu độc');
        pb.onclick = () => { if (witchPoison !== null) witchPoison = null; else poisonMode = !poisonMode; render(); };
        row.append(pb);
      }
      const ok = h('button', 'btn gold', 'Xong');
      ok.onclick = async () => { const r = await act('witch', { heal: witchHeal, poison: witchPoison }); if (r.err) toast(r.err); };
      row.append(ok);
    } else if (S.phase === 'discuss' && m.alive) {
      const rb = h('button', 'btn ' + (m.ready ? 'green' : 'gold'), m.ready ? '✓ Đã sẵn sàng (bấm để huỷ)' : '🗳️ Sẵn sàng bỏ phiếu');
      rb.onclick = () => act('ready', { on: !m.ready });
      row.append(rb);
    } else if (S.phase === 'vote' && m.alive) {
      const sk = h('button', 'btn' + (m.myVote === -1 ? ' green' : ''), m.myVote === -1 ? '✓ Đã bỏ qua' : 'Bỏ qua (không treo ai)');
      sk.onclick = () => act('vote', { target: -1 });
      row.append(sk, h('div', 'note', m.myVote !== null && m.myVote >= 0 ? `Bạn đang vote ${nm(m.myVote)} — chạm người khác để đổi` : 'Chạm vào một người để vote'));
    } else if (S.phase === 'hunter' && S.g.hunter === S.you) {
      const nb = h('button', 'btn', 'Không bắn ai'); nb.onclick = () => act('shoot', { target: null });
      row.append(nb);
    }
    if (row.childNodes.length) box.append(row);
    const dead = (S.g && S.g.deaths) || [];
    if (dead.length) {
      const lg = h('div', 'mlog');
      const CAUSE = { wolf: 'bị Sói cắn', poison: 'bị đầu độc', vote: 'bị treo cổ', hunter: 'bị Thợ săn bắn', night: 'chết trong đêm' };
      dead.slice(-6).forEach(d => lg.append(h('div', '', `${d.cause === 'vote' ? 'Ngày' : 'Đêm'} ${d.day}: ${nm(d.i)} ${CAUSE[d.cause] || ''}`)));
      box.append(lg);
    }
  }

  /* ---------- lật vai đầu ván + bảng vai ---------- */
  function revealCard(role) {
    const ri = R()[role]; if (!ri) return;
    const ov = h('div', 'ms-reveal r-' + role);
    const card = h('div', 'rcard');
    const pic = h('div', 'pic'); if (ri.art) pic.style.backgroundImage = `url(${ri.art})`; else pic.textContent = ri.icon;
    const tx = h('div', 'tx');
    tx.append(h('b', '', 'Bạn là ' + ri.name), h('small', '', ri.desc));
    if (ri.lore) tx.append(h('i', 'lore', ri.lore));
    tx.append(h('em', '', 'Chạm để đóng'));
    card.append(pic, tx);
    ov.append(card);
    ov.onclick = () => ov.remove();
    document.body.append(ov);
    setTimeout(() => ov.remove(), 12000);
  }
  function renderRolesSheet() {
    const box = $('msRoles'); box.textContent = '';
    const card = h('div', 'rsheet');
    card.append(h('b', 'ttl', '📜 Các vai trong làng'));
    for (const [k, r] of Object.entries(R())) { const it = h('div', 'it'); const pic = h('span', 'pic'); if (r.art) pic.style.backgroundImage = `url(${r.art})`; else pic.textContent = r.icon; it.append(pic, h('div', '')); it.lastChild.append(h('b', '', r.name + (r.team === 'wolf' ? ' · phe Sói' : '')), h('small', '', r.desc)); card.append(it); }
    card.append(h('small', 'foot', 'Dân thắng khi diệt hết Sói. Sói thắng khi số Sói bằng hoặc nhiều hơn số người còn lại. Ban đêm dân không chat được; Sói có kênh 🐺 riêng; người chết và người xem chat ở kênh 👻.'));
    card.append(h('small', 'foot', 'Nhạc nền: “Deep Horrors” – Kevin MacLeod (incompetech.com), giấy phép CC BY 4.0.'));
    box.append(card);
    box.onclick = e => { if (e.target === box) box.classList.remove('on'); };
  }

  function render() {
    if (!S || S.game !== 'masoi') return;
    renderBanner(); renderGrid(); renderPanel();
  }
  $('btMsRoles').onclick = () => { renderRolesSheet(); $('msRoles').classList.add('on'); };
  $('btMsLeave').onclick = () => leaveRoom();
  $('btMsNarr').onclick = () => { narrOn = !narrOn; setPref('ms_narr', narrOn); if (!narrOn) Sound.narrStop(); Sound.unlock(); syncAudio(); toast(narrOn ? '🎙️ Bật người dẫn truyện' : '🎙️ Tắt người dẫn truyện'); };
  $('btMsBgm').onclick = () => { bgmOn = !bgmOn; setPref('ms_bgm', bgmOn); Sound.unlock(); syncAudio(); toast(bgmOn ? '🎵 Bật nhạc nền' : '🎵 Tắt nhạc nền'); };

  return { onState, leave, render };
})();
GAMES.masoi = { name: 'Ma Sói', onState: MS.onState, leave: MS.leave };
