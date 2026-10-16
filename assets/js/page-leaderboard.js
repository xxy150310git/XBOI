/* ============================================================
   排行榜页
   ============================================================ */

(function () {
  var ui = XBOI.ui;
  var rows = [];

  ui.markNav();
  if (XBOI.db.isDemo()) ui.$('#demoNotice').hidden = false;

  var box = ui.$('#tableBox');

  function roleTag(role) {
    return role === 'admin'
      ? '<span class="tag tag-pink">管理员</span>'
      : '<span class="tag tag-cyan">成员</span>';
  }

  function statusTag(st) {
    if (st === 'active') return '<span class="tag tag-green">在队</span>';
    if (st === 'left') return '<span class="tag tag-gray">已退队</span>';
    return '<span class="tag tag-red">已移出</span>';
  }

  function render() {
    var kw = ui.$('#kw').value.trim().toLowerCase();
    var only = ui.$('#onlyActive').checked;

    var list = rows.filter(function (r) {
      if (only && r.status !== 'active') return false;
      if (!kw) return true;
      return String(r.luogu_name).toLowerCase().indexOf(kw) >= 0 ||
             String(r.display_name || '').toLowerCase().indexOf(kw) >= 0;
    });

    if (!list.length) {
      ui.empty(box, '没有符合条件的成员');
      return;
    }

    var html = '<table><thead><tr>' +
      '<th>名次</th><th>洛谷用户名</th><th>昵称</th><th>名字颜色</th><th>身份</th><th>状态</th>' +
      '<th class="num">X 币余额</th><th class="num">比赛积分</th><th class="num">答题积分</th>' +
      '<th class="num">AK</th><th class="num">参赛</th><th class="num">答题</th><th>入队日期</th>' +
      '</tr></thead><tbody>';

    list.forEach(function (r, i) {
      var rank = i + 1;
      var cls = rank <= 3 ? ' r' + rank : '';
      html += '<tr data-name="' + ui.esc(r.luogu_name) + '" style="cursor:pointer">' +
        '<td><span class="rank-badge' + cls + '">' + rank + '</span></td>' +
        '<td><b>' + ui.esc(r.luogu_name) + '</b></td>' +
        '<td class="muted">' + ui.esc(r.display_name || '—') + '</td>' +
        '<td>' + ui.colorTag(r.color) + '</td>' +
        '<td>' + roleTag(r.role) + '</td>' +
        '<td>' + statusTag(r.status) + '</td>' +
        '<td class="num" style="color:var(--ty-blue-dark)">' + ui.fmtNum(r.balance) + '</td>' +
        '<td class="num">' + ui.fmtNum(r.total_score) + '</td>' +
        '<td class="num" style="color:var(--ty-pink-deep)">' + ui.fmtNum(r.quiz_score) + '</td>' +
        '<td class="num">' + ui.fmtNum(r.ak_count) + '</td>' +
        '<td class="num">' + ui.fmtNum(r.contest_count) + '</td>' +
        '<td class="num">' + ui.fmtNum(r.quiz_count) + '</td>' +
        '<td class="muted">' + ui.fmtDay(r.joined_at) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    box.innerHTML = html;

    // 点行跳转到该成员的流水
    ui.$$('tbody tr', box).forEach(function (tr) {
      tr.addEventListener('click', function () {
        location.href = 'query.html?name=' + encodeURIComponent(tr.getAttribute('data-name'));
      });
    });
  }

  function reload() {
    ui.loading(box, '正在读取排行榜…');
    XBOI.db.getLeaderboard(ui.$('#sortKey').value).then(function (data) {
      rows = data || [];
      render();
    }).catch(function (err) {
      box.innerHTML = '<div class="notice danger" style="margin:16px">读取失败：' + ui.esc(err.message) + '</div>';
    });
  }

  ui.$('#kw').addEventListener('input', render);
  ui.$('#onlyActive').addEventListener('change', render);
  ui.$('#sortKey').addEventListener('change', reload);

  reload();
})();
