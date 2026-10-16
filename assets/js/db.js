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
  if (!demo) {
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    } else {
      // 配了后端但脚本没加载出来（多半是网络问题）。
      // 这里绝不能悄悄退回演示数据，否则访客会看到一堆假队员，
      // 所以给一个「怎么调都报错」的替身，让页面上明明白白地提示出来。
      client = brokenClient();
    }
  }

  function brokenClient() {
    function chain() {
      var node = {};
      function self() { return node; }
      ['select', 'insert', 'update', 'upsert', 'delete', 'order', 'eq', 'neq',
       'ilike', 'or', 'limit', 'single', 'maybeSingle'].forEach(function (k) {
        node[k] = self;
      });
      node.then = function (_ok, bad) {
        return Promise.reject(new Error('后端脚本没能加载出来，请检查网络后刷新页面再试')).catch(bad);
      };
      return node;
    }
    return {
      from: function () { return chain(); },
      rpc: function () { return chain(); }
    };
  }

  // 网络断了的时候，浏览器只会抛一句 "Failed to fetch"，
  // 这里统一换成看得懂的话。站点里只有 Supabase 在用 fetch，影响面可控。
  if (!demo && typeof window.fetch === 'function') {
    var rawFetch = window.fetch.bind(window);
    window.fetch = function () {
      return rawFetch.apply(null, arguments).catch(function () {
        throw new Error('连不上后端服务器，请检查网络后再试');
      });
    };
  }

  var TOKEN_KEY = 'xboi_token';

  function ok(data) { return Promise.resolve(data); }
  function fail(msg) { return Promise.reject(new Error(msg)); }

  // 表还没建的时候报错很晦涩，这里换成一句能直接照做的提示
  function friendly(msg) {
    var m = String(msg || '请求失败').replace(/^Error:\s*/i, '');
    if (/schema cache|does not exist|relation .* does not exist/i.test(m)) {
      return '数据表还没建好，请先在 Supabase 的 SQL Editor 里执行 supabase-schema.sql';
    }
    return m;
  }

  // 统一处理 Supabase 返回：有 error 就抛出来
  function pick(res) {
    if (res.error) throw new Error(friendly(res.error.message));
    return res.data;
  }

  // 调用服务端函数
  function rpc(name, params) {
    return client.rpc(name, params).then(function (res) {
      if (res.error) throw new Error(friendly(res.error.message));
      return res.data;
    });
  }

  // 返回单行的函数（returns table）取第一行
  function rpcRow(name, params) {
    return rpc(name, params).then(function (rows) {
      return rows && rows.length ? rows[0] : null;
    });
  }

  // ---------- 登录态 ----------
  function readToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function writeToken(t) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 忽略 */ }
  }

  // ---------- 演示模式下的自增主键 ----------
  var mockNow = 1000;
  function nextId() { return ++mockNow; }

  // ---------- 演示模式下的密码与会话 ----------
  // 演示环境没有后端，密码和会话就放在内存里；token 里带上成员 id，
  // 这样刷新页面还能认得出来是谁。
  var demoPasswords = {};
  var demoRevoked = {};

  function demoCred(memberId) {
    if (!demoPasswords[memberId]) {
      demoPasswords[memberId] = { password: '123456', is_default: true };
    }
    return demoPasswords[memberId];
  }

  function demoMemberOfToken(token) {
    var t = String(token || '');
    if (!t || demoRevoked[t]) return null;
    var m = /^demo:([^:]+):/.exec(t);
    if (!m) return null;
    return XBOI.mock.memberById(m[1]);
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
  //  登录 / 会话 / 改密码
  // ============================================================

  function memberLogin(luoguName, password) {
    var name = String(luoguName || '').trim();
    if (!name) return fail('请输入洛谷用户名');
    if (!password) return fail('请输入密码');

    if (demo) {
      var member = null;
      XBOI.mock.members.forEach(function (m) {
        if (String(m.luogu_name).toLowerCase() === name.toLowerCase()) member = m;
      });
      if (!member) return fail('洛谷用户名或密码不对');
      if (member.status === 'removed') return fail('该成员已被移出团队，无法登录');
      var cred = demoCred(member.id);
      if (cred.password !== password) return fail('洛谷用户名或密码不对');

      var token = 'demo:' + member.id + ':' + Math.random().toString(36).slice(2, 12);
      writeToken(token);
      return ok({
        out_token: token,
        out_luogu_name: member.luogu_name,
        out_display_name: member.display_name,
        out_role: member.role,
        out_color: member.color,
        out_status: member.status,
        out_is_default: cred.is_default
      });
    }

    return rpcRow('member_login', { p_luogu_name: name, p_password: password })
      .then(function (row) {
        if (!row) throw new Error('登录失败，请稍后重试');
        writeToken(row.out_token);
        return row;
      });
  }

  // 用本地 token 换回当前登录的人；没登录或过期返回 null
  function memberMe() {
    var token = readToken();
    if (!token) return ok(null);

    if (demo) {
      var m = demoMemberOfToken(token);
      if (!m) { writeToken(null); return ok(null); }
      var cred = demoCred(m.id);
      return ok({
        out_luogu_name: m.luogu_name,
        out_display_name: m.display_name,
        out_role: m.role,
        out_color: m.color,
        out_status: m.status,
        out_is_default: cred.is_default
      });
    }

    return rpcRow('member_me', { p_token: token }).then(function (row) {
      if (!row) writeToken(null);
      return row || null;
    }).catch(function () {
      writeToken(null);
      return null;
    });
  }

  function memberLogout() {
    var token = readToken();
    writeToken(null);
    if (!token) return ok(true);
    if (demo) { demoRevoked[token] = true; return ok(true); }
    return rpc('member_logout', { p_token: token }).then(function () { return true; })
      .catch(function () { return true; });
  }

  function memberChangePassword(oldPassword, newPassword) {
    var token = readToken();
    if (!token) return fail('请先登录');

    if (demo) {
      var m = demoMemberOfToken(token);
      if (!m) return fail('登录已过期，请重新登录');
      if (!newPassword || String(newPassword).length < 6) return fail('新密码至少 6 位');
      var cred = demoCred(m.id);
      if (cred.password !== oldPassword) return fail('原密码不对');
      if (cred.password === newPassword) return fail('新密码不能和原密码一样');
      cred.password = newPassword;
      cred.is_default = false;
      return ok(true);
    }

    return rpc('member_change_password', {
      p_token: token, p_old_password: oldPassword, p_new_password: newPassword
    }).then(function () { return true; });
  }

  // ============================================================
  //  查询类
  // ============================================================

  function getLeaderboard(key) {
    if (demo) return ok(sorted(XBOI.mock.leaderboardRows(), key || 'balance'));
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
      XBOI.mock.leaderboardRows().forEach(function (row) {
        if (String(row.luogu_name).toLowerCase() === target) hit = row;
      });
      return ok(hit);
    }

    return client.from('v_leaderboard').select('*')
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
        .filter(function (t) { return String(t.member_id) === String(memberId); })
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
  //  道具与兑换码
  // ============================================================

  // 兑换码状态：unused 未使用 / used 已使用 / expired 已过期
  function withStatus(r) {
    var row = {};
    for (var k in r) row[k] = r[k];
    row.display_status = r.status === 'used'
      ? 'used'
      : (r.expires_at && new Date(r.expires_at) < new Date() ? 'expired' : 'unused');
    return row;
  }

  function listItems() {
    if (demo) return ok(XBOI.items.demoList());
    return client.from('items').select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(pick)
      .then(function (rows) {
        return (rows || []).map(function (r) {
          r.icon = XBOI.items.icon(r.code);
          return r;
        });
      });
  }

  // 某个成员的兑换记录
  function getRedemptions(memberId) {
    if (demo) {
      return ok(XBOI.mock.redemptions
        .filter(function (r) { return String(r.member_id) === String(memberId); })
        .map(withStatus)
        .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }));
    }
    return client.from('v_redemptions').select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .then(pick);
  }

  // 后台用：全部兑换记录
  function listAllRedemptions(onlyUnused) {
    if (demo) {
      var rows = XBOI.mock.redemptions.map(function (r) {
        var row = withStatus(r);
        var m = XBOI.mock.memberById(r.member_id);
        row.luogu_name = m ? m.luogu_name : '—';
        row.display_name = m ? m.display_name : '';
        return row;
      });
      if (onlyUnused) rows = rows.filter(function (r) { return r.display_status === 'unused'; });
      return ok(rows.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }));
    }
    var q = client.from('v_redemptions').select('*').order('created_at', { ascending: false });
    if (onlyUnused) q = q.eq('display_status', 'unused');
    return q.then(pick);
  }

  // 生成演示用的兑换码
  function demoCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    function block(n) {
      var s = '';
      for (var i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      return s;
    }
    return 'XBOI-' + block(5) + '-' + block(5);
  }

  // 兑换道具：当前登录的人 + 再次输入密码确认 → 扣 X 币 → 生成兑换码
  function redeem(itemCode, password) {
    if (!itemCode) return fail('请选择要兑换的道具');
    if (!password) return fail('请输入密码确认');
    var token = readToken();
    if (!token) return fail('请先登录');

    if (demo) {
      var member = demoMemberOfToken(token);
      if (!member) return fail('登录已过期，请重新登录');
      if (member.status !== 'active') return fail('当前不在队，不能兑换');

      var cred = demoCred(member.id);
      if (cred.password !== password) return fail('密码不对，兑换已取消');

      var item = XBOI.mock.itemByCode(itemCode);
      if (!item) return fail('道具不存在或已下架');

      var balance = XBOI.mock.balanceOf(member.id);
      if (balance < item.cost) {
        return fail('X 币不足，当前 ' + balance + ' 币，需要 ' + item.cost + ' 币');
      }

      var code = demoCode();
      var now = new Date();
      var expires = new Date(now.getTime() + (item.valid_days || 90) * 86400000);

      XBOI.mock.transactions.push({
        id: 'demo-' + now.getTime(),
        member_id: member.id,
        amount: -item.cost,
        category: 'exchange',
        reason: '兑换' + item.name + ' ×1（兑换码 ' + code + '）',
        created_at: now.toISOString()
      });
      XBOI.mock.redemptions.push({
        id: 'demo-' + now.getTime(),
        code: code,
        member_id: member.id,
        item_code: item.code,
        item_name: item.name,
        cost: item.cost,
        status: 'unused',
        created_at: now.toISOString(),
        expires_at: expires.toISOString(),
        used_at: null,
        used_by: null
      });

      return ok({
        out_code: code,
        out_item_name: item.name,
        out_cost: item.cost,
        out_balance: balance - item.cost,
        out_expires_at: expires.toISOString()
      });
    }

    return rpcRow('redeem_item', {
      p_token: token, p_item_code: itemCode, p_password: password
    }).then(function (row) {
      if (!row) throw new Error('兑换失败，请稍后重试');
      return row;
    });
  }

  // 管理员核销
  function markRedemptionUsed(id) {
    if (demo) {
      var hit = null;
      XBOI.mock.redemptions.forEach(function (r) { if (String(r.id) === String(id)) hit = r; });
      if (!hit) return fail('兑换记录不存在');
      if (hit.status === 'used') return fail('这张兑换码已经用过了');
      if (hit.expires_at && new Date(hit.expires_at) < new Date()) return fail('这张兑换码已经过期');
      hit.status = 'used';
      hit.used_at = new Date().toISOString();
      hit.used_by = 'demo-admin';
      return ok(hit);
    }
    return rpc('admin_mark_redemption_used', { p_token: readToken(), p_id: id })
      .then(function () { return true; });
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
        XBOI.mock.members.forEach(function (x) { if (String(x.id) === String(m.id)) found = x; });
        if (!found) return fail('成员不存在');
        for (var k in payload) found[k] = payload[k];
        return ok(found);
      }
      payload.id = 'm' + nextId();
      XBOI.mock.members.push(payload);
      return ok(payload);
    }

    return rpc('admin_upsert_member', {
      p_token: readToken(),
      p_id: m.id || null,
      p_luogu_name: payload.luogu_name,
      p_display_name: payload.display_name,
      p_luogu_uid: payload.luogu_uid,
      p_color: payload.color,
      p_role: payload.role,
      p_status: payload.status,
      p_joined_at: payload.joined_at,
      p_note: payload.note
    });
  }

  function deleteMember(id) {
    if (demo) {
      XBOI.mock.members = XBOI.mock.members.filter(function (m) { return String(m.id) !== String(id); });
      XBOI.mock.transactions = XBOI.mock.transactions.filter(function (t) { return String(t.member_id) !== String(id); });
      XBOI.mock.results = XBOI.mock.results.filter(function (r) { return String(r.member_id) !== String(id); });
      XBOI.mock.redemptions = XBOI.mock.redemptions.filter(function (r) { return String(r.member_id) !== String(id); });
      return ok(true);
    }
    return rpc('admin_delete_member', { p_token: readToken(), p_id: id });
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
    return rpc('admin_add_transaction', {
      p_token: readToken(),
      p_member_id: payload.member_id,
      p_amount: payload.amount,
      p_category: payload.category,
      p_reason: payload.reason,
      p_contest_id: payload.contest_id
    });
  }

  function deleteTransaction(id) {
    if (demo) {
      XBOI.mock.transactions = XBOI.mock.transactions.filter(function (t) { return String(t.id) !== String(id); });
      return ok(true);
    }
    return rpc('admin_delete_transaction', { p_token: readToken(), p_id: id });
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

    return rpc('admin_upsert_contest', {
      p_token: readToken(),
      p_id: c.id || null,
      p_name: payload.name,
      p_type: payload.type,
      p_status: payload.status,
      p_held_at: payload.held_at,
      p_duration_hours: payload.duration_hours,
      p_problem_count: payload.problem_count,
      p_note: payload.note
    });
  }

  function deleteContest(id) {
    if (demo) {
      XBOI.mock.contests = XBOI.mock.contests.filter(function (c) { return String(c.id) !== String(id); });
      XBOI.mock.results = XBOI.mock.results.filter(function (r) { return String(r.contest_id) !== String(id); });
      return ok(true);
    }
    return rpc('admin_delete_contest', { p_token: readToken(), p_id: id });
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
    return rpc('admin_upsert_result', {
      p_token: readToken(),
      p_contest_id: payload.contest_id,
      p_member_id: payload.member_id,
      p_score: payload.score,
      p_rank: payload.rank,
      p_solved: payload.solved,
      p_first_bloods: payload.first_bloods,
      p_is_ak: payload.is_ak,
      p_coins: payload.coins
    });
  }

  function deleteResult(contestId, memberId) {
    if (demo) {
      XBOI.mock.results = XBOI.mock.results.filter(function (r) {
        return !(String(r.contest_id) === String(contestId) && String(r.member_id) === String(memberId));
      });
      return ok(true);
    }
    return rpc('admin_delete_result', {
      p_token: readToken(), p_contest_id: contestId, p_member_id: memberId
    });
  }

  // ============================================================
  //  答题赛
  // ============================================================

  // 演示与前端共用的阶段判断
  function quizPhase(q) {
    if (q.published === false) return 'hidden';
    var start = new Date(q.start_at).getTime();
    var end = start + (Number(q.duration_minutes) || 0) * 60000;
    var now = Date.now();
    if (now < start) return 'planned';
    if (now > end) return 'ended';
    return 'running';
  }

  function demoQuiz() { return XBOI.quiz.demo; }

  function demoAttempt(quizId, memberId) {
    var hit = null;
    demoQuiz().attempts.forEach(function (a) {
      if (String(a.quiz_id) === String(quizId) && String(a.member_id) === String(memberId)) hit = a;
    });
    return hit;
  }

  // 某人某场的最终结果（前端展示用）
  function quizRowFor(q, memberId) {
    var d = demoQuiz();
    var a = demoAttempt(q.id, memberId);
    var qs = d.questionsOf(q.id);
    var full = 0;
    qs.forEach(function (x) { full += Number(x.score) || 0; });
    return {
      out_id: q.id,
      out_name: q.name,
      out_description: q.description,
      out_start_at: q.start_at,
      out_ends_at: new Date(new Date(q.start_at).getTime() + q.duration_minutes * 60000).toISOString(),
      out_multiplier: q.multiplier,
      out_question_count: qs.length,
      out_full_score: full,
      out_phase: quizPhase(q),
      out_my_submitted: !!(a && a.submitted_at),
      out_my_raw: a ? a.raw_score : null,
      out_my_final: a ? a.final_score : null,
      out_my_correct: a ? a.correct_count : null
    };
  }

  // 成员：答题赛列表
  function quizList() {
    if (demo) {
      var m = demoMemberOfToken(readToken());
      if (!m) return fail('请先登录');
      return ok(demoQuiz().contests
        .filter(function (q) { return q.published; })
        .map(function (q) { return quizRowFor(q, m.id); })
        .sort(function (a, b) { return new Date(b.out_start_at) - new Date(a.out_start_at); }));
    }
    return rpc('quiz_list', { p_token: readToken() });
  }

  // 成员：取题面（不含答案）
  function quizTake(quizId) {
    if (demo) {
      var m = demoMemberOfToken(readToken());
      if (!m) return fail('请先登录');
      if (m.status !== 'active') return fail('当前不在队，不能参加答题');

      var q = null;
      demoQuiz().contests.forEach(function (x) { if (String(x.id) === String(quizId)) q = x; });
      if (!q || !q.published) return fail('答题赛不存在或未开放');

      var phase = quizPhase(q);
      if (phase === 'planned') return fail('还没到开赛时间');
      if (phase === 'ended') return fail('这场答题已经结束了');

      var a = demoAttempt(q.id, m.id);
      if (a && a.submitted_at) return fail('这张卷你已经交过了');

      if (!a) {
        demoQuiz().attempts.push({
          id: demoQuiz().nextId(), quiz_id: q.id, member_id: m.id,
          raw_score: 0, multiplier: Number(q.multiplier) || 1, final_score: 0,
          correct_count: 0, total_count: 0,
          started_at: new Date().toISOString(), submitted_at: null
        });
      }

      return ok({
        quiz: {
          id: q.id, name: q.name, description: q.description,
          multiplier: q.multiplier, start_at: q.start_at,
          ends_at: new Date(new Date(q.start_at).getTime() + q.duration_minutes * 60000).toISOString()
        },
        questions: demoQuiz().questionsOf(q.id).map(function (x) {
          return { id: x.id, qtype: x.qtype, stem: x.stem, options: x.options || [], score: x.score };
        })
      });
    }
    return rpcRow('quiz_take', { p_token: readToken(), p_quiz_id: quizId });
  }

  // 成员：交卷（服务端判分并结算）
  function quizSubmit(quizId, answers) {
    if (demo) {
      var m = demoMemberOfToken(readToken());
      if (!m) return fail('请先登录');
      if (m.status !== 'active') return fail('当前不在队，不能交卷');

      var q = null;
      demoQuiz().contests.forEach(function (x) { if (String(x.id) === String(quizId)) q = x; });
      if (!q || !q.published) return fail('答题赛不存在或未开放');

      var phase = quizPhase(q);
      if (phase === 'planned') return fail('还没到开赛时间');
      if (phase === 'ended') return fail('这场答题已经结束了，交卷时间已过');

      var a = demoAttempt(q.id, m.id);
      if (a && a.submitted_at) return fail('这张卷你已经交过了');

      // 没打开过卷子就直接交的（比如接口被直接调用），这里补一条草稿
      if (!a) {
        a = {
          id: demoQuiz().nextId(), quiz_id: q.id, member_id: m.id,
          raw_score: 0, multiplier: Number(q.multiplier) || 1, final_score: 0,
          correct_count: 0, total_count: 0,
          started_at: new Date().toISOString(), submitted_at: null
        };
        demoQuiz().attempts.push(a);
      }

      var map = {};
      (answers || []).forEach(function (x) { map[String(x.id)] = x.answer; });

      var raw = 0, correct = 0, total = 0, details = [];
      demoQuiz().questionsOf(q.id).forEach(function (qq) {
        total += 1;
        var given = map[String(qq.id)] === undefined ? '' : String(map[String(qq.id)]);
        var isRight = XBOI.quiz.gradeOne(qq.qtype, qq.answer, given);
        if (isRight) { raw += Number(qq.score) || 0; correct += 1; }
        details.push({ id: qq.id, given: given, correct: isRight, earned: isRight ? qq.score : 0 });
      });

      var mult = Number(q.multiplier) || 1;
      var finalScore = Math.round(raw * mult);

      a.raw_score = raw;
      a.multiplier = mult;
      a.final_score = finalScore;
      a.correct_count = correct;
      a.total_count = total;
      a.answers = answers || [];
      a.submitted_at = new Date().toISOString();

      if (finalScore !== 0) {
        XBOI.mock.transactions.push({
          id: 'quiz-' + Date.now(),
          member_id: m.id,
          amount: finalScore,
          category: 'quiz',
          reason: '答题赛「' + q.name + '」卷面 ' + raw + ' 分 × 倍率 ' + mult + ' = ' + finalScore + ' X 币',
          created_at: a.submitted_at
        });
      }

      return ok({
        raw_score: raw, multiplier: mult, final_score: finalScore,
        correct_count: correct, total_count: total, details: details
      });
    }
    return rpcRow('quiz_submit', {
      p_token: readToken(), p_quiz_id: quizId, p_answers: answers || []
    });
  }

  // 管理端：答题赛列表
  function adminQuizList() {
    if (demo) {
      return ok(demoQuiz().contests.map(function (q) {
        var qs = demoQuiz().questionsOf(q.id);
        var full = 0;
        qs.forEach(function (x) { full += Number(x.score) || 0; });
        var submitted = demoQuiz().attempts.filter(function (a) {
          return String(a.quiz_id) === String(q.id) && a.submitted_at;
        }).length;
        return {
          out_id: q.id, out_name: q.name, out_description: q.description,
          out_start_at: q.start_at, out_duration_minutes: q.duration_minutes,
          out_ends_at: new Date(new Date(q.start_at).getTime() + q.duration_minutes * 60000).toISOString(),
          out_multiplier: q.multiplier, out_published: q.published,
          out_question_count: qs.length, out_full_score: full,
          out_attempt_count: submitted, out_phase: quizPhase(q)
        };
      }).sort(function (a, b) { return new Date(b.out_start_at) - new Date(a.out_start_at); }));
    }
    return rpc('admin_quiz_list', { p_token: readToken() });
  }

  function adminUpsertQuiz(q) {
    var payload = {
      name: String(q.name || '').trim(),
      description: q.description || null,
      start_at: q.start_at || null,
      duration_minutes: parseInt(q.duration_minutes, 10),
      multiplier: Number(q.multiplier),
      published: q.published !== false
    };
    if (!payload.name) return fail('答题赛名称不能为空');
    if (!payload.start_at) return fail('请设置开赛时间');
    if (!payload.duration_minutes || payload.duration_minutes <= 0) return fail('作答时长必须大于 0 分钟');
    if (isNaN(payload.multiplier) || payload.multiplier < 0) return fail('积分倍率不能是负数');

    if (demo) {
      if (q.id) {
        var hit = null;
        demoQuiz().contests.forEach(function (x) { if (String(x.id) === String(q.id)) hit = x; });
        if (!hit) return fail('答题赛不存在');
        for (var k in payload) hit[k] = payload[k];
        return ok(hit.id);
      }
      var id = demoQuiz().nextId();
      demoQuiz().contests.push({
        id: id, name: payload.name, description: payload.description,
        start_at: payload.start_at, duration_minutes: payload.duration_minutes,
        multiplier: payload.multiplier, published: payload.published
      });
      return ok(id);
    }
    return rpc('admin_upsert_quiz', {
      p_token: readToken(),
      p_id: q.id || null,
      p_name: payload.name,
      p_description: payload.description,
      p_start_at: payload.start_at,
      p_duration_minutes: payload.duration_minutes,
      p_multiplier: payload.multiplier,
      p_published: payload.published
    });
  }

  function adminDeleteQuiz(id) {
    if (demo) {
      demoQuiz().contests = demoQuiz().contests.filter(function (q) { return String(q.id) !== String(id); });
      demoQuiz().questions = demoQuiz().questions.filter(function (q) { return String(q.quiz_id) !== String(id); });
      demoQuiz().attempts = demoQuiz().attempts.filter(function (a) { return String(a.quiz_id) !== String(id); });
      return ok(true);
    }
    return rpc('admin_delete_quiz', { p_token: readToken(), p_id: id });
  }

  function adminQuizQuestions(quizId) {
    if (demo) return ok(demoQuiz().questionsOf(quizId));
    return rpc('admin_quiz_questions', { p_token: readToken(), p_quiz_id: quizId })
      .then(function (v) { return v || []; });
  }

  function adminUpsertQuestion(q) {
    var payload = {
      quiz_id: q.quiz_id,
      qtype: q.qtype || 'choice',
      stem: String(q.stem || '').trim(),
      options: q.qtype === 'choice' ? (q.options || []) : null,
      answer: String(q.answer || '').trim(),
      score: parseInt(q.score, 10),
      sort_order: parseInt(q.sort_order, 10) || 0
    };
    if (!payload.quiz_id) return fail('请先选择是哪一场答题赛');
    if (!payload.stem) return fail('题干不能为空');
    if (!payload.answer) return fail('答案不能为空');
    if (isNaN(payload.score) || payload.score < 0) return fail('分值不能是负数');

    if (payload.qtype === 'choice') {
      var opts = (payload.options || []).filter(function (o) { return String(o).trim() !== ''; });
      if (opts.length < 2) return fail('选择题至少要填两个选项');
      payload.options = opts;
      if (payload.answer.toUpperCase().charCodeAt(0) - 65 >= opts.length) {
        return fail('答案超出了选项范围');
      }
      payload.answer = payload.answer.toUpperCase();
    }

    if (demo) {
      if (q.id) {
        var hit = null;
        demoQuiz().questions.forEach(function (x) { if (String(x.id) === String(q.id)) hit = x; });
        if (!hit) return fail('题目不存在');
        for (var k in payload) hit[k] = payload[k];
        hit.options = payload.options || [];
        return ok(hit.id);
      }
      var row = { id: demoQuiz().nextId() };
      for (var k2 in payload) row[k2] = payload[k2];
      row.options = payload.options || [];
      demoQuiz().questions.push(row);
      return ok(row.id);
    }
    return rpc('admin_upsert_question', {
      p_token: readToken(),
      p_id: q.id || null,
      p_quiz_id: payload.quiz_id,
      p_qtype: payload.qtype,
      p_stem: payload.stem,
      p_options: payload.options || [],
      p_answer: payload.answer,
      p_score: payload.score,
      p_sort_order: payload.sort_order
    });
  }

  function adminDeleteQuestion(id) {
    if (demo) {
      demoQuiz().questions = demoQuiz().questions.filter(function (q) { return String(q.id) !== String(id); });
      return ok(true);
    }
    return rpc('admin_delete_question', { p_token: readToken(), p_id: id });
  }

  function adminQuizAttempts(quizId) {
    if (demo) {
      return ok(demoQuiz().attempts
        .filter(function (a) { return String(a.quiz_id) === String(quizId) && a.submitted_at; })
        .map(function (a) {
          var m = XBOI.mock.memberById(a.member_id);
          return {
            out_member_id: a.member_id,
            out_luogu_name: m ? m.luogu_name : '—',
            out_display_name: m ? m.display_name : '',
            out_raw_score: a.raw_score, out_multiplier: a.multiplier,
            out_final_score: a.final_score, out_correct: a.correct_count,
            out_total: a.total_count, out_started_at: a.started_at,
            out_submitted_at: a.submitted_at
          };
        })
        .sort(function (a, b) { return b.out_final_score - a.out_final_score; }));
    }
    return rpc('admin_quiz_attempts', { p_token: readToken(), p_quiz_id: quizId });
  }

  return {
    isDemo: function () { return demo; },
    token: readToken,
    // 登录
    memberLogin: memberLogin,
    memberMe: memberMe,
    memberLogout: memberLogout,
    memberChangePassword: memberChangePassword,
    // 查询
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
    // 道具
    listItems: listItems,
    getRedemptions: getRedemptions,
    listAllRedemptions: listAllRedemptions,
    redeem: redeem,
    markRedemptionUsed: markRedemptionUsed,
    // 答题
    quizPhase: quizPhase,
    quizList: quizList,
    quizTake: quizTake,
    quizSubmit: quizSubmit,
    adminQuizList: adminQuizList,
    adminUpsertQuiz: adminUpsertQuiz,
    adminDeleteQuiz: adminDeleteQuiz,
    adminQuizQuestions: adminQuizQuestions,
    adminUpsertQuestion: adminUpsertQuestion,
    adminDeleteQuestion: adminDeleteQuestion,
    adminQuizAttempts: adminQuizAttempts,
    // 管理端
    upsertMember: upsertMember,
    deleteMember: deleteMember,
    addTransaction: addTransaction,
    deleteTransaction: deleteTransaction,
    upsertContest: upsertContest,
    deleteContest: deleteContest,
    upsertResult: upsertResult,
    deleteResult: deleteResult
  };
})();
