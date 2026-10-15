export const JOURNEY_PROFILES: Record<
  string,
  { aliases: string[]; attributes: Record<string, string> }
> = {
  wukong: {
    aliases: ['美猴王', '齐天大圣', '孙行者'],
    attributes: {
      出身: '花果山水帘洞',
      师承: '菩提祖师；唐僧',
      兵器: '如意金箍棒',
      主要经历: '学艺、闹天宫、护送取经',
    },
  },
  tangseng: {
    aliases: ['唐三藏', '玄奘'],
    attributes: { 身份: '取经僧人', 使命: '前往西天求取真经', 相关物品: '锦襕袈裟、九环锡杖' },
  },
  bajie: {
    aliases: ['猪悟能', '天蓬元帅'],
    attributes: { 前身: '天蓬元帅', 兵器: '九齿钉耙', 相关地点: '高老庄' },
  },
  shaseng: {
    aliases: ['沙悟净', '沙和尚'],
    attributes: { 前身: '卷帘大将', 相关地点: '流沙河', 身份: '取经团队成员' },
  },
  bailongma: {
    aliases: ['小白龙'],
    attributes: { 出身: '西海龙宫', 相关地点: '鹰愁涧', 职责: '化作白马驮负唐僧' },
  },
  puti: {
    aliases: ['须菩提祖师'],
    attributes: { 居所: '灵台方寸山、斜月三星洞', 身份: '孙悟空的授业师父' },
  },
  guanyin: {
    aliases: ['观世音菩萨'],
    attributes: { 居所: '南海普陀山', 职责: '安排取经并救助取经团队' },
  },
  rulai: { aliases: ['如来'], attributes: { 居所: '灵山', 相关事件: '五行山镇压、辨认六耳猕猴' } },
  yudi: { aliases: ['玉帝'], attributes: { 身份: '天庭之主', 相关事件: '招安孙悟空、天庭征讨' } },
  laojun: { aliases: ['老君'], attributes: { 居所: '兜率宫', 相关物品: '八卦炉、金刚琢' } },
  taibai: { aliases: ['太白金星'], attributes: { 身份: '天庭使者', 相关事件: '招安孙悟空' } },
  erlang: { aliases: ['二郎显圣真君'], attributes: { 居所: '灌江口', 相关事件: '与孙悟空斗法' } },
  donghai: { aliases: ['敖广'], attributes: { 居所: '东海龙宫', 相关物品: '定海神珍铁' } },
  zhenyuan: { aliases: ['镇元子'], attributes: { 居所: '五庄观', 相关物品: '人参果树' } },
  nezha: { aliases: ['哪吒三太子'], attributes: { 父亲: '托塔李天王', 身份: '天庭将领' } },
  lijing: { aliases: ['李靖'], attributes: { 身份: '天庭将领', 子嗣: '哪吒' } },
  niumowang: {
    aliases: ['平天大圣'],
    attributes: { 妻子: '铁扇公主', 儿子: '红孩儿', 相关事件: '结义、火焰山争斗' },
  },
  tieshan: {
    aliases: ['罗刹女'],
    attributes: { 丈夫: '牛魔王', 儿子: '红孩儿', 相关物品: '芭蕉扇' },
  },
  honghaier: {
    aliases: ['圣婴大王'],
    attributes: { 父亲: '牛魔王', 母亲: '铁扇公主', 本领: '三昧真火' },
  },
  baigujing: {
    aliases: ['白骨夫人'],
    attributes: { 相关地点: '白虎岭', 相关事件: '三次变化接近唐僧' },
  },
  huangfeng: { aliases: ['黄风大圣'], attributes: { 相关地点: '黄风岭', 本领: '三昧神风' } },
  heixiong: {
    aliases: ['黑风大王'],
    attributes: { 相关地点: '黑风山', 相关事件: '盗取袈裟、被观音收伏' },
  },
  jinjiao: {
    aliases: ['金角大王'],
    attributes: { 相关地点: '平顶山莲花洞', 原来身份: '太上老君的童子' },
  },
  yinjiao: {
    aliases: ['银角大王'],
    attributes: { 相关地点: '平顶山莲花洞', 原来身份: '太上老君的童子' },
  },
  qingniu: {
    aliases: ['独角兕大王'],
    attributes: { 原来身份: '太上老君的坐骑', 相关物品: '金刚琢' },
  },
  liuer: {
    aliases: ['六耳猕猴'],
    attributes: { 相关事件: '假扮孙悟空、真假之争', 辨认者: '如来' },
  },
};
