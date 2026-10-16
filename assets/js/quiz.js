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

  // 按题单算「满分」
  function fullScore(quizId) {
    var s = 0;
    questions.forEach(function (q) { if (String(q.quiz_id) === String(quizId)) s += q.score; });
    return s;
  }

  function questionsOf(quizId) {
    return questions.filter(function (q) { return String(q.quiz_id) === String(quizId); })
      .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
  }

  // 演示环境下临时造一个自增 id
  var seq = 9000;
  function nextId() { return ++seq; }

  return {
    TYPES: TYPES,
    PHASES: PHASES,
    gradeOne: gradeOne,
    norm: norm,
    judgeNorm: judgeNorm,
    demo: {
      contests: contests,
      questions: questions,
      attempts: attempts,
      fullScore: fullScore,
      questionsOf: questionsOf,
      nextId: nextId
    }
  };
})();
