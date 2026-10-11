/* ============================================================
   管理后台
   ============================================================ */

(function () {
  var ui = XBOI.ui;
  var db = XBOI.db;

  ui.markNav();
  if (db.isDemo()) ui.$('#demoNotice').hidden = false;

  var memberCache = [];
  var contestCache = [];

  // ------------------------------------------------------------
  //  登录
  // ------------------------------------------------------------

  function showLogin() {
    ui.$('#loginCard').hidden = false;
    ui.$('#dash').hidden = true;
    if (db.isDemo()) {
      ui.$('#loginTip').innerHTML = '演示模式下随便填一个邮箱和密码就能进来，改动只留在当前页面内存里。';
    }
  }

  function showDash(user) {
    ui.$('#loginCard').hidden = true;
    ui.$('#dash').hidden = false;
    ui.$('#whoami').textContent = (user && user.email) || '管理员';
    boot();
  }

  ui.$('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = ui.$('#loginBtn');
    btn.disabled = true;
    btn.textContent = '登录中…';
    db.signIn(ui.$('#email').value.trim(), ui.$('#password').value).then(function (user) {
      ui.toast('登录成功', 'ok');
      showDash(user);
    }).catch(function (err) {
      ui.toast('登录失败：' + err.message, 'err');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = '登录';
    });
  });

  ui.$('#logoutBtn').addEventListener('click', function () {
    db.signOut().then(function () {
      ui.toast('已退出登录');
      showLogin();
      location.reload();
    });
  });

  // ------------------------------------------------------------
  //  成员管理
  // ------------------------------------------------------------

  function resetMemberForm() {
    ['mId', 'mName', 'mDisplay', 'mUid', 'mNote'].forEach(function (id) { ui.$('#' + id).value = ''; });
    ui.$('#mColor').value = '灰名';
    ui.$('#mRole').value = 'member';
    ui.$('#mStatus').value = 'active';
    ui.$('#mJoined').value = new Date().toISOString().slice(0, 10);
    ui.$('#memberFormTitle').textContent = '新增成员';
  }

  function memberOptionsHtml(list) {
    return list.map(function (m) {
      var extra = m.status !== 'active' ? '（' + (ui.MEMBER_STATUS[m.status] || m.status) + '）' : '';
      return '<option value="' + ui.esc(m.id) + '">' + ui.esc(m.luogu_name) + extra + '</option>';
    }).join('');
  }

  function loadMembers() {
    return db.listMembers().then(function (list) {
      memberCache = list || [];
      ui.$('#memberCount').textContent = memberCache.length;

      // 下拉框
      var opts = memberOptionsHtml(memberCache.filter(function (m) { return m.status === 'active'; }));
      var all = memberOptionsHtml(memberCache);
      ui.$('#cMember').innerHTML = opts || '<option value="">（暂无在队成员）</option>';
      ui.$('#rsMember').innerHTML = all || '<option value="">（暂无成员）</option>';

      // 表格
      var box = ui.$('#memberTable');
      if (!memberCache.length) { ui.empty(box, '还没有登记任何成员'); return; }

      var html = '<table><thead><tr>' +
        '<th>洛谷用户名</th><th>昵称</th><th>颜色</th><th>身份</th><th>状态</th>' +
        '<th class="num">余额</th><th>入队日期</th><th>操作</th>' +
        '</tr></thead><tbody>';
      memberCache.forEach(function (m) {
        html += '<tr>' +
          '<td><b>' + ui.esc(m.luogu_name) + '</b></td>' +
          '<td class="muted">' + ui.esc(m.display_name || '—') + '</td>' +
          '<td>' + ui.colorTag(m.color) + '</td>' +
          '<td>' + (m.role === 'admin' ? '<span class="tag tag-pink">管理员</span>' : '<span class="tag tag-cyan">成员</span>') + '</td>' +
          '<td>' + ui.esc(ui.MEMBER_STATUS[m.status] || m.status) + '</td>' +
          '<td class="num">' + ui.fmtNum(m.balance) + '</td>' +
          '<td class="muted">' + ui.fmtDay(m.joined_at) + '</td>' +
          '<td><button class="btn ghost sm" data-edit="' + ui.esc(m.id) + '">编辑</button> ' +
              '<button class="btn danger sm" data-del="' + ui.esc(m.id) + '">删除</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;

      ui.$$('[data-edit]', box).forEach(function (b) {
        b.addEventListener('click', function () { editMember(b.getAttribute('data-edit')); });
      });
      ui.$$('[data-del]', box).forEach(function (b) {
        b.addEventListener('click', function () { removeMember(b.getAttribute('data-del')); });
      });
    }).catch(function (err) {
      ui.toast('读取成员失败：' + err.message, 'err');
    });
  }

  function editMember(id) {
    var m = null;
    memberCache.forEach(function (x) { if (String(x.id) === String(id)) m = x; });
    if (!m) return;
    ui.$('#mId').value = m.id;
    ui.$('#mName').value = m.luogu_name || '';
    ui.$('#mDisplay').value = m.display_name || '';
    ui.$('#mUid').value = m.luogu_uid || '';
    ui.$('#mColor').value = m.color || '灰名';
    ui.$('#mRole').value = m.role || 'member';
    ui.$('#mStatus').value = m.status || 'active';
    ui.$('#mJoined').value = (m.joined_at || '').slice(0, 10);
    ui.$('#mNote').value = m.note || '';
    ui.$('#memberFormTitle').textContent = '编辑成员：' + m.luogu_name;
    window.scrollTo({ top: ui.$('#memberForm').getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
  }

  function removeMember(id) {
    var m = null;
    memberCache.forEach(function (x) { if (String(x.id) === String(id)) m = x; });
    if (!confirm('确定删除成员「' + (m ? m.luogu_name : id) + '」吗？\n他的全部 X 币流水和比赛成绩也会一起删除，且无法恢复。')) return;
    db.deleteMember(id).then(function () {
      ui.toast('已删除', 'ok');
      resetMemberForm();
      return loadMembers().then(loadTx);
    }).catch(function (err) { ui.toast('删除失败：' + err.message, 'err'); });
  }

  ui.$('#memberForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var payload = {
      id: ui.$('#mId').value || null,
      luogu_name: ui.$('#mName').value.trim(),
      display_name: ui.$('#mDisplay').value.trim() || null,
      luogu_uid: ui.$('#mUid').value.trim() || null,
      color: ui.$('#mColor').value,
      role: ui.$('#mRole').value,
      status: ui.$('#mStatus').value,
      joined_at: ui.$('#mJoined').value || null,
      note: ui.$('#mNote').value.trim() || null
    };
    db.upsertMember(payload).then(function () {
      ui.toast('已保存', 'ok');
      resetMemberForm();
      return loadMembers();
    }).catch(function (err) { ui.toast('保存失败：' + err.message, 'err'); });
  });

  ui.$('#memberReset').addEventListener('click', resetMemberForm);

  // ------------------------------------------------------------
  //  X 币操作
  // ------------------------------------------------------------

  function loadTx() {
    var box = ui.$('#txTable');
    ui.loading(box, '正在读取流水…');
    return db.recentTransactions(30).then(function (list) {
      if (!list || !list.length) { ui.empty(box, '还没有任何流水'); return; }
      var html = '<table><thead><tr>' +
        '<th>时间</th><th>成员</th><th>分类</th><th>事由</th><th class="num">变动</th><th>操作</th>' +
        '</tr></thead><tbody>';
      list.forEach(function (t) {
        var cls = t.amount > 0 ? 'tx-in' : (t.amount < 0 ? 'tx-out' : 'muted');
        html += '<tr>' +
          '<td class="muted">' + ui.fmtTime(t.created_at) + '</td>' +
          '<td><b>' + ui.esc(t.luogu_name || '—') + '</b></td>' +
          '<td><span class="tag tag-gray">' + ui.esc(ui.CATEGORY[t.category] || t.category) + '</span></td>' +
          '<td>' + ui.esc(t.reason) + '</td>' +
          '<td class="num ' + cls + '">' + ui.fmtCoin(t.amount) + '</td>' +
          '<td><button class="btn danger sm" data-txdel="' + ui.esc(t.id) + '">撤销</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;

      ui.$$('[data-txdel]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('确定撤销这条流水吗？撤销后余额会同步变化。')) return;
          db.deleteTransaction(b.getAttribute('data-txdel')).then(function () {
            ui.toast('已撤销', 'ok');
            loadTx();
            loadMembers();
          }).catch(function (err) { ui.toast('撤销失败：' + err.message, 'err'); });
        });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="notice danger" style="margin:16px">读取失败：' + ui.esc(err.message) + '</div>';
    });
  }

  ui.$('#coinForm').addEventListener('submit', function (e) {
    e.preventDefault();
    db.addTransaction({
      member_id: ui.$('#cMember').value,
      amount: ui.$('#cAmount').value,
      category: ui.$('#cCategory').value,
      reason: ui.$('#cReason').value
    }).then(function () {
      ui.toast('流水已提交', 'ok');
      ui.$('#cAmount').value = '';
      ui.$('#cReason').value = '';
      loadTx();
      loadMembers();
    }).catch(function (err) { ui.toast('提交失败：' + err.message, 'err'); });
  });

  // ------------------------------------------------------------
  //  比赛
  // ------------------------------------------------------------

  function resetContestForm() {
    ['ctId', 'ctName', 'ctHeld', 'ctDuration', 'ctProblems', 'ctNote'].forEach(function (id) {
      ui.$('#' + id).value = '';
    });
    ui.$('#ctType').value = 'week';
    ui.$('#ctStatus').value = 'finished';
    ui.$('#contestFormTitle').textContent = '新增比赛';
  }

  function loadContests() {
    return db.listContests().then(function (list) {
      contestCache = list || [];

      // 下拉框：录入成绩用
      ui.$('#resultContest').innerHTML = contestCache.length
        ? contestCache.map(function (c) {
            return '<option value="' + ui.esc(c.id) + '">' + ui.esc(c.name) +
              '（' + (ui.CONTEST_TYPE[c.type] || c.type) + '）</option>';
          }).join('')
        : '<option value="">（还没有比赛）</option>';

      var box = ui.$('#contestTable');
      if (!contestCache.length) { ui.empty(box, '还没有比赛记录'); return; }

      var html = '<table><thead><tr>' +
        '<th>比赛</th><th>类型</th><th>操作</th>' +
        '</tr></thead><tbody>';
      contestCache.forEach(function (c) {
        html += '<tr>' +
          '<td><b>' + ui.esc(c.name) + '</b>' +
            '<div class="muted" style="font-size:12px;font-weight:400">' +
            ui.fmtDay(c.held_at) + ' · ' + ui.esc(ui.CONTEST_STATUS[c.status] || c.status) +
            '</div></td>' +
          '<td><span class="tag tag-cyan">' + ui.esc(ui.CONTEST_TYPE[c.type] || c.type) + '</span></td>' +
          '<td><button class="btn ghost sm" data-cedit="' + ui.esc(c.id) + '">编辑</button> ' +
              '<button class="btn danger sm" data-cdel="' + ui.esc(c.id) + '">删除</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;

      ui.$$('[data-cedit]', box).forEach(function (b) {
        b.addEventListener('click', function () { editContest(b.getAttribute('data-cedit')); });
      });
      ui.$$('[data-cdel]', box).forEach(function (b) {
        b.addEventListener('click', function () { removeContest(b.getAttribute('data-cdel')); });
      });
    }).catch(function (err) {
      ui.toast('读取比赛失败：' + err.message, 'err');
    });
  }

  function editContest(id) {
    var c = null;
    contestCache.forEach(function (x) { if (String(x.id) === String(id)) c = x; });
    if (!c) return;
    ui.$('#ctId').value = c.id;
    ui.$('#ctName').value = c.name || '';
    ui.$('#ctType').value = c.type || 'week';
    ui.$('#ctStatus').value = c.status || 'finished';
    ui.$('#ctHeld').value = c.held_at ? String(c.held_at).slice(0, 16) : '';
    ui.$('#ctDuration').value = c.duration_hours === null || c.duration_hours === undefined ? '' : c.duration_hours;
    ui.$('#ctProblems').value = c.problem_count === null || c.problem_count === undefined ? '' : c.problem_count;
    ui.$('#ctNote').value = c.note || '';
    ui.$('#contestFormTitle').textContent = '编辑比赛：' + c.name;
  }

  function removeContest(id) {
    var c = null;
    contestCache.forEach(function (x) { if (String(x.id) === String(id)) c = x; });
    if (!confirm('确定删除比赛「' + (c ? c.name : id) + '」吗？\n该场全部成绩也会一起删除，且无法恢复。')) return;
    db.deleteContest(id).then(function () {
      ui.toast('已删除', 'ok');
      resetContestForm();
      return loadContests();
    }).catch(function (err) { ui.toast('删除失败：' + err.message, 'err'); });
  }

  ui.$('#contestForm').addEventListener('submit', function (e) {
    e.preventDefault();
    db.upsertContest({
      id: ui.$('#ctId').value || null,
      name: ui.$('#ctName').value.trim(),
      type: ui.$('#ctType').value,
      status: ui.$('#ctStatus').value,
      held_at: ui.$('#ctHeld').value || null,
      duration_hours: ui.$('#ctDuration').value,
      problem_count: ui.$('#ctProblems').value,
      note: ui.$('#ctNote').value.trim() || null
    }).then(function () {
      ui.toast('比赛已保存', 'ok');
      resetContestForm();
      return loadContests();
    }).catch(function (err) { ui.toast('保存失败：' + err.message, 'err'); });
  });

  ui.$('#contestReset').addEventListener('click', resetContestForm);

  // ------------------------------------------------------------
  //  成绩
  // ------------------------------------------------------------

  function loadResults() {
    var cid = ui.$('#resultContest').value;
    var box = ui.$('#resultTable');
    ui.$('#rsContestId').value = cid || '';
    if (!cid) { ui.empty(box, '请先选择一场比赛'); return Promise.resolve(); }

    ui.loading(box, '正在读取成绩…');
    return db.listResults(cid).then(function (list) {
      if (!list || !list.length) { ui.empty(box, '这场比赛还没有录入成绩'); return; }
      var html = '<table><thead><tr>' +
        '<th>名次</th><th>成员</th><th class="num">得分</th><th class="num">通过</th>' +
        '<th class="num">首 A</th><th>AK</th><th class="num">发放 X 币</th><th>操作</th>' +
        '</tr></thead><tbody>';
      list.forEach(function (r) {
        html += '<tr>' +
          '<td>' + (r.rank ? '#' + r.rank : '—') + '</td>' +
          '<td><b>' + ui.esc(r.luogu_name || '—') + '</b></td>' +
          '<td class="num">' + ui.fmtNum(r.score) + '</td>' +
          '<td class="num">' + ui.fmtNum(r.solved) + '</td>' +
          '<td class="num">' + ui.fmtNum(r.first_bloods) + '</td>' +
          '<td>' + (r.is_ak ? '<span class="tag tag-pink">AK</span>' : '<span class="muted">—</span>') + '</td>' +
          '<td class="num" style="color:var(--ty-blue-dark)">' + ui.fmtNum(r.coins) + '</td>' +
          '<td><button class="btn danger sm" data-rdel="' + ui.esc(r.member_id) + '">删除</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;

      ui.$$('[data-rdel]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('确定删除这名成员在本场的成绩吗？')) return;
          db.deleteResult(cid, b.getAttribute('data-rdel')).then(function () {
            ui.toast('已删除', 'ok');
            loadResults();
          }).catch(function (err) { ui.toast('删除失败：' + err.message, 'err'); });
        });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="notice danger" style="margin:16px">读取失败：' + ui.esc(err.message) + '</div>';
    });
  }

  ui.$('#resultContest').addEventListener('change', loadResults);

  ui.$('#resultForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var cid = ui.$('#resultContest').value;
    if (!cid) { ui.toast('请先选择一场比赛', 'err'); return; }
    db.upsertResult({
      contest_id: cid,
      member_id: ui.$('#rsMember').value,
      score: ui.$('#rsScore').value,
      rank: ui.$('#rsRank').value,
      solved: ui.$('#rsSolved').value,
      first_bloods: ui.$('#rsFirst').value,
      is_ak: ui.$('#rsAk').checked,
      coins: ui.$('#rsCoins').value
    }).then(function () {
      ui.toast('成绩已写入', 'ok');
      loadResults();
      loadTx();
      loadMembers();
    }).catch(function (err) { ui.toast('写入失败：' + err.message, 'err'); });
  });

  // ------------------------------------------------------------
  //  附录 2 试算器
  // ------------------------------------------------------------

  function buildFbBoxes() {
    var type = ui.$('#calcType').value;
    var n = XBOI.rules.problemCount(type);
    var vals = XBOI.rules.FIRST_BLOOD[type] || [];
    var html = '';
    for (var i = 1; i <= n; i++) {
      html += '<label class="btn ghost sm" style="cursor:pointer">' +
        '<input type="checkbox" class="fb-box" value="' + i + '" style="width:auto;margin:0 6px 0 0">' +
        '第 ' + i + ' 题（' + (vals[i - 1] || 0) + '）</label>';
    }
    ui.$('#calcFb').innerHTML = html;
    ui.$$('.fb-box').forEach(function (b) { b.addEventListener('change', calcNow); });
  }

  function calcNow() {
    var type = ui.$('#calcType').value;
    var idx = [];
    ui.$$('.fb-box').forEach(function (b) { if (b.checked) idx.push(parseInt(b.value, 10)); });

    var r = XBOI.rules.contestCoins({
      type: type,
      isAk: ui.$('#calcAk').value === '1',
      rank: ui.$('#calcRank').value,
      firstBloodIndexes: idx,
      scored: ui.$('#calcScored').checked
    });

    var out = ui.$('#calcOut');
    if (!r.items.length) {
      out.innerHTML = '按当前条件，这场不发放 X 币。';
      return;
    }
    out.innerHTML = r.items.map(function (it) {
      return ui.esc(it.label) + ' +' + it.value;
    }).join('　｜　') + '<br>合计应发 <b>' + r.total + '</b> X 币';
  }

  ['#calcType', '#calcAk', '#calcRank', '#calcScored'].forEach(function (sel) {
    ui.$(sel).addEventListener('change', calcNow);
    ui.$(sel).addEventListener('input', calcNow);
  });

  ui.$('#calcType').addEventListener('change', function () { buildFbBoxes(); calcNow(); });

  ui.$('#useCalc').addEventListener('click', function () {
    var type = ui.$('#calcType').value;
    var idx = [];
    ui.$$('.fb-box').forEach(function (b) { if (b.checked) idx.push(parseInt(b.value, 10)); });
    var r = XBOI.rules.contestCoins({
      type: type,
      isAk: ui.$('#calcAk').value === '1',
      rank: ui.$('#calcRank').value,
      firstBloodIndexes: idx,
      scored: ui.$('#calcScored').checked
    });
    ui.$('#rsCoins').value = r.total;
    ui.$('#rsScore').value = ui.$('#rsScore').value || (ui.$('#calcScored').checked ? 100 : 0);
    ui.$('#rsRank').value = ui.$('#calcRank').value || '';
    ui.$('#rsFirst').value = idx.length;
    ui.$('#rsAk').checked = ui.$('#calcAk').value === '1';
    ui.toast('已把试算结果填进成绩表单', 'ok');
  });

  // ------------------------------------------------------------
  //  启动
  // ------------------------------------------------------------

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;

    ui.bindTabs('#tabs', '.tab-panel');

    resetMemberForm();
    resetContestForm();
    buildFbBoxes();
    calcNow();

    loadMembers();
    loadContests().then(function () { loadResults(); });
    loadTx();
  }

  db.getUser().then(function (user) {
    if (user) showDash(user); else showLogin();
  }).catch(function () { showLogin(); });
})();
