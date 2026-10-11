# XBOI 团队分数站

洛谷团队 XBOI 的分数与 X 币查询站点。前端是纯静态多页面（零构建），后端用 Supabase。

```
XBOI/
├─ index.html              首页
├─ leaderboard.html        排行榜
├─ query.html              X 币查询
├─ admin.html              管理后台
├─ supabase-schema.sql     数据库建表脚本（在 Supabase 控制台执行一次）
├─ README.md               本文件
└─ assets/
   ├─ css/style.css        主题样式（天依蓝青）
   └─ js/
      ├─ config.js         ← 只有这个文件需要你改
      ├─ rules.js          附录 2 奖励算法
      ├─ mock.js           演示数据（未配置后端时使用）
      ├─ ui.js             公共界面工具
      ├─ db.js             数据访问层
      ├─ page-index.js
      ├─ page-leaderboard.js
      ├─ page-query.js
      └─ page-admin.js
```

> 没有配置 Supabase 时整站自动进入演示数据模式，可以直接打开看效果；填好配置后自动切换到真实数据。

---

## 第一步：建 Supabase 项目

1. 打开 <https://supabase.com>，注册并新建一个项目（区域选离你近的，例如新加坡）。
2. 等数据库初始化完成，进入左侧 **SQL Editor → New query**。
3. 把 `supabase-schema.sql` 的内容整段粘贴进去，点 **Run**。
   执行成功后会生成 4 张表、2 个统计视图和对应的权限策略。

## 第二步：创建管理员账号

左侧 **Authentication → Users → Add user → Create new user**，填一个邮箱和密码，勾选自动确认邮箱。

> 谁能登录谁就能改数据，所以只给需要管理权限的人建账号。

## 第三步：填配置

左侧 **Project Settings → API**，复制两个值，填进 `assets/js/config.js`：

```js
SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi...',
```

`anon key` 是设计上就公开给浏览器的密钥，安全性由数据库里的行级安全策略保证，可以放心写在页面里。**不要**把 `service_role key` 填进来。

## 第四步：本地预览

在项目目录下起一个静态服务器（随便一种）：

```bash
python -m http.server 8765
# 然后浏览器打开 http://127.0.0.1:8765/
```

## 第五步：部署

整站没有任何构建步骤，把这几个文件和 `assets/` 目录原样上传到任意静态托管即可：

- **GitHub Pages**：把文件推到仓库，Settings → Pages → 选分支根目录。
- **Vercel / Cloudflare Pages / Netlify**：直接拖拽目录，框架预设选「其他 / 静态」。
- **对象存储 + CDN**：上传后把默认首页设为 `index.html`。

如果托管在自定义域名上，记得回 Supabase 的 **Authentication → URL Configuration** 把站点地址加到允许列表。

---

## 常见问题

**Q：页面底部一直显示「演示数据模式」？**
`assets/js/config.js` 里的两项还是占位值。注意 `SUPABASE_URL` 必须以 `https://` 开头，`SUPABASE_ANON_KEY` 要粘完整。

**Q：后台保存时报 `new row violates row-level security policy`？**
说明当前浏览器没有登录，或者登录的账号不是 Supabase 里创建的用户。回到后台页面点「退出登录」后重新登录。

**Q：`relation "v_leaderboard" does not exist`？**
建表脚本没有跑完整。回到 SQL Editor 把 `supabase-schema.sql` 重新整段执行一次（脚本可以重复执行）。

**Q：排行榜和查询页显示的是旧数据？**
视图是实时计算的，不需要手动刷新；如果是浏览器缓存，强刷一次（Ctrl + F5）。

**Q：想让某个成员退出但保留记录？**
在后台把该成员的「在队状态」改成「已退队」，不要直接删除。删除会连同他的全部流水和成绩一起清掉。

**Q：数据库连不上但想先给队友看页面？**
什么都不用改，保持演示模式即可，页面上的数据是内置示例。
