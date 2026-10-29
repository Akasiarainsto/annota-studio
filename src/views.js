import {icon} from './icons.js';
import {escapeHtml as esc,formatTime} from './utils.js';
import {PROJECTS,VIDEO_FIELDS} from './seed-data.js';
import {STATUS_LABELS,calculateCer} from './core.js';
import {AUDIO_DIALECTS,AUDIO_NOISE_TAGS} from './validation_rules/profiles.js';

const PHASE_COPY={annotation:['数据标注','我在制作数据：记录素材中真实存在的内容。'],review:['数据质检','我在检查数据：复核人工标注的内容与结构。'],evaluation:['模型评测','我在检验模型：只判断原始模型输出，不改写标注。']};
export function field(options) {
  const {bind,label,value='',type='text',hint='',rows=3}=options;
  const id=`field-${bind.replaceAll('.','-')}`;
  const attrs=`id="${id}" data-bind="${bind}"`;
  const control=type==='textarea'?`<textarea ${attrs} rows="${rows}">${esc(value)}</textarea>`:`<input ${attrs} type="${type}" value="${esc(value)}" ${type==='number'?'step="0.001"':''}>`;
  return `<div class="field"><label for="${id}">${label}</label>${control}${hint?`<small>${hint}</small>`:''}</div>`;
}
export function selectField(options) {
  const {bind,label,value,choices}=options;
  const id=`field-${bind.replaceAll('.','-')}`;
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-bind="${bind}">${choices.map(choice=>`<option value="${esc(choice)}" ${choice===value?'selected':''}>${esc(choice)}</option>`).join('')}</select></div>`;
}
export function taskCard(task,active) {
  const count=task.modality==='image'?`${task.regions.length} 个区域`:`${task.segments.length} 个片段`;
  return `<button class="task_card ${active?'active':''}" data-task="${esc(task.id)}" aria-pressed="${active}"><span class="task_thumb">${task.modality==='image'&&task.media.url?`<img alt="" src="${esc(task.media.url)}">`:icon(task.modality)}</span><span class="task_summary"><strong>${esc(task.title)}</strong><span>${esc(task.id)} · ${count} · ${STATUS_LABELS[task.status]}</span></span><i class="status_dot status_${task.status}"></i></button>`;
}
export function heading(task,phase) {
  const [title,copy]=PHASE_COPY[phase];
  return `<div class="workspace_heading"><div><div class="eyebrow">${PROJECTS[task.modality].name} <span>/</span> ${esc(task.id)} <span>/</span> ${title}</div><h1>${esc(task.title)}</h1><p class="subtitle">${copy}</p></div><div class="heading_actions"><span class="badge status_${task.status}">${STATUS_LABELS[task.status]}</span>${phase==='annotation'?`<button class="button" data-action="save">保存草稿</button><button class="button primary" data-action="submit" ${['pending','approved'].includes(task.status)?'disabled':''}>提交质检 ${icon('chevron')}</button>`:`<button class="button" data-action="back-to-annotation">${icon('back')} 返回标注</button>`}</div></div>`;
}
function mediaToolbar(task,editable,selection) {
  const imageTools=`<button class="icon_button ${selection.tool==='select'?'active':''}" data-action="tool-select" title="选择与移动（V）" aria-label="选择与移动">${icon('pointer')}</button>${editable?`<button class="icon_button ${selection.tool==='box'?'active':''}" data-action="tool-box" title="绘制目标框（B）" aria-label="绘制目标框">${icon('box')}</button><button class="icon_button" data-action="undo" title="撤销上一次标注操作" aria-label="撤销">${icon('undo')}</button>`:''}`;
  return `<div class="media_toolbar"><div class="tool_group">${task.modality==='audio'?`${icon('audio')}<span class="toolbar_label">原始音频</span>`:imageTools}</div><div class="tool_group">${task.modality==='image'?`<button class="icon_button" data-action="zoom-out" aria-label="缩小">${icon('minus')}</button><span id="zoom-level" class="toolbar_label">100%</span><button class="icon_button" data-action="zoom-in" aria-label="放大">${icon('plus')}</button><button class="icon_button" data-action="fit" aria-label="适应窗口">${icon('fit')}</button>`:`<span class="toolbar_label">${task.modality==='audio'?'WAV / 分段转写':'VIDEO / 片段与轨迹'}</span>`}<button class="icon_button" data-action="task-info" aria-label="素材来源与规范" title="素材来源与规范">${icon('info')}</button></div></div>`;
}
function transport(task) {
  return `<div class="transport"><button id="play-toggle" class="play_button" data-action="play" aria-label="播放">${icon('play')}</button>${task.modality==='video'?`<button class="icon_button" data-action="previous-frame" aria-label="后退1/30秒">${icon('back')}</button><button class="icon_button" data-action="next-frame" aria-label="前进1/30秒">${icon('next')}</button>`:''}<span class="time_readout"><b id="current-time">00:00.00</b> <span>/</span> <span id="duration-time">${formatTime(task.media.duration)}</span></span><input id="seek-slider" class="seek_slider" type="range" min="0" max="${task.media.duration}" step="0.001" value="0" aria-label="播放位置"><select id="playback-speed" class="speed_select" aria-label="播放倍速"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><button class="icon_button" id="loop-toggle" data-action="loop" aria-label="循环所选片段" aria-pressed="false" title="循环所选片段">${icon('loop')}</button></div>`;
}
export function mediaPanel(task,editable,selection) {
  const source=esc(task.media.url || '');
  const visual=task.modality==='image'?`<img id="visual-media" src="${source}" alt="${esc(task.title)}" draggable="false">`:`<video id="media-player" src="${source}" preload="auto" playsinline></video>`;
  const audioSource=task.media.imported?'本地导入素材':task.segments.length&&task.segments.every(segment=>String(segment.label || '').toLowerCase()==='noise')?'程序噪声 / 教学样例':'合成普通话 / 教学样例';
  const stage=task.modality==='audio'?`<div class="media_stage audio_stage"><div class="audio_identity"><div class="audio_orb">${icon('audio')}</div><div><div class="wave_summary">DOLPHIN · AUDIO ANNOTATION</div><h2>${esc(task.media.name)}</h2><p>${audioSource} <span>·</span> ${formatTime(task.media.duration)}</p></div></div><audio id="media-player" src="${source}" preload="auto"></audio></div>`:`<div class="visual_viewport"><div id="visual-surface" class="visual_surface">${visual}<svg id="annotation-overlay" class="annotation_overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="标注画布"></svg></div></div>`;
  return `<section class="media_panel">${mediaToolbar(task,editable,selection)}${stage}${task.modality==='image'?'':transport(task)}</section>`;
}
export function timeline(task,editable) {
  if(task.modality==='image') return '';
  return `<section class="timeline_panel"><div class="timeline_header"><h3>${task.modality==='audio'?'音频波形':'视频时间轴'}</h3><small>${editable?'拖选新片段 · 点击定位':'点击时间轴定位试听'}</small></div><canvas id="timeline-canvas" class="timeline_canvas" aria-label="${task.modality==='audio'?'音频波形与片段选择':'视频片段时间轴'}"></canvas><div class="timeline_ruler"><span>00:00</span><span>${formatTime(task.media.duration/4)}</span><span>${formatTime(task.media.duration/2)}</span><span>${formatTime(task.media.duration*3/4)}</span><span>${formatTime(task.media.duration)}</span></div><div id="segment-lane" class="segment_lane"></div></section>`;
}
export function segmentRows(task,selection,editable) {
  if(!task.segments.length) return '<div class="empty_state">尚无片段。拖选时间轴或点击“添加片段”，从空白开始。</div>';
  return task.segments.map((segment,index)=>`<div class="segment_row ${selection.segmentId===segment.id?'active':''}" data-segment="${esc(segment.id)}" role="button" tabindex="0"><span class="segment_index">${String(index+1).padStart(2,'0')}</span><span class="segment_times">${formatTime(segment.start)} — ${formatTime(segment.end)} <span>· ${esc(segment.speaker || segment.label || '片段')}</span></span><span class="segment_text">${esc(segment.text || segment.description?.action || '待填写标注')}</span><span class="row_actions"><button data-play-segment="${esc(segment.id)}" aria-label="试听片段${index+1}" title="播放此片段">${icon('play')}</button>${editable?`<button data-delete-segment="${esc(segment.id)}" aria-label="删除片段${index+1}" title="删除片段">${icon('trash')}</button>`:''}</span></div>`).join('');
}
export function segmentsPanel(task,selection,editable) {
  if(task.modality==='image')return `<section class="segment_section"><div class="section_heading"><h2>图像标注</h2><small>${task.regions.length} 个目标区域</small></div><div class="inline_notice" style="margin:16px">${editable?'点击右侧编辑 Caption；使用框选工具，在图像上拖出目标区域。':'对照图像检查人工 Caption、标签和区域是否准确。'}</div></section>`;
  return `<section class="segment_section"><div class="section_heading"><h2>${task.modality==='audio'?'逐段转写':'分段描述'} <span class="muted">${task.segments.length}</span></h2>${editable?`<button class="button small" data-action="add-segment">${icon('plus')} 添加片段</button>`:'<small>人工标注记录 · 只读</small>'}</div><div id="segment-list" class="segment_list">${segmentRows(task,selection,editable)}</div></section>`;
}
export function audioEditor(task,selection) {
  const segment=task.segments.find(segment=>segment.id===selection.segmentId);
  if(!segment) return '<div class="empty_state">选中或新建一个片段，即可填写转写和属性。</div>';
  return `${timeFields(segment)}${selectField({bind:'segment.label',label:'片段类型',value:segment.label,choices:['Speech','Noise']})}${field({bind:'segment.text',label:'转写文本',value:segment.text,type:'textarea',hint:'忠实记录听到的内容；噪声可写 [噪声]。',rows:4})}<div class="field_row">${field({bind:'segment.speaker',label:'说话人',value:segment.speaker})}${field({bind:'segment.language',label:'语种',value:segment.language})}</div>${selectField({bind:'segment.dialect',label:'方言 / 口音 · 约定枚举',value:segment.dialect,choices:['','普通话（合成）',...AUDIO_DIALECTS]})}${field({bind:'segment.scene',label:'场景',value:segment.scene})}<div class="field"><label>整条音频的噪声 / 静音标签</label><div class="tag_options">${[...AUDIO_NOISE_TAGS].map(tag=>`<button class="tag_chip ${task.noiseTags?.includes(tag)?'active':''}" data-noise-tag="${tag}">${tag}</button>`).join('')}</div><small>Noise 任务至少一项；纯噪声说话人可填“不适用”。</small></div><label class="check_item"><input type="checkbox" data-bind="segment.mixed" ${segment.mixed?'checked':''}> 包含语种混说</label>`;
}
function timeFields(segment) {
  return `<div class="field_row">${field({bind:'segment.start',label:'起始时间 · 秒',value:segment.start,type:'number'})}${field({bind:'segment.end',label:'结束时间 · 秒',value:segment.end,type:'number'})}</div><div class="tool_group" style="margin:-5px 0 15px"><button class="button small" data-action="set-start">取当前起点 [</button><button class="button small" data-action="set-end">取当前终点 ]</button></div>`;
}
export function videoEditor(task,selection) {
  if(selection.inspectorTab==='objects') return objectEditor(task,selection);
  const segment=task.segments.find(segment=>segment.id===selection.segmentId);
  if(!segment)return '<div class="empty_state">在时间轴上拖选一个片段，记录七项 Dense Caption。</div>';
  return `${timeFields(segment)}${field({bind:'segment.overlapReason',label:'重叠原因（片段重叠时必填）',value:segment.overlapReason||''})}${field({bind:'segment.text',label:'片段摘要',value:segment.text})}${Object.entries(VIDEO_FIELDS).map(([key,label])=>field({bind:`description.${key}`,label,value:segment.description?.[key] || '',type:'textarea',rows:2})).join('')}`;
}
export function imageEditor(task,selection) {
  if(selection.inspectorTab==='objects')return objectEditor(task,selection);
  const tags=['办公','静物','摄影','人物','自然','插画','水果','中文文字'];
  return `${field({bind:'task.caption',label:'图像 Caption',value:task.caption,type:'textarea',rows:7,hint:'主体 → 动作 / 状态 → 场景 → 光影；不添加图中不存在的细节。'})}<div class="field"><label>内容标签</label><div class="tag_options">${tags.map(tag=>`<button class="tag_chip ${task.tags.includes(tag)?'active':''}" data-tag="${tag}" aria-pressed="${task.tags.includes(tag)}">${tag}</button>`).join('')}</div></div><div class="form_section"><h3>区域标注</h3><p class="muted" style="font-size:12px">使用 ${icon('box')} 框选工具创建目标，再切换“目标区域”编辑标签与位置。</p></div>`;
}
function objectEditor(task,selection) {
  const isVideo=task.modality==='video';
  const collection=isVideo?task.tracks:task.regions;
  const selectedId=isVideo?selection.trackId:selection.regionId;
  const object=collection.find(item=>item.id===selectedId);
  const listing=`<div class="object_list">${collection.map((item,index)=>`<button class="object_item ${item.id===selectedId?'active':''}" data-object="${esc(item.id)}"><i class="color_dot"></i>${esc(item.label)}<span class="muted">${isVideo?`${item.keyframes.length} 关键帧`:`#${index+1}`}</span></button>`).join('') || '<div class="empty_state">选择框选工具，在画面上拖出第一个目标框。</div>'}</div>`;
  if(!object)return listing;
  const label=field({bind:'object.label',label:isVideo?'轨迹标签':'区域标签',value:object.label});
  const detail=isVideo?`<div class="inline_notice">移动播放位置后，再次框选即可为当前轨迹添加关键帧。首末关键帧之间线性插值，范围之外不显示。</div><div class="object_list">${object.keyframes.map(frame=>`<div class="object_item"><span class="mono">${formatTime(frame.time)}</span><button class="icon_button" data-seek="${frame.time}" aria-label="定位关键帧${frame.time}">${icon('play')}</button><button class="icon_button" data-delete-keyframe="${frame.time}" aria-label="删除关键帧${frame.time}">${icon('trash')}</button></div>`).join('')}</div>`:`<div class="field_row">${field({bind:'object.x',label:'X · 归一坐标',value:object.x,type:'number'})}${field({bind:'object.y',label:'Y · 归一坐标',value:object.y,type:'number'})}</div><div class="field_row">${field({bind:'object.width',label:'宽度 · 0–1',value:object.width,type:'number'})}${field({bind:'object.height',label:'高度 · 0–1',value:object.height,type:'number'})}</div>`;
  return `${listing}<div class="form_section">${label}${detail}<button class="button danger small" data-action="delete-object">${icon('trash')} 删除${isVideo?'轨迹':'区域'}</button>${isVideo?'<button class="button small" data-action="new-track">＋ 新目标轨迹</button>':''}</div>`;
}
export function inspector(task,selection) {
  const tabs=task.modality==='audio'?[['annotation','转写与属性']]:task.modality==='video'?[['annotation','片段描述'],['objects','目标轨迹']]:[['annotation','图文描述'],['objects','目标区域']];
  const editor={audio:audioEditor,video:videoEditor,image:imageEditor}[task.modality];
  return `<div class="inspector_heading"><h2>标注检查器</h2><span class="pill">人工标注</span></div><div class="inspector_tabs">${tabs.map(([key,label])=>`<button data-inspector-tab="${key}" class="${selection.inspectorTab===key?'active':''}">${label}</button>`).join('')}</div><div class="inspector_body">${editor(task,selection)}</div><div id="live-validation" class="live_validation"></div><div class="inspector_footer"><span>标注修订 <b class="mono">r${task.revision}</b></span><button class="button small" data-action="save">保存草稿</button></div>`;
}
export function reviewPanel(task,issues) {
  return `<div class="inspector_heading"><h2>质检与验收</h2><button class="button small" data-action="json-validate">JSON校验</button></div><div class="inspector_body"><div class="form_section" style="border:0;padding-top:0"><h3>结构检查</h3><div class="notice ${issues.length?'error':''}">${issues.length?`${issues.length} 项待修正`:'结构规则通过 · 内容仍需人工检查'}</div><div class="issue_list">${issues.map(issue=>`<button class="issue_item" data-issue="${esc(issue.field)}">${esc(issue.message)}<small>${esc(issue.field)}</small></button>`).join('')}</div></div><div class="form_section"><h3>人工复核</h3><div class="check_list">${['描述或转写与素材一致','时间或区域准确，无遗漏','属性与标签符合任务规范'].map((text,index)=>`<label class="check_item"><input type="checkbox" data-review-check="${index}"> ${text}</label>`).join('')}</div></div><div class="field" style="margin-top:18px"><label for="review-note">复核意见 / 退回原因</label><textarea id="review-note" placeholder="退回时请说明具体片段、问题和修改建议。"></textarea></div><div class="review_actions"><button class="button danger" data-action="return" ${task.status!=='pending'?'disabled':''}>退回修改</button><button class="button primary" data-action="approve" ${task.status!=='pending'?'disabled':''}>通过验收</button></div><div class="inline_notice" style="margin-top:15px">同一浏览器中的审核流程演示。通过后再次编辑，需重新提交质检。</div><div class="form_section"><h3>审核记录</h3>${task.reviews.length?task.reviews.slice().reverse().map(review=>`<div class="inline_notice" style="margin-bottom:8px">${review.decision==='approved'?'通过验收':'退回修改'} · r${review.revision}<br>${esc(review.note)}<br><small>${esc(review.at)}</small></div>`).join(''):'<small class="muted">尚无审核记录</small>'}</div></div>`;
}
export function evaluationPanel(task) {
  if(task.modality==='audio')return audioEvaluation(task);
  const dimensions=task.modality==='image'?['主体与要素','结构与空间','风格一致性','光影与细节','指令遵循']:['指令遵循','主体与动作','运动自然度','时序一致性','镜头连贯性'];
  if(!task.evaluation.comparisonUrl)return '<section class="eval_card"><h2>当前任务未提供模型输出</h2><p class="muted">这是标注素材。请选择“春日果铺”或“小球运动”任务，查看人为构造的 A/B 评测样例。</p></section>';
  return `<section class="eval_card"><div class="section_heading"><h2>模拟模型输出 · A/B 评测</h2><span class="pill">人工构造</span></div><div style="padding:20px"><div class="notice">${esc(task.evaluation.notes)}</div><h3>评测指令</h3><p style="margin:10px 0 20px">${esc(task.evaluation.prompt)}</p><div class="comparison_grid">${['A','B'].map((name,index)=>`<div class="comparison_pane"><h3>输出 ${name}</h3>${task.modality==='image'?`<img src="${esc(index?task.evaluation.comparisonUrl:task.media.url)}" alt="模拟输出${name}">`:`<video controls src="${esc(index?task.evaluation.comparisonUrl:task.media.url)}" preload="metadata"></video>`}</div>`).join('')}</div><h3 style="margin-top:24px">输出 A · Rubric 人工评分</h3><div class="score_grid">${dimensions.map((name,index)=>`<div class="score_item">${selectField({bind:`rating.dim${index}`,label:name,value:String(task.evaluation.ratings[`dim${index}`] || ''),choices:['','1','2','3','4','5','na']})}</div>`).join('')}</div><small class="muted">1 核心要求失败 · 3 基本满足 · 5 完整满足 · na 不适用（请在证据中说明）</small>${selectField({bind:'evaluation.outcome',label:'同指令 A/B 结论',value:task.evaluation.outcome,choices:['','A更好','B更好','持平','均不可用']})}${field({bind:'evaluation.comment',label:'判断证据 / N/A 理由',value:task.evaluation.comment || '',type:'textarea'})}<button class="button primary" data-action="export-evaluation">导出评测记录</button></div></section>`;
}
function audioEvaluation(task) {
  const evaluation=task.evaluation;
  const result=calculateCer(evaluation.reference || '',evaluation.asrOriginal || '');
  return `<section class="eval_card"><div class="section_heading"><h2>ASR 原稿评测</h2><span class="pill">独立于人工转写</span></div><div style="padding:20px"><div class="notice">${esc(evaluation.notes || '当前任务未配置可靠参考稿与模型原稿，不计算成绩。')}</div><div class="comparison_grid"><div class="comparison_pane"><h3>独立参考稿 · 只读</h3><p>${esc(evaluation.reference || '尚无独立参考稿')}</p></div><div class="comparison_pane"><h3>ASR 原始识别稿 · 只读</h3><p>${esc(evaluation.asrOriginal || '尚无模型识别稿')}</p></div></div><div class="form_section"><h3>字符错误率 CER</h3><p class="cer_value">${result?`${(result.rate*100).toFixed(1)}<small>%</small>`:'—'}</p><p class="muted">${result?`${result.distance} 次编辑 / ${result.referenceLength} 个参考字符`:'需要独立参考稿和模型原稿。'} · 去标点、空白，按 Unicode 字符计算。</p></div><div class="inline_notice" style="margin:18px 0">人工改好的转写不参与模型 CER。预置错误为人为构造，不能当成真实模型成绩。</div>${field({bind:'evaluation.comment',label:'错例观察',value:evaluation.comment || '',type:'textarea'})}<button class="button primary" data-action="export-evaluation">导出评测记录</button></div></section>`;
}
