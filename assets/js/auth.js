/* ============================================================
   登录与会话
   右上角的登录按钮、登录弹窗、改密码面板都由这里统一生成，
   页面里只要引这个脚本，再给「管理后台」加上 data-admin-only 就行。
   ============================================================ */

window.XBOI = window.XBOI || {};

XBOI.auth = (function () {

  var db = XBOI.db;
  var ui = XBOI.ui;

  var current = null;          // 当前登录成员，未登录为 null
  var stateReady = false;      // 是否已经问过服务端「我是谁」
  var pending = [];            // 等状态就绪的回调
  var listeners = [];          // 状态变化的订阅者
  var confirmResolver = null;  // 密码确认弹窗的回调

  // ------------------------------------------------------------
  //  顶栏按钮与弹窗外壳
  // ------------------------------------------------------------

  function buildSlot() {
    var bar = ui.$('.topbar-inner');
    if (!bar || ui.$('.auth-slot')) return;

    var slot = document.createElement('div');
    slot.className = 'auth-slot';
    bar.appendChild(slot);
    renderSlot();
  }

  function buildModal() {
    if (ui.$('#xboiModal')) return;
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.id = 'xboiModal';
    mask.hidden = true;
    mask.innerHTML =
      '<div class="modal-box" role="dialog" aria-modal="true">' +
        '<button class="modal-x" type="button" data-close aria-label="关闭">\u00d7</button>' +
        '<div id="xboiModalBody"></div>' +
      '</div>';
    document.body.appendChild(mask);

    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.hasAttribute('data-close')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !mask.hidden) closeModal();
    });
  }

  function openModal() { var m = ui.$('#xboiModal'); if (m) m.hidden = false; }

  function closeModal() {
    var m = ui.$('#xboiModal');
    if (m) m.hidden = true;
    if (confirmResolver) { confirmResolver(null); confirmResolver = null; }
  }

  // ------------------------------------------------------------
  //  顶栏状态
  // ------------------------------------------------------------

  function renderSlot() {
    var slot = ui.$('.auth-slot');
    if (!slot) return;

    if (current) {
      slot.innerHTML =
        '<button class="user-chip" type="button" id="authChip" title="我的账号与改密码">' +
          '<span class="user-ava">' + ui.esc(String(current.out_luogu_name).slice(0, 1).toUpperCase()) + '</span>' +
          '<span class="user-name">' + ui.esc(current.out_luogu_name) + '</span>' +
          (current.out_role === 'admin' ? '<span class="user-role">管理</span>' : '') +
        '</button>' +
        '<button class="auth-out" type="button" id="authOutBtn" title="退出登录">退出</button>';
      ui.$('#authChip').addEventListener('click', openAccount);
      ui.$('#authOutBtn').addEventListener('click', function () { logout(); });
    } else {
      slot.innerHTML = '<button class="auth-btn" type="button" id="authLoginBtn">登录</button>';
      ui.$('#authLoginBtn').addEventListener('click', function () { openLogin(); });
    }

    // 只有管理员能看到「管理后台」
    ui.$$('[data-admin-only]').forEach(function (el) {
      el.hidden = !(current && current.out_role === 'admin');
    });
  }

  // ------------------------------------------------------------
  //  登录面板
  // ------------------------------------------------------------

  function openLogin() {
    buildModal();
    var body = ui.$('#xboiModalBody');
    body.innerHTML =
      '<h2 class="modal-title">登录 XBOI</h2>' +
      '<p class="modal-sub">用你的洛谷用户名登录，初始密码是 123456。</p>' +
      '<div class="field"><label>洛谷用户名</label>' +
        '<input id="lgName" type="text" autocomplete="username" placeholder="例如 xxy150310"></div>' +
      '<div class="field"><label>密码</label>' +
        '<input id="lgPass" type="password" autocomplete="current-password" placeholder="初始密码 123456"></div>' +
      '<div id="lgErr" class="notice danger" hidden></div>' +
      '<button class="btn" type="button" id="lgBtn" style="width:100%">登录</button>' +
      '<p class="modal-tip">登录后可以随时在右上角改密码。改了密码就别用 123456 了哦～</p>';

    openModal();
    setTimeout(function () { ui.$('#lgName').focus(); }, 30);

    var submit = function () {
      var name = ui.$('#lgName').value.trim();
      var pass = ui.$('#lgPass').value;
      var err = ui.$('#lgErr');
      var btn = ui.$('#lgBtn');

      err.hidden = true;
      btn.disabled = true;
      btn.textContent = '登录中…';

      db.memberLogin(name, pass).then(function (row) {
        apply(row);
        ui.toast('欢迎回来，' + row.out_luogu_name, 'ok');
        closeModal();
        if (row.out_is_default) {
          setTimeout(function () {
            ui.toast('你还在用初始密码，记得改一下', 'err');
          }, 800);
        }
      }).catch(function (e) {
        err.textContent = e.message;
        err.hidden = false;
      }).then(function () {
        btn.disabled = false;
        btn.textContent = '登录';
      });
    };

    ui.$('#lgBtn').addEventListener('click', submit);
    body.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }

  // ------------------------------------------------------------
  //  退出登录（顶栏按钮与账号面板共用）
  // ------------------------------------------------------------

  function logout() {
    db.memberLogout().then(function () {
      apply(null);
      ui.toast('已退出登录');
      closeModal();
    }).catch(function (e) {
      // 服务端没通也要把本地状态清掉，否则页面会一直以为还登着
      apply(null);
      ui.toast('已退出登录' + (e && e.message ? '（' + e.message + '）' : ''));
      closeModal();
    });
  }

  // ------------------------------------------------------------
  //  账号面板（改密码 / 退出）
  // ------------------------------------------------------------

  function openAccount() {
    buildModal();
    var body = ui.$('#xboiModalBody');
    if (!current) return;

    body.innerHTML =
      '<h2 class="modal-title">我的账号</h2>' +
      '<div class="account" style="margin-bottom:16px">' +
        '<div class="avatar">' + ui.esc(String(current.out_luogu_name).slice(0, 1).toUpperCase()) + '</div>' +
        '<div class="who"><h2 style="font-size:18px">' + ui.esc(current.out_luogu_name) + '</h2>' +
          '<div class="sub">' + (current.out_display_name ? ui.esc(current.out_display_name) + ' · ' : '') +
            ui.colorTag(current.out_color) + ' · ' +
            (current.out_role === 'admin' ? '<span class="tag tag-pink">管理员</span>' : '<span class="tag tag-cyan">成员</span>') +
          '</div></div>' +
      '</div>' +
      (current.out_is_default
        ? '<div class="notice warn">你现在用的还是初始密码 123456，建议马上改掉。</div>'
        : '') +
      '<h3 class="modal-h3">修改密码</h3>' +
      '<div class="field"><label>原密码</label>' +
        '<input id="pwOld" type="password" autocomplete="current-password"></div>' +
      '<div class="field"><label>新密码（至少 6 位）</label>' +
        '<input id="pwNew" type="password" autocomplete="new-password"></div>' +
      '<div class="field"><label>再输一次新密码</label>' +
        '<input id="pwNew2" type="password" autocomplete="new-password"></div>' +
      '<div id="pwErr" class="notice danger" hidden></div>' +
      '<button class="btn" type="button" id="pwBtn" style="width:100%">确认修改</button>' +
      '<hr class="modal-hr">' +
      '<button class="btn ghost" type="button" id="outBtn" style="width:100%">退出登录</button>';

    openModal();

    ui.$('#pwBtn').addEventListener('click', function () {
      var oldPw = ui.$('#pwOld').value;
      var newPw = ui.$('#pwNew').value;
      var newPw2 = ui.$('#pwNew2').value;
      var err = ui.$('#pwErr');
      var btn = ui.$('#pwBtn');

      err.hidden = true;
      if (!oldPw) { err.textContent = '请填写原密码'; err.hidden = false; return; }
      if (newPw !== newPw2) { err.textContent = '两次输入的新密码不一样'; err.hidden = false; return; }

      btn.disabled = true;
      btn.textContent = '提交中…';

      db.memberChangePassword(oldPw, newPw).then(function () {
        ui.toast('密码已改好，别忘了新密码', 'ok');
        current.out_is_default = false;
        renderSlot();
        closeModal();
      }).catch(function (e) {
        err.textContent = e.message;
        err.hidden = false;
      }).then(function () {
        btn.disabled = false;
        btn.textContent = '确认修改';
      });
    });

    ui.$('#outBtn').addEventListener('click', logout);
  }

  // ------------------------------------------------------------
  //  再次输入密码确认（兑换用）
  // ------------------------------------------------------------

  function confirmPassword(title, desc) {
    buildModal();
    var body = ui.$('#xboiModalBody');

    return new Promise(function (resolve) {
      confirmResolver = resolve;

      body.innerHTML =
        '<h2 class="modal-title">' + ui.esc(title || '再确认一下') + '</h2>' +
        (desc ? '<p class="modal-sub">' + ui.esc(desc) + '</p>' : '') +
        '<div class="field"><label>输入你的密码</label>' +
          '<input id="cfPass" type="password" autocomplete="current-password" placeholder="密码"></div>' +
        '<div id="cfErr" class="notice danger" hidden></div>' +
        '<div class="auth-actions">' +
          '<button class="btn ghost" type="button" data-close>取消</button>' +
          '<button class="btn" type="button" id="cfBtn">确认</button>' +
        '</div>';

      openModal();
      setTimeout(function () { var el = ui.$('#cfPass'); if (el) el.focus(); }, 30);

      var submit = function () {
        var pw = ui.$('#cfPass').value;
        if (!pw) {
          var err = ui.$('#cfErr');
          err.textContent = '请输入密码';
          err.hidden = false;
          return;
        }
        confirmResolver = null;
        var m = ui.$('#xboiModal'); if (m) m.hidden = true;
        resolve(pw);
      };

      ui.$('#cfBtn').addEventListener('click', submit);
      body.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
    });
  }

  // ------------------------------------------------------------
  //  订阅与状态
  // ------------------------------------------------------------

  function apply(user) {
    current = user || null;
    stateReady = true;
    renderSlot();

    var waiters = pending.slice();
    pending = [];
    waiters.forEach(function (cb) { try { cb(current); } catch (e) { /* 忽略 */ } });

    listeners.forEach(function (cb) { try { cb(current); } catch (e) { /* 忽略 */ } });
  }

  // 状态就绪后回调；已经就绪就直接调
  function ready(cb) {
    if (stateReady) { cb(current); return; }
    pending.push(cb);
  }

  function onChange(cb) {
    listeners.push(cb);
    if (stateReady) cb(current);
  }

  // 没登录就先弹登录框，登录成功返回 true
  function requireLogin() {
    return new Promise(function (resolve) {
      ready(function (user) {
        if (user) { resolve(true); return; }
        openLogin();
        var off = function (u) {
          if (u) {
            var i = listeners.indexOf(off);
            if (i >= 0) listeners.splice(i, 1);
            resolve(true);
          }
        };
        listeners.push(off);
      });
    });
  }

  // ------------------------------------------------------------
  //  启动
  // ------------------------------------------------------------

  buildSlot();
  buildModal();

  db.memberMe().then(function (user) {
    apply(user);
  }).catch(function () {
    apply(null);
  });

  return {
    me: function () { return current; },
    isAdmin: function () { return !!current && current.out_role === 'admin'; },
    ready: ready,
    onChange: onChange,
    requireLogin: requireLogin,
    confirmPassword: confirmPassword,
    openLogin: openLogin,
    openAccount: openAccount
  };
})();
