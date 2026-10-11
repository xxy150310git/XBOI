/* ============================================================
   首页：汇总统计
   ============================================================ */

(function () {
  var ui = XBOI.ui;

  ui.markNav();

  if (XBOI.db.isDemo()) {
    var n = ui.$('#demoNotice');
    if (n) n.hidden = false;
  }

  XBOI.db.getStats().then(function (s) {
    ui.$('#stMembers').textContent = s.memberCount;
    ui.$('#stCoin').textContent = s.totalCoin;
    ui.$('#stTx').textContent = s.totalTx;
    ui.$('#stScore').textContent = s.totalScore;
  }).catch(function (err) {
    ui.toast('读取统计失败：' + err.message, 'err');
    ['#stMembers', '#stCoin', '#stTx', '#stScore'].forEach(function (sel) {
      ui.$(sel).textContent = '—';
    });
  });
})();
