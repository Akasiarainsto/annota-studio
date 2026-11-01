import {escapeHtml,icon,optionButtons} from '../views/shared.js';
import {IMAGE_LABELS} from '../core/attributes.js';
import {clone,makeId} from '../core/segments.js';

// The SVG uses original-image pixels; zoom and pan change the viewport, never saved coordinates.
export async function mountImageEditor(options) {
  const {root,task,getDocument,onChange,onError,readonly}=options;const doc=getDocument();
  const state={selected:null,mode:readonly?'select':'box',zoom:1,drag:null};
  root.innerHTML=`<div class="visual-editor image-editor"><div class="image-left"><div class="image-toolbar"><button data-image-mode="box" ${readonly?'disabled':''}>${icon('box')} 框选</button><button data-image-mode="select">选择 / 移动</button><button data-image-mode="pan">平移</button><span class="push-right"></span><button data-image-zoom="out">−</button><span id="image-zoom">100%</span><button data-image-zoom="in">＋</button><button data-image-zoom="fit">适应</button><button data-history="undo" class="icon-button" aria-label="撤销">${icon('undo')}</button><button data-history="redo" class="icon-button" aria-label="重做">${icon('redo')}</button></div><div class="image-viewport"><div class="image-plane" style="aspect-ratio:${doc.media.width}/${doc.media.height}"><img src="${escapeHtml(doc.media.url)}" alt="待标注的街边市集实拍图" draggable="false"><svg viewBox="0 0 ${doc.media.width} ${doc.media.height}" aria-label="图片区域标注画布"></svg></div></div><div class="image-meta"><span>${doc.media.width} × ${doc.media.height} px · 坐标使用原图像素</span>${task.source.url?`<a href="${escapeHtml(task.source.url)}" target="_blank" rel="noreferrer">素材来源</a>`:`<span>${escapeHtml(task.source.name)}</span>`}</div><div class="editor-hint">框选可见区域；选择模式可移动框，拖动四角调整大小。放大后可滚动或切换平移。</div></div><aside class="properties-scroll"><label>图片 Caption<textarea id="image-caption" rows="5" ${readonly?'readonly':''}>${escapeHtml(doc.caption)}</textarea></label><div class="attribute-line vertical"><span>场景</span>${optionButtons([['market','市集'],['street','街道'],['indoor','室内'],['nature','自然'],['other','其他']],doc.scene,'scene',readonly)}</div><div class="attribute-line vertical"><span>光线</span>${optionButtons([['daylight','自然光'],['lowlight','暗光'],['artificial','人工光'],['uncertain','无法判断']],doc.lighting,'lighting',readonly)}</div><div class="attribute-line vertical"><span>标签 <span class="muted">可多选</span></span><div id="image-tags"></div></div><div class="section-label">区域 <span id="box-count"></span><button data-delete-box class="text-button danger" ${readonly?'disabled':''}>删除选中</button></div><div id="box-list"></div><div id="box-properties"></div><label class="confirmation"><input id="image-confirm" type="checkbox" ${doc.content_confirmed?'checked':''} ${readonly?'disabled':''}>已核对 Caption、标签和主体区域</label></aside></div>`;
  const svg=root.querySelector('.image-plane svg');const viewport=root.querySelector('.image-viewport');
  const plane=root.querySelector('.image-plane');
  const fit=()=>{const width=Math.min(viewport.clientWidth,viewport.clientHeight*doc.media.width/doc.media.height);plane.style.width=width*state.zoom+'px';plane.style.marginInline='auto';plane.style.marginTop=Math.max(0,(viewport.clientHeight-width*state.zoom*doc.media.height/doc.media.width)/2)+'px';};
  const observer=new ResizeObserver(fit);observer.observe(viewport);fit();
  const current=()=>getDocument().boxes.find(box=>box.id===state.selected);
  const commit=next=>{next.content_confirmed=false;onChange(next);refresh();};
  const point=event=>{const rect=svg.getBoundingClientRect();return {x:Math.max(0,Math.min(doc.media.width,(event.clientX-rect.left)/rect.width*doc.media.width)),y:Math.max(0,Math.min(doc.media.height,(event.clientY-rect.top)/rect.height*doc.media.height))};};
  function renderBoxes(preview) {
    const boxes=preview||getDocument().boxes;const handleSize=12/state.zoom;
    svg.innerHTML=boxes.map(box=>`<g data-box="${escapeHtml(box.id)}"><rect class="annotation-box ${box.id===state.selected?'active':''}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"/><text class="box-label" x="${box.x+5}" y="${Math.max(20,box.y-8)}">${escapeHtml(box.id)} · ${IMAGE_LABELS[box.label]||box.label}</text>${box.id===state.selected&&!readonly?[[box.x,box.y,'nw'],[box.x+box.width,box.y,'ne'],[box.x,box.y+box.height,'sw'],[box.x+box.width,box.y+box.height,'se']].map(([x,y,edge])=>`<rect class="box-handle" data-box-edge="${edge}" x="${x-handleSize/2}" y="${y-handleSize/2}" width="${handleSize}" height="${handleSize}"/>`).join(''):''}</g>`).join('');
  }
  function refresh() {
    renderBoxes();root.querySelector('#box-count').textContent=getDocument().boxes.length;
    root.querySelectorAll('[data-image-mode]').forEach(button=>button.classList.toggle('selected',button.dataset.imageMode===state.mode));
    root.querySelector('#image-tags').innerHTML=Object.entries(IMAGE_LABELS).map(([key,label])=>`<button class="choice ${getDocument().tags.includes(key)?'selected':''}" data-tag="${key}" ${readonly?'disabled':''}>${label}</button>`).join('');
    root.querySelector('#box-list').innerHTML=getDocument().boxes.length?getDocument().boxes.map(box=>`<button class="box-list-row ${box.id===state.selected?'selected':''}" data-select-box="${escapeHtml(box.id)}">${escapeHtml(box.id)}<span>${IMAGE_LABELS[box.label]}</span><small>${Math.round(box.width)} × ${Math.round(box.height)}</small></button>`).join(''):'<p class="muted">尚无区域。选择“框选”后在图上拖动。</p>';
    const box=current();root.querySelector('#box-properties').innerHTML=box?`<div class="box-properties"><label>区域类别<select id="box-label" ${readonly?'disabled':''}>${Object.entries(IMAGE_LABELS).map(([key,label])=>`<option value="${key}" ${box.label===key?'selected':''}>${label}</option>`).join('')}</select></label><div class="coordinate-fields">${['x','y','width','height'].map(key=>`<label>${key}<input data-coordinate="${key}" type="number" value="${Math.round(box[key]*100)/100}" step="1" ${readonly?'disabled':''}></label>`).join('')}</div><label class="inline-check"><input id="box-occluded" type="checkbox" ${box.occluded?'checked':''} ${readonly?'disabled':''}>此主体有遮挡</label></div>`:'';
    root.querySelector('#image-confirm').checked=!!getDocument().content_confirmed;
    const caption=root.querySelector('#image-caption');if(document.activeElement!==caption)caption.value=getDocument().caption;
    root.querySelectorAll('[data-choice]').forEach(button=>button.classList.toggle('selected',getDocument()[button.dataset.choice]===button.dataset.value));
  }
  root.addEventListener('click',event=>{
    const mode=event.target.closest('[data-image-mode]');if(mode){state.mode=mode.dataset.imageMode;refresh();}
    const zoom=event.target.closest('[data-image-zoom]');if(zoom){state.zoom=zoom.dataset.imageZoom==='fit'?1:Math.max(.5,Math.min(4,state.zoom*(zoom.dataset.imageZoom==='in'?1.25:.8)));fit();root.querySelector('#image-zoom').textContent=Math.round(state.zoom*100)+'%';renderBoxes();}
    const select=event.target.closest('[data-select-box]');if(select){state.selected=select.dataset.selectBox;state.mode='select';refresh();}
    if(readonly)return;const choice=event.target.closest('[data-choice]');const tag=event.target.closest('[data-tag]');
    if(choice){const next=clone(getDocument());next[choice.dataset.choice]=choice.dataset.value;commit(next);}
    if(tag){const next=clone(getDocument());next.tags=next.tags.includes(tag.dataset.tag)?next.tags.filter(value=>value!==tag.dataset.tag):[...next.tags,tag.dataset.tag];commit(next);}
    if(event.target.closest('[data-delete-box]')&&current()){const next=clone(getDocument());next.boxes=next.boxes.filter(box=>box.id!==state.selected);state.selected=null;commit(next);}
  });
  root.addEventListener('input',event=>{if(!readonly&&event.target.id==='image-caption'){const next=clone(getDocument());next.caption=event.target.value;next.content_confirmed=false;onChange(next);root.querySelector('#image-confirm').checked=false;}});
  root.addEventListener('change',event=>{
    if(readonly)return;const target=event.target,next=clone(getDocument()),box=next.boxes.find(item=>item.id===state.selected);
    if(target.id==='image-confirm'){next.content_confirmed=target.checked;onChange(next);return;}
    if(target.id==='box-label'&&box)box.label=target.value;
    else if(target.id==='box-occluded'&&box)box.occluded=target.checked;
    else if(target.dataset.coordinate&&box)box[target.dataset.coordinate]=target.value===''?null:Number(target.value);
    else return;commit(next);
  });
  svg.addEventListener('pointerdown',event=>{
    const start=point(event),boxId=event.target.closest('[data-box]')?.dataset.box;
    if(state.mode==='pan'){state.drag={mode:'pan',x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};}
    else if(!readonly&&state.mode==='box')state.drag={mode:'new',start};
    else if(boxId){state.selected=boxId;refresh();if(!readonly)state.drag={mode:'move',start,original:clone(current()),edge:event.target.dataset.boxEdge};}
    if(state.drag){svg.setPointerCapture(event.pointerId);event.preventDefault();}
  });
  svg.addEventListener('pointermove',event=>{
    const drag=state.drag;if(!drag)return;
    if(drag.mode==='pan'){viewport.scrollLeft=drag.left-(event.clientX-drag.x);viewport.scrollTop=drag.top-(event.clientY-drag.y);return;}
    const at=point(event);let box;
    if(drag.mode==='new')box={id:'新区域',x:Math.min(at.x,drag.start.x),y:Math.min(at.y,drag.start.y),width:Math.abs(at.x-drag.start.x),height:Math.abs(at.y-drag.start.y),label:'person',occluded:false};
    else {box=clone(drag.original);if(drag.edge){let left=box.x,right=box.x+box.width,top=box.y,bottom=box.y+box.height;if(drag.edge.includes('w'))left=at.x;if(drag.edge.includes('e'))right=at.x;if(drag.edge.includes('n'))top=at.y;if(drag.edge.includes('s'))bottom=at.y;box={...box,x:Math.min(left,right),y:Math.min(top,bottom),width:Math.abs(right-left),height:Math.abs(bottom-top)};}else{box.x=Math.max(0,Math.min(doc.media.width-box.width,box.x+at.x-drag.start.x));box.y=Math.max(0,Math.min(doc.media.height-box.height,box.y+at.y-drag.start.y));}}
    drag.preview=box;renderBoxes(drag.mode==='new'?[...getDocument().boxes,box]:getDocument().boxes.map(item=>item.id===box.id?box:item));
  });
  svg.addEventListener('pointerup',()=>{
    const drag=state.drag;state.drag=null;if(!drag?.preview)return;
    if(drag.preview.width<4||drag.preview.height<4){refresh();return;}
    const next=clone(getDocument());if(drag.mode==='new'){drag.preview.id=makeId('B');next.boxes.push(drag.preview);state.selected=drag.preview.id;state.mode='select';}else next.boxes=next.boxes.map(box=>box.id===drag.preview.id?drag.preview:box);commit(next);
  });
  root.querySelector('img').addEventListener('error',()=>onError(new Error('图片加载失败，请重新导入')));refresh();
  return {refresh,select:id=>{state.selected=id;refresh();},get selected(){return current();},destroy:async()=>{observer.disconnect();}};
}
