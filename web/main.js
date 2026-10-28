import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import {
  clampPercent,
  formatGB,
  placePopover,
  usageLevel,
} from "./pet_utils.js";

/* ============ 常量 ============ */
const STYLE_ID = "comfyui-pet-style";
const POS_KEY = "comfyui-pet-pos-v1";
const MAP_KEY = "comfyui-pet-mapping-v1";
/* 设置 id 的首段 = ComfyUI 设置里的选项卡名，中文 id 让选项卡直接显示「宠物」 */
const SIZE_KEY = "宠物.大小";
const THROW_KEY = "宠物.抛射";
const VISIBLE_KEY = "宠物.显示";
const PRE_CLEAN_KEY = "宠物.运行前清理";
const POST_CLEAN_KEY = "宠物.运行后清理";
/* 报错分析：OpenAI 兼容接口，默认 DeepSeek（地址已预填），可换豆包方舟等任意供应商 */
const AI_ENABLE_ID = "宠物.报错分析";
const AI_FILTER_ID = "宠物.报错分析过滤思维链";
const AI_BASE_ID = "宠物.报错分析地址";
const AI_KEY_ID = "宠物.报错分析密钥";
const AI_MODEL_ID = "宠物.报错分析模型";
const AI_BASE_DEFAULT = "https://api.deepseek.com";
const AI_MODEL_DEFAULT = "deepseek-chat";
/* API Key 不进 ComfyUI 设置（设置里会明文展示），单独存本地并打码输入 */
const AI_KEY_STORE = "comfyui-pet-aikey-v1";
/* 资源监控：状态栏展示，2 秒轮询一次 */
const MONITOR_KEY = "宠物.资源监控";

/* 改名后沿用旧数据：位置 / 上一代设置 id */
const LEGACY_KEYS = { [POS_KEY]: "comfyui-task-timer-pos-v1" };
const PREV_SETTING_KEYS = { [SIZE_KEY]: "Pet.Size", [THROW_KEY]: "Pet.Throw", [VISIBLE_KEY]: "Pet.Visible" };
const LEGACY_SIZE_KEY = "ComfyUI.TaskTimer.PetSize";

/* 基准边长：旧版 96px 时用户需拉到 200% 才合适，故基准翻倍，100% 即旧 200% */
const BASE_ICON = 192;

/* DSH 源码物理参数（dsh-pet config：gravity 1400 / restitution 0.78） */
const THROW_GRAVITY = 1400;
const THROW_RESTITUTION = 0.78;

let ICON_URL = "icon.jpg";
try { ICON_URL = new URL("icon.jpg", import.meta.url).href; } catch (e) { /* ignore */ }

/* 状态循环动画（可被用户映射覆盖）+ 动作池 */
const STATE_KEYS = ["idle", "running", "finished", "failed", "cleaning"];
const POOL_KEYS = ["click", "drag", "work", "random"];
const PLAN_KEYS = STATE_KEYS.concat(POOL_KEYS);
const POOL_LABELS = {
  idle: "待命", running: "运行中", finished: "运行完成", failed: "运行失败",
  cleaning: "双击清理", click: "点击回应", drag: "拖拽", work: "工作", random: "随机动作",
};
const PHASE_LABELS = { idle: "待命", running: "运行中", finished: "运行完成", failed: "运行失败", cleaning: "清理中" };

/* ---- DSH「Maid DeepSeek Whale」素材池（dsh-pet/assets/webm 全量文件名） ---- */
const CLICK_POOL = [
  "点击回应-傲娇生气", "点击回应-元气挥手", "点击回应-害羞惊讶",
  "点击回应-开心跃动", "点击回应-挠痒咯咯笑",
];
const DRAG_POOL = ["被鼠标拖拽悬空反馈"];
const WORK_POOL = [
  "工作状态-原地踱步张望", "工作状态-思考冒泡", "工作状态-清点归档",
];
const RANDOM_POOL = [
  "三球抛接", "下五子棋", "东张西望", "中秋赏月吃月饼", "优雅女仆舞",
  "余额-分文不剩", "余额-数金皱眉", "余额-袋空如洗", "余额-金袋叮当",
  "余额-钱袋如常", "余额-钱袋满溢", "偷吃零食被抓住", "写代码", "写福字",
  "凭空生花", "动物环绕", "原地专心玩魔方", "原地小憩沉眠", "原地左转奔跑",
  "原地敲击桌面互动", "原地漂浮踏步", "原地跳跃抓碎头顶物品", "原地蹲下玩玩具汽车",
  "原地重力下蹲压缩", "变鸽子", "可爱宅舞", "吃Token", "吃冰淇淋融化", "吃午餐",
  "吃大闸蟹", "吃年糕", "吃早餐", "吃晚餐", "吃汤圆", "吃白饭", "吃粽子",
  "吃糖葫芦", "吃腊八粥", "吃西瓜", "吃重阳糕", "吃长寿面", "吃青团", "吃饺子",
  "吹气球", "吹笛子", "哈欠连天", "堆雪人", "大口吃零食", "女仆屈膝礼仪",
  "小幅度原地360度旋转展示", "小提琴演奏", "悠闲哼歌", "扑克魔术", "打瞌睡被惊醒",
  "抽陀螺", "拆礼物", "插茱萸赏菊", "摇扇纳凉", "撸猫", "收红包", "放孔明灯",
  "放河灯", "放烟花", "放风筝", "整体换装试色", "是啊，吃什么", "晨间刷牙",
  "涮火锅", "深度思考碎碎念", "照镜子", "玩水枪", "玩游戏气急败坏",
  "用鲸鱼尾巴拍打地面", "碎碎念-发呆碎碎念", "碎碎念-对屏碎碎念", "碎碎念-擦桌碎碎念",
  "穿针乞巧", "舞狮头", "荡秋千", "萌化小幽灵", "蓝鲸现世",
  "蝴蝶蜜蜂环绕头顶开花", "螃蟹走路", "被吓一跳", "被落叶淹没", "装点圣诞树",
  "讨糖南瓜灯", "超大伸懒腰", "踢毽子", "轻快摇摆舞", "轻快记录", "骑木马",
];

/* 内置预设：Maid DeepSeek Whale（DSH manifest pets 条目投影） */
const BUILTIN_PET = {
  id: "maid-deepseek-whale",
  name: "Maid DeepSeek Whale",
  user: "PC2005-cloud",
  repo: "dsh-pet",
  ref: "e1ff8c1e4001878cbb80441262d530e16541f138",
  base: "dsh-pet/assets/webm",
  ext: "webm",
  files: {
    idle: ["待机呼吸休闲"],
    running: ["工作状态-忙碌点按"],
    finished: ["工作状态-雀跃庆祝"],
    failed: ["工作状态-垂头叹气冒汗"],
    cleaning: ["鲸鱼吐泡泡特效"],
    click: CLICK_POOL,
    drag: DRAG_POOL,
    work: WORK_POOL,
    random: RANDOM_POOL,
  },
};

