/* ============================================================
   演示数据
   当 config.js 里没有填 Supabase 配置时，整站读取这份数据，
   方便先看页面效果。填好配置后自动失效，不影响真实数据。
   比赛奖励由 XBOI.rules 现算，保证与规则一致。
   ============================================================ */

window.XBOI = window.XBOI || {};

XBOI.mock = (function () {

  // ---------- 成员 ----------
  var members = [
    { id: 'm1', luogu_name: 'xxy150310', display_name: '队长',   luogu_uid: '100001', color: '红名', role: 'admin',  status: 'active', joined_at: '2025-09-01' },
    { id: 'm2', luogu_name: 'Tianyi',    display_name: '天依',   luogu_uid: '100002', color: '紫名', role: 'member', status: 'active', joined_at: '2025-09-06' },
    { id: 'm3', luogu_name: 'abcd1234',  display_name: '老队员', luogu_uid: '100003', color: '橙名', role: 'member', status: 'active', joined_at: '2025-09-06' },
    { id: 'm4', luogu_name: 'Aqua_',     display_name: '水水',   luogu_uid: '100004', color: '蓝名', role: 'member', status: 'active', joined_at: '2025-10-12' },
    { id: 'm5', luogu_name: 'NovaX',     display_name: '新星',   luogu_uid: '100005', color: '绿名', role: 'member', status: 'active', joined_at: '2025-11-03' },
    { id: 'm6', luogu_name: 'huanhuan',  display_name: '欢欢',   luogu_uid: '100006', color: '灰名', role: 'member', status: 'active', joined_at: '2026-01-18' },
    { id: 'm7', luogu_name: 'Ruri',      display_name: '琉璃',   luogu_uid: '100007', color: '紫名', role: 'member', status: 'active', joined_at: '2026-02-09' },
    { id: 'm8', luogu_name: 'Kaguya',    display_name: '辉夜',   luogu_uid: '100008', color: '绿名', role: 'member', status: 'left',   joined_at: '2025-12-01' }
  ];

  // ---------- 比赛 ----------
  var contests = [
    { id: 1, name: '入门赛 #1',    type: 'entry', held_at: '2026-03-08T14:00:00+08:00', duration_hours: 4,  problem_count: 6, status: 'finished', note: '' },
    { id: 2, name: '周赛 R1',      type: 'week',  held_at: '2026-03-15T19:00:00+08:00', duration_hours: 48, problem_count: 4, status: 'finished', note: '' },
    { id: 3, name: '月赛 2026-03', type: 'month', held_at: '2026-03-29T09:00:00+08:00', duration_hours: 8,  problem_count: 4, status: 'finished', note: '自主出题' },
    { id: 4, name: '周赛 R2',      type: 'week',  held_at: '2026-04-05T19:00:00+08:00', duration_hours: 48, problem_count: 4, status: 'finished', note: '' },
    { id: 5, name: '入门赛 #2',    type: 'entry', held_at: '2026-04-19T14:00:00+08:00', duration_hours: 4,  problem_count: 6, status: 'finished', note: '' }
  ];

  // ---------- 成绩（发放 X 币由规则现算） ----------
  var rawResults = [
    { contest_id: 1, member_id: 'm1', score: 600, rank: 1, solved: 6, first_bloods: 2, is_ak: true },
    { contest_id: 1, member_id: 'm2', score: 480, rank: 2, solved: 5, first_bloods: 1, is_ak: false },
    { contest_id: 1, member_id: 'm3', score: 420, rank: 3, solved: 4, first_bloods: 1, is_ak: false },
    { contest_id: 1, member_id: 'm5', score: 300, rank: 4, solved: 3, first_bloods: 0, is_ak: false },

    { contest_id: 2, member_id: 'm2', score: 400, rank: 1, solved: 4, first_bloods: 2, is_ak: true },
    { contest_id: 2, member_id: 'm7', score: 320, rank: 2, solved: 3, first_bloods: 1, is_ak: false },
    { contest_id: 2, member_id: 'm1', score: 280, rank: 3, solved: 3, first_bloods: 0, is_ak: false },
    { contest_id: 2, member_id: 'm4', score: 160, rank: 4, solved: 2, first_bloods: 0, is_ak: false },

    { contest_id: 3, member_id: 'm1', score: 400, rank: 1, solved: 4, first_bloods: 3, is_ak: true },
    { contest_id: 3, member_id: 'm3', score: 260, rank: 2, solved: 3, first_bloods: 1, is_ak: false },
    { contest_id: 3, member_id: 'm5', score: 190, rank: 3, solved: 2, first_bloods: 0, is_ak: false },
    { contest_id: 3, member_id: 'm6', score: 100, rank: 4, solved: 1, first_bloods: 0, is_ak: false },

    { contest_id: 4, member_id: 'm7', score: 400, rank: 1, solved: 4, first_bloods: 4, is_ak: true },
    { contest_id: 4, member_id: 'm2', score: 240, rank: 2, solved: 3, first_bloods: 0, is_ak: false },
    { contest_id: 4, member_id: 'm4', score: 200, rank: 3, solved: 2, first_bloods: 0, is_ak: false },

    { contest_id: 5, member_id: 'm5', score: 600, rank: 1, solved: 6, first_bloods: 3, is_ak: true },
    { contest_id: 5, member_id: 'm6', score: 360, rank: 2, solved: 4, first_bloods: 1, is_ak: false },
    { contest_id: 5, member_id: 'm2', score: 300, rank: 3, solved: 3, first_bloods: 1, is_ak: false }
  ];

  // ---------- 其他流水 ----------
  var extras = [
    { member_id: 'm1', amount: 100,  category: 'join',     reason: '入队初始发放',                       created_at: '2025-09-01T10:00:00+08:00' },
    { member_id: 'm2', amount: 100,  category: 'join',     reason: '入队初始发放',                       created_at: '2025-09-06T10:00:00+08:00' },
    { member_id: 'm3', amount: 100,  category: 'join',     reason: '入队初始发放',                       created_at: '2025-09-06T10:00:00+08:00' },
    { member_id: 'm4', amount: 100,  category: 'join',     reason: '入队初始发放',                       created_at: '2025-10-12T10:00:00+08:00' },
    { member_id: 'm5', amount: 100,  category: 'join',     reason: '入队初始发放',                       created_at: '2025-11-03T10:00:00+08:00' },
    { member_id: 'm6', amount: 100,  category: 'join',     reason: '入队初始发放',                       created_at: '2026-01-18T10:00:00+08:00' },
    { member_id: 'm7', amount: 100,  category: 'join',     reason: '入队初始发放',                       created_at: '2026-02-09T10:00:00+08:00' },
    { member_id: 'm8', amount: 100,  category: 'join',     reason: '入队初始发放',                       created_at: '2025-12-01T10:00:00+08:00' },
    { member_id: 'm5', amount: -10,  category: 'training', reason: '周训练未达标（不足 200 分）',          created_at: '2026-03-20T20:00:00+08:00' },
    { member_id: 'm6', amount: -25,  category: 'penalty',  reason: '群内刷屏，按规则 07 扣除',             created_at: '2026-03-22T21:10:00+08:00' },
    { member_id: 'm2', amount: 8,    category: 'reward',   reason: '群内分享优质题解',                    created_at: '2026-04-02T19:30:00+08:00' },
    { member_id: 'm1', amount: 100,  category: 'manual',   reason: '成功举办成员赛奖励',                  created_at: '2026-04-12T15:00:00+08:00' },
    { member_id: 'm8', amount: -100, category: 'leave',    reason: '自愿退队，X 币清零',                  created_at: '2026-04-25T18:00:00+08:00' }
  ];

  // ---------- 兑换记录 ----------
  // 兑换时间相对今天生成，这样演示数据不会随着时间推移全部变成「已过期」
  var DAY = 86400000;
  function daysAgo(n) { return new Date(Date.now() - n * DAY).toISOString(); }
  function daysAfter(iso, n) { return new Date(new Date(iso).getTime() + n * DAY).toISOString(); }

  var REDEMPTION_SEED = [
    { code: 'XBOI-2WD6R-4PN9H', member_id: 'm6', item_code: 'makeup', item_name: '补签卡', cost: 15, status: 'unused', madeAgo: 128, usedAgo: null },
    { code: 'XBOI-3F9K2-7QW8D', member_id: 'm4', item_code: 'makeup', item_name: '补签卡', cost: 15, status: 'unused', madeAgo: 12,  usedAgo: null },
    { code: 'XBOI-8HN4M-2XR6P', member_id: 'm1', item_code: 'waiver', item_name: '免扣卡', cost: 40, status: 'used',   madeAgo: 26,  usedAgo: 22 },
    { code: 'XBOI-6TB1Y-9KJ5C', member_id: 'm7', item_code: 'appeal', item_name: '申诉券', cost: 25, status: 'unused', madeAgo: 4,   usedAgo: null },
    { code: 'XBOI-5VQ7L-3MZ8A', member_id: 'm3', item_code: 'extend', item_name: '延长卡', cost: 20, status: 'used',   madeAgo: 18,  usedAgo: 16 }
  ];

  var redemptions = REDEMPTION_SEED.map(function (s, i) {
    var created = daysAgo(s.madeAgo);
    return {
      id: i + 1,
      code: s.code,
      member_id: s.member_id,
      item_code: s.item_code,
      item_name: s.item_name,
      cost: s.cost,
      status: s.status,
      created_at: created,
      expires_at: daysAfter(created, 90),          // 道具有效期 90 天
      used_at: s.usedAgo === null ? null : daysAgo(s.usedAgo),
      used_by: s.usedAgo === null ? null : 'demo-admin'
    };
  });

  // 兑换产生的扣币流水，与上面的兑换记录一一对应
  var exchangeTx = redemptions.map(function (r) {
    return {
      member_id: r.member_id,
      amount: -r.cost,
      category: 'exchange',
      reason: '兑换' + r.item_name + ' ×1（兑换码 ' + r.code + '）',
      created_at: r.created_at
    };
  });

  // ---------- 组装 ----------
  var api = {};

  function contestById(id) {
    var hit = null;
    api.contests.forEach(function (c) { if (String(c.id) === String(id)) hit = c; });
    return hit;
  }

  function memberById(id) {
    var hit = null;
    api.members.forEach(function (m) { if (String(m.id) === String(id)) hit = m; });
    return hit;
  }

  function itemByCode(code) {
    var hit = null;
    api.items.forEach(function (it) { if (it.code === code) hit = it; });
    return hit;
  }

  api.contests = contests;
  api.members = members;
  api.redemptions = redemptions;
  api.items = XBOI.items.demoList();

  // 成绩：把首 A 题数折算成题号数组，再用规则算 X 币
  api.results = rawResults.map(function (r, i) {
    var c = contestById(r.contest_id);
    var type = c ? c.type : 'week';
    var idx = [];
    for (var k = 1; k <= r.first_bloods; k++) idx.push(k);

    var calc = XBOI.rules.contestCoins({
      type: type,
      isAk: r.is_ak,
      rank: r.rank,
      firstBloodIndexes: idx,
      scored: r.score > 0
    });

    var row = {
      id: i + 1,
      contest_id: r.contest_id,
      member_id: r.member_id,
      score: r.score,
      rank: r.rank,
      solved: r.solved,
      first_bloods: r.first_bloods,
      is_ak: r.is_ak,
      coins: calc.total
    };
    row._items = calc.items;
    return row;
  });

  // 比赛奖励流水：由成绩自动生成，事由写成明细
  var contestTx = api.results.filter(function (r) { return r.coins > 0; }).map(function (r, i) {
    var c = contestById(r.contest_id);
    var detail = r._items.map(function (it) { return it.label + ' ' + it.value; }).join(' + ');
    var base = c ? new Date(c.held_at) : new Date();
    return {
      id: 500 + i,
      member_id: r.member_id,
      amount: r.coins,
      category: 'contest',
      reason: (c ? c.name + '：' : '') + detail,
      contest_id: r.contest_id,
      created_at: new Date(base.getTime() + 6 * 3600 * 1000).toISOString()
    };
  });

  // 汇总流水并按时间倒序整理出 id
  api.transactions = extras.concat(exchangeTx, contestTx)
    .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); })
    .map(function (t, i) { t.id = i + 1; return t; });

  function balanceOf(id) {
    var sum = 0;
    api.transactions.forEach(function (t) {
      if (String(t.member_id) === String(id)) sum += t.amount;
    });
    return sum;
  }

  function leaderboardRows() {
    var quizDemo = XBOI.quiz.demo;

    return api.members.map(function (m) {
      var coins = 0, score = 0, ak = 0, cnt = 0;
      api.results.forEach(function (r) {
        if (String(r.member_id) !== String(m.id)) return;
        coins += r.coins; score += r.score; cnt += 1;
        if (r.is_ak) ak += 1;
      });

      // 答题积分：只算已经交卷的
      var qScore = 0, qCount = 0, qScored = 0;
      quizDemo.attempts.forEach(function (a) {
        if (String(a.member_id) !== String(m.id) || !a.submitted_at) return;
        qScore += Number(a.final_score) || 0;
        qCount += 1;
        if (Number(a.final_score) > 0) qScored += 1;
      });

      return {
        id: m.id,
        luogu_name: m.luogu_name,
        display_name: m.display_name,
        luogu_uid: m.luogu_uid,
        color: m.color,
        role: m.role,
        status: m.status,
        joined_at: m.joined_at,
        balance: balanceOf(m.id),
        tx_count: api.transactions.filter(function (t) {
          return String(t.member_id) === String(m.id);
        }).length,
        contest_coins: coins,
        total_score: score,
        ak_count: ak,
        contest_count: cnt,
        quiz_score: qScore,
        quiz_count: qCount,
        quiz_scored_count: qScored
      };
    });
  }

  api.memberById = memberById;
  api.contestById = contestById;
  api.itemByCode = itemByCode;
  api.balanceOf = balanceOf;
  api.leaderboardRows = leaderboardRows;

  return api;
})();
