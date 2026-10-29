export const ALLOWED_SPLITS=new Set(['train','validation','test']);
export const ALLOWED_TAGS=new Set(['动物','人物','自然','建筑','摄影','插画','办公','静物','水果','中文文字']);
export const IMAGE_SUFFIXES=new Set(['png','jpg','jpeg','webp','bmp','tif','tiff','svg']);
export const VIDEO_SUFFIXES=new Set(['mp4','webm','mov','mkv','avi']);
export const AUDIO_SUFFIXES=new Set(['wav','mp3','m4a','aac','flac','ogg','opus','webm','aif','aiff']);
export const AUDIO_DIALECTS=new Set(['普通话','待判定','粤语','吴语','闽南语','西南官话','其他（备注）']);
export const AUDIO_NOISE_TAGS=new Set(['背景噪声','音乐','静音','听不清','混说待复核']);
export const CAPTION_FIELDS=['主体身份与外观','动作序列与时序','运镜变化','光影氛围','物理动态','材质与纹理','场景交互'];
export const PROFILES={
  image:{name:'图片',project:'Seedream',version:'annota_image_v2',idField:'sample_id',pathField:'image_path',mediaLabel:'图片',crossSplitCode:'CROSS_SPLIT_IMAGE',requiredFields:['sample_id','image_path','caption','tags','split'],textFields:['sample_id','image_path','caption'],summary:'图片引用 + Caption + 标签 + 数据划分',contract:'sample_id / image_path / caption / tags / split',ruleNotes:['Caption 必填且必须是非空字符串。','标签非空、在约定集合内且不重复；split 为 train / validation / test。','相对图片路径不得越界，引用需在所选图片清单中。','同批 ID 唯一，同一规范化图片路径不得跨数据划分。'],limitation:'图片仅按所选文件清单核对引用；不判断图文内容、审美、图片质量或近重复。'},
  video:{name:'视频',project:'Seedance',version:'annota_video_v2',idField:'sample_id',pathField:'video_path',mediaLabel:'视频',crossSplitCode:'CROSS_SPLIT_VIDEO',requiredFields:['sample_id','video_path','duration','segments','split'],textFields:['sample_id','video_path'],summary:'时间轴边界 + 七项 Dense Caption + 重叠原因',contract:'sample_id / video_path / duration / segments[].captions[7] / split',ruleNotes:['duration 是大于 0 的有限数字，时间满足 0 ≤ start < end ≤ duration。','captions 必须有固定七项，按页面说明依次填写。','视频片段可重叠，但后续重叠片段必须填写 overlap_reason；首尾相接允许。','ID 唯一、视频相对路径合法，同一视频不能跨 train/validation/test。'],limitation:'按 JSON 声明的时长检查，不验证真实视频时长、描述语义或逐帧动作对齐。'},
  audio:{name:'音频',project:'Dolphin',version:'annota_audio_v2',idField:'id',mediaLabel:'音频',requiredFields:['id','source_id','audio_file','duration','language','dialect','scene','kind','segments','noise_tags'],textFields:['id','source_id','audio_file','language','dialect','scene'],summary:'分段转写 + 说话人 + 噪声属性 + 单通道时间',contract:'id / source_id / audio_file / duration / language / dialect / scene / kind / segments / noise_tags',ruleNotes:['每段 start/end 为有限数字，0 ≤ start < end ≤ duration；本单通道规则不允许片段重叠。','text 与 speaker 必填；非语音也需填写约定标记和“不适用”。','kind 为 speech/noise；dialect 使用约定枚举。','noise_tags 使用约定标签，kind=noise 时至少一项；不检查 ASR 正确率。'],limitation:'不读取真实音频时长、不识别方言与说话人、不判断转写准确性；CER 在模型评测中单独计算。'}
};
