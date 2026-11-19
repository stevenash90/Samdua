// Máy chơi Ma Sói. Mỗi máy giữ "độ nghi" với từng người (0..1), cập nhật theo:
//   - vai của mình (Sói biết đồng bọn; Tiên tri biết kết quả soi),
//   - lời khai Tiên tri (của máy hoặc người: "tôi là tiên tri, X là sói"),
//   - người chơi tố ai trong chat ("X là sói", "nghi X"),
//   - ai bỏ phiếu cho ai, vai lộ ra khi chết.
// Máy chỉ dùng thông tin mà một người ở vị trí đó được biết — không nhìn vai người khác.
const crypto = require('crypto');
const rnd = n => crypto.randomInt(Math.max(1, n));
const chance = p => crypto.randomInt(1000) < p * 1000;
const pick = a => a[rnd(a.length)];

function newMind(room, i) {
  const n = room.players.length, sus = [];
  for (let k = 0; k < n; k++) sus.push(k === i ? 0 : 0.3 + rnd(150) / 1000);
  return { sus, said: 0, claimed: false, accused: {} };
}
const mind = (room, i) => room.g.mind[i] || (room.g.mind[i] = newMind(room, i));
const bots = room => room.players.map((p, k) => k).filter(k => room.players[k].bot && room.alive(k));
const name = (room, k) => room.players[k].name;
const others = (room, i) => room.aliveIdx().filter(k => k !== i);
function bump(room, i, k, d) { const m = mind(room, i); if (k === i || k < 0) return; m.sus[k] = Math.max(0, Math.min(1, (m.sus[k] || 0.3) + d)); }
function setSus(room, i, k, v) { const m = mind(room, i); if (k !== i) m.sus[k] = v; }
function topSus(room, i, cand) {
  const m = mind(room, i);
  let best = null, bv = -1;
  for (const k of cand) { const v = m.sus[k] + rnd(60) / 1000; if (v > bv) { bv = v; best = k; } }
  return best;
}
function say(room, i, text, ch) {
  const m = mind(room, i);
  if (ch !== 'wolf' && m.said >= 3) return;     // tiết chế: tối đa 3 câu/ngày/máy
  if (ch !== 'wolf') m.said++;
  room.botChat(i, text, ch);
}

/* ---------- đêm ---------- */
function scheduleNight(room) {
  for (const i of bots(room)) {
    const r = room.role(i);
    if (r !== 'wolf' && r !== 'seer' && r !== 'guard') continue;
    room.later(room.botDelay(), () => { if (room.phase === 'night' && room.alive(i)) { nightMove(room, i); room.commit(); } });
  }
}
function nightMove(room, i) {
  const g = room.g, r = room.role(i), n = g.night;
  if (r === 'wolf') {
    if (n.wolf[i] !== undefined) return;
    const prey = others(room, i).filter(k => !room.isWolf(k));
    if (!prey.length) return;
    // theo đồng bọn đã chọn; nếu chưa: ưu tiên người tự nhận Tiên tri / người đang tố Sói
    const mate = Object.values(n.wolf).find(t => room.alive(t));
    let t = mate !== undefined && chance(0.85) ? mate : null;
    if (t === null) {
      const claimers = g.claims.filter(c => room.alive(c.by) && !room.isWolf(c.by)).map(c => c.by);
      t = claimers.length && chance(0.7) ? pick(claimers) : threatToWolves(room, prey);
      if (!Object.keys(n.wolf).length && room.settings.botChat !== false) {
        const mates = room.players.map((_, k) => k).filter(k => room.isWolf(k) && room.alive(k) && k !== i);
        if (mates.some(k => !room.players[k].bot)) say(room, i, `Cắn ${name(room, t)} nhé?`, 'wolf');
      }
    }
    room.nightAct(i, 'wolf', t);
  } else if (r === 'seer') {
    if (n.seer !== null) return;
    const checked = new Set(g.seen.filter(x => x.by === i).map(x => x.t));
    const cand = others(room, i).filter(k => !checked.has(k));
    if (cand.length) room.nightAct(i, 'seer', topSus(room, i, cand));
  } else if (r === 'guard') {
    if (n.guard !== null) return;
    const cand = room.aliveIdx().filter(k => k !== g.guardLast);
    const seer = g.claims.find(c => room.alive(c.by) && cand.includes(c.by));
    const t = seer && chance(0.8) ? seer.by : cand.includes(i) && chance(0.45) ? i : pick(cand);
    room.nightAct(i, 'guard', t);
  }
}
// Sói cắn người nguy hiểm: người hay tố đúng Sói (phiếu bầu vào Sói)
function threatToWolves(room, prey) {
  const g = room.g, score = {};
  for (const k of prey) score[k] = rnd(100);
  if (g.lastVote) for (const [v, t] of Object.entries(g.lastVote.votes)) if (t >= 0 && room.isWolf(t) && score[v] !== undefined) score[v] += 80;
  return +Object.keys(score).sort((a, b) => score[b] - score[a])[0];
}
function scheduleWitch(room, wi) {
  if (!room.players[wi].bot) return;
  room.later(room.botDelay(), () => {
    if (room.phase !== 'witch') return;
    const g = room.g, v = g.night.victim;
    let heal = false, poison = null;
    if (v !== null && g.potions.heal) {
      const isClaimSeer = g.claims.some(c => c.by === v);
      heal = v === wi || isClaimSeer || (g.day === 1 && chance(0.6)) || chance(0.25);
    }
    if (g.potions.poison && g.day >= 2) {
      const cand = others(room, wi);
      const t = topSus(room, wi, cand);
      if (t !== null && mind(room, wi).sus[t] >= 0.85 && chance(0.7)) poison = t;
    }
    room.witchAct(wi, heal, poison);
    room.commit();
  });
}
function scheduleHunter(room, h) {
  if (!room.players[h].bot) return;
  room.later(room.botDelay() / 2, () => {
    if (room.phase !== 'hunter') return;
    const cand = others(room, h).filter(k => !(room.role(h) === 'wolf' && room.isWolf(k)));
    const t = topSus(room, h, cand);
    room.hunterShoot(t !== null && mind(room, h).sus[t] >= 0.5 ? t : null);
    room.commit();
  });
}

