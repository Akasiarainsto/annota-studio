export const AUDIO_OPTIONS = {
  language: [['zh-CN','普通话'],['en','英语'],['mixed','混合'],['other','其他']],
  scene: [['read_speech','朗读'],['dialogue','对话'],['other','其他']],
  quality: [['clear','清楚'],['noisy','噪声'],['unclear','听不清']]
};
export const VIDEO_OPTIONS = {
  subject: [['person','人物'],['vehicle','车辆'],['object','物体'],['text','文字'],['nature','自然'],['multiple','多主体']],
  action: [['static','静止'],['moving','移动'],['contact','接触'],['changing','变化'],['other','其他']],
  camera: [['fixed','固定'],['pan','摇移'],['tracking','跟拍'],['zoom','推拉'],['uncertain','无法判断'],['not_applicable','不适用']],
  lighting: [['daylight','自然光'],['lowlight','暗光'],['colored','彩色光'],['studio','室内光'],['graphic','图形片尾'],['uncertain','无法判断']],
  physical_dynamics: [['plausible','合理'],['suspect','存疑'],['uncertain','无法判断'],['not_applicable','不适用']],
  material: [['metal','金属'],['glass','透明硬质'],['fabric','织物'],['mixed','多材质'],['graphic','图形'],['uncertain','无法判断']],
  interaction: [['contact','接触'],['occlusion','遮挡'],['none','无明显交互'],['uncertain','无法判断']]
};
export const VIDEO_LABELS = {subject:'主体',action:'动作',camera:'运镜',lighting:'光影',physical_dynamics:'物理动态',material:'材质',interaction:'交互'};
export const IMAGE_LABELS = {person:'人物',stall:'摊位',building:'建筑',goods:'商品',other:'其他'};
export const getOptionValues = options => options.map(([value]) => value);