/* ============ CSS ============ */
const CSS = `
#comfyui-pet{position:fixed;z-index:10002;user-select:none;-webkit-user-select:none;}
#comfyui-pet .dsh-status{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% - 20px);
  z-index:9;display:none;flex-direction:column;gap:0;align-items:center;max-width:min(74vw,340px);
  background:rgba(18,20,26,.85);border:1px solid rgba(36,200,219,.55);border-radius:10px;padding:3px 10px;
  color:#eafcff;font:12px/1.45 "Segoe UI","Microsoft YaHei",sans-serif;backdrop-filter:blur(4px);
  pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.35);}
#comfyui-pet.bub-below .dsh-status{bottom:auto;top:calc(100% - 20px);}
#comfyui-pet.pop-open .dsh-status,#comfyui-pet.pop-open .ai-bubble{display:none!important;}
#comfyui-pet .dsh-status .l1,#comfyui-pet .dsh-status .l2{max-width:100%;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
#comfyui-pet .dsh-status .l2{color:#ffc131;}
#comfyui-pet.finished .dsh-status{border-color:rgba(255,193,49,.7);}
#comfyui-pet.failed .dsh-status{border-color:rgba(255,110,110,.75);}
#comfyui-pet.cleaning .dsh-status{border-color:rgba(120,220,255,.8);}
#comfyui-pet .ai-bubble{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% - 18px);
  z-index:10;display:none;flex-direction:column;min-width:200px;max-width:min(76vw,400px);
  background:linear-gradient(165deg,rgba(22,30,40,.97),rgba(14,18,26,.97));border:1px solid rgba(36,200,219,.55);
  border-radius:14px;padding:9px 12px 10px;color:#eafcff;font:12px/1.65 "Segoe UI","Microsoft YaHei",sans-serif;
  backdrop-filter:blur(6px);pointer-events:none;box-shadow:0 4px 18px rgba(0,0,0,.5);}
#comfyui-pet .ai-bubble.show{display:flex;}
#comfyui-pet .ai-bubble::after{content:"";position:absolute;left:50%;bottom:-6px;width:11px;height:11px;
  transform:translateX(-50%) rotate(45deg);background:rgba(14,18,26,.97);
  border-right:1px solid rgba(36,200,219,.55);border-bottom:1px solid rgba(36,200,219,.55);}
#comfyui-pet.bub-below .ai-bubble{bottom:auto;top:calc(100% - 18px);}
#comfyui-pet.bub-below .ai-bubble::after{bottom:auto;top:-6px;border-right:none;border-bottom:none;
  border-left:1px solid rgba(36,200,219,.55);border-top:1px solid rgba(36,200,219,.55);}
#comfyui-pet .ai-bubble .ai-b-title{font-weight:600;font-size:12px;color:#24c8db;margin-bottom:4px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#comfyui-pet .ai-bubble .ai-b-body{white-space:pre-wrap;word-break:break-word;max-height:42vh;overflow:auto;
  pointer-events:auto;color:#e8f6f8;padding-right:2px;}
#comfyui-pet .dsh-icon-wrap{position:relative;width:192px;height:192px;cursor:grab;touch-action:none;transform-origin:50% 100%;}
#comfyui-pet .dsh-icon-wrap.tt-squish{animation:tt-squish .62s cubic-bezier(.28,.9,.35,1) 1;}
@keyframes tt-squish{
  0%{transform:translateY(0) scale(1,1)}
  18%{transform:translateY(7%) scale(1.14,.80)}
  40%{transform:translateY(-15%) scale(.92,1.12)}
  60%{transform:translateY(0) scale(1.05,.95)}
  78%{transform:translateY(-4%) scale(.98,1.03)}
  100%{transform:translateY(0) scale(1,1)}}
#comfyui-pet .dsh-pet{position:absolute;inset:0;width:100%;height:100%;
  object-fit:contain;pointer-events:none;opacity:0;filter:drop-shadow(0 3px 8px rgba(0,0,0,.45));}
#comfyui-pet .dsh-pet.on{opacity:1;}
#comfyui-pet .dsh-fallback{position:absolute;inset:0;z-index:1;display:none;pointer-events:none;}
#comfyui-pet.nopet .dsh-fallback{display:block;}
#comfyui-pet.nopet .dsh-pet{display:none!important;}
#comfyui-pet .dsh-fallback img{width:100%;height:100%;border-radius:50%;object-fit:cover;box-shadow:0 2px 12px rgba(0,0,0,.5);}
#comfyui-pet .dsh-fallback .dsh-circle{width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#24c8db,#ffc131);display:flex;align-items:center;justify-content:center;color:#10131a;font:700 34px/1 "Segoe UI",sans-serif;}
/* ---- 气泡面板（右键菜单 / 动作面板 / 映射菜单共用） ---- */
.pet-pop{position:fixed;z-index:10003;box-sizing:border-box;display:flex;flex-direction:column;
  background:linear-gradient(165deg,rgba(22,30,40,.98),rgba(13,17,24,.98));
  border:1px solid rgba(36,200,219,.42);border-radius:14px;color:#eafcff;
  font:12px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;
  box-shadow:0 16px 44px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.4);
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateY(var(--pop-shift,5px)) scale(.97);
  transform-origin:var(--arrow-x,50%) calc(100% + 10px);
  transition:opacity .14s ease,transform .17s cubic-bezier(.2,.8,.2,1),visibility .17s;
  will-change:transform,opacity;}
.pet-pop.show{opacity:1;visibility:visible;pointer-events:auto;transform:none;}
.pet-pop.below{transform-origin:var(--arrow-x,50%) -10px;}
.pet-pop .pet-arrow{position:absolute;left:var(--arrow-x,50%);bottom:-6px;width:10px;height:10px;
  background:#0d1118;border:1px solid rgba(36,200,219,.42);transform:translateX(-50%) rotate(45deg);
  border-top:0;border-left:0;z-index:-1;}
.pet-pop.below .pet-arrow{bottom:auto;top:-6px;border:0;
  border-top:1px solid rgba(36,200,219,.42);border-left:1px solid rgba(36,200,219,.42);}
.pet-pop .pp-head{display:flex;align-items:center;gap:7px;padding:9px 10px 6px;user-select:none;flex:none;}
.pet-pop .pp-dot{width:7px;height:7px;border-radius:50%;background:#24c8db;flex:none;
  box-shadow:0 0 8px rgba(36,200,219,.55);transition:background .2s,box-shadow .2s;}
.pet-pop .pp-dot.finished{background:#ffc131;box-shadow:0 0 8px rgba(255,193,49,.55);}
.pet-pop .pp-dot.failed{background:#ff6b6b;box-shadow:0 0 8px rgba(255,107,107,.55);}
.pet-pop .pp-dot.cleaning{background:#78dcff;box-shadow:0 0 8px rgba(120,220,255,.55);}
.pet-pop .pp-title{font-size:12px;font-weight:600;letter-spacing:.02em;color:#eafcff;white-space:nowrap;}
.pet-pop .pp-note{margin-left:auto;color:#7f929b;font-size:10.5px;white-space:nowrap;max-width:150px;
  overflow:hidden;text-overflow:ellipsis;}
.pet-pop .pp-close{margin-left:6px;width:22px;height:22px;border:0;background:none;color:#7d8f98;
  border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}
#comfyui-pet-map .pp-close{margin-left:auto;}
.pet-pop .pp-close:hover{background:rgba(255,255,255,.07);color:#fff;}
.pet-pop .pp-body{display:flex;flex-direction:column;gap:2px;padding:0 6px 7px;min-height:0;}
.pet-pop .pp-sep{height:1px;margin:5px 7px;background:rgba(255,255,255,.07);flex:none;}
.pet-mi{display:flex;align-items:center;gap:9px;width:100%;box-sizing:border-box;padding:7px 9px;
  border:0;border-radius:9px;background:none;color:#dbe8ec;cursor:pointer;text-align:left;
  font:inherit;transition:background .12s ease,color .12s ease,transform .08s ease;}
.pet-mi:hover,.pet-mi:focus-visible{background:rgba(36,200,219,.1);color:#fff;outline:none;}
.pet-mi:active{transform:scale(.985);}
.pet-mi .mi-ico{width:15px;height:15px;flex:none;color:#24c8db;opacity:.9;display:flex;}
.pet-mi .mi-ico svg{width:15px;height:15px;}
.pet-mi .mi-txt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pet-mi .mi-end{margin-left:auto;display:flex;align-items:center;gap:6px;color:#7d8f98;font-size:10.5px;}
.pet-mi > .pet-sw{margin-left:auto;}
.pet-mi .mi-chev{transition:transform .16s ease;color:#7d8f98;display:flex;}
.pet-mi.open .mi-chev{transform:rotate(90deg);}
.pet-mi[disabled]{opacity:.45;pointer-events:none;}
.pet-sw{position:relative;width:32px;height:18px;flex:none;border:0;border-radius:999px;background:#3a4249;
  cursor:pointer;padding:0;transition:background .15s ease;}
.pet-sw::after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;
  background:#cfd9dc;transition:transform .15s cubic-bezier(.2,.8,.2,1),background .15s;}
.pet-sw.on{background:#24c8db;}
.pet-sw.on::after{transform:translateX(14px);background:#08262b;}
.pet-note{display:none;padding:2px 10px 6px;color:#ffb86b;font-size:10.5px;line-height:1.35;}
.pet-note.show{display:block;}
.pet-fold{display:grid;grid-template-rows:0fr;transition:grid-template-rows .18s ease;margin:0 6px;}
.pet-fold.open{grid-template-rows:1fr;}
.pet-fold > .pet-fold-in{overflow:hidden;min-height:0;}
.pet-subrow{display:flex;align-items:center;gap:7px;padding:5px 3px;color:#b9c9cf;font-size:11px;
  cursor:pointer;border-radius:8px;user-select:none;}
.pet-subrow:hover{background:rgba(255,255,255,.04);}
.pet-subrow .pet-sw{margin-left:auto;transform:scale(.9);}
#comfyui-pet-menu{width:242px;max-height:min(86vh,560px);}
#comfyui-pet-menu .pp-body{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;}
#comfyui-pet-map{width:216px;}
#pet-actions-modal .tt-panel{width:min(500px,94vw);max-height:min(84vh,640px);display:flex;
  flex-direction:column;overflow:hidden;}
.tt-act-body{display:flex;flex-direction:column;gap:8px;min-height:0;flex:1 1 auto;}
.tt-note{font-size:10.5px;color:#7f929b;white-space:nowrap;}
.tt-hint strong{color:#9ff3ff;font-weight:600;}
.tt-btn[disabled]{opacity:.5;cursor:default;pointer-events:none;}
#pet-clean-modal .tt-panel{width:min(430px,94vw);}
#pet-clean-modal .tt-out{min-height:56px;}
.pet-search{display:flex;align-items:center;gap:7px;flex:none;background:rgba(0,0,0,.26);
  border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:6px 9px;color:#7d8f98;}
.pet-search svg{width:13px;height:13px;flex:none;}
.pet-search input{flex:1;min-width:0;background:none;border:0;outline:0;color:#e8f6f8;
  font:11.5px/1.4 "Segoe UI","Microsoft YaHei",sans-serif;}
.pet-search input::placeholder{color:#6c7e86;}
.pet-acts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;overflow-y:auto;
  min-height:58px;max-height:min(42vh,380px);padding-right:2px;overscroll-behavior:contain;align-content:start;}
.pet-acts::-webkit-scrollbar{width:6px;}
.pet-acts::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:999px;}
.pet-act{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:38px;
  padding:6px 8px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);
  border-radius:9px;color:#dfe9ec;cursor:pointer;text-align:left;font:inherit;
  content-visibility:auto;contain-intrinsic-size:auto 40px;
  transition:background .12s,border-color .12s,transform .08s;}
.pet-act:hover,.pet-act:focus-visible{background:rgba(36,200,219,.08);border-color:rgba(36,200,219,.35);outline:none;}
.pet-act:active{transform:scale(.985);}
.pet-act b{max-width:100%;font-size:11.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pet-act .mb{font-size:9.5px;color:#24c8db;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.pet-act .mb.pool{color:#8fa3ad;}
.pet-act.flash{border-color:#ffc131;background:rgba(255,193,49,.12);}
.pet-empty{grid-column:1/-1;color:#7d8f98;font-size:11.5px;padding:18px 4px;text-align:center;}
.pet-foot{display:flex;align-items:center;gap:6px;color:#6c7e86;font-size:10.5px;min-height:14px;flex:none;}
.pet-foot b{color:#9fb4bb;font-weight:500;}
/* ---- 画布状态栏资源监控（位置参照 Crystools） ---- */
#pet-sbar{display:flex;align-items:center;gap:4px;align-self:center;height:28px;flex:none;
  margin-left:2px;pointer-events:auto;user-select:none;
  font:10px/1 "Segoe UI","Microsoft YaHei",sans-serif;}
#pet-sbar .ps-item{position:relative;width:60px;height:28px;flex:none;box-sizing:border-box;
  border:1px solid var(--border-color,#4e4e4e);border-radius:6px;overflow:hidden;
  background:var(--comfy-input-bg,#222);cursor:default;}
#pet-sbar .ps-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--ps-bg,rgba(36,200,219,.42));
  transition:width .45s cubic-bezier(.2,.8,.2,1),background .25s ease;}
#pet-sbar .ps-name{position:absolute;left:5px;bottom:3px;font-size:9px;letter-spacing:.03em;
  color:var(--input-text,#ddd);opacity:.6;pointer-events:none;}
#pet-sbar .ps-val{position:absolute;right:5px;top:4px;font-size:10.5px;line-height:1;
  color:var(--input-text,#eee);font-variant-numeric:tabular-nums;pointer-events:none;
  text-shadow:0 1px 2px rgba(0,0,0,.45);}
#pet-sbar .ps-item[data-k="cpu"]{--ps-bg:rgba(36,200,219,.42);}
#pet-sbar .ps-item[data-k="ram"]{--ps-bg:rgba(91,214,162,.42);}
#pet-sbar .ps-item[data-k="gpu"]{--ps-bg:rgba(255,193,49,.45);}
#pet-sbar .ps-item[data-k="vram"]{--ps-bg:rgba(176,140,255,.45);}
#pet-sbar .ps-item[data-k="temp"] .ps-fill{
  background:linear-gradient(90deg,rgba(120,220,255,.5),rgba(255,200,90,.6) 55%,rgba(255,90,80,.72));}
#pet-sbar .ps-item.high{--ps-bg:rgba(255,159,92,.6);}
#pet-sbar .ps-item.crit{--ps-bg:rgba(255,107,107,.65);}
#pet-sbar .ps-item.temp-hot .ps-fill{background:rgba(255,90,80,.7);}
/* ---- 兼容：隐藏中文翻译插件的顶栏「翻译开启」开关 ----
   用 CSS 覆盖而不是改对方插件，升级不受影响。不能 display:none：该插件每 2 秒检查一次
   可见性（宽高为 0 会反复移除重插），所以保留 1px 尺寸、移出布局并仅做视觉隐藏。 ---- */
#toggle-translation-button{position:absolute!important;width:1px!important;height:1px!important;
  min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;
  opacity:0!important;visibility:hidden!important;overflow:hidden!important;pointer-events:none!important;
  font-size:0!important;line-height:0!important;}
/* ---- 兼容：隐藏管理器顶栏的收藏 / 释放模型 / 释放模型+缓存 / 分享 ----
   同样只做 CSS 覆盖，不改对方插件。汉化插件会改写 title / aria-label，
   所以按稳定的图标类匹配；管理器没有可见性看门狗，直接 display:none 即可。
   保留同组左侧的「管理器」按钮。 ---- */
[data-testid="top-menu-actionbars"] .comfyui-button-group > button:has(> i.mdi-star),
[data-testid="top-menu-actionbars"] .comfyui-button-group > button:has(> i.mdi-vacuum-outline),
[data-testid="top-menu-actionbars"] .comfyui-button-group > button:has(> i.mdi-vacuum),
[data-testid="top-menu-actionbars"] .comfyui-button-group > button:has(> i.mdi-share),
#shareButton{display:none!important;}
/* ---- 报错分析弹窗（与桌宠气泡同一套视觉） ---- */
.tt-modal{position:fixed;inset:0;z-index:10001;display:none;align-items:center;justify-content:center;
  background:rgba(3,6,10,.58);backdrop-filter:blur(3px);
  font:12px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;}
.tt-modal.open{display:flex;}
.tt-modal.open .tt-panel{animation:tt-pop-in .16s cubic-bezier(.2,.8,.2,1);}
@keyframes tt-pop-in{from{opacity:0;transform:translateY(6px) scale(.98);}to{opacity:1;transform:none;}}
.tt-panel{width:min(620px,94vw);max-height:84vh;overflow:auto;box-sizing:border-box;
  background:linear-gradient(165deg,rgba(22,30,40,.99),rgba(13,17,24,.99));
  border:1px solid rgba(36,200,219,.42);border-radius:14px;padding:12px 16px 16px;color:#eafcff;
  box-shadow:0 16px 44px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.4);}
.tt-panel::-webkit-scrollbar{width:8px;}
.tt-panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:999px;}
.tt-head{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:#eafcff;margin-bottom:4px;}
.tt-head .pp-dot{width:7px;height:7px;border-radius:50%;flex:none;background:#24c8db;
  box-shadow:0 0 8px rgba(36,200,219,.55);}
.tt-x{margin-left:auto;width:22px;height:22px;border:0;background:none;color:#7d8f98;
  border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;
  padding:0;font-size:16px;line-height:1;}
.tt-x:hover{background:rgba(255,255,255,.07);color:#fff;}
.tt-sec{margin:0;font-size:12px;font-weight:600;letter-spacing:.02em;color:#24c8db;}
.tt-hint{color:#7f929b;font-size:10.5px;margin:2px 0;line-height:1.55;}
.tt-row .tt-btn{margin-left:0;}
.tt-input{width:100%;box-sizing:border-box;background:rgba(0,0,0,.26);border:1px solid rgba(255,255,255,.08);
  border-radius:9px;color:#e8f6f8;padding:7px 9px;
  font:11.5px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;margin:4px 0;outline:none;
  transition:border-color .15s ease,box-shadow .15s ease;}
.tt-input::placeholder{color:#6c7e86;}
.tt-input:focus{border-color:rgba(36,200,219,.55);box-shadow:0 0 0 2px rgba(36,200,219,.12);}
.tt-row{display:flex;gap:8px;align-items:center;margin:6px 0;flex-wrap:wrap;}
.tt-check{display:inline-flex;align-items:center;gap:6px;color:#b9c9cf;font-size:11.5px;
  cursor:pointer;user-select:none;}
.tt-check input{accent-color:#24c8db;cursor:pointer;}
.tt-cfg{margin:0 0 10px;border:1px solid rgba(255,255,255,.07);border-radius:10px;
  background:rgba(0,0,0,.18);padding:2px 10px 10px;}
.tt-cfg > summary{cursor:pointer;color:#8fa3ab;font-size:11.5px;user-select:none;
  padding:7px 0;list-style:none;}
.tt-cfg > summary::-webkit-details-marker{display:none;}
.tt-cfg > summary::before{content:"▸ ";color:#24c8db;}
.tt-cfg[open] > summary{color:#9ff3ff;}
.tt-cfg[open] > summary::before{content:"▾ ";}
.tt-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#dbe8ec;
  border-radius:9px;padding:6px 12px;font:11.5px/1.2 "Segoe UI","Microsoft YaHei",sans-serif;
  cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease;}
.tt-btn:hover{background:rgba(36,200,219,.1);border-color:rgba(36,200,219,.35);color:#fff;}
.tt-btn.primary{background:rgba(36,200,219,.16);border-color:rgba(36,200,219,.45);
  color:#9ff3ff;font-weight:600;}
.tt-btn.primary:hover{background:rgba(36,200,219,.24);color:#d8fbff;}
.tt-head > .tt-btn{margin-left:auto;}
.tt-out{white-space:pre-wrap;word-break:break-word;margin:6px 0 0;color:#e8f6f8;
  background:rgba(0,0,0,.26);border:1px solid rgba(255,255,255,.07);border-radius:9px;
  padding:8px 10px;font:12px/1.6 Consolas,"Microsoft YaHei",monospace;max-height:300px;overflow:auto;}
.tt-raw{margin-top:8px;}
.tt-raw summary{cursor:pointer;color:#7f929b;font-size:11px;user-select:none;}
.tt-raw summary:hover{color:#9ff3ff;}
@media (prefers-reduced-motion: reduce){
  .pet-pop,.pet-pop *,.ps-fill,.pet-sw::after,.tt-modal.open .tt-panel{
    transition:none!important;animation:none!important;}
}
`;