/* ---------- thông tin mới ---------- */
function onSeen(room, i, t) {
  if (!room.players[i].bot) return;
  setSus(room, i, t, room.isWolf(t) ? 1 : 0);
}
function onDawn(room, deaths) {
  for (const i of bots(room)) mind(room, i).said = 0;
  // người chết đêm thường không phải Sói (Sói không cắn đồng bọn)
  if (room.settings.botChat === false) return;
  const b = bots(room);
  if (!b.length) return;
  if (deaths.length && chance(0.6)) {
    const i = pick(b);
    room.later(1500 + rnd(2500), () => { if (room.phase === 'dawn' || room.phase === 'discuss') { say(room, i, pick([`RIP ${name(room, deaths[0])} 😢 Đêm qua ai thấy gì không?`, `Mất ${name(room, deaths[0])} rồi… Sói ở ngay trong bàn này.`, `${name(room, deaths[0])} đi rồi. Phải tìm ra Sói thôi!`])); room.publish(); } });
  } else if (!deaths.length && chance(0.5)) {
    const i = pick(b);
    room.later(1500 + rnd(2000), () => { if (room.phase === 'dawn' || room.phase === 'discuss') { say(room, i, pick(['Đêm qua yên bình, chắc Bảo vệ đỡ trúng rồi 😎', 'Không ai chết, có người được cứu đấy!'])); room.publish(); } });
  }
}
function onDeath(room, i) {
  const r = room.role(i);
  if (!room.settings.revealRole) return;
  for (const b of bots(room)) {
    if (b === i) continue;
    // vai lộ ra: người nhận Tiên tri là thật hay giả, và ai đã bỏ phiếu cho người này
    for (const c of room.g.claims) {
      if (c.by === i) {
        if (r === 'seer' && c.target !== undefined && room.alive(c.target)) setSus(room, b, c.target, c.wolf ? 0.97 : 0.1);
        if (r === 'wolf' && c.target !== undefined) setSus(room, b, c.target, c.wolf ? 0.15 : 0.6);
      }
    }
    const lv = room.g.lastVote;
    if (lv) for (const [v, t] of Object.entries(lv.votes)) if (+t === i) bump(room, b, +v, r === 'wolf' ? -0.15 : 0.12);
  }
}
function onVote(room, votes) {
  for (const b of bots(room)) {
    if (room.isWolf(b)) continue;
    for (const [v, t] of Object.entries(votes)) {
      if (+v === b || t < 0) continue;
      // bỏ phiếu cho người mình tin là dân → hơi đáng nghi
      if (mind(room, b).sus[t] < 0.2) bump(room, b, +v, 0.1);
    }
  }
}
// người chơi chat: tìm "X là sói", "nghi X", "tôi là tiên tri"
function onHumanChat(room, e) {
  const g = room.g;
  if (!g || !room.inGame()) return;
  const low = e.text.toLowerCase();
  const speaker = e.seat;
  const named = room.players.map((p, k) => k).filter(k => k !== speaker && room.alive(k) && low.includes(room.players[k].name.toLowerCase()));
  const accuse = /sói|soi|nghi|khả nghi|kha nghi|vote|treo/.test(low);
  const clean = /(là|la) (dân|dan|người tốt|nguoi tot)|trong sạch|trong sach|không phải sói|khong phai soi/.test(low);
  const claimSeer = /(tôi|tao|tớ|mình|em|anh) (là |la )?(tiên tri|tien tri)/.test(low);
  if (claimSeer && named.length) g.claims.push({ by: speaker, target: named[0], wolf: !clean, day: g.day, human: true });
  for (const b of bots(room)) {
    if (room.isWolf(b)) {
      // Sói bị tố: phản bác
      if (accuse && named.includes(b) && chance(0.6) && room.settings.botChat) room.later(1500 + rnd(2500), () => { if (room.phase === 'discuss' || room.phase === 'vote') { say(room, b, pick([`${name(room, speaker)} nói vô căn cứ, tôi là dân!`, 'Tôi dân thật mà 😤', `Sao lại là tôi? ${name(room, speaker)} mới đáng nghi!`])); room.publish(); } });
      continue;
    }
    for (const k of named) {
      if (k === b) {
        if (accuse && chance(0.6) && room.settings.botChat) room.later(1500 + rnd(2500), () => { if (room.phase === 'discuss' || room.phase === 'vote') { say(room, b, pick(['Tôi là dân, đừng vote nhầm!', `${name(room, speaker)} ơi tôi dân thật mà 🥺`])); room.publish(); } });
        continue;
      }
      const trust = 1 - (mind(room, b).sus[speaker] || 0.3);
      if (claimSeer) setSus(room, b, k, clean ? Math.min(mind(room, b).sus[k], 0.2) : Math.max(mind(room, b).sus[k], 0.55 + 0.4 * trust));
      else if (clean) bump(room, b, k, -0.1 * trust);
      else if (accuse) bump(room, b, k, 0.18 * trust);
    }
  }
}

