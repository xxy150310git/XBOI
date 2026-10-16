/* ============================================================
   X 币查询页
   ============================================================ */

(function () {
  var ui = XBOI.ui;
  var box = ui.$('#resultBox');

  ui.markNav();
  if (XBOI.db.isDemo()) ui.$('#demoNotice').hidden = false;

  function categoryTag(cat) {
    var label = ui.CATEGORY[cat] || cat;
    var cls = 'tag-gray';
    if (cat === 'contest') cls = 'tag-blue';
    else if (cat === 'training') cls = 'tag-cyan';
    else if (cat === 'quiz') cls = 'tag-pink';
    else if (cat === 'penalty') cls = 'tag-red';
    else if (cat === 'reward') cls = 'tag-green';
    else if (cat === 'exchange') cls = 'tag-purple';
    else if (cat === 'join') cls = 'tag-green';
    else if (cat === 'leave') cls = 'tag-gray';
    return '<span class="tag ' + cls + '">' + ui.esc(label) + '</span>';
  }

  function showNotFound(name) {
    ui.loading(box, '');
    XBOI.db.searchMembers(name).then(function (cands) {
      var html = '<div class="card"><div class="notice warn" style="margin-bottom:14px">' +
        '没有找到洛谷用户名为 <b>' + ui.esc(name) + '</b> 的成员。' +
        '如果是新入队，请先让管理员在后台登记哦。</div>';

      if (cands && cands.length) {
        html += '<div style="font-size:14px;color:var(--ink-soft);margin-bottom:8px">你是不是想找：</div>' +
          '<div class="chip-list">' +
          cands.map(function (c) {
            return '<a class="btn ghost sm" href="query.html?name=' + encodeURIComponent(c.luogu_name) + '">' +
              ui.esc(c.luogu_name) + '</a>';
          }).join('') +
          '</div>';
      }
      html += '</div>';
      box.innerHTML = html;
    }).catch(function (err) {
      box.innerHTML = '<div class="notice danger">读取失败：' + ui.esc(err.message) + '</div>';
    });
  }

  function render(member, txs, results) {
    var initial = String(member.luogu_name).slice(0, 1).toUpperCase();

    var totalScore = 0, akCount = 0, contestCoins = 0;
    results.forEach(function (r) {
      totalScore += Number(r.score) || 0;
      contestCoins += Number(r.coins) || 0;
      if (r.is_ak) akCount += 1;
    });

    var html = '';

    // 账户卡片
    html += '<div class="card"><div class="account">' +
      '<div class="avatar">' + ui.esc(initial) + '</div>' +
      '<div class="who">' +
        '<h2>' + ui.esc(member.luogu_name) + '</h2>' +
        '<div class="sub">' +
          (member.display_name ? ui.esc(member.display_name) + ' · ' : '') +
          ui.colorTag(member.color) + ' · ' +
          (member.role === 'admin' ? '管理员' : '成员') + ' · ' +
          (ui.MEMBER_STATUS[member.status] || member.status) +
          ' · 入队于 ' + ui.fmtDay(member.joined_at) +
        '</div>' +
      '</div>' +
      '<div class="balance"><div class="k">X 币余额</div><div class="v">' + ui.fmtNum(member.balance) + '</div></div>' +
      '</div></div>';

    // 小统计
    html += '<div class="stat-row five" style="margin-top:18px">' +
      '<div class="stat"><div class="k">参赛场次</div><div class="v">' + results.length + '</div></div>' +
      '<div class="stat"><div class="k">累计比赛积分</div><div class="v">' + totalScore + '</div></div>' +
      '<div class="stat"><div class="k">答题积分</div><div class="v">' + (member.quiz_score || 0) + '</div></div>' +
      '<div class="stat"><div class="k">AK 次数</div><div class="v">' + akCount + '</div></div>' +
      '<div class="stat"><div class="k">比赛所得 X 币</div><div class="v">' + contestCoins + '</div></div>' +
      '</div>';

    // 比赛成绩
    html += '<div class="card"><h2 class="card-title"><span class="dot"></span>比赛成绩</h2>';
    if (!results.length) {
      html += '<div class="empty">还没有比赛记录</div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>比赛</th><th>类型</th><th>时间</th>' +
        '<th class="num">得分</th><th class="num">名次</th><th class="num">通过题数</th>' +
        '<th class="num">首 A</th><th>AK</th><th class="num">获得 X 币</th>' +
        '</tr></thead><tbody>';
      results.forEach(function (r) {
        html += '<tr>' +
          '<td><b>' + ui.esc(r.contest_name) + '</b></td>' +
          '<td>' + ui.esc(ui.CONTEST_TYPE[r.contest_type] || '—') + '</td>' +
          '<td class="muted">' + ui.fmtTime(r.held_at) + '</td>' +
          '<td class="num">' + ui.fmtNum(r.score) + '</td>' +
          '<td class="num">' + (r.rank ? '#' + r.rank : '—') + '</td>' +
          '<td class="num">' + ui.fmtNum(r.solved) + '</td>' +
          '<td class="num">' + ui.fmtNum(r.first_bloods) + '</td>' +
          '<td>' + (r.is_ak ? '<span class="tag tag-pink">AK</span>' : '<span class="muted">—</span>') + '</td>' +
          '<td class="num" style="color:var(--ty-blue-dark)">' + ui.fmtNum(r.coins) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';

    // 流水明细
    html += '<div class="card"><h2 class="card-title"><span class="dot"></span>X 币流水' +
      '（共 ' + txs.length + ' 条）</h2>';
    if (!txs.length) {
      html += '<div class="empty">还没有任何 X 币记录</div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>时间</th><th>分类</th><th>事由</th><th class="num">变动</th>' +
        '</tr></thead><tbody>';
      txs.forEach(function (t) {
        var cls = t.amount > 0 ? 'tx-in' : (t.amount < 0 ? 'tx-out' : 'muted');
        html += '<tr>' +
          '<td class="muted">' + ui.fmtTime(t.created_at) + '</td>' +
          '<td>' + categoryTag(t.category) + '</td>' +
          '<td>' + ui.esc(t.reason) + '</td>' +
          '<td class="num ' + cls + '">' + ui.fmtCoin(t.amount) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';

    box.innerHTML = html;
  }

  function query(name) {
    name = String(name || '').trim();
    if (!name) { ui.toast('请先输入洛谷用户名'); return; }

    ui.loading(box, '正在查询 ' + name + ' …');
    XBOI.db.findMember(name).then(function (m) {
      if (!m) { showNotFound(name); return; }
      return Promise.all([
        XBOI.db.getTransactions(m.id),
        XBOI.db.getMemberResults(m.id)
      ]).then(function (arr) {
        render(m, arr[0] || [], arr[1] || []);
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="notice danger">读取失败：' + ui.esc(err.message) + '</div>';
    });
  }

  ui.$('#searchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = ui.$('#nameInput').value.trim();
    // 用 file:// 直接打开时 replaceState 会被浏览器拦下，这里忽略即可
    try {
      history.replaceState(null, '', 'query.html?name=' + encodeURIComponent(name));
    } catch (err) { /* 忽略 */ }
    query(name);
  });

  // 支持从排行榜带参数跳进来
  var initial = new URLSearchParams(location.search).get('name');
  if (initial) {
    ui.$('#nameInput').value = initial;
    query(initial);
  }
})();
