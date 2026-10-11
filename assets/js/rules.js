/* ============================================================
   附录 2 奖励规则
   比赛奖励算法集中放在这里，演示数据和后台试算器共用同一套逻辑
   ============================================================ */

window.XBOI = window.XBOI || {};

XBOI.rules = (function () {

  // 各题首 A 的 X 币：入门赛每题 10；周赛、月赛按题号 10、15、20、30
  var FIRST_BLOOD = {
    entry: [10, 10, 10, 10, 10, 10],
    week:  [10, 15, 20, 30],
    month: [10, 15, 20, 30]
  };

  // AK 奖励
  var AK_BONUS = { entry: 20, week: 50, month: 50, member: 0 };

  // 周赛、月赛前五名奖励
  var RANK_BONUS = [30, 25, 20, 15, 10];

  // 只要获得分数的额外奖励（入门赛没有这一项）
  var SCORE_BONUS = { entry: 0, week: 5, month: 5, member: 0 };

  // 成员成功办赛奖励
  var HOST_BONUS = 100;

  function problemCount(type) { return type === 'entry' ? 6 : 4; }

  function firstBloodValue(type, indexes) {
    var vals = FIRST_BLOOD[type] || [];
    var sum = 0;
    (indexes || []).forEach(function (i) { sum += vals[i - 1] || 0; });
    return sum;
  }

  /**
   * 计算一场比赛应发 X 币
   * @param {Object} o
   *   o.type              比赛类型 entry / week / month
   *   o.isAk              是否 AK
   *   o.rank              名次，没进前五传 0 或 null
   *   o.firstBloodIndexes 拿到首 A 的题号数组，例如 [1, 3]
   *   o.scored            是否拿到了分数（周赛、月赛的 +5）
   * @returns {{total:number, items:Array}}
   */
  function contestCoins(o) {
    o = o || {};
    var type = o.type || 'week';
    var items = [];

    // 1. AK 奖励
    if (o.isAk) {
      var ak = AK_BONUS[type] || 0;
      if (ak) items.push({ label: 'AK 奖励', value: ak });
    }

    // 2. 首 A 奖励，可与 AK 奖励叠加
    var fbSum = firstBloodValue(type, o.firstBloodIndexes);
    if (fbSum) {
      items.push({ label: '首 A ' + o.firstBloodIndexes.length + ' 题奖励', value: fbSum });
    }

    // 3. 排名奖励，与 AK 奖励互斥；入门赛没有排名奖励
    var rank = parseInt(o.rank, 10);
    if (!o.isAk && rank >= 1 && rank <= 5 && (type === 'week' || type === 'month')) {
      items.push({ label: '排名第 ' + rank + ' 奖励', value: RANK_BONUS[rank - 1] });
    }

    // 4. 得分奖励
    if (o.scored && (SCORE_BONUS[type] || 0)) {
      items.push({ label: '获得分数奖励', value: SCORE_BONUS[type] });
    }

    var total = 0;
    items.forEach(function (it) { total += it.value; });
    return { total: total, items: items };
  }

  return {
    FIRST_BLOOD: FIRST_BLOOD,
    AK_BONUS: AK_BONUS,
    RANK_BONUS: RANK_BONUS,
    SCORE_BONUS: SCORE_BONUS,
    HOST_BONUS: HOST_BONUS,
    problemCount: problemCount,
    contestCoins: contestCoins
  };
})();