/* ---------- ngày ---------- */
function scheduleDiscuss(room) {
  const g = room.g;
  for (const i of bots(room)) {
    const r = room.role(i), m = mind(room, i);
    // Tiên tri máy: soi trúng Sói thì khai ra (hoặc sau ngày 2 thì khai kết quả)
    if (r === 'seer' && !m.claimed) {
      const hit = g.seen.filter(x => x.by === i && x.wolf && room.alive(x.t)).pop();
      if (hit || (g.day >= 3 && chance(0.6))) {
        m.claimed = true;
        room.later(3000 + rnd(6000), () => {
          if (room.phase !== 'discuss' || !room.alive(i)) return;
          const last = hit || g.seen.filter(x => x.by === i && room.alive(x.t)).pop();
          if (!last) return;
          g.claims.push({ by: i, target: last.t, wolf: last.wolf, day: g.day });
          say(room, i, last.wolf ? `Tôi là Tiên tri! Đêm ${last.day} soi ${name(room, last.t)} là SÓI 🐺 Treo nó!` : `Tôi là Tiên tri. ${name(room, last.t)} là dân, đừng vote nhầm.`);
          for (const b of bots(room)) if (b !== i && !room.isWolf(b)) setSus(room, b, last.t, last.wolf ? Math.max(mind(room, b).sus[last.t], 0.85) : 0.1);
          if (last.wolf) wolfCounter(room, i, last.t);
          room.publish();
        });
      }
    }
    // tố người mình nghi nhất (thỉnh thoảng)
    if (room.settings.botChat && chance(0.35)) {
      room.later(6000 + rnd(Math.max(1, room.settings.discussMs - 12000)), () => {
        if (room.phase !== 'discuss' || !room.alive(i)) return;
        const cand = others(room, i).filter(k => !(room.isWolf(i) && room.isWolf(k)));
        const t = topSus(room, i, cand);
        if (t === null) return;
        say(room, i, pick([`Tôi thấy ${name(room, t)} hơi khả nghi.`, `${name(room, t)} im lặng quá, nghi lắm 🤔`, `Vote ${name(room, t)} đi mọi người.`]));
        room.publish();
      });
    }
  }
  // máy cũng bấm "sẵn sàng" sau một lúc (không ảnh hưởng — chỉ người thật quyết định chuyển sang bỏ phiếu)
}
// Sói bị Tiên tri tố: đồng bọn (máy) có thể nhảy ra nhận Tiên tri giả để cãi
function wolfCounter(room, seer, wolf) {
  const mates = bots(room).filter(k => room.isWolf(k) && k !== wolf);
  if (!mates.length || !chance(0.4)) return;
  const m = pick(mates);
  room.later(4000 + rnd(5000), () => {
    if (room.phase !== 'discuss' || !room.alive(m)) return;
    room.g.claims.push({ by: m, target: seer, wolf: true, day: room.g.day, fake: true });
    say(room, m, `Sai! TÔI mới là Tiên tri thật. ${name(room, seer)} nhận vơ, chính nó là Sói!`);
    for (const b of bots(room)) if (!room.isWolf(b)) { bump(room, b, seer, 0.25); bump(room, b, m, 0.2); }
    room.publish();
  });
}
function scheduleVotes(room) {
  for (const i of bots(room)) {
    room.later(room.botDelay(), () => {
      if (room.phase !== 'vote' || !room.alive(i) || room.g.votes[i] !== undefined) return;
      room.vote(i, botVote(room, i));
      room.commit();
    });
  }
}
function botVote(room, i) {
  const g = room.g, cand = others(room, i);
  const tally = {};
  Object.values(g.votes).forEach(t => { if (t >= 0) tally[t] = (tally[t] || 0) + 1; });
  if (room.isWolf(i)) {
    const prey = cand.filter(k => !room.isWolf(k));
    // theo số đông nếu đang dồn vào một người không phải Sói; nếu đồng bọn bị dồn thì đẩy sang người khác
    let best = null, bv = -1;
    for (const k of prey) {
      const claimer = g.claims.some(c => c.by === k && !c.fake) ? 1.5 : 0;
      const v = (tally[k] || 0) * 1.2 + claimer + rnd(100) / 100;
      if (v > bv) { bv = v; best = k; }
    }
    return best === null ? -1 : best;
  }
  const m = mind(room, i);
  let best = null, bv = -1;
  for (const k of cand) {
    const v = m.sus[k] + 0.08 * (tally[k] || 0) + rnd(60) / 1000;
    if (v > bv) { bv = v; best = k; }
  }
  if (best === null || (bv < 0.5 && g.day === 1 && chance(0.5)) || bv < 0.35) return -1;
  return best;
}
function onOver(room) {
  if (!room.settings.botChat) return;
  const g = room.g, b = room.players.map((p, k) => k).filter(k => room.players[k].bot);
  if (!b.length) return;
  const i = pick(b), win = (g.winner === 'wolf') === (g.roles[i] === 'wolf');
  room.later(1500, () => { room.botChat(i, win ? pick(['GG! Ván hay 😎', 'Thắng rồi nhé 🎉', 'Dễ như ăn kẹo 😏']) : pick(['Thua rồi 😭 ván sau gỡ!', 'Lừa hay đấy… GG', 'Ván sau tôi làm Sói cho xem!'])); room.publish(); });
}

