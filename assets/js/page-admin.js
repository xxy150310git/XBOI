/* ============================================================
   管理后台
   ============================================================ */

(function () {
  var ui = XBOI.ui;
  var db = XBOI.db;
  var auth = XBOI.auth;

  ui.markNav();
  if (db.isDemo()) ui.$('#demoNotice').hidden = false;

  var memberCache = [];
  var contestCache = [];
  var booted = false;        // 后台只初始化一次，避免登录状态变化时重复绑定

  // ------------------------------------------------------------
  //  进入条件：登录且是管理员
  // ------------------------------------------------------------

  function showGate(kind) {
    var card = ui.$('#gateCard');
    var body = ui.$('#gateBody');
    card.hidden = false;
    ui.$('#dash').hidden = true;

    if (kind === 'guest') {
      body.innerHTML =
        '<div class="notice info" style="margin-bottom:0">这个页面只有管理员能进，先登录一下。</div>' +
        '<div style="margin-top:14px"><button class="btn" type="button" id="gateLogin">去登录</button></div>';
      ui.$('#gateLogin').addEventListener('click', function () { auth.openLogin(); });
    } else {
      body.innerHTML =
        '<div class="notice warn" style="margin-bottom:0">' +
          '你现在的身份是<b>普通成员</b>，没有管理权限。' +
          '如果确实需要，让队长在后台把你的身份改成管理员。' +
        '</div>' +
        '<div style="margin-top:14px"><button class="btn ghost" type="button" id="gateBack">回到首页</button></div>';
      ui.$('#gateBack').addEventListener('click', function () { location.href = 'index.html'; });
    }
  }

  function showDash() {
    var me = auth.me();
    ui.$('#gateCard').hidden = true;
    ui.$('#dash').hidden = false;
    ui.$('#whoami').textContent = me ? me.out_luogu_name : '管理员';
    boot();
  }

  ui.$('#logoutBtn').addEventListener('click', function () {
    auth.openAccount();
  });

  auth.onChange(function (user) {
    if (!user) { showGate('guest'); return; }
    if (user.out_role !== 'admin') { showGate('denied'); return; }
    showDash();
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
  //  兑换码核销
  // ------------------------------------------------------------

  var RDM_TEXT = { unused: '未使用', used: '已使用', expired: '已过期' };
  var RDM_CLASS = { unused: 'tag-green', used: 'tag-gray', expired: 'tag-red' };

  function loadRedeem() {
    var box = ui.$('#redeemTable');
    ui.loading(box, '正在读取兑换码…');
    return db.listAllRedemptions(ui.$('#onlyUnused').checked).then(function (list) {
      if (!list || !list.length) {
        ui.empty(box, ui.$('#onlyUnused').checked ? '没有待核销的兑换码' : '还没有任何兑换记录');
        return;
      }
      var html = '<table><thead><tr>' +
        '<th>兑换码</th><th>成员</th><th>道具</th><th class="num">消耗</th>' +
        '<th>状态</th><th>兑换时间</th><th>核销时间</th><th>操作</th>' +
        '</tr></thead><tbody>';
      list.forEach(function (r) {
        var st = r.display_status || (r.status === 'used' ? 'used' : 'unused');
        var canUse = st === 'unused';
        html += '<tr>' +
          '<td><b class="mono">' + ui.esc(r.code) + '</b></td>' +
          '<td>' + ui.esc(r.luogu_name || '—') +
            (r.display_name ? ' <span class="muted">' + ui.esc(r.display_name) + '</span>' : '') + '</td>' +
          '<td>' + ui.esc(r.item_name) + '</td>' +
          '<td class="num tx-out">\u2212' + ui.fmtNum(r.cost) + '</td>' +
          '<td><span class="tag ' + (RDM_CLASS[st] || 'tag-gray') + '">' + (RDM_TEXT[st] || st) + '</span></td>' +
          '<td class="muted">' + ui.fmtTime(r.created_at) + '</td>' +
          '<td class="muted">' + (r.used_at ? ui.fmtTime(r.used_at) : '—') + '</td>' +
          '<td>' + (canUse
            ? '<button class="btn sm" data-use="' + ui.esc(r.id) + '">标记已使用</button>'
            : '<span class="muted">—</span>') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;

      ui.$$('[data-use]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('确认核销这张兑换码吗？核销后不可撤销。')) return;
          b.disabled = true;
          db.markRedemptionUsed(b.getAttribute('data-use')).then(function () {
            ui.toast('已标记为使用', 'ok');
            loadRedeem();
          }).catch(function (err) {
            ui.toast('核销失败：' + err.message, 'err');
            b.disabled = false;
          });
        });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="notice danger" style="margin:16px">读取失败：' + ui.esc(err.message) + '</div>';
    });
  }

  ui.$('#onlyUnused').addEventListener('change', loadRedeem);
  ui.$('#reloadRedeem').addEventListener('click', loadRedeem);

  // ------------------------------------------------------------
  //  答题赛
  // ------------------------------------------------------------

  var quizCache = [];
  var qz = XBOI.quiz;

  var QUIZ_PHASE_TEXT = { planned: '未开始', running: '进行中', ended: '已结束', hidden: '未发布' };
  var QUIZ_PHASE_CLASS = { planned: 'tag-cyan', running: 'tag-green', ended: 'tag-gray', hidden: 'tag-orange' };

  function resetQuizForm() {
    ui.$('#qzId').value = '';
    ui.$('#qzName').value = '';
    ui.$('#qzDesc').value = '';
    ui.$('#qzStart').value = '';
    ui.$('#qzDuration').value = '60';
    ui.$('#qzMultiplier').value = '1';
    ui.$('#qzPublished').value = '1';
    ui.$('#quizFormTitle').textContent = '新建答题赛';
  }

  function loadQuizzes() {
    return db.adminQuizList().then(function (list) {
      quizCache = list || [];

      var sel = ui.$('#qQuestionQuiz');
      var keep = sel.value;
      sel.innerHTML = quizCache.length
        ? quizCache.map(function (q) {
            return '<option value="' + ui.esc(q.out_id) + '">' + ui.esc(q.out_name) +
              '（' + (QUIZ_PHASE_TEXT[q.out_phase] || q.out_phase) + '）</option>';
          }).join('')
        : '<option value="">（还没有答题赛）</option>';
      if (keep) {
        sel.value = keep;
      } else {
        // 默认挑一场已经有题的，省得点进去空空如也
        var withQ = quizCache.filter(function (x) { return x.out_question_count > 0; });
        if (withQ.length) sel.value = withQ[0].out_id;
      }

      var box = ui.$('#quizTable');
      if (!quizCache.length) { ui.empty(box, '还没有答题赛，先在上面建一场'); return; }

      var html = '<table><thead><tr>' +
        '<th>名称</th><th>开赛时间</th><th class="num">时长</th><th class="num">倍率</th>' +
        '<th class="num">题目 / 满分</th><th class="num">已交卷</th><th>状态</th><th>操作</th>' +
        '</tr></thead><tbody>';
      quizCache.forEach(function (q) {
        html += '<tr>' +
          '<td><b>' + ui.esc(q.out_name) + '</b>' +
            (q.out_description ? '<div class="muted" style="font-size:12px">' + ui.esc(q.out_description) + '</div>' : '') +
          '</td>' +
          '<td class="muted">' + ui.fmtTime(q.out_start_at) + '</td>' +
          '<td class="num">' + ui.fmtNum(q.out_duration_minutes) + ' 分</td>' +
          '<td class="num">×' + ui.fmtNum(q.out_multiplier) + '</td>' +
          '<td class="num">' + ui.fmtNum(q.out_question_count) + ' / ' + ui.fmtNum(q.out_full_score) + '</td>' +
          '<td class="num">' + ui.fmtNum(q.out_attempt_count) + '</td>' +
          '<td><span class="tag ' + (QUIZ_PHASE_CLASS[q.out_phase] || 'tag-gray') + '">' +
            ui.esc(QUIZ_PHASE_TEXT[q.out_phase] || q.out_phase) + '</span></td>' +
          '<td><button class="btn ghost sm" data-qzedit="' + ui.esc(q.out_id) + '">编辑</button> ' +
              '<button class="btn danger sm" data-qzdel="' + ui.esc(q.out_id) + '">删除</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;

      ui.$$('[data-qzedit]', box).forEach(function (b) {
        b.addEventListener('click', function () { editQuiz(b.getAttribute('data-qzedit')); });
      });
      ui.$$('[data-qzdel]', box).forEach(function (b) {
        b.addEventListener('click', function () { removeQuiz(b.getAttribute('data-qzdel')); });
      });

      if (!sel.dataset.bound) {
        sel.dataset.bound = '1';
        sel.addEventListener('change', function () { loadQuestions(); loadQuizScores(); });
      }
      if (sel.value) { loadQuestions(); loadQuizScores(); }
    }).catch(function (err) {
      ui.toast('读取答题赛失败：' + err.message, 'err');
    });
  }

  function editQuiz(id) {
    var q = null;
    quizCache.forEach(function (x) { if (String(x.out_id) === String(id)) q = x; });
    if (!q) return;
    ui.$('#qzId').value = q.out_id;
    ui.$('#qzName').value = q.out_name || '';
    ui.$('#qzDesc').value = q.out_description || '';
    // datetime-local 需要 YYYY-MM-DDTHH:MM 这种格式
    ui.$('#qzStart').value = q.out_start_at ? String(q.out_start_at).slice(0, 16) : '';
    ui.$('#qzDuration').value = q.out_duration_minutes;
    ui.$('#qzMultiplier').value = q.out_multiplier;
    ui.$('#qzPublished').value = q.out_published ? '1' : '0';
    ui.$('#quizFormTitle').textContent = '编辑答题赛：' + q.out_name;
  }

  function removeQuiz(id) {
    var q = null;
    quizCache.forEach(function (x) { if (String(x.out_id) === String(id)) q = x; });
    if (!confirm('确定删除答题赛「' + (q ? q.out_name : id) + '」吗？\n题目和已有的作答记录都会一起删掉，无法恢复。')) return;
    db.adminDeleteQuiz(id).then(function () {
      ui.toast('已删除', 'ok');
      resetQuizForm();
      return loadQuizzes();
    }).catch(function (err) { ui.toast('删除失败：' + err.message, 'err'); });
  }

  ui.$('#quizForm').addEventListener('submit', function (e) {
    e.preventDefault();
    db.adminUpsertQuiz({
      id: ui.$('#qzId').value || null,
      name: ui.$('#qzName').value.trim(),
      description: ui.$('#qzDesc').value.trim() || null,
      start_at: ui.$('#qzStart').value || null,
      duration_minutes: ui.$('#qzDuration').value,
      multiplier: ui.$('#qzMultiplier').value,
      published: ui.$('#qzPublished').value === '1'
    }).then(function () {
      ui.toast('答题赛已保存', 'ok');
      resetQuizForm();
      return loadQuizzes();
    }).catch(function (err) { ui.toast('保存失败：' + err.message, 'err'); });
  });

  ui.$('#quizReset').addEventListener('click', resetQuizForm);

  // ---------- 题目 ----------

  function currentQuestionQuiz() { return ui.$('#qQuestionQuiz').value; }

  function updateAnswerHint() {
    var t = ui.$('#qType').value;
    var hint = '';
    if (t === 'choice') hint = '填选项字母，例如 A（选项按行顺序对应 A、B、C…）';
    else if (t === 'judge') hint = '填 T 表示「对」，F 表示「错」（写 对/错 也能识别）';
    else hint = '多个可接受的写法用 | 隔开，例如 main|Main；判分忽略大小写和首尾空格';

    ui.$('#qAnswerHint').textContent = hint;
    ui.$('#qOptionsField').hidden = t !== 'choice';
  }

  function resetQuestionForm() {
    ui.$('#qId').value = '';
    ui.$('#qStem').value = '';
    ui.$('#qOptions').value = '';
    ui.$('#qAnswer').value = '';
    ui.$('#qScore').value = '10';
    ui.$('#qSort').value = '0';
    ui.$('#qType').value = 'choice';
    ui.$('#questionFormTitle').textContent = '新增题目';
    updateAnswerHint();
  }

  function loadQuestions() {
    var quizId = currentQuestionQuiz();
    var box = ui.$('#questionTable');
    if (!quizId) { ui.empty(box, '先在上面选一场答题赛'); return Promise.resolve(); }

    ui.loading(box, '正在读取题目…');
    return db.adminQuizQuestions(quizId).then(function (list) {
      if (!list || !list.length) { ui.empty(box, '这场还没有题目，在下面添加'); return; }

      var html = '<table><thead><tr>' +
        '<th class="num">序号</th><th>题型</th><th>题干</th><th>答案</th>' +
        '<th class="num">分值</th><th>操作</th>' +
        '</tr></thead><tbody>';
      list.forEach(function (q) {
        html += '<tr>' +
          '<td class="num">' + ui.fmtNum(q.sort_order) + '</td>' +
          '<td><span class="tag tag-cyan">' + ui.esc(qz.TYPES[q.qtype] || q.qtype) + '</span></td>' +
          '<td style="white-space:normal;min-width:220px">' + ui.esc(q.stem) +
            (q.qtype === 'choice' && q.options && q.options.length
              ? '<div class="muted" style="font-size:12px">' +
                q.options.map(function (o, i) {
                  return String.fromCharCode(65 + i) + '. ' + ui.esc(o);
                }).join('　') + '</div>'
              : '') +
          '</td>' +
          '<td class="mono">' + ui.esc(q.answer) + '</td>' +
          '<td class="num">' + ui.fmtNum(q.score) + '</td>' +
          '<td><button class="btn ghost sm" data-qedit="' + ui.esc(q.id) + '">编辑</button> ' +
              '<button class="btn danger sm" data-qdel="' + ui.esc(q.id) + '">删除</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;

      ui.$$('[data-qedit]', box).forEach(function (b) {
        b.addEventListener('click', function () { editQuestion(b.getAttribute('data-qedit'), list); });
      });
      ui.$$('[data-qdel]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('确定删除这道题吗？')) return;
          db.adminDeleteQuestion(b.getAttribute('data-qdel')).then(function () {
            ui.toast('已删除', 'ok');
            loadQuestions();
            loadQuizzes();
          }).catch(function (err) { ui.toast('删除失败：' + err.message, 'err'); });
        });
      });
    }).catch(function (err) {
      box.innerHTML = '<div class="notice danger" style="margin:16px">读取失败：' + ui.esc(err.message) + '</div>';
    });
  }

  function editQuestion(id, list) {
    var q = null;
    list.forEach(function (x) { if (String(x.id) === String(id)) q = x; });
    if (!q) return;
    ui.$('#qId').value = q.id;
    ui.$('#qType').value = q.qtype;
    ui.$('#qStem').value = q.stem || '';
    ui.$('#qOptions').value = (q.options || []).join('\n');
    ui.$('#qAnswer').value = q.answer || '';
    ui.$('#qScore').value = q.score;
    ui.$('#qSort').value = q.sort_order;
    ui.$('#questionFormTitle').textContent = '编辑题目 #' + q.id;
    updateAnswerHint();
    window.scrollTo({
      top: ui.$('#questionForm').getBoundingClientRect().top + window.scrollY - 90,
      behavior: 'smooth'
    });
  }

  ui.$('#qType').addEventListener('change', updateAnswerHint);
  ui.$('#questionReset').addEventListener('click', resetQuestionForm);

  ui.$('#questionForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var options = ui.$('#qOptions').value.split('\n')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ''; });

    db.adminUpsertQuestion({
      id: ui.$('#qId').value || null,
      quiz_id: currentQuestionQuiz(),
      qtype: ui.$('#qType').value,
      stem: ui.$('#qStem').value,
      options: options,
      answer: ui.$('#qAnswer').value,
      score: ui.$('#qScore').value,
      sort_order: ui.$('#qSort').value
    }).then(function () {
      ui.toast('题目已保存', 'ok');
      resetQuestionForm();
      loadQuestions();
      loadQuizzes();
    }).catch(function (err) { ui.toast('保存失败：' + err.message, 'err'); });
  });

  // ---------- 本场成绩 ----------

  function loadQuizScores() {
    var quizId = currentQuestionQuiz();
    var box = ui.$('#quizScoreTable');
    if (!quizId) { ui.empty(box, '请先在上面选择一场答题赛'); return Promise.resolve(); }

    ui.loading(box, '正在读取成绩…');
    return db.adminQuizAttempts(quizId).then(function (list) {
      if (!list || !list.length) { ui.empty(box, '这场还没有人交卷'); return; }

      var html = '<table><thead><tr>' +
        '<th class="num">名次</th><th>成员</th><th class="num">卷面分</th><th class="num">倍率</th>' +
        '<th class="num">最终积分</th><th class="num">答对 / 总题</th><th>交卷时间</th>' +
        '</tr></thead><tbody>';
      list.forEach(function (a, i) {
        html += '<tr>' +
          '<td><span class="rank-badge' + (i < 3 ? ' r' + (i + 1) : '') + '">' + (i + 1) + '</span></td>' +
          '<td><b>' + ui.esc(a.out_luogu_name) + '</b>' +
            (a.out_display_name ? ' <span class="muted">' + ui.esc(a.out_display_name) + '</span>' : '') + '</td>' +
          '<td class="num">' + ui.fmtNum(a.out_raw_score) + '</td>' +
          '<td class="num">×' + ui.fmtNum(a.out_multiplier) + '</td>' +
          '<td class="num" style="color:var(--ty-blue-dark)">' + ui.fmtNum(a.out_final_score) + '</td>' +
          '<td class="num">' + ui.fmtNum(a.out_correct) + ' / ' + ui.fmtNum(a.out_total) + '</td>' +
          '<td class="muted">' + ui.fmtTime(a.out_submitted_at) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;
    }).catch(function (err) {
      box.innerHTML = '<div class="notice danger" style="margin:16px">读取失败：' + ui.esc(err.message) + '</div>';
    });
  }

  // ------------------------------------------------------------
  //  启动
  // ------------------------------------------------------------

  function boot() {
    if (booted) return;
    booted = true;

    ui.bindTabs('#tabs', '.tab-panel');

    resetMemberForm();
    resetContestForm();
    resetQuizForm();
    resetQuestionForm();
    buildFbBoxes();
    calcNow();

    loadMembers();
    loadContests().then(function () { loadResults(); });
    loadTx();
    loadRedeem();
    loadQuizzes();
  }
})();
