/* Khởi động — nạp sau cùng, khi mọi game đã đăng ký. */
'use strict';
setSeg('fGender', myGender());
Account.renderChip();
renderMe();
// nút chỉ có biểu tượng: đọc được bằng trình đọc màn hình
document.querySelectorAll('button[title]:not([aria-label])').forEach(b => b.setAttribute('aria-label', b.title));
document.querySelectorAll('[data-back],#btLobbyLeave,#btMsLeave').forEach(b => b.setAttribute('aria-label', 'Quay lại'));
document.querySelectorAll('.sheet-head .icon').forEach(b => b.setAttribute('aria-label', 'Đóng'));
api('config').then(c => { if (c.err) return; Account.cfg = c; if ($('accSheet').classList.contains('on')) Account.render(); });
Account.refresh();
applySettings();
window.addEventListener('resize', () => { if (S && current === 'sGame') { renderHand(); } });
(async function boot() {
  const c = qRoom || store.get('sam_room', ''), nm = store.get('sam_name', '');
  if (!c) return;
  if (!nm) { $('inCode').value = c; return; }   // người mới mở link mời: nhập tên rồi bấm Vào phòng
  const wasSpec = store.get('sam_role', '') === 'spec' && store.get('sam_room', '') === c;
  let j = wasSpec ? await api('watch', { room: c, name: nm, av: myAv }) : await api('join', { room: c, name: nm, av: myAv });
  if (!j.code && j.canWatch) j = await api('watch', { room: c, name: nm, av: myAv });
  if (j.code) enterRoom(j.code);
  else { if (qRoom) toast(j.err || 'Không vào được phòng'); store.set('sam_room', ''); history.replaceState(null, '', location.pathname); }
})();