/* ============ 通用工具 ============ */
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}
function dedupe(a) { return a.filter((x, i) => a.indexOf(x) === i); }
function withExt(name, ext) { return /\.\w{2,5}$/.test(name) ? name : `${name}.${ext || "webm"}`; }
function stripExt(n) { return String(n).replace(/\.\w{2,5}$/, ""); }
function pickOne(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
function lsRead(key) {
  try {
    let v = localStorage.getItem(key);
    if (v == null && LEGACY_KEYS[key]) {
      v = localStorage.getItem(LEGACY_KEYS[key]);
      if (v != null) localStorage.setItem(key, v);
    }
    return v;
  } catch (e) { return null; }
}
function lsWrite(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* ignore */ } }

/* ============ 图标 / 仪表 ============ */
const ICONS = {
  play: '<path d="M5.5 3.6v8.8L12.5 8z"/>',
  spark: '<path d="M8 1.8l1.2 3.9L13 7l-3.8 1.3L8 12.2 6.8 8.3 3 7l3.8-1.3z"/>',
  gauge: '<circle cx="8" cy="8" r="5.2"/><path d="M8 8l2.6-2.2"/><path d="M2.8 12.6a6.4 6.4 0 0 1 10.4 0"/>',
  clean: '<path d="M4 6h8l-1 7H5z"/><path d="M6 6V4.5A1.5 1.5 0 0 1 7.5 3h1A1.5 1.5 0 0 1 10 4.5V6"/><path d="M2.5 6h11"/>',
  eyeoff: '<path d="M2 2l12 12"/><path d="M6.7 4.3A6.6 6.6 0 0 1 8 4c4 0 6.2 4 6.2 4a10 10 0 0 1-1.7 2.2"/><path d="M4.6 5.4C3 6.7 1.8 8 1.8 8S4 12 8 12c.9 0 1.7-.2 2.4-.5"/><path d="M6.5 8.5a2.1 2.1 0 0 0 2.9 2.9"/>',
  search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2L14 14"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  chev: '<path d="M6 3.5L10.5 8 6 12.5"/>',
  check: '<path d="M3.5 8.5l3 3 6-7"/>',
  monitor: '<path d="M2.5 3.5h11v8h-11z"/><path d="M5 13.5h6"/><path d="M6 9l1.8-2.2L9.4 8l1.8-2.5"/>',
};
function iconEl(name) {
  const s = el("span", "mi-ico");
  s.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
  return s;
}
function makeBarMeter(k, label) {
  const row = el("div", "ps-item");
  row.dataset.k = k;
  const fill = el("i", "ps-fill");
  const val = el("span", "ps-val", "--");
  row.appendChild(fill);
  row.appendChild(el("span", "ps-name", label));
  row.appendChild(val);
  return { row, fill, val };
}
function setBarMeter(meter, pct, text, title, kind) {
  const p = clampPercent(pct);
  if (p == null) {
    meter.row.style.display = "none";
    return;
  }
  meter.row.style.display = "";
  meter.fill.style.width = p.toFixed(1) + "%";
  meter.val.textContent = text != null ? text : Math.round(p) + "%";
  const level = usageLevel(p);
  const isTemp = kind === "temp";
  meter.row.classList.toggle("high", !isTemp && level === "high");
  meter.row.classList.toggle("crit", !isTemp && level === "crit");
  meter.row.classList.toggle("temp-hot", isTemp && p >= 80);
  meter.row.title = title || "";
}

/* 内置鲸鱼娘素材地址：优先固定版本，jsDelivr 失败再逐个回退 raw / main / master */
function assetUrls(file) {
  const p = encodeURI(`${BUILTIN_PET.base}/${file}`);
  const out = [];
  const js = (r) => `https://cdn.jsdelivr.net/gh/${BUILTIN_PET.user}/${BUILTIN_PET.repo}@${r}/${p}`;
  const raw = (r) => `https://raw.githubusercontent.com/${BUILTIN_PET.user}/${BUILTIN_PET.repo}/${r}/${p}`;
  if (BUILTIN_PET.ref) out.push(js(BUILTIN_PET.ref), raw(BUILTIN_PET.ref));
  out.push(js("main"), js("master"), raw("HEAD"), raw("main"), raw("master"));
  return dedupe(out);
}

