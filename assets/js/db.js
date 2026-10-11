/* ============================================================
   数据访问层
   已配置 Supabase → 走真实后端
   未配置        → 走 mock.js 的演示数据（增删改只在当前页面内存里生效）
   所有函数统一返回 Promise，失败时 reject 一个 Error
   ============================================================ */

window.XBOI = window.XBOI || {};

XBOI.db = (function () {

  var cfg = XBOI.config;
  var demo = !cfg.isConfigured();
  var client = null;

  // Supabase UMD 把库挂在 window.supabase 上，这里另起名避免混淆
  if (!demo && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  } else if (!demo) {
    demo = true; // 脚本没加载成功时退化为演示模式，页面不至于全白
  }

  function ok(data) { return Promise.resolve(data); }
  function fail(msg) { return Promise.reject(new Error(msg)); }

  // 统一处理 Supabase 返回：有 error 就抛出来
  function pick(res) {
    if (res.error) throw new Error(res.error.message || '请求失败');
    return res.data;
  }

  // ---------- 演示模式下的自增主键 ----------
  var mockNow = 1000;
  function nextId() { return ++mockNow; }

  // 演示模式：把排行榜行按名字排序返回
  function demoLeaderboard() {
    return XBOI.mock.leaderboardRows();
  }

  function sorted(rows, key) {
    var arr = rows.slice();
    arr.sort(function (a, b) {
      var d = (Number(b[key]) || 0) - (Number(a[key]) || 0);
      if (d !== 0) return d;
      return String(a.luogu_name).localeCompare(String(b.luogu_name));
    });
    return arr;
  }

  // ============================================================
  //  查询类
  // ============================================================

  function getLeaderboard(key) {
    if (demo) return ok(sorted(demoLeaderboard(), key || 'balance'));
    return client.from('v_leaderboard').select('*')
      .then(pick)
      .then(function (rows) { return sorted(rows, key || 'balance'); });
  }

  function listMembers() {
    if (demo) {
      return ok(XBOI.mock.members.map(function (m) {
        var row = {};
        for (var k in m) row[k] = m[k];
        row.balance = XBOI.mock.balanceOf(m.id);
        return row;
      }));
    }
    return client.from('v_member_balances').select('*')
      .order('status', { ascending: true })
      .order('joined_at', { ascending: true })
      .then(pick);
  }

  // 按洛谷用户名精确匹配（不区分大小写）
  function findMember(name) {
    var target = String(name || '').trim().toLowerCase();
    if (!target) return ok(null);

    if (demo) {
      var hit = null;
      XBOI.mock.members.forEach(function (m) {
        if (String(m.luogu_name).toLowerCase() === target) hit = m;
      });
      if (!hit) return ok(null);
      var row = {};
      for (var k in hit) row[k] = hit[k];
      row.balance = XBOI.mock.balanceOf(hit.id);
      row.tx_count = XBOI.mock.transactions.filter(function (t) { return t.member_id === hit.id; }).length;
      return ok(row);
    }

    return client.from('v_member_balances').select('*')
      .ilike('luogu_name', target)
      .limit(1)
      .then(pick)
      .then(function (rows) { return rows && rows.length ? rows[0] : null; });
  }

  // 模糊搜索（用于"没找到，可能是"提示）
  function searchMembers(keyword) {
    var kw = String(keyword || '').trim();
    if (!kw) return ok([]);
    if (demo) {
      var low = kw.toLowerCase();
      return ok(XBOI.mock.members.filter(function (m) {
        return String(m.luogu_name).toLowerCase().indexOf(low) >= 0 ||
               String(m.display_name || '').toLowerCase().indexOf(low) >= 0;
      }).slice(0, 8));
    }
    return client.from('v_member_balances').select('*')
      .or('luogu_name.ilike.%' + kw + '%,display_name.ilike.%' + kw + '%')
      .limit(8)
      .then(pick);
  }

  function getTransactions(memberId) {
    if (demo) {
      return ok(XBOI.mock.transactions
        .filter(function (t) { return t.member_id === memberId; })
        .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }));
    }
    return client.from('coin_transactions').select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .then(pick);
  }

  function recentTransactions(limit) {
    var n = limit || 20;
    if (demo) {
      return ok(XBOI.mock.transactions.slice().sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      }).slice(0, n).map(function (t) {
        var m = XBOI.mock.memberById(t.member_id);
        var row = {};
        for (var k in t) row[k] = t[k];
        row.luogu_name = m ? m.luogu_name : '—';
        return row;
      }));
    }
    return client.from('coin_transactions')
      .select('*, members(luogu_name)')
      .order('created_at', { ascending: false })
      .limit(n)
      .then(pick)
      .then(function (rows) {
        return rows.map(function (r) {
          r.luogu_name = r.members ? r.members.luogu_name : '—';
          return r;
        });
      });
  }

  function listContests() {
    if (demo) {
      return ok(XBOI.mock.contests.slice().sort(function (a, b) {
        return new Date(b.held_at) - new Date(a.held_at);
      }));
    }
    return client.from('contests').select('*')
      .order('held_at', { ascending: false, nullsFirst: false })
      .then(pick);
  }

  function listResults(contestId) {
    if (demo) {
      return ok(XBOI.mock.results
        .filter(function (r) { return String(r.contest_id) === String(contestId); })
        .map(function (r) {
          var m = XBOI.mock.memberById(r.member_id);
          var row = {};
          for (var k in r) row[k] = r[k];
          row.luogu_name = m ? m.luogu_name : '—';
          row.display_name = m ? m.display_name : '';
          return row;
        })
        .sort(function (a, b) { return (a.rank || 999) - (b.rank || 999); }));
    }
    return client.from('contest_results').select('*, members(luogu_name, display_name)')
      .eq('contest_id', contestId)
      .order('rank', { ascending: true, nullsFirst: false })
      .then(pick)
      .then(function (rows) {
        return rows.map(function (r) {
          r.luogu_name = r.members ? r.members.luogu_name : '—';
          r.display_name = r.members ? r.members.display_name : '';
          return r;
        });
      });
  }

  // 某成员参加过的比赛成绩
  function getMemberResults(memberId) {
    if (demo) {
      return ok(XBOI.mock.results
        .filter(function (r) { return String(r.member_id) === String(memberId); })
        .map(function (r) {
          var c = null;
          XBOI.mock.contests.forEach(function (x) { if (String(x.id) === String(r.contest_id)) c = x; });
          var row = {};
          for (var k in r) row[k] = r[k];
          row.contest_name = c ? c.name : '—';
          row.contest_type = c ? c.type : '';
          row.held_at = c ? c.held_at : null;
          return row;
        })
        .sort(function (a, b) { return new Date(b.held_at) - new Date(a.held_at); }));
    }
    return client.from('contest_results').select('*, contests(name, type, held_at)')
      .eq('member_id', memberId)
      .then(pick)
      .then(function (rows) {
        return rows.map(function (r) {
          r.contest_name = r.contests ? r.contests.name : '—';
          r.contest_type = r.contests ? r.contests.type : '';
          r.held_at = r.contests ? r.contests.held_at : null;
          return r;
        }).sort(function (a, b) { return new Date(b.held_at) - new Date(a.held_at); });
      });
  }

  // 首页汇总统计
  function getStats() {
    return getLeaderboard('balance').then(function (rows) {
      var active = rows.filter(function (r) { return r.status === 'active'; });
      var totalCoin = 0, totalTx = 0, totalScore = 0, ak = 0;
      rows.forEach(function (r) {
        totalCoin += Number(r.balance) || 0;
        totalTx += Number(r.tx_count) || 0;
        totalScore += Number(r.total_score) || 0;
        ak += Number(r.ak_count) || 0;
      });
      return {
        memberCount: active.length,
        totalCoin: totalCoin,
        totalTx: totalTx,
        totalScore: totalScore,
        akCount: ak
      };
    });
  }

  // ============================================================
  //  管理端：成员
  // ============================================================

  function upsertMember(m) {
    var payload = {
      luogu_name: String(m.luogu_name || '').trim(),
      display_name: m.display_name || null,
      luogu_uid: m.luogu_uid || null,
      color: m.color || '灰名',
      role: m.role || 'member',
      status: m.status || 'active',
      joined_at: m.joined_at || new Date().toISOString().slice(0, 10),
      note: m.note || null
    };
    if (!payload.luogu_name) return fail('洛谷用户名不能为空');

    if (demo) {
      if (m.id) {
        var found = null;
        XBOI.mock.members.forEach(function (x) { if (x.id === m.id) found = x; });
        if (!found) return fail('成员不存在');
        for (var k in payload) found[k] = payload[k];
        return ok(found);
      }
      payload.id = 'm' + nextId();
      XBOI.mock.members.push(payload);
      return ok(payload);
    }

    if (m.id) {
      return client.from('members').update(payload).eq('id', m.id).select().single().then(pick);
    }
    return client.from('members').insert(payload).select().single().then(pick);
  }

  function deleteMember(id) {
    if (demo) {
      XBOI.mock.members = XBOI.mock.members.filter(function (m) { return m.id !== id; });
      XBOI.mock.transactions = XBOI.mock.transactions.filter(function (t) { return t.member_id !== id; });
      XBOI.mock.results = XBOI.mock.results.filter(function (r) { return r.member_id !== id; });
      return ok(true);
    }
    return client.from('members').delete().eq('id', id).then(pick);
  }

  // ============================================================
  //  管理端：X 币流水
  // ============================================================

  function addTransaction(t) {
    var amount = parseInt(t.amount, 10);
    if (isNaN(amount) || amount === 0) return fail('X 币数量必须是不为 0 的整数');
    var payload = {
      member_id: t.member_id,
      amount: amount,
      category: t.category || 'manual',
      reason: String(t.reason || '').trim() || '（未填写事由）',
      contest_id: t.contest_id || null
    };
    if (!payload.member_id) return fail('请选择成员');

    if (demo) {
      payload.id = nextId();
      payload.created_at = new Date().toISOString();
      XBOI.mock.transactions.push(payload);
      return ok(payload);
    }
    return client.from('coin_transactions').insert(payload).select().single().then(pick);
  }

  function deleteTransaction(id) {
    if (demo) {
      XBOI.mock.transactions = XBOI.mock.transactions.filter(function (t) { return t.id !== id; });
      return ok(true);
    }
    return client.from('coin_transactions').delete().eq('id', id).then(pick);
  }

  // ============================================================
  //  管理端：比赛与成绩
  // ============================================================

  function upsertContest(c) {
    var payload = {
      name: String(c.name || '').trim(),
      type: c.type || 'week',
      held_at: c.held_at || null,
      duration_hours: c.duration_hours === '' || c.duration_hours === undefined ? null : Number(c.duration_hours),
      problem_count: c.problem_count === '' || c.problem_count === undefined ? null : parseInt(c.problem_count, 10),
      status: c.status || 'finished',
      note: c.note || null
    };
    if (!payload.name) return fail('比赛名称不能为空');

    if (demo) {
      if (c.id) {
        var found = null;
        XBOI.mock.contests.forEach(function (x) { if (String(x.id) === String(c.id)) found = x; });
        if (!found) return fail('比赛不存在');
        for (var k in payload) found[k] = payload[k];
        return ok(found);
      }
      payload.id = nextId();
      XBOI.mock.contests.push(payload);
      return ok(payload);
    }

    if (c.id) {
      return client.from('contests').update(payload).eq('id', c.id).select().single().then(pick);
    }
    return client.from('contests').insert(payload).select().single().then(pick);
  }

  function deleteContest(id) {
    if (demo) {
      XBOI.mock.contests = XBOI.mock.contests.filter(function (c) { return String(c.id) !== String(id); });
      XBOI.mock.results = XBOI.mock.results.filter(function (r) { return String(r.contest_id) !== String(id); });
      return ok(true);
    }
    return client.from('contests').delete().eq('id', id).then(pick);
  }

  function upsertResult(r) {
    var payload = {
      contest_id: r.contest_id,
      member_id: r.member_id,
      score: parseInt(r.score, 10) || 0,
      rank: r.rank === '' || r.rank === undefined || r.rank === null ? null : parseInt(r.rank, 10),
      solved: parseInt(r.solved, 10) || 0,
      first_bloods: parseInt(r.first_bloods, 10) || 0,
      is_ak: !!r.is_ak,
      coins: parseInt(r.coins, 10) || 0
    };
    if (!payload.contest_id || !payload.member_id) return fail('比赛与成员都不能为空');

    if (demo) {
      var found = null;
      XBOI.mock.results.forEach(function (x) {
        if (String(x.contest_id) === String(payload.contest_id) &&
            String(x.member_id) === String(payload.member_id)) found = x;
      });
      if (found) {
        for (var k in payload) found[k] = payload[k];
        return ok(found);
      }
      payload.id = nextId();
      XBOI.mock.results.push(payload);
      return ok(payload);
    }
    return client.from('contest_results')
      .upsert(payload, { onConflict: 'contest_id,member_id' })
      .select().single().then(pick);
  }

  function deleteResult(contestId, memberId) {
    if (demo) {
      XBOI.mock.results = XBOI.mock.results.filter(function (r) {
        return !(String(r.contest_id) === String(contestId) && String(r.member_id) === String(memberId));
      });
      return ok(true);
    }
    return client.from('contest_results').delete()
      .eq('contest_id', contestId).eq('member_id', memberId).then(pick);
  }

  // ============================================================
  //  登录（管理员）
  // ============================================================

  function signIn(email, password) {
    if (demo) {
      if (!email || !password) return fail('请输入邮箱与密码');
      demoUser = { email: email, demo: true };
      return ok(demoUser);
    }
    return client.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data.user;
      });
  }

  function signOut() {
    if (demo) { demoUser = null; return ok(true); }
    return client.auth.signOut().then(pick);
  }

  var demoUser = null;

  function getUser() {
    if (demo) return ok(demoUser);
    return client.auth.getUser().then(function (res) {
      return res.data ? res.data.user : null;
    });
  }

  function onChange(cb) {
    if (demo) { cb(demoUser); return; }
    client.auth.onAuthStateChange(function (_evt, session) {
      cb(session ? session.user : null);
    });
  }

  return {
    isDemo: function () { return demo; },
    getLeaderboard: getLeaderboard,
    listMembers: listMembers,
    findMember: findMember,
    searchMembers: searchMembers,
    getTransactions: getTransactions,
    getMemberResults: getMemberResults,
    recentTransactions: recentTransactions,
    listContests: listContests,
    listResults: listResults,
    getStats: getStats,
    upsertMember: upsertMember,
    deleteMember: deleteMember,
    addTransaction: addTransaction,
    deleteTransaction: deleteTransaction,
    upsertContest: upsertContest,
    deleteContest: deleteContest,
    upsertResult: upsertResult,
    deleteResult: deleteResult,
    signIn: signIn,
    signOut: signOut,
    getUser: getUser,
    onChange: onChange
  };
})();
