/* ============================================================
   答题赛页
   列表 → 作答（带倒计时，到点自动交卷）→ 成绩
   ============================================================ */

(function () {
  var ui = XBOI.ui;
  var db = XBOI.db;
  var auth = XBOI.auth;
  var qz = XBOI.quiz;

  var quizzes = [];
  var cur = null;            // 当前正在答的卷 { quiz, questions }
  var timerId = null;
  var autoSubmitted = false;

  ui.markNav();
  if (db.isDemo()) ui.$('#demoNotice').hidden = false;

  // ------------------------------------------------------------
  //  视图切换
  // ------------------------------------------------------------

  function show(view) {
    ui.$('#listView').hidden   = view !== 'list';
    ui.$('#playView').hidden   = view !== 'play';
    ui.$('#resultView').hidden = view !== 'result';
    if (view !== 'play') stopTimer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  // ------------------------------------------------------------
  //  列表
  // ------------------------------------------------------------

  var PHASE_CLASS = {
    running: 'tag-green',
    planned: 'tag-cyan',
    ended:   'tag-gray'
  };

  function fmtRange(q) {
    return ui.fmtTime(q.out_start_at).slice(5) + ' 开始 · 共 ' + q.out_question_count + ' 题';
  }

  function renderList() {
    var box = ui.$('#listBox');

    if (!auth.me()) {
      box.innerHTML =
        '<div class="card"><div class="notice info" style="margin-bottom:0">' +
          '答题赛需要先登录才能参加，点右上角<b>登录</b>吧。' +
        '</div><div style="margin-top:14px">' +
          '<button class="btn" type="button" id="goLogin">去登录</button></div></div>';
      ui.$('#goLogin').addEventListener('click', function () { auth.openLogin(); });
      return;
    }

    if (!quizzes.length) { ui.empty(box, '暂时还没有答题赛，等管理员出题吧'); return; }

    box.innerHTML = '<div class="quiz-grid">' + quizzes.map(function (q) {
      var phase = q.out_phase;
      var done = !!q.out_my_submitted;

      var btn;
      if (done) {
        btn = '<button class="btn ghost sm" data-open="' + q.out_id + '">看成绩</button>';
      } else if (phase === 'running') {
        btn = '<button class="btn" data-start="' + q.out_id + '">开始作答</button>';
      } else if (phase === 'planned') {
        btn = '<button class="btn ghost sm" disabled>还没开始</button>';
      } else {
        btn = '<button class="btn ghost sm" disabled>已结束</button>';
      }

      return '<div class="quiz-card">' +
        '<h3>' + ui.esc(q.out_name) + '</h3>' +
        '<p class="desc">' + ui.esc(q.out_description || '（没有说明）') + '</p>' +
        '<div class="quiz-meta">' +
          '<span><span class="tag ' + (PHASE_CLASS[phase] || 'tag-gray') + '">' +
            ui.esc(qz.PHASES[phase] || phase) + '</span></span>' +
          '<span>满分 <b>' + ui.fmtNum(q.out_full_score) + '</b></span>' +
          '<span>倍率 <b>×' + ui.fmtNum(q.out_multiplier) + '</b></span>' +
          (done ? '<span>我的得分 <b>' + ui.fmtNum(q.out_my_final) + '</b></span>' : '') +
        '</div>' +
        '<div class="quiz-meta"><span>' + ui.esc(fmtRange(q)) + '</span></div>' +
        '<div class="quiz-foot">' + btn + '</div>' +
      '</div>';
    }).join('') + '</div>';

    ui.$$('[data-start]', box).forEach(function (b) {
      b.addEventListener('click', function () { startQuiz(b.getAttribute('data-start')); });
    });
    ui.$$('[data-open]', box).forEach(function (b) {
      b.addEventListener('click', function () { showMyResult(b.getAttribute('data-open')); });
    });
  }

  function loadList() {
    if (!auth.me()) { quizzes = []; renderList(); return; }
    ui.loading(ui.$('#listBox'), '正在读取答题赛…');
    db.quizList().then(function (list) {
      quizzes = list || [];
      // 进行中的排前面，其次未开始，最后已结束
      var order = { running: 0, planned: 1, ended: 2 };
      function rank(p) { return order[p] === undefined ? 9 : order[p]; }
      quizzes.sort(function (a, b) {
        var d = rank(a.out_phase) - rank(b.out_phase);
        if (d !== 0) return d;
        return new Date(b.out_start_at) - new Date(a.out_start_at);
      });
      renderList();
    }).catch(function (err) {
      ui.$('#listBox').innerHTML = '<div class="notice danger">读取失败：' + ui.esc(err.message) + '</div>';
    });
  }

  // ------------------------------------------------------------
  //  作答
  // ------------------------------------------------------------

  // key 是显示用的 A/B/C…（判断题不需要，传空字符串），value 是提交给服务端的答案
  function optionHtml(qid, key, value, text) {
    return '<label class="q-option">' +
      '<input type="radio" name="q' + qid + '" value="' + ui.esc(value) + '">' +
      (key ? '<span class="tag-key">' + key + '</span>' : '') +
      '<span>' + ui.esc(text) + '</span>' +
    '</label>';
  }

  function renderQuestions(quiz, questions) {
    ui.$('#playName').textContent = quiz.name;
    ui.$('#playSub').textContent = (quiz.description ? quiz.description + ' · ' : '') +
      '共 ' + questions.length + ' 题 · 倍率 ×' + ui.fmtNum(quiz.multiplier);
    ui.$('#progressText').textContent = '共 ' + questions.length + ' 题';

    ui.$('#questionBox').innerHTML = questions.map(function (q, i) {
      var head = '<div class="q-head">' +
        '<span class="q-no">' + (i + 1) + '</span>' +
        '<div class="q-stem">' + ui.esc(q.stem) + '</div>' +
        '<span class="q-score">' + ui.fmtNum(q.score) + ' 分</span>' +
      '</div>';

      var body = '';
      if (q.qtype === 'choice') {
        body = '<div class="q-options">' +
          (q.options || []).map(function (o, idx) {
            var key = String.fromCharCode(65 + idx);
            return optionHtml(q.id, key, key, o);
          }).join('') +
        '</div>';
      } else if (q.qtype === 'judge') {
        body = '<div class="q-options">' +
          optionHtml(q.id, '', 'T', '对') + optionHtml(q.id, '', 'F', '错') +
        '</div>';
      } else {
        body = '<input class="q-fill-input" type="text" data-fill="' + q.id + '" ' +
          'placeholder="在这里填写答案" autocomplete="off">';
      }

      return '<div class="q-item" data-qid="' + q.id + '">' + head + body + '</div>';
    }).join('');

    // 选择题用 对/错 时要替换选项字母
    ui.$$('.q-item', ui.$('#questionBox')).forEach(function (item) {
      item.addEventListener('change', function () {
        var picked = item.querySelector('input[type=radio]:checked');
        ui.$$('.q-option', item).forEach(function (o) { o.classList.remove('on'); });
        if (picked) picked.closest('.q-option').classList.add('on');
      });
    });
  }

  function collect() {
    if (!cur) return [];
    return cur.questions.map(function (q) {
      if (q.qtype === 'fill') {
        var el = ui.$('[data-fill="' + q.id + '"]');
        return { id: q.id, answer: el ? el.value : '' };
      }
      var picked = ui.$('input[name="q' + q.id + '"]:checked');
      return { id: q.id, answer: picked ? picked.value : '' };
    });
  }

  function startQuiz(id) {
    ui.loading(ui.$('#listBox'), '正在打开卷子…');
    db.quizTake(id).then(function (data) {
      if (!data || !data.quiz) throw new Error('这场答题赛没有题目，请联系管理员');
      // 一道题都没有的时候别放人进去：交上去就是 0 分，还会白白用掉这一次机会
      if (!data.questions || !data.questions.length) {
        throw new Error('这场答题赛还没出题，等管理员出完再来');
      }
      cur = data;
      autoSubmitted = false;
      renderQuestions(data.quiz, data.questions);
      show('play');
      startTimer(new Date(data.quiz.ends_at).getTime());
    }).catch(function (err) {
      ui.toast(err.message, 'err');
      loadList();
    });
  }

  function startTimer(endsAt) {
    stopTimer();
    var el = ui.$('#timer');

    function tick() {
      var left = endsAt - Date.now();
      if (left <= 0) {
        el.textContent = '00:00';
        stopTimer();
        if (!autoSubmitted) {
          autoSubmitted = true;
          ui.toast('时间到，自动交卷', 'err');
          doSubmit(true);
        }
        return;
      }
      var s = Math.floor(left / 1000);
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      el.textContent = (h > 0 ? h + ':' : '') +
        (h > 0 ? String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0');
      el.classList.toggle('hurry', left < 120000);
    }

    tick();
    timerId = setInterval(tick, 1000);
  }

  function doSubmit(auto) {
    if (!cur) return;
    var btn = ui.$('#submitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '提交中…'; }

    db.quizSubmit(cur.quiz.id, collect()).then(function (r) {
      stopTimer();
      renderResult(r, cur);
      show('result');
    }).catch(function (err) {
      ui.toast(err.message, 'err');
      if (!auto) {
        if (btn) { btn.disabled = false; btn.textContent = '交卷'; }
      } else {
        loadList();
        show('list');
      }
    });
  }

  // ------------------------------------------------------------
  //  成绩
  // ------------------------------------------------------------

  function renderResult(r, data) {
    var box = ui.$('#resultBox');
    box.innerHTML =
      '<div class="big">' + ui.fmtNum(r.final_score) + '</div>' +
      '<div class="sub">最终积分（已作为 X 币发到你的账户）</div>' +
      '<div class="result-formula">卷面 ' + ui.fmtNum(r.raw_score) + ' 分 × 倍率 ' +
        ui.fmtNum(r.multiplier) + ' = ' + ui.fmtNum(r.final_score) + ' 积分</div>' +
      '<div class="sub" style="margin-top:14px">答对 ' + (r.correct_count || 0) + ' / ' +
        (r.total_count || 0) + ' 题</div>';

    // 逐题复盘
    var byId = {};
    (r.details || []).forEach(function (d) { byId[String(d.id)] = d; });

    var quiz = data ? data.quiz : null;
    var html = '<div class="card"><h2 class="card-title"><span class="dot"></span>逐题复盘</h2>';
    (data.questions || []).forEach(function (q, i) {
      var d = byId[String(q.id)] || { given: '', correct: false, earned: 0 };
      var given = d.given || '（没作答）';

      var givenText = given;
      if (q.qtype === 'choice' && given !== '（没作答）') {
        var optIdx = given.toUpperCase().charCodeAt(0) - 65;
        var optText = (q.options || [])[optIdx];
        givenText = given + (optText ? '. ' + optText : '');
      }
      if (q.qtype === 'judge') {
        givenText = given === 'T' ? '对' : (given === 'F' ? '错' : given);
      }

      html += '<div class="q-item">' +
        '<div class="q-head">' +
          '<span class="q-no" style="' + (d.correct
            ? 'background:linear-gradient(135deg,#17a673,#4fd0a3)'
            : 'background:linear-gradient(135deg,#e35b6b,#f790a0)') + '">' + (i + 1) + '</span>' +
          '<div class="q-stem">' + ui.esc(q.stem) + '</div>' +
          '<span class="q-score">' + (d.correct ? '+' : '') + ui.fmtNum(d.earned || 0) + ' 分</span>' +
        '</div>' +
        '<div class="muted" style="font-size:13px">' +
          '你的答案：<b>' + ui.esc(givenText) + '</b> · ' +
          (d.correct ? '<span class="tag tag-green">答对了</span>'
                     : '<span class="tag tag-red">答错了</span>') +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    ui.$('#detailBox').innerHTML = html;
  }

  // 已经交过卷的，直接看汇总成绩
  function showMyResult(id) {
    var q = null;
    quizzes.forEach(function (x) { if (String(x.out_id) === String(id)) q = x; });
    if (!q) return;

    ui.$('#resultBox').innerHTML =
      '<div class="big">' + ui.fmtNum(q.out_my_final) + '</div>' +
      '<div class="sub">最终积分</div>' +
      '<div class="result-formula">卷面 ' + ui.fmtNum(q.out_my_raw) + ' 分 × 倍率 ' +
        ui.fmtNum(q.out_multiplier) + ' = ' + ui.fmtNum(q.out_my_final) + ' 积分</div>' +
      '<div class="sub" style="margin-top:14px">答对 ' + (q.out_my_correct || 0) + ' / ' +
        q.out_question_count + ' 题 · ' + ui.esc(q.out_name) + '</div>';
    ui.$('#detailBox').innerHTML = '';
    show('result');
  }

  // ------------------------------------------------------------
  //  事件与启动
  // ------------------------------------------------------------

  ui.$('#submitBtn').addEventListener('click', function () {
    var unanswered = collect().filter(function (a) { return !String(a.answer).trim(); }).length;
    var msg = '确认交卷吗？交卷后不能再修改。';
    if (unanswered > 0) msg += '\n还有 ' + unanswered + ' 题没有作答。';
    if (confirm(msg)) doSubmit(false);
  });

  function back() {
    if (cur && !autoSubmitted) {
      // 已经开始的卷保留在服务端，这里只回到列表
    }
    cur = null;
    stopTimer();
    show('list');
    loadList();
  }

  ui.$('#backBtn').addEventListener('click', function () {
    if (confirm('返回列表不会交卷，倒计时还在走，确定要离开吗？')) back();
  });
  ui.$('#backBtn2').addEventListener('click', back);

  auth.ready(function () { loadList(); });
  auth.onChange(function () { if (ui.$('#playView').hidden) loadList(); });
})();
