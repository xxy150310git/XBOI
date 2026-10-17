/* ============================================================
   答题：题型定义、判分规则与演示题库
   判分规则要和数据库里的 quiz_grade_one() 保持一致
   ============================================================ */

window.XBOI = window.XBOI || {};

XBOI.quiz = (function () {

  var TYPES = {
    choice: '选择题',
    judge:  '判断题',
    fill:   '填空题'
  };

  var PHASES = {
    planned: '未开始',
    running: '进行中',
    ended:   '已结束',
    hidden:  '未发布'
  };

  function norm(s) {
    return String(s === null || s === undefined ? '' : s).trim().toLowerCase();
  }

  // 判断题的各种写法统一成 t / f
  function judgeNorm(s) {
    var v = norm(s);
    if (['对', '正确', '是', 't', 'true', '1', '√', 'y', 'yes'].indexOf(v) >= 0) return 't';
    if (['错', '错误', '否', 'f', 'false', '0', '×', 'x', 'n', 'no'].indexOf(v) >= 0) return 'f';
    return v;
  }

  /**
   * 单题判分
   * @param {string} type   choice / judge / fill
   * @param {string} answer 正确答案（选择题存选项序号，填空可用 | 分隔多个）
   * @param {string} given  作答内容
   */
  function gradeOne(type, answer, given) {
    if (type === 'choice') {
      return norm(given) !== '' && norm(given) === norm(answer);
    }

    if (type === 'judge') {
      var a = judgeNorm(answer) === 't' ? 't' : 'f';
      var g = judgeNorm(given);
      return g !== '' && g === a;
    }

    // 填空：忽略大小写与首尾空格，多个可接受答案用 | 分隔
    var given2 = norm(given);
    if (!given2) return false;
    return norm(answer).split('|').some(function (c) {
      return norm(c) !== '' && norm(c) === given2;
    });
  }

  // ------------------------------------------------------------
  //  题目文件导入
  //  把一段 JS 文本当成「题目数组」读出来并逐题校验，
  //  解析结果交给后台批量写入，这里不碰数据库。
  // ------------------------------------------------------------

  // 题型别名：写英文代号、拼音缩写或中文都能认
  var TYPE_ALIAS = {
    choice: 'choice', xz: 'choice', xzt: 'choice', '选择': 'choice', '选择题': 'choice',
    '单选': 'choice', '单选题': 'choice',
    judge: 'judge', pd: 'judge', pdt: 'judge', '判断': 'judge', '判断题': 'judge',
    fill: 'fill', tk: 'fill', tkt: 'fill', '填空': 'fill', '填空题': 'fill'
  };

  // 认得出来的判断题答案写法（用来猜题型，也用来校验）
  var JUDGE_WORDS = ['t', 'f', '对', '错', '正确', '错误', '是', '否', 'true', 'false',
                     '√', '×', '1', '0', 'y', 'n', 'yes', 'no'];

  var MAX_BANK = 500;   // 一次最多导入多少道题

  // 从任意一个值里抠出「题目数组」
  function pickList(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      var keys = ['questions', 'list', 'items', 'bank', '题库', '题目'];
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(v[keys[i]])) return v[keys[i]];
      }
    }
    return null;
  }

  /**
   * 把文件文本读成题目数组，四种写法都支持：
   *   ① 整个文件就是一个数组     [ { … }, { … } ]
   *   ② XBOI_QUESTIONS = [ … ]  （QUESTIONS 也行）
   *   ③ module.exports = [ … ] ／ export default [ … ]
   *   ④ window.XBOI_QUESTIONS = [ … ]
   * 读不出来就抛错，错误信息直接给用户看。
   */
  function readBank(text) {
    var body = String(text === null || text === undefined ? '' : text)
      .replace(/^\uFEFF/, '').trim();
    if (!body) throw new Error('这个文件是空的');

    // 顺手把 ES module 的写法还原成普通写法
    body = body.replace(/^[ \t]*export[ \t]+default[ \t]+/m, '');
    body = body.replace(/^[ \t]*export[ \t]+(const|let|var)[ \t]+/m, '');
    // 末尾那个分号会在下面被包进括号里，先摘掉（["a;"]; 这种只摘最后那个）
    body = body.replace(/;+\s*$/, '');

    var holder = {};                 // 冒充 window
    var mod = { exports: {} };
    var names = ['XBOI_QUESTIONS', 'QUESTIONS', 'window', 'module', 'exports'];
    var args = [undefined, undefined, holder, mod, mod.exports];

    // 读法一：整段就是一个表达式（数组字面量 / 赋值表达式 / JSON）
    try {
      var one = new Function(names.join(','), 'return { v: (' + body + ') };').apply(null, args);
      var direct = pickList(one && one.v);
      if (direct) return direct;
    } catch (e) { /* 不是纯表达式，换读法二 */ }

    // 读法二：当成一段脚本执行，看它把数组塞进了哪个名字
    var tail =
      '\n;return {' +
      ' a: XBOI_QUESTIONS,' +
      ' b: QUESTIONS,' +
      ' c: window.XBOI_QUESTIONS,' +
      ' d: window.QUESTIONS,' +
      ' e: window.quizBank,' +
      ' f: exports && exports.questions,' +
      ' g: exports && exports.list,' +
      ' h: module.exports,' +
      ' i: module.exports && module.exports.questions };';
    var two;
    try {
      two = new Function(names.join(','), body + tail).apply(null, args);
    } catch (e2) {
      throw new Error('这个 JS 文件没能执行成功：' + (e2 && e2.message ? e2.message : e2));
    }

    if (two) {
      for (var k in two) {
        var got = pickList(two[k]);
        if (got) return got;
      }
    }
    throw new Error('文件里没找到题目数组，正确写法是 XBOI_QUESTIONS = [ … ]，或者整份文件直接写一个数组');
  }

  // 把一道原始题目规范成内部格式；有问题就抛错，错误里带题号
  function normQuestion(raw, index, defaultScore) {
    var where = '第 ' + (index + 1) + ' 题';
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(where + '不是一个题目对象');
    }

    // 题型：没写就按内容猜
    var rawType = raw.type !== undefined ? raw.type : raw.qtype;
    var qtype = TYPE_ALIAS[norm(rawType)];
    var rawAnswer = raw.answer !== undefined ? raw.answer : raw.ans;
    if (!qtype) {
      if (raw.options && raw.options.length) qtype = 'choice';
      else if (JUDGE_WORDS.indexOf(norm(rawAnswer)) >= 0) qtype = 'judge';
      else qtype = 'fill';
    }

    var stem = String(raw.stem !== undefined ? raw.stem : (raw.question || raw.title || '')).trim();
    if (!stem) throw new Error(where + '没有题干（stem）');

    if (rawAnswer === undefined || rawAnswer === null || String(rawAnswer).trim() === '') {
      throw new Error(where + '没有答案（answer）');
    }

    var score = (raw.score !== undefined && raw.score !== null && raw.score !== '')
      ? parseInt(raw.score, 10) : parseInt(defaultScore, 10);
    if (isNaN(score) || score < 0) throw new Error(where + '的分值不合法（score 要填 0 或正数）');

    var rawSort = raw.sort !== undefined ? raw.sort : raw.sort_order;
    var sort = parseInt(rawSort, 10);
    if (isNaN(sort)) sort = index + 1;

    var options = [];
    var ans = String(rawAnswer).trim();

    if (qtype === 'choice') {
      options = (raw.options || [])
        .map(function (o) { return String(o === null || o === undefined ? '' : o).trim(); })
        .filter(function (o) { return o !== ''; });
      if (options.length < 2) throw new Error(where + '是选择题，但选项少于两个');

      // 答案写成选项字母、从 1 开始的序号，或者选项原文，都能对上
      var idx = -1;
      var up = ans.toUpperCase();
      if (/^[A-Z]$/.test(up)) {
        idx = up.charCodeAt(0) - 65;
      } else if (/^\d+$/.test(ans)) {
        idx = parseInt(ans, 10) - 1;
      } else {
        options.forEach(function (o, i) { if (idx < 0 && o === ans) idx = i; });
        if (idx < 0) {
          options.forEach(function (o, i) { if (idx < 0 && norm(o) === norm(ans)) idx = i; });
        }
      }
      if (idx < 0 || idx >= options.length) {
        throw new Error(where + '的答案「' + ans + '」对不上任何选项（可以填选项字母 A、序号 1，或选项原文）');
      }
      ans = String.fromCharCode(65 + idx);

    } else if (qtype === 'judge') {
      var j = judgeNorm(ans);
      if (j !== 't' && j !== 'f') {
        throw new Error(where + '是判断题，答案要写 T（对）或 F（错）');
      }
      ans = j.toUpperCase();

    } else {
      // 填空：多个可接受的写法用 | 隔开
      var parts = ans.split('|')
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s !== ''; });
      if (!parts.length) throw new Error(where + '的答案不能为空');
      ans = parts.join('|');
    }

    return {
      qtype: qtype, stem: stem, options: options,
      answer: ans, score: score, sort_order: sort
    };
  }

  /**
   * 解析题目文件
   * @param {string} text 文件内容
   * @param {object} opts { defaultScore } 题目没写分值时用的默认分
   * @returns {{ok:boolean, rows:Array, errors:Array, total:number, stat:object}}
   *          只要有一道题不对，ok 就是 false，rows 也会清空 —— 避免导入半截。
   */
  function parseBank(text, opts) {
    opts = opts || {};
    var blank = { ok: false, rows: [], errors: [], total: 0, stat: { choice: 0, judge: 0, fill: 0, score: 0 } };

    // 没给默认分值、或者给得不合法，就按 10 分算
    var defaultScore = parseInt(opts.defaultScore, 10);
    if (isNaN(defaultScore) || defaultScore < 0) defaultScore = 10;

    var list;
    try {
      list = readBank(text);
    } catch (e) {
      blank.errors = [e && e.message ? e.message : String(e)];
      return blank;
    }

    if (!list.length) {
      blank.errors = ['文件里的题目数组是空的'];
      return blank;
    }
    if (list.length > MAX_BANK) {
      blank.errors = ['一次最多导入 ' + MAX_BANK + ' 道题，这个文件里有 ' + list.length + ' 条'];
      return blank;
    }

    var rows = [];
    var errors = [];
    list.forEach(function (raw, i) {
      try {
        rows.push(normQuestion(raw, i, defaultScore));
      } catch (e) {
        errors.push(e.message);
      }
    });

    var stat = { choice: 0, judge: 0, fill: 0, score: 0 };
    rows.forEach(function (r) { stat[r.qtype] += 1; stat.score += r.score; });

    if (errors.length) {
      // 有错就整份不导，让用户一次改完
      return { ok: false, rows: [], errors: errors, total: list.length, stat: stat };
    }
    return { ok: true, rows: rows, errors: [], total: list.length, stat: stat };
  }

  // 可下载的模板文件内容
  function template() {
    return `/* ============================================================
   XBOI 答题赛 · 题目导入文件
   ------------------------------------------------------------
   怎么用：照着下面改好，存成 .js（UTF-8 或 GBK 都能读），
           到「管理后台 → 答题赛 → 批量导入题目」选这个文件。

   整份文件最后要给 XBOI_QUESTIONS 一个数组，直接写数组也行。
   题目里没写 score 的话，就用导入面板上的「默认分值」。

   每种题型的写法见下面三个例子：
   ============================================================ */

XBOI_QUESTIONS = [

  // ---------- 选择题 ----------
  {
    type: 'choice',
    stem: '下面哪个是 C++ 里输出到屏幕的语句？',
    options: ['cin >> a;', 'cout << a;', 'printf("%d", a);', 'scanf("%d", &a);'],
    answer: 'B',              // 填选项字母 B、序号 2，或选项原文都行
    score: 10,
    sort: 1                   // 排序，小的排前面；不写就按文件里的先后
  },

  // ---------- 判断题 ----------
  {
    type: 'judge',
    stem: '在 C++ 中，数组下标从 0 开始。',
    answer: 'T',              // T 表示对，F 表示错（写 对／错、√／×、true／false 也认）
    score: 10,
    sort: 2
  },

  // ---------- 填空题 ----------
  {
    type: 'fill',
    stem: 'C++ 程序的入口函数叫 ______。',
    answer: 'main|Main',      // 多个可接受写法用竖线隔开，判分忽略大小写和首尾空格
    score: 15,
    sort: 3
  }

];
`;
  }

  // ------------------------------------------------------------
  //  演示题库：时间相对今天生成，保证演示时总有一场能答
  // ------------------------------------------------------------

  var DAY = 86400000;
  function minutesAgo(n) { return new Date(Date.now() - n * 60000).toISOString(); }
  function daysAgo(n) { return new Date(Date.now() - n * DAY).toISOString(); }
  function daysAfter(n) { return new Date(Date.now() + n * DAY).toISOString(); }

  var contests = [
    { id: 1, name: '周训答题 #1', description: '洛谷语法基础，范围到循环与数组。',
      start_at: minutesAgo(25), duration_minutes: 90, multiplier: 2, published: true },
    { id: 2, name: '算法专题 · 图论', description: '最短路与最小生成树概念题。',
      start_at: daysAfter(2), duration_minutes: 45, multiplier: 1.5, published: true },
    { id: 3, name: '新手热身', description: '开卷热身，随便做做。',
      start_at: daysAgo(6), duration_minutes: 60, multiplier: 1, published: true },
    { id: 4, name: '内部用卷（未发布）', description: '还在出的题，成员看不到。',
      start_at: daysAfter(8), duration_minutes: 30, multiplier: 1, published: false }
  ];

  var questions = [
    // 周训答题 #1（进行中）
    { id: 101, quiz_id: 1, qtype: 'choice', stem: '下面哪个是 C++ 里输出到屏幕的语句？',
      options: ['cin >> a;', 'cout << a;', 'printf("%d", a);', 'scanf("%d", &a);'],
      answer: 'B', score: 10, sort_order: 1 },
    { id: 102, quiz_id: 1, qtype: 'judge', stem: '在 C++ 中，数组下标从 0 开始。',
      options: [], answer: 'T', score: 10, sort_order: 2 },
    { id: 103, quiz_id: 1, qtype: 'fill', stem: '求一个整数数组最大值时，把答案变量初值设为数组第一个元素的常见写法，'
      + '用一句话说出这个变量应该初始化成什么（回答一个词即可）：初始化为 a[____] 中的下标。',
      options: [], answer: '0', score: 15, sort_order: 3 },
    { id: 104, quiz_id: 1, qtype: 'choice', stem: '下面哪种循环至少会执行一次循环体？',
      options: ['for', 'while', 'do-while', '以上都不会'],
      answer: 'C', score: 15, sort_order: 4 },

    // 算法专题 · 图论（未开始）
    { id: 201, quiz_id: 2, qtype: 'choice', stem: 'Dijkstra 算法不能处理下面哪种情况？',
      options: ['有向图', '负权边', '稀疏图', '单源最短路'],
      answer: 'B', score: 20, sort_order: 1 },
    { id: 202, quiz_id: 2, qtype: 'judge', stem: '一个连通图的最小生成树一定唯一。',
      options: [], answer: 'F', score: 10, sort_order: 2 },

    // 新手热身（已结束）
    { id: 301, quiz_id: 3, qtype: 'choice', stem: '洛谷的题目难度里，「普及-」大致对应哪个颜色？',
      options: ['红', '橙', '黄', '绿'],
      answer: 'B', score: 10, sort_order: 1 },
    { id: 302, quiz_id: 3, qtype: 'fill', stem: '一个程序从开始执行到结束，最先执行的函数名是？',
      options: [], answer: 'main|Main|MAIN', score: 10, sort_order: 2 },
    { id: 303, quiz_id: 3, qtype: 'judge', stem: 'CE 表示编译错误。',
      options: [], answer: 'T', score: 10, sort_order: 3 }
  ];

  // 演示用的作答记录（已交卷的）
  var attempts = [
    { id: 1, quiz_id: 3, member_id: 'm1', raw_score: 30, multiplier: 1, final_score: 30,
      correct_count: 3, total_count: 3, started_at: daysAgo(6), submitted_at: daysAgo(6) },
    { id: 2, quiz_id: 3, member_id: 'm2', raw_score: 20, multiplier: 1, final_score: 20,
      correct_count: 2, total_count: 3, started_at: daysAgo(6), submitted_at: daysAgo(6) },
    { id: 3, quiz_id: 3, member_id: 'm3', raw_score: 0, multiplier: 1, final_score: 0,
      correct_count: 0, total_count: 3, started_at: daysAgo(6), submitted_at: daysAgo(6) }
  ];

  // 演示环境下临时造一个自增 id
  var seq = 9000;
  function nextId() { return ++seq; }

  // 演示数据统一挂在这个对象上，读写都走 api.xxx。
  // 演示模式里删除是「整属性替换」（api.questions = 过滤后的新数组），
  // 如果这里直接去读函数外面的变量，就会一直拿着最初那个旧数组 ——
  // 表现出来就是「删了题目但列表里还在」。
  var api = {
    contests: contests,
    questions: questions,
    attempts: attempts,
    fullScore: function (quizId) {
      var s = 0;
      api.questions.forEach(function (q) {
        if (String(q.quiz_id) === String(quizId)) s += q.score;
      });
      return s;
    },
    questionsOf: function (quizId) {
      return api.questions
        .filter(function (q) { return String(q.quiz_id) === String(quizId); })
        .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    },
    nextId: nextId
  };

  return {
    TYPES: TYPES,
    PHASES: PHASES,
    TYPE_ALIAS: TYPE_ALIAS,
    MAX_BANK: MAX_BANK,
    gradeOne: gradeOne,
    norm: norm,
    judgeNorm: judgeNorm,
    parseBank: parseBank,
    template: template,
    demo: api
  };
})();
