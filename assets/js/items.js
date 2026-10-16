/* ============================================================
   附录 1 道具表
   接上后端时这里只提供图标与演示数据；真实道具从 items 表读取
   ============================================================ */

window.XBOI = window.XBOI || {};

XBOI.items = (function () {

  // 每个道具一个线描图标，颜色继承 currentColor
  var ICONS = {
    makeup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m9 15.5 2 2 4-4"/></svg>',
    extend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    appeal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/></svg>',
    waiver: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>'
  };

  // 演示数据：与 supabase-schema.sql 里 items 表的初始内容保持一致
  var DEMO = [
    { code: 'makeup', name: '补签卡', cost: 15, valid_days: 90,
      description: '抵消 1 次周训练未打卡记录，一次记录仅可使用一张，不可叠加预存多次' },
    { code: 'extend', name: '延长卡', cost: 20, valid_days: 90,
      description: '周训练截止时间向后延长 48 小时，仅可给自己使用，一场训练只能用 1 张' },
    { code: 'appeal', name: '申诉券', cost: 25, valid_days: 90,
      description: '对比赛奖励、扣分结果发起一次复核申诉，管理员重新核对数据，申诉无理不返还道具' },
    { code: 'waiver', name: '免扣卡', cost: 40, valid_days: 90,
      description: '免除一次非作弊类的 X 币扣分，作弊处罚无法使用本卡抵消' }
  ];

  function icon(code) { return ICONS[code] || ICONS.waiver; }

  function demoList() {
    return DEMO.map(function (it, i) {
      var row = {};
      for (var k in it) row[k] = it[k];
      row.sort_order = i + 1;
      row.active = true;
      row.icon = icon(it.code);
      return row;
    });
  }

  return {
    ICONS: ICONS,
    icon: icon,
    demoList: demoList
  };
})();