/* ============ 扩展主体 ============ */
app.registerExtension({
  name: "Comfyui-Pet",

  init(app) {
    if (!document.getElementById(STYLE_ID)) {
      const st = el("style"); st.id = STYLE_ID; st.textContent = CSS;
      document.head.appendChild(st);
    }

    /* ---- DOM ---- */
    const root = el("div"); root.id = "comfyui-pet";
    const bubble = el("div", "dsh-status");
    const l1 = el("div", "l1"); const l2 = el("div", "l2");
    bubble.appendChild(l1); bubble.appendChild(l2);
    const wrap = el("div", "dsh-icon-wrap");

    /* 三层视频：两个循环缓冲（后台预加载后再切换，杜绝黑帧闪烁）+ 一个单次动作层 */
    function mkVideo(loop, z) {
      const v = el("video", "dsh-pet");
      v.muted = true; v.loop = !!loop; v.playsInline = true; v.preload = "auto";
      v.setAttribute("muted", "");
      v.style.zIndex = String(z);
      return v;
    }
    const loopA = mkVideo(true, 2);
    const loopB = mkVideo(true, 3);
    const onceV = mkVideo(false, 6);
    const fallback = el("div", "dsh-fallback");
    const fbImg = el("img"); fbImg.src = ICON_URL; fbImg.alt = "";
    fbImg.addEventListener("error", () => { fallback.innerHTML = ""; fallback.appendChild(el("div", "dsh-circle", "DSH")); });
    fallback.appendChild(fbImg);
    wrap.appendChild(loopA); wrap.appendChild(loopB); wrap.appendChild(onceV);
    wrap.appendChild(fallback);
    root.appendChild(bubble); root.appendChild(wrap);
    /* 报错分析气泡：悬浮在宠物上方，左键点宠物即可关闭 */
    const aiBubble = el("div", "ai-bubble");
    const aiTitle = el("div", "ai-b-title", "报错分析");
    const aiBody = el("div", "ai-b-body");
    aiBubble.appendChild(aiTitle); aiBubble.appendChild(aiBody);
    root.appendChild(aiBubble);
    document.body.appendChild(root);

    /* ---- 画布状态栏资源监控（运行时挂到运行按钮 / 管理器的同一栏） ---- */
    const statusBar = el("div"); statusBar.id = "pet-sbar";
    statusBar.style.display = "none";
    const sbM = {};
    for (const [k, label] of [["cpu", "CPU"], ["ram", "内存"], ["gpu", "GPU"], ["vram", "显存"], ["temp", "温度"]]) {
      sbM[k] = makeBarMeter(k, label);
      statusBar.appendChild(sbM[k].row);
    }

    /* ---- 右键气泡菜单 ---- */
    const menu = el("div", "pet-pop"); menu.id = "comfyui-pet-menu";
    const menuArrow = el("div", "pet-arrow");
    const menuHead = el("div", "pp-head");
    const menuDot = el("span", "pp-dot");
    const menuTitle = el("span", "pp-title", "桌宠");
    const menuPhase = el("span", "pp-note", "待命");
    const menuClose = el("button", "pp-close"); menuClose.type = "button";
    menuClose.appendChild(iconEl("close"));
    menuHead.appendChild(menuDot); menuHead.appendChild(menuTitle);
    menuHead.appendChild(menuPhase); menuHead.appendChild(menuClose);
    const menuBody = el("div", "pp-body");

    function mi(icon, text, fn) {
      const row = el("div", "pet-mi");
      row.setAttribute("role", "button"); row.tabIndex = 0;
      row.appendChild(iconEl(icon));
      row.appendChild(el("span", "mi-txt", text));
      const run = (e) => { if (e) e.stopPropagation(); if (fn) fn(e); };
      row.addEventListener("click", run);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(e); }
      });
      return row;
    }
    function mkSwitch(on) {
      const sw = el("button", "pet-sw"); sw.type = "button";
      sw.classList.toggle("on", !!on);
      return sw;
    }
    function watchSwitch(sw, fn) {
      sw.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    }

    const miActions = mi("play", "动作选项", () => { closePops(); openActionPanel(); });
    const miError = mi("spark", "报错分析", () => { closePops(); openErrModal(); });

    const monRow = mi("monitor", "资源监控", () => toggleMonitor());
    const monSwitch = mkSwitch(false);
    monRow.appendChild(monSwitch);
    watchSwitch(monSwitch, () => toggleMonitor());

    const monErr = el("div", "pet-note", "监控接口未就绪，重启 ComfyUI 后生效");

    const cleanHead = mi("clean", "清理缓存", () => { cleanFolded = !cleanFolded; syncMenuState(); });
    const cleanEnd = el("span", "mi-end mi-chev");
    cleanEnd.appendChild(iconEl("chev"));
    cleanHead.appendChild(cleanEnd);
    const cleanFold = el("div", "pet-fold");
    const cleanFoldIn = el("div", "pet-fold-in");
    function subRow(text, getVal, toggle) {
      const row = el("div", "pet-subrow");
      row.setAttribute("role", "button"); row.tabIndex = 0;
      row.appendChild(el("span", null, text));
      const sw = mkSwitch(getVal());
      row.appendChild(sw);
      const run = (e) => { if (e) e.stopPropagation(); toggle(); syncMenuState(); };
      row.addEventListener("click", run);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(e); }
      });
      watchSwitch(sw, run);
      return row;
    }
    const preRow = subRow("运行前清理", () => getSetting(PRE_CLEAN_KEY, false),
      () => setSettingValue(PRE_CLEAN_KEY, !getSetting(PRE_CLEAN_KEY, false)));
    const postRow = subRow("运行后清理", () => getSetting(POST_CLEAN_KEY, false),
      () => setSettingValue(POST_CLEAN_KEY, !getSetting(POST_CLEAN_KEY, false)));
    const miCleanNow = mi("clean", "立即清理一次", () => { closePops(); openCleanModal(); });
    cleanFoldIn.appendChild(preRow); cleanFoldIn.appendChild(postRow); cleanFoldIn.appendChild(miCleanNow);
    cleanFold.appendChild(cleanFoldIn);
    const hideRow = mi("eyeoff", "隐藏宠物", () => { closePops(); setSettingValue(VISIBLE_KEY, false); });

    menuBody.appendChild(miActions);
    menuBody.appendChild(miError);
    menuBody.appendChild(el("div", "pp-sep"));
    menuBody.appendChild(monRow);
    menuBody.appendChild(monErr);
    menuBody.appendChild(el("div", "pp-sep"));
    menuBody.appendChild(cleanHead);
    menuBody.appendChild(cleanFold);
    menuBody.appendChild(el("div", "pp-sep"));
    menuBody.appendChild(hideRow);
    menu.appendChild(menuArrow); menu.appendChild(menuHead); menu.appendChild(menuBody);
    document.body.appendChild(menu);

    /* ---- 动作选择（居中模态：搜索 + 全部动作 + 分批渲染） ---- */
    const actionModal = makeModal("动作选项", (panel) => {
      const body = el("div", "tt-act-body");
      const searchWrap = el("div", "pet-search");
      searchWrap.appendChild(iconEl("search"));
      const search = el("input");
      search.type = "search"; search.placeholder = "搜索动作…"; search.autocomplete = "off";
      searchWrap.appendChild(search);
      body.appendChild(searchWrap);
      body.appendChild(el("div", "pet-acts"));
      body.appendChild(el("div", "pet-foot", "左键预览一次 · 右键设为状态动画"));
      panel.appendChild(body);
    });
    actionModal.id = "pet-actions-modal";
    const apSearch = actionModal.querySelector(".pet-search input");
    const apGrid = actionModal.querySelector(".pet-acts");
    const apFoot = actionModal.querySelector(".pet-foot");
    const apCount = el("span", "tt-note", "");
    actionModal.querySelector(".tt-head").insertBefore(
      apCount, actionModal.querySelector(".tt-x"));

    /* ---- 动作 → 状态映射气泡 ---- */
    const mapPop = el("div", "pet-pop"); mapPop.id = "comfyui-pet-map";
    const mapArrow = el("div", "pet-arrow");
    const mapHead = el("div", "pp-head");
    const mapTitle = el("span", "pp-title", "设为状态动画");
    const mapClose = el("button", "pp-close"); mapClose.type = "button";
    mapClose.appendChild(iconEl("close"));
    mapHead.appendChild(mapTitle); mapHead.appendChild(mapClose);
    const mapBody = el("div", "pp-body");
    mapPop.appendChild(mapArrow); mapPop.appendChild(mapHead); mapPop.appendChild(mapBody);
    document.body.appendChild(mapPop);

    /* ---- 监控 / 菜单状态 ---- */
    let monitorOn = false, monitorStats = null;
    let monitorTimer = 0, monitorBusy = false, monitorFails = 0, monitorError = false;
    let cleanFolded = false;
    let apQuery = "", apToken = 0, apSearchTimer = 0;

    /* ---- 运行状态 ---- */
    let phase = "idle";
    let busy = false, startTime = 0, lastTotal = 0, currentStep = "准备中", pct = null;
    let cleanText = "", endTimer = 0, postCleanTimer = 0;
    let throwOn = true;
    let pos = { x: innerWidth - 230, y: innerHeight - 280 };
    try { pos = JSON.parse(lsRead(POS_KEY) || "null") || pos; } catch (e) { /* ignore */ }

    /* ---- 素材清单：内置鲸鱼娘 → 圆形头像兜底 ---- */
    let mapping = {};          /* 状态 -> 指定动作文件名 */
    try { mapping = JSON.parse(localStorage.getItem(MAP_KEY) || "null") || {}; } catch (e) { mapping = {}; }
    let plan = {};             /* key -> [{name,type,urls:[],pool}] */

    function rebuildPlan() {
      plan = {};
      for (const k of PLAN_KEYS) {
        plan[k] = (BUILTIN_PET.files[k] || []).map((n) => {
          const file = withExt(n, BUILTIN_PET.ext);
          return { name: file, type: "video", urls: assetUrls(file), pool: k };
        });
      }
      /* 用户映射：把指定动作提到该状态的首位（其余仍作为加载失败的候补） */
      const byName = {};
      for (const k of PLAN_KEYS) for (const s of plan[k]) if (!byName[s.name]) byName[s.name] = s;
      for (const st of STATE_KEYS) {
        const src = mapping[st] && byName[mapping[st]];
        if (src) plan[st] = [src].concat(plan[st].filter((x) => x !== src));
      }
    }

    /* ---- 播放器：循环层双缓冲切换 ---- */
    let frontV = null;         /* 当前可见的循环视频 */
    let baseKey = "", baseOkKey = "", baseSrc = 0, baseUrl = 0, baseToken = 0, baseTimer = 0;

    function showNoPet() {
      wrap.classList.add("nopet");
      for (const v of [loopA, loopB]) v.classList.remove("on");
      frontV = null;
    }
    /* 单次动作播放期间隐藏底层循环，避免两个动作叠在一起 */
    function showBaseLayer(on) {
      if (wrap.classList.contains("nopet")) return;
      if (frontV) frontV.classList.toggle("on", on);
    }
    function reveal(v) {
      wrap.classList.remove("nopet");
      if (frontV && frontV !== v) {
        frontV.classList.remove("on");
        try { frontV.pause(); } catch (e) { /* ignore */ }
        frontV.removeAttribute("src");
        try { frontV.load(); } catch (e) { /* ignore */ }
      }
      frontV = v;
      if (!onceActive) v.classList.add("on");
    }
    function loadBase() {
      const token = ++baseToken;
      clearTimeout(baseTimer);
      const srcs = (plan[baseKey] && plan[baseKey].length) ? plan[baseKey] : (plan.idle || []);
      if (baseSrc >= srcs.length) { showNoPet(); return; }
      const s = srcs[baseSrc];
      if (baseUrl >= s.urls.length) { baseSrc++; baseUrl = 0; loadBase(); return; }
      const url = s.urls[baseUrl];
      const fail = () => { if (token !== baseToken) return; baseUrl++; loadBase(); };
      /* 网络卡死时也推进到下一个候选地址 */
      baseTimer = setTimeout(() => { if (token === baseToken && baseOkKey !== baseKey) fail(); }, 15000);

      const target = frontV === loopA ? loopB : loopA;
      target.onerror = () => { if (token !== baseToken) return; target.onerror = target.oncanplay = null; fail(); };
      target.oncanplay = () => {
        if (token !== baseToken) return;
        target.onerror = target.oncanplay = null;
        clearTimeout(baseTimer);
        target.loop = true;
        reveal(target);
        target.play().catch(() => {});
        baseOkKey = baseKey;
      };
      target.src = url;
      try { target.load(); } catch (e) { /* ignore */ }
    }
    function setBase(key) {
      if (!key) key = "idle";
      if (baseKey === key && baseOkKey === key) return;
      baseKey = key; baseSrc = 0; baseUrl = 0; baseOkKey = "";
      loadBase();
    }
    function reloadBase() { baseOkKey = ""; setBase(baseKey || phase || "idle"); }

    /* ---- 单次动作层（随机动作 / 动作选项预览 / 工作穿插） ---- */
    let onceActive = false, onceToken = 0, onceTimer = 0, onceEndCb = null;
    function endOnce() {
      if (!onceActive && !onceV.getAttribute("src")) return;
      onceToken++;            /* 让仍在加载中的候选地址作废，避免切换状态后突然插播 */
      onceActive = false;
      clearTimeout(onceTimer);
      onceV.classList.remove("on");
      onceV.onended = onceV.onerror = onceV.oncanplay = onceV.ontimeupdate = null;
      try { onceV.pause(); } catch (e) { /* ignore */ }
      onceV.removeAttribute("src");
      try { onceV.load(); } catch (e) { /* ignore */ }
      showBaseLayer(true);
      const cb = onceEndCb; onceEndCb = null;
      if (cb) cb();
    }
    function playOnceSrc(s, onEnd, maxMs) {
      if (!s || s.type !== "video" || !s.urls.length) return false;
      endOnce();
      const token = ++onceToken;
      onceEndCb = onEnd || null;
      let ui = 0;
      const tryLoad = () => {
        if (token !== onceToken) return;
        if (ui >= s.urls.length) return;
        clearTimeout(onceTimer);
        onceTimer = setTimeout(() => { if (token === onceToken) endOnce(); }, maxMs || 20000);
        onceV.onerror = () => { if (token !== onceToken) return; onceV.onerror = onceV.oncanplay = null; ui++; tryLoad(); };
        onceV.oncanplay = () => {
          if (token !== onceToken) return;
          onceV.onerror = onceV.oncanplay = null;
          onceV.loop = false;
          showBaseLayer(false);
          onceActive = true;
          wrap.classList.remove("nopet");
          onceV.classList.add("on");
          onceV.play().catch(() => {});
          const finish = () => { if (token === onceToken) endOnce(); };
          onceV.onended = finish;
          /* 部分 webm 不带时长元数据、ended 不触发，用 timeupdate + 兜底计时收场 */
          const dur = onceV.duration;
          clearTimeout(onceTimer);
          onceTimer = setTimeout(finish, isFinite(dur) && dur > 0 ? (dur + 3) * 1000 : 45000);
          let lastT = -1, stall = 0;
          onceV.ontimeupdate = () => {
            if (token !== onceToken) { onceV.ontimeupdate = null; return; }
            const d = onceV.duration;
            if (isFinite(d) && d > 0 && onceV.currentTime >= d - 0.08) { finish(); return; }
            if (onceV.currentTime === lastT) { if (onceV.currentTime > 0 && ++stall >= 4) finish(); }
            else { stall = 0; lastT = onceV.currentTime; }
          };
        };
        onceV.src = s.urls[ui];
        try { onceV.load(); } catch (e) { /* ignore */ }
      };
      tryLoad();
      return true;
    }

    /* 只有待命时才随机表演；运行/完成/失败/清理各自只显示映射动画，绝不重叠 */
    let randomTimer = 0;
    function scheduleRandom(delay) {
      clearTimeout(randomTimer);
      randomTimer = setTimeout(() => {
        /* 动态素材整体加载失败（圆形头像兜底）时不再反复请求远端 */
        if (phase === "idle" && !onceActive && !pressed && !dragging && !flying && !document.hidden
          && root.style.display !== "none" && !wrap.classList.contains("nopet")) {
          playOnceSrc(pickOne(plan.random));
        }
        scheduleRandom();
      }, delay != null ? delay : 8000 + Math.random() * 14000);
    }

    /* ---- 位置 / 大小 / 显隐 ---- */
    function bounds() {
      return { maxX: Math.max(0, innerWidth - root.offsetWidth), maxY: Math.max(0, innerHeight - root.offsetHeight) };
    }
    function clampPos() {
      const b = bounds();
      pos.x = Math.min(Math.max(0, pos.x), b.maxX);
      pos.y = Math.min(Math.max(0, pos.y), b.maxY);
    }
    function applyPos() {
      root.style.left = pos.x + "px"; root.style.top = pos.y + "px";
      /* 贴近顶部时气泡改到下方，避免被裁掉 */
      root.classList.toggle("bub-below", pos.y < 56);
    }
    function savePos() { lsWrite(POS_KEY, JSON.stringify(pos)); }
    function setSize(p) {
      const v = Math.min(200, Math.max(50, Number(p) || 100));
      const px = Math.round(BASE_ICON * v / 100);
      wrap.style.width = px + "px"; wrap.style.height = px + "px";
      clampPos(); applyPos();
    }
    function setThrow(on) { throwOn = !!on; if (!throwOn) stopFlying(true); }
    function applyVisible(v) {
      root.style.display = v ? "" : "none";
      if (v) { clampPos(); applyPos(); }
    }

    /* ---- 抛射物理（DSH：gravity 1400 / restitution 0.78） ---- */
    let pressed = false, dragging = false, moved = false, flying = false, rafId = 0;
    let downX = 0, downY = 0, downT = 0, lastClickAt = 0;
    let lastX = 0, lastY = 0, lastT = 0, vx = 0, vy = 0, lastFrameT = 0;
    function stopFlying(save) {
      flying = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      if (save) { savePos(); setBase(phase || "idle"); }
    }
    function stopFlyingNoRestore() {
      flying = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }
    function flyStep(t) {
      if (!flying) return;
      const dt = Math.min(0.05, (t - lastFrameT) / 1000 || 0.016);
      lastFrameT = t;
      const b = bounds();
      vy += THROW_GRAVITY * dt;
      pos.x += vx * dt; pos.y += vy * dt;
      if (pos.x <= 0) { pos.x = 0; vx = Math.abs(vx) * THROW_RESTITUTION; }
      else if (pos.x >= b.maxX) { pos.x = b.maxX; vx = -Math.abs(vx) * THROW_RESTITUTION; }
      if (pos.y <= 0) { pos.y = 0; vy = Math.abs(vy) * THROW_RESTITUTION; }
      else if (pos.y >= b.maxY) {
        pos.y = b.maxY;
        vy = -Math.abs(vy) * THROW_RESTITUTION;
        vx *= 0.92;
      }
      applyPos();
      const onGround = pos.y >= b.maxY - 0.5;
      if (onGround && Math.abs(vy) < 60 && Math.abs(vx) < 40) { stopFlying(true); return; }
      rafId = requestAnimationFrame(flyStep);
    }
    wrap.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      closePops();
      hideAiBubble();
      stopFlyingNoRestore();
      pressed = true; moved = false; dragging = false;
      downX = e.clientX; downY = e.clientY; downT = performance.now();
      lastX = e.clientX; lastY = e.clientY; lastT = downT;
      vx = 0; vy = 0;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!pressed) return;
      if (!moved) {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) < 4) return;
        moved = true; dragging = true;
        wrap.style.cursor = "grabbing";
        endOnce();
        if ((plan.drag || []).length) setBase("drag");
      }
      const now = performance.now();
      const dt = Math.max(0.001, (now - lastT) / 1000);
      vx = vx * 0.7 + ((e.clientX - lastX) / dt) * 0.3;
      vy = vy * 0.7 + ((e.clientY - lastY) / dt) * 0.3;
      pos.x += e.clientX - lastX; pos.y += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      clampPos(); applyPos();
    });
    window.addEventListener("mouseup", () => {
      if (!pressed) return;
      pressed = false;
      wrap.style.cursor = "grab";
      const wasClick = !moved && performance.now() - downT < 500;
      if (dragging) {
        dragging = false;
        if (throwOn && Math.hypot(vx, vy) > 250) {
          flying = true; lastFrameT = performance.now();
          rafId = requestAnimationFrame(flyStep);
        } else { stopFlying(true); }
      }
      /* 双击的第二下交给 dblclick 处理（清理），不重复触发点击动画 */
      if (wasClick) {
        const now = performance.now();
        if (now - lastClickAt > 320) { lastClickAt = now; reactClick(); }
      }
    });
    window.addEventListener("resize", () => {
      clampPos(); applyPos();
      closePops();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      if (frontV) frontV.play().catch(() => {});
      if (onceActive) onceV.play().catch(() => {});
      pollMonitor();
    });

    /* ---- 单击互动：DSH 原版下蹲弹跳，落地后接一个点击回应动作 ---- */
    let clickTimer = 0;
    function squish() {
      if (phase === "cleaning") return;
      wrap.classList.remove("tt-squish");
      void wrap.offsetWidth;
      wrap.classList.add("tt-squish");
    }
    function reactClick() {
      if (phase === "cleaning") return;
      squish();
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        if (pressed || dragging || flying || wrap.classList.contains("nopet")) return;
        playOnceSrc(pickOne(plan.click));
      }, 480);
    }
    wrap.addEventListener("animationend", () => wrap.classList.remove("tt-squish"));

    /* ---- 阶段与顶部气泡 ---- */
    function setPhase(next) {
      phase = next || "idle";
      root.classList.remove("running", "finished", "failed", "cleaning");
      if (phase !== "idle") root.classList.add(phase);
      endOnce();
      setBase(phase);
      render();
      syncMenuState();
    }
    function render() {
      const now = Date.now();
      /* 报错分析气泡展示期间隐藏状态气泡，避免上下叠两个泡 */
      if (aiBubble.classList.contains("show")) { bubble.style.display = "none"; return; }
      let show = false;
      if (phase === "running") {
        show = true;
        l1.style.display = "";
        l1.textContent = "⏱ 已运行 " + fmtDuration(now - startTime);
        l2.style.display = "";
        l2.textContent = "▶ " + (currentStep || "准备中") + (pct == null ? "" : " " + pct + "%");
      } else if (phase === "finished") {
        show = true;
        l1.style.display = "";
        l1.textContent = "✓ 总计 " + fmtDuration(lastTotal);
        l2.style.display = "none";
      } else if (phase === "failed") {
        show = true;
        l1.style.display = "";
        l1.textContent = "✗ 运行失败 · 用时 " + fmtDuration(lastTotal);
        l2.style.display = "none";
      } else if (phase === "cleaning") {
        /* 双击瞬间弹出 2 秒「已清理 ✓」，超时后气泡收起 */
        if (cleanText) {
          show = true;
          l1.style.display = ""; l1.textContent = cleanText; l2.style.display = "none";
        } else {
          l1.style.display = "none"; l2.style.display = "none";
        }
      }
      bubble.style.display = show ? "flex" : "none";
    }
    function startRun() {
      if (busy) return;
      busy = true; startTime = Date.now();
      currentStep = "准备中"; pct = null;
      clearTimeout(endTimer);
      clearTimeout(postCleanTimer);
      hideAiBubble();
      setPhase("running");
      /* 运行前清理：开跑时后台静默调 /free 清一次内存/显存，不播动画不打扰 */
      if (getSetting(PRE_CLEAN_KEY, false)) doClean(true);
    }
    /* 完成 / 失败提示显示 6 秒，随后回到待命并继续随机动作 */
    function endRun(next) {
      if (!busy) return;
      busy = false;
      lastTotal = Date.now() - startTime;
      pct = null;
      setPhase(next);
      clearTimeout(endTimer);
      endTimer = setTimeout(() => {
        if (phase === next && !busy) setPhase("idle");
      }, 6000);
    }
    /* 运行成功结束后：等「✓ 总计」提示展示完（6 秒）再自动清理一次；期间开新任务则取消 */
    function finishRun() {
      endRun("finished");
      if (getSetting(POST_CLEAN_KEY, false)) {
        clearTimeout(postCleanTimer);
        postCleanTimer = setTimeout(() => { if (!busy && phase !== "cleaning") doClean(true); }, 6000);
      }
    }
    function failRun() { endRun("failed"); }
    function nodeLabel(id) {
      try {
        const n = app.graph.getNodeById(Number(id));
        if (n) return n.title || n.type || ("节点 " + id);
      } catch (e) { /* ignore */ }
      return "节点 " + id;
    }

    /* ---- 清理运存/显存：手动（双击 / 菜单）播清理动画；自动（运行前/后）后台静默 ---- */
    let cleanGuard = 0, cleanTextTimer = 0, silentCleaning = false;
    async function freeMemory() {
      try {
        await api.fetchApi("/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unload_models: true, free_memory: true }),
        });
        return true;
      } catch (e) { return false; }
    }
    async function doClean(silent, quiet) {
      if (silent) {
        if (silentCleaning) return;
        silentCleaning = true;
        await freeMemory();
        silentCleaning = false;
        return;
      }
      if (phase === "cleaning") return;
      clearTimeout(endTimer);
      clearTimeout(postCleanTimer);
      clearTimeout(cleanGuard);
      clearTimeout(cleanTextTimer);
      clearTimeout(clickTimer);
      endOnce();
      phase = "cleaning";
      root.classList.remove("running", "finished", "failed");
      root.classList.add("cleaning");
      setBase("cleaning");
      /* 双击在宠物头顶显示 2 秒提示；从清理窗口触发时只播动画，结果留在窗口里 */
      cleanText = quiet ? "" : "已清理 ✓";
      render();
      if (!quiet) {
        cleanTextTimer = setTimeout(() => { if (phase === "cleaning") { cleanText = ""; render(); } }, 2000);
      }
      /* 提示消失后，仍等清理动画完整播完、且 /free 请求返回才复位 */
      let fetchDone = false, animDone = false;
      const backIdle = () => {
        if (!fetchDone || !animDone || phase !== "cleaning") return;
        setPhase(busy ? "running" : "idle");
      };
      const onAnim = () => { animDone = true; backIdle(); };
      if (!playOnceSrc(pickOne(plan.cleaning), onAnim, 12000)) animDone = true;
      cleanGuard = setTimeout(onAnim, 16000);   /* 绝对兜底：再长也别卡在清理态 */
      const ok = await freeMemory();
      fetchDone = true;
      backIdle();
      return ok;
    }
    wrap.addEventListener("dblclick", (e) => { e.preventDefault(); lastClickAt = performance.now(); doClean(); });

    /* ---- 居中清理窗口（交互与报错分析一致，不跟随宠物位置） ---- */
    let cleanOut = null, cleanRun = null, cleanRunBusy = false, cleanWaitTimer = 0;
    const cleanModal = makeModal("清理内存 / 显存", (panel) => {
      panel.appendChild(el("div", "tt-hint",
        "调用 ComfyUI 的 <strong>/free</strong>：卸载已加载的模型，并释放内存与显存缓存。"));
      cleanOut = el("div", "tt-out", "准备清理…");
      panel.appendChild(cleanOut);
      const row = el("div", "tt-row");
      cleanRun = el("button", "tt-btn primary", "立即清理");
      cleanRun.type = "button";
      cleanRun.addEventListener("click", runCleanModal);
      const close = el("button", "tt-btn", "关闭");
      close.type = "button";
      close.addEventListener("click", () => cleanModal.classList.remove("open"));
      row.appendChild(cleanRun); row.appendChild(close);
      panel.appendChild(row);
    });
    cleanModal.id = "pet-clean-modal";
    async function runCleanModal() {
      if (!cleanOut || cleanRunBusy) return;
      if (phase === "cleaning") {
        clearInterval(cleanWaitTimer);
        cleanOut.textContent = "正在清理中，请稍候…";
        if (cleanRun) { cleanRun.disabled = true; cleanRun.textContent = "清理中…"; }
        cleanWaitTimer = setInterval(() => {
          if (phase === "cleaning") return;
          clearInterval(cleanWaitTimer);
          cleanWaitTimer = 0;
          cleanOut.textContent = "清理完成 ✓\n已释放内存 / 显存缓存。";
          if (cleanRun) { cleanRun.disabled = false; cleanRun.textContent = "再次清理"; }
        }, 300);
        return;
      }
      cleanRunBusy = true;
      if (cleanRun) { cleanRun.disabled = true; cleanRun.textContent = "清理中…"; }
      cleanOut.textContent = "正在清理内存与显存…";
      const ok = await doClean(false, true);
      cleanOut.textContent = ok
        ? "清理完成 ✓\n已卸载模型并释放内存 / 显存缓存。"
        : "清理请求失败，请查看 ComfyUI 控制台。";
      if (cleanRun) { cleanRun.disabled = false; cleanRun.textContent = "再次清理"; }
      cleanRunBusy = false;
    }
    function openCleanModal() {
      cleanModal.classList.add("open");
      runCleanModal();
    }

    /* ---- 气泡菜单公共逻辑 ---- */
    function petRect() { return wrap.getBoundingClientRect(); }
    function syncPopOpen() {
      root.classList.toggle("pop-open",
        menu.classList.contains("show") || mapPop.classList.contains("show"));
    }
    function closePops(except) {
      for (const p of [menu, mapPop]) {
        if (p === except) continue;
        p.classList.remove("show");
      }
      syncPopOpen();
    }
    function closeMapPop() { mapPop.classList.remove("show"); syncPopOpen(); }
    function placePop(pop, anchorRect) {
      /* 用布局尺寸而不是 rect：气泡入场时有 0.97 缩放，rect 会偏小 */
      const p = placePopover(
        { left: anchorRect.left, top: anchorRect.top, width: anchorRect.width, height: anchorRect.height },
        { width: pop.offsetWidth, height: pop.offsetHeight },
        { width: innerWidth, height: innerHeight },
      );
      pop.style.left = p.left + "px";
      pop.style.top = p.top + "px";
      pop.style.setProperty("--arrow-x", p.arrowX + "px");
      pop.style.setProperty("--pop-shift", p.below ? "-5px" : "5px");
      pop.classList.toggle("below", p.below);
    }
    function openMenu() {
      closePops(menu);
      syncMenuState();
      placePop(menu, petRect());
      menu.classList.add("show");
      syncPopOpen();
    }
    let menuReflowTimer = 0;
    function reflowMenu() {
      clearTimeout(menuReflowTimer);
      menuReflowTimer = setTimeout(() => {
        if (menu.classList.contains("show")) placePop(menu, petRect());
      }, 200);
    }
    menuClose.addEventListener("click", () => closePops());
    mapClose.addEventListener("click", closeMapPop);

    wrap.addEventListener("contextmenu", (e) => {
      e.preventDefault(); e.stopPropagation();
      openMenu();
    });
    document.addEventListener("mousedown", (e) => {
      const t = e.target;
      if (!(t && t.closest && t.closest(".pet-pop"))) { closePops(); return; }
      /* 点动作面板的其他区域时顺手收起映射气泡，但不连带关闭动作面板 */
      if (mapPop.classList.contains("show") && !t.closest("#comfyui-pet-map")) closeMapPop();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closePops(); closeModals(); }
    });

    /* ---- 模态框骨架 ---- */
    function makeModal(title, buildBody) {
      const modal = el("div", "tt-modal");
      const panel = el("div", "tt-panel");
      const head = el("div", "tt-head");
      head.appendChild(el("span", "pp-dot"));
      head.appendChild(el("span", null, title));
      const x = el("button", "tt-x", "×");
      x.addEventListener("click", () => modal.classList.remove("open"));
      head.appendChild(x);
      panel.appendChild(head);
      buildBody(panel);
      modal.appendChild(panel);
      modal.addEventListener("mousedown", (e) => { if (e.target === modal) modal.classList.remove("open"); });
      document.body.appendChild(modal);
      return modal;
    }
    function closeModals() {
      document.querySelectorAll(".tt-modal.open").forEach((m) => m.classList.remove("open"));
    }

    /* ---- 状态动画映射 ---- */
    function setMapping(state, name) {
      if (name) mapping[state] = name;
      else delete mapping[state];
      lsWrite(MAP_KEY, JSON.stringify(mapping));
      rebuildPlan();
      reloadBase();
      updateCardBadges();
    }

    let mapAnchor = null;
    function setCardBadge(card) {
      const s = card._src;
      if (!s) return;
      const mb = card.querySelector(".mb");
      if (!mb) return;
      const used = STATE_KEYS.filter((st) => mapping[st] === s.name);
      const pool = apQuery ? (POOL_LABELS[s.pool] || "") : "";
      mb.textContent = used.length ? used.map((st) => POOL_LABELS[st]).join(" · ") : pool;
      mb.classList.toggle("pool", !used.length);
    }
    function updateCardBadges() {
      for (const card of apGrid.querySelectorAll(".pet-act")) setCardBadge(card);
    }
    function buildMapBody(src) {
      mapTitle.textContent = `「${stripExt(src.name)}」设为…`;
      mapBody.innerHTML = "";
      for (const st of STATE_KEYS) {
        const on = mapping[st] === src.name;
        const row = mi("check", `${POOL_LABELS[st]}动画`, () => {
          setMapping(st, on ? null : src.name);
          buildMapBody(src);
          if (mapAnchor) placePop(mapPop, mapAnchor);
        });
        row.querySelector(".mi-ico").style.visibility = on ? "" : "hidden";
        mapBody.appendChild(row);
      }
      const used = STATE_KEYS.filter((st) => mapping[st] === src.name);
      if (used.length) {
        mapBody.appendChild(el("div", "pp-sep"));
        mapBody.appendChild(mi("clean", "全部恢复默认", () => {
          for (const st of used) setMapping(st, null);
          buildMapBody(src);
          if (mapAnchor) placePop(mapPop, mapAnchor);
        }));
      }
    }
    function openMapPop(anchorRect, src) {
      mapAnchor = anchorRect;
      buildMapBody(src);
      placePop(mapPop, anchorRect);
      mapPop.classList.add("show");
      syncPopOpen();
    }

    /* ---- 动作选项（气泡面板：搜索 + 全部动作 + 分批渲染） ---- */
    function actionList() {
      const seen = new Set();
      const all = [];
      for (const k of PLAN_KEYS) {
        for (const s of plan[k] || []) {
          if (seen.has(s.name)) continue;
          seen.add(s.name);
          all.push(s);
        }
      }
      const q = apQuery.trim().toLowerCase();
      if (!q) return all;
      return all.filter((s) => stripExt(s.name).toLowerCase().includes(q));
    }
    function previewAction(card, s) {
      endOnce();
      if (playOnceSrc(s)) {
        card.classList.add("flash");
        setTimeout(() => card.classList.remove("flash"), 450);
        apFoot.textContent = `正在表演：${stripExt(s.name)}`;
      } else {
        apFoot.textContent = `「${stripExt(s.name)}」暂时无法播放`;
      }
    }
    function makeActionCard(s) {
      const card = el("button", "pet-act");
      card.type = "button";
      card._src = s;
      card.appendChild(el("b", null, stripExt(s.name)));
      card.appendChild(el("div", "mb"));
      setCardBadge(card);
      card.addEventListener("click", () => previewAction(card, s));
      card.addEventListener("contextmenu", (e) => {
        e.preventDefault(); e.stopPropagation();
        menu.classList.remove("show");
        closeMapPop();
        openMapPop(card.getBoundingClientRect(), s);
      });
      return card;
    }
    function renderActions() {
      apToken++;
      const token = apToken;
      const list = actionList();
      apGrid.innerHTML = "";
      apGrid.scrollTop = 0;
      apCount.textContent = apQuery ? `${list.length} 个结果` : `${list.length} 个动作`;
      apFoot.textContent = "左键预览一次 · 右键设为状态动画";
      const rows = Math.ceil(list.length / 2);
      apGrid.style.height = Math.max(58, Math.min(380, innerHeight * 0.42, rows * 43 + 4)) + "px";
      if (!list.length) {
        apGrid.appendChild(el("div", "pet-empty", "没有匹配的动作"));
        return;
      }
      let i = 0;
      const firstEnd = Math.min(12, list.length);
      const first = document.createDocumentFragment();
      for (; i < firstEnd; i++) first.appendChild(makeActionCard(list[i]));
      apGrid.appendChild(first);
      const chunk = () => {
        if (token !== apToken) return;
        const frag = document.createDocumentFragment();
        const end = Math.min(list.length, i + 24);
        for (; i < end; i++) frag.appendChild(makeActionCard(list[i]));
        apGrid.appendChild(frag);
        if (i < list.length) requestAnimationFrame(chunk);
      };
      if (i < list.length) requestAnimationFrame(chunk);
    }
    function openActionPanel() {
      closePops();
      apQuery = ""; apSearch.value = ""; apToken++;
      renderActions();
      actionModal.classList.add("open");
    }
    apSearch.addEventListener("input", () => {
      clearTimeout(apSearchTimer);
      apSearchTimer = setTimeout(() => {
        apQuery = apSearch.value;
        renderActions();
      }, 80);
    });
    apGrid.addEventListener("scroll", closeMapPop, { passive: true });

    /* ---- 资源监控（画布状态栏） ---- */
    function toggleMonitor() {
      const next = !monitorOn;
      setSettingValue(MONITOR_KEY, next);
      applyMonitor(next);
    }
    function syncMenuState() {
      monSwitch.classList.toggle("on", monitorOn);
      monErr.classList.toggle("show", monitorError);
      cleanHead.classList.toggle("open", cleanFolded);
      cleanFold.classList.toggle("open", cleanFolded);
      const pre = preRow.querySelector(".pet-sw");
      const post = postRow.querySelector(".pet-sw");
      if (pre) pre.classList.toggle("on", !!getSetting(PRE_CLEAN_KEY, false));
      if (post) post.classList.toggle("on", !!getSetting(POST_CLEAN_KEY, false));
      menuDot.className = "pp-dot" + (phase === "finished" || phase === "failed" || phase === "cleaning" ? " " + phase : "");
      menuPhase.textContent = PHASE_LABELS[phase] || "待命";
      /* 折叠/报错提示会改变菜单高度，展开动画结束后重新贴合宠物 */
      if (menu.classList.contains("show")) reflowMenu();
    }

    function ensureStatusBar() {
      if (!monitorOn) { statusBar.remove(); return; }
      statusBar.style.display = "";
      /* 新版前端：放进运行按钮 / 管理器 / 翻译开关共用的描边卡片内，
         并排在这些已显示插件的最左边，不占原来运行按钮的位置 */
      const card = document.querySelector('[data-testid="action-bar-card"]');
      if (card) {
        const inner = card.querySelector(".actionbar-container");
        if (inner) {
          if (statusBar.parentElement !== inner || inner.firstElementChild !== statusBar) {
            inner.prepend(statusBar);
          }
          return;
        }
      }
      if (statusBar.isConnected) return;
      /* 旧版前端回退：跟在运行按钮后面 */
      const queueBtn = document.getElementById("queue-button");
      if (queueBtn) { queueBtn.insertAdjacentElement("afterend", statusBar); return; }
      const bar = document.querySelector(".actionbar-container");
      if (bar) bar.appendChild(statusBar);
    }

    function fmtPair(used, total) { return `${formatGB(used)} / ${formatGB(total)} GB`; }
    function setMeters(key, pct, text, title, kind) {
      setBarMeter(sbM[key], pct, text, title, kind);
    }
    function hideMeters() {
      for (const k of Object.keys(sbM)) sbM[k].row.style.display = "none";
    }
    function updateMeters() {
      const st = monitorStats;
      if (!st) { hideMeters(); return; }
      const cpuTitle = st.cpu_count ? `CPU 占用 · ${st.cpu_count} 线程` : "CPU 占用";
      setMeters("cpu", st.cpu, null, cpuTitle);
      const ram = st.ram || {};
      setMeters("ram", ram.percent, null, `内存占用 ${fmtPair(ram.used, ram.total)}`);
      const gpu = st.gpus && st.gpus.length ? st.gpus[0] : null;
      if (gpu) {
        const name = gpu.name || "GPU";
        const vramPct = gpu.vram_total ? (gpu.vram_used / gpu.vram_total) * 100 : null;
        const temp = gpu.temp != null ? Number(gpu.temp) : null;
        setMeters("gpu", gpu.util, null, `${name} · GPU 占用`);
        setMeters("vram", vramPct, null, `${name} · 显存 ${fmtPair(gpu.vram_used, gpu.vram_total)}`);
        setMeters("temp", temp, temp == null ? null : `${Math.round(temp)}°C`,
          temp == null ? `${name} · 温度` : `${name} · 温度 ${Math.round(temp)}°C`, "temp");
      } else {
        setMeters("gpu", null, null, "");
        setMeters("vram", null, null, "");
        setMeters("temp", null, null, "");
      }
      ensureStatusBar();
    }

    let monitorEpoch = 0;
    async function pollMonitor() {
      if (!monitorOn || monitorBusy || document.hidden) return;
      ensureStatusBar();
      const epoch = monitorEpoch;
      monitorBusy = true;
      try {
        const r = await api.fetchApi("/comfyui-pet/stats", { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        if (epoch !== monitorEpoch || !monitorOn) return;
        monitorStats = data;
        monitorFails = 0;
        monitorError = false;
        updateMeters();
        syncMenuState();
      } catch (e) {
        if (epoch !== monitorEpoch) return;
        monitorFails++;
        if (monitorFails >= 2) {
          monitorError = true;
          monitorStats = null;
          hideMeters();
          syncMenuState();
        }
      } finally {
        monitorBusy = false;
      }
    }
    function startMonitor() {
      if (!monitorTimer) monitorTimer = setInterval(pollMonitor, 2000);
      pollMonitor();
    }
    function stopMonitor() {
      clearInterval(monitorTimer);
      monitorTimer = 0;
    }
    function applyMonitor(enabled) {
      monitorOn = !!enabled;
      monitorEpoch++;
      if (!monitorOn) {
        stopMonitor();
        monitorStats = null;
        monitorFails = 0;
        monitorError = false;
        hideMeters();
        statusBar.remove();
      } else {
        ensureStatusBar();
        startMonitor();
      }
      syncMenuState();
    }

    /* ---- 报错分析（运行失败自动抓日志 → 大模型给出原因与解决办法） ----
       OpenAI 兼容接口，默认 DeepSeek，可换成豆包方舟等任意供应商。 */
    let lastError = null, aiBusy = false, refreshErrUi = null;
    let aiText = "尚未分析。配置密钥后，运行失败会自动抓取错误日志发给大模型，结论显示在宠物头顶的气泡里，这里也能查看。";
    function getSetting(id, d) {
      try { return app.ui.settings.getSettingValue(id, d); } catch (e) { return d; }
    }
    function buildErrorText(d) {
      if (!d || typeof d !== "object") return "（未捕获到详细错误信息）";
      const L = [];
      if (d.exception_type) L.push("异常类型: " + d.exception_type);
      if (d.exception_message) L.push("异常信息: " + d.exception_message);
      if (d.node_id != null) L.push("出错节点: #" + d.node_id + (d.node_type ? "（" + d.node_type + "）" : ""));
      if (d.prompt_id) L.push("prompt_id: " + d.prompt_id);
      const tb = Array.isArray(d.traceback) ? d.traceback.join("\n")
        : (typeof d.detailed_traceback === "string" ? d.detailed_traceback : "");
      if (tb) L.push("调用堆栈:\n" + String(tb).slice(0, 2500));
      return L.length ? L.join("\n") : "原始数据:\n" + JSON.stringify(d, null, 2).slice(0, 2500);
    }
    async function askAI(errText, key) {
      const base = String(getSetting(AI_BASE_ID, AI_BASE_DEFAULT) || AI_BASE_DEFAULT).trim().replace(/\/+$/, "");
      const model = String(getSetting(AI_MODEL_ID, "") || "").trim() || AI_MODEL_DEFAULT;
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: "system", content: "你是 ComfyUI 工作流报错分析助手。根据用户给出的错误日志，用中文简洁回答：第一行以「原因：」开头，一句话点明根因；随后以「解决办法：」开头，给出 1-3 条具体可操作的修复步骤。不要寒暄，不要复述日志。" },
            { role: "user", content: errText },
          ],
        }),
      });
      if (!r.ok) throw new Error(`接口返回 ${r.status}：${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      const m = j.choices && j.choices[0] && j.choices[0].message;
      if (!m || !m.content) throw new Error("返回内容为空");
      let text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      if (getSetting(AI_FILTER_ID, true)) {
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*/i, "").trim();
      }
      if (!text) throw new Error("过滤思维链后没有正文，可关闭「过滤思维链输出」再试");
      return text;
    }
    /* API Key 只存浏览器本地（ComfyUI 设置页是明文输入框，不适合放密钥）；旧设置里存过的值自动迁入并抹除 */
    function getAiKey() {
      try {
        let k = localStorage.getItem(AI_KEY_STORE);
        if (!k) {
          const prev = getSetting(AI_KEY_ID, null);
          if (prev) {
            k = String(prev);
            localStorage.setItem(AI_KEY_STORE, k);
            try { app.ui.settings.setSettingValue(AI_KEY_ID, ""); } catch (e) { /* ignore */ }
          }
        }
        return (k || "").trim();
      } catch (e) { return ""; }
    }
    function setAiKey(k) {
      try { localStorage.setItem(AI_KEY_STORE, String(k || "").trim()); } catch (e) { /* ignore */ }
    }

    /* 报错分析气泡：悬浮在宠物上方，点宠物即关，60 秒自动消失 */
    let aiBubbleTimer = 0;
    function showAiBubble(text, loading) {
      aiTitle.textContent = loading ? "报错分析中…" : "报错分析";
      aiBody.textContent = text || "";
      aiBubble.classList.add("show");
      render();
      clearTimeout(aiBubbleTimer);
      aiBubbleTimer = setTimeout(hideAiBubble, 60000);
    }
    function hideAiBubble() {
      clearTimeout(aiBubbleTimer);
      if (!aiBubble.classList.contains("show")) return;
      aiBubble.classList.remove("show");
      render();
    }

    async function runAnalysis(d, silent) {
      const key = getAiKey();
      if (!key) {
        aiText = "尚未配置 API Key：右键宠物 → 报错分析，展开「供应商配置」填写并保存（默认 DeepSeek，也可用豆包方舟等任意 OpenAI 兼容接口）。";
        if (!silent) { errModal.classList.add("open"); if (refreshErrUi) refreshErrUi(true); }
        return;
      }
      if (aiBusy) return;
      aiBusy = true;
      aiText = "分析中…";
      if (silent) showAiBubble("正在抓取错误日志并请求模型，请稍候…", true);
      else { errModal.classList.add("open"); if (refreshErrUi) refreshErrUi(); }
      try {
        aiText = await askAI(buildErrorText(d), key);
      } catch (e) {
        aiText = "分析失败：" + (e && e.message ? e.message : e)
          + "\n\n提示：若浏览器控制台显示 CORS/跨域错误，说明该接口不允许网页直连，请换一个支持跨域的 OpenAI 兼容地址。";
      }
      aiBusy = false;
      if (silent) showAiBubble(aiText, false);
      else if (refreshErrUi) refreshErrUi();
    }
    function autoAnalyze(d) {
      lastError = d || null;
      if (!getSetting(AI_ENABLE_ID, true)) return;
      if (getAiKey()) runAnalysis(d, true);
    }
    const errModal = makeModal("报错分析", (panel) => {
      /* 供应商配置默认折叠：填好 Key 自动弹出时，直接看分析结果 */
      const cfg = el("details", "tt-cfg");
      cfg.appendChild(el("summary", null, "供应商配置（接口地址 / API Key / 模型 / 开关）"));
      const cfgBody = el("div");
      cfgBody.appendChild(el("div", "tt-hint", "默认 DeepSeek（地址已填好），也可换成豆包方舟等任意 OpenAI 兼容供应商；地址 / 模型 / 开关保存在 ComfyUI 设置 → 宠物，API Key 只存在浏览器本地，不会出现在设置页。"));
      const baseIn = el("input", "tt-input");
      baseIn.placeholder = `接口地址（默认 ${AI_BASE_DEFAULT}）`;
      const keyIn = el("input", "tt-input"); keyIn.type = "password";
      keyIn.placeholder = "API Key";
      const modelIn = el("input", "tt-input");
      modelIn.placeholder = `模型（默认 ${AI_MODEL_DEFAULT}）`;
      const swRow = el("div", "tt-row");
      const enWrap = el("label", "tt-check");
      const enIn = el("input"); enIn.type = "checkbox";
      enWrap.appendChild(enIn); enWrap.appendChild(el("span", null, "失败时自动分析"));
      const flWrap = el("label", "tt-check");
      const flIn = el("input"); flIn.type = "checkbox";
      flWrap.appendChild(flIn); flWrap.appendChild(el("span", null, "过滤思维链输出"));
      swRow.appendChild(enWrap); swRow.appendChild(flWrap);
      const row = el("div", "tt-row");
      const saveBtn = el("button", "tt-btn primary", "保存配置");
      const st = el("span", "tt-hint", "");
      row.appendChild(saveBtn); row.appendChild(st);
      cfgBody.appendChild(baseIn); cfgBody.appendChild(keyIn); cfgBody.appendChild(modelIn);
      cfgBody.appendChild(swRow); cfgBody.appendChild(row);
      cfg.appendChild(cfgBody);
      panel.appendChild(cfg);

      const resHead = el("div", "tt-head");
      resHead.appendChild(el("span", "tt-sec", "分析结果"));
      const retryBtn = el("button", "tt-btn", "重新分析");
      resHead.appendChild(retryBtn);
      panel.appendChild(resHead);
      const out = el("div", "tt-out", "");
      const raw = el("details", "tt-raw");
      raw.appendChild(el("summary", null, "原始错误日志"));
      const rawPre = el("pre", "tt-out", "");
      raw.appendChild(rawPre);
      panel.appendChild(out); panel.appendChild(raw);

      refreshErrUi = function (resetCfg) {
        baseIn.value = String(getSetting(AI_BASE_ID, "") || "") || AI_BASE_DEFAULT;
        keyIn.value = getAiKey();
        modelIn.value = String(getSetting(AI_MODEL_ID, "") || "");
        enIn.checked = !!getSetting(AI_ENABLE_ID, true);
        flIn.checked = !!getSetting(AI_FILTER_ID, true);
        out.textContent = aiText;
        rawPre.textContent = buildErrorText(lastError);
        if (resetCfg) cfg.open = !getAiKey();
      };
      saveBtn.addEventListener("click", () => {
        try {
          const s = app.ui.settings;
          s.setSettingValue(AI_BASE_ID, baseIn.value.trim());
          setAiKey(keyIn.value);
          s.setSettingValue(AI_MODEL_ID, modelIn.value.trim());
          s.setSettingValue(AI_ENABLE_ID, enIn.checked);
          s.setSettingValue(AI_FILTER_ID, flIn.checked);
          st.textContent = "已保存 ✓";
        } catch (err) { st.textContent = "保存失败：" + err; }
        setTimeout(() => { st.textContent = ""; }, 1500);
      });
      retryBtn.addEventListener("click", () => runAnalysis(lastError));
      refreshErrUi(true);
    });
    function openErrModal() { errModal.classList.add("open"); if (refreshErrUi) refreshErrUi(true); }

    /* ---- 设置联动 ---- */
    function setSettingValue(id, v) {
      try {
        if (app.ui.settings && app.ui.settings.setSettingValue) { app.ui.settings.setSettingValue(id, v); return; }
      } catch (e) { /* ignore */ }
      if (id === VISIBLE_KEY) applyVisible(v);
      else if (id === THROW_KEY) setThrow(v);
      else if (id === SIZE_KEY) setSize(v);
      else if (id === MONITOR_KEY) applyMonitor(v);
    }
    window.__petHooks = {
      setSize, setThrow, applyVisible,
      setMonitor: (v) => applyMonitor(v),
    };

    /* ---- ComfyUI 事件 ---- */
    api.addEventListener("execution_start", () => { startRun(); });
    api.addEventListener("executing", (e) => {
      const d = e.detail;
      const nodeId = d && typeof d === "object" ? (d.node != null ? d.node : d.display_node) : d;
      if (nodeId == null || nodeId === "") { if (busy) finishRun(); return; }
      if (!busy) startRun();
      currentStep = nodeLabel(nodeId);
      pct = null;
      render();
    });
    api.addEventListener("progress", (e) => {
      const d = e.detail || {};
      if (d.max) pct = Math.round((d.value / d.max) * 100);
      render();
    });
    api.addEventListener("execution_success", () => finishRun());
    api.addEventListener("execution_interrupted", () => failRun());
    api.addEventListener("execution_error", (e) => {
      failRun();
      const raw = e.detail || {};
      autoAnalyze(raw.data && typeof raw.data === "object" ? raw.data : raw);
    });
    api.addEventListener("status", (e) => {
      const q = e.detail && e.detail.status && e.detail.status.exec_info ? e.detail.status.exec_info.queue_remaining : 0;
      if (q > 0) { if (!busy) startRun(); }
      else if (busy) finishRun();
    });
    async function pollQueue() {
      try {
        const r = await api.fetchApi("/queue");
        const j = await r.json();
        const n = (j.queue_running ? j.queue_running.length : 0) + (j.queue_pending ? j.queue_pending.length : 0);
        if (n > 0) { if (!busy) startRun(); }
        else if (busy) finishRun();
      } catch (e) { /* ignore */ }
    }

    /* ---- 启动 ---- */
    clampPos(); applyPos();
    setSize(100);
    rebuildPlan();
    setPhase("idle");
    setInterval(render, 250);
    scheduleRandom();
    pollQueue();
    setInterval(pollQueue, 1000);
  },

  setup(app) {
    const settings = app.ui.settings;
    const get = (id, d) => { try { return settings.getSettingValue(id, d); } catch (e) { return d; } };
    const set = (id, v) => { try { settings.setSettingValue(id, v); } catch (e) { /* ignore */ } };
    /* 设置项 id 的首段决定 ComfyUI 设置里的选项卡名，中文 id → 选项卡「宠物」 */
    settings.addSetting({
      id: SIZE_KEY,
      name: "大小（50–200%，100% 为原始大小）",
      type: "slider",
      defaultValue: 100,
      attrs: { min: 50, max: 200, step: 5 },
      onChange: (v) => window.__petHooks && window.__petHooks.setSize(v),
    });
    settings.addSetting({
      id: THROW_KEY,
      name: "抛射（甩出去会飞起、碰边回弹；关闭后松手即停）",
      type: "boolean",
      defaultValue: true,
      onChange: (v) => window.__petHooks && window.__petHooks.setThrow(v),
    });
    settings.addSetting({
      id: VISIBLE_KEY,
      name: "显示桌宠（右键桌宠可隐藏）",
      type: "boolean",
      defaultValue: true,
      onChange: (v) => window.__petHooks && window.__petHooks.applyVisible(v),
    });
    settings.addSetting({
      id: MONITOR_KEY,
      name: "资源监控（在画布状态栏显示 CPU / 内存 / GPU / 显存 / 温度）",
      type: "boolean",
      defaultValue: true,
      onChange: (v) => window.__petHooks && window.__petHooks.setMonitor(v),
    });
    settings.addSetting({
      id: PRE_CLEAN_KEY,
      name: "运行前清理（开始运行时先清一次内存/显存）",
      type: "boolean",
      defaultValue: false,
    });
    settings.addSetting({
      id: POST_CLEAN_KEY,
      name: "运行后清理（运行成功结束并展示完提示后自动清一次）",
      type: "boolean",
      defaultValue: false,
    });
    settings.addSetting({
      id: AI_ENABLE_ID,
      name: "报错分析（运行失败时自动抓日志询问大模型）",
      type: "boolean",
      defaultValue: true,
    });
    settings.addSetting({
      id: AI_FILTER_ID,
      name: "报错分析过滤思维链（隐藏模型的推理过程，只看结论）",
      type: "boolean",
      defaultValue: true,
    });
    settings.addSetting({
      id: AI_BASE_ID,
      name: "报错分析接口地址（OpenAI 兼容，默认 DeepSeek）",
      type: "text",
      defaultValue: AI_BASE_DEFAULT,
    });
    settings.addSetting({
      id: AI_MODEL_ID,
      name: "报错分析模型（默认 deepseek-chat）",
      type: "text",
      defaultValue: AI_MODEL_DEFAULT,
    });

    /* 迁移：宠物.* ← Pet.* ← ComfyUI.TaskTimer.PetSize（旧基准 96px，>100% 折半） */
    let size = Number(get(SIZE_KEY, NaN));
    if (!isFinite(size)) {
      const prev = Number(get(PREV_SETTING_KEYS[SIZE_KEY], NaN));
      if (isFinite(prev)) size = Math.min(200, Math.max(50, prev));
      else {
        const legacy = Number(get(LEGACY_SIZE_KEY, NaN));
        size = legacy > 100 ? Math.min(200, Math.max(50, Math.round(legacy / 2))) : 100;
      }
      set(SIZE_KEY, size);
    }
    for (const [newId, prevId] of Object.entries(PREV_SETTING_KEYS)) {
      if (newId === SIZE_KEY) continue;
      if (get(newId, null) === null) {
        const prev = get(prevId, null);
        set(newId, prev === null ? true : prev === true);
      }
    }
    /* 豆包旧 id → 报错分析新 id */
    const AI_LEGACY = {
      [AI_KEY_ID]: "宠物.豆包密钥",
      [AI_BASE_ID]: "宠物.豆包地址",
      [AI_MODEL_ID]: "宠物.豆包模型",
    };
    for (const [newId, oldId] of Object.entries(AI_LEGACY)) {
      if (get(newId, null) === null) {
        const prev = get(oldId, null);
        if (prev !== null) set(newId, prev);
      }
    }

    const h = window.__petHooks || {};
    if (h.setSize) h.setSize(size);
    if (h.setThrow) h.setThrow(get(THROW_KEY, true));
    if (h.applyVisible) h.applyVisible(get(VISIBLE_KEY, true));
    if (h.setMonitor) h.setMonitor(get(MONITOR_KEY, true));
  },
});