/* ---------- khôi phục / người thoát giữa ván ---------- */
function reschedulePhase(room) {
  const ph = room.phase, g = room.g;
  if (ph === 'night') scheduleNight(room);
  else if (ph === 'witch') { const wi = room.players.findIndex((_, k) => room.alive(k) && g.roles[k] === 'witch'); if (wi >= 0) scheduleWitch(room, wi); }
  else if (ph === 'vote') scheduleVotes(room);
  else if (ph === 'hunter' && g.hunter) scheduleHunter(room, g.hunter.i);
}
function rescheduleFor(room, i) {
  const ph = room.phase;
  if (!room.alive(i)) { if (ph === 'hunter' && room.g.hunter && room.g.hunter.i === i) scheduleHunter(room, i); return; }
  if (ph === 'night') room.later(room.botDelay(), () => { if (room.phase === 'night') { nightMove(room, i); room.commit(); } });
  else if (ph === 'witch' && room.role(i) === 'witch') scheduleWitch(room, i);
  else if (ph === 'vote') room.later(room.botDelay(), () => { if (room.phase === 'vote' && room.g.votes[i] === undefined) { room.vote(i, botVote(room, i)); room.commit(); } });
}

module.exports = { newMind, scheduleNight, scheduleWitch, scheduleHunter, scheduleDiscuss, scheduleVotes, onSeen, onDawn, onDeath, onVote, onHumanChat, onOver, reschedulePhase, rescheduleFor, botVote };
