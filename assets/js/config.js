/* ============================================================
   站点配置
   把下面两项换成你自己 Supabase 项目里的值即可接通后端。
   路径：Supabase 控制台 → Project Settings → API
   ＝＝＝ 没有填写时整站自动切换到演示数据 ＝＝＝
   ============================================================ */

window.XBOI = window.XBOI || {};

XBOI.config = {
  SUPABASE_URL: 'https://oxwoaakkkuvjjpahdwpx.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_eH4PBQ-j2QAWdrCShtCRaQ_GUMA68rk',

  team: {
    name: 'XBOI',
    slogan: '一起来唱歌……不对，一起来写题吧！',
    owner: 'xxy150310',
    rulesUrl: 'https://note.qninq.cn/xboi',
    qqGroup: '见群公告'
  },

  // 判断是否已经填过真实配置
  isConfigured: function () {
    var u = String(this.SUPABASE_URL || '');
    var k = String(this.SUPABASE_ANON_KEY || '');
    return u.indexOf('http') === 0 && u.indexOf('YOUR-PROJECT') < 0 &&
           k.length > 20 && k.indexOf('YOUR-ANON') < 0;
  }
};
