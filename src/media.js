import { interpolateTrack } from './core.js';
import { clamp, formatTime } from './utils.js';
import { icon } from './icons.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SVG_SIZE = 1000;
const TIMELINE_HEIGHT = 120;
const MIN_SEGMENT_SECONDS = 0.08;
const MIN_DRAG_PIXELS = 4;
const MIN_BOX_SIZE = 0.005;
const SEGMENT_COLORS = ['#8d74d9', '#6f94c9', '#b38bc1'];

function getDuration(context) {
  const loadedDuration = context.player?.duration;
  return Number.isFinite(loadedDuration) && loadedDuration > 0 ? loadedDuration : context.task.media.duration || 0;
}

function getCurrentTime(context) {
  return context.player?.currentTime || 0;
}

function getSelectedSegment(context) {
  return context.task.segments.find(segment => segment.id === context.getSelection().segmentId);
}

function setCurrentTime(context, time) {
  if (!context.player || !Number.isFinite(time)) return;
  context.player.currentTime = clamp(time, 0, getDuration(context));
  syncTransport(context);
  context.repaint();
}

async function playMedia(context) {
  if (!context.player || context.abort.signal.aborted) return;
  try {
    await context.player.play();
  } catch (error) {
    if (!context.abort.signal.aborted) context.onError?.(`媒体暂时无法播放：${error.message}`);
  }
}

function syncTransport(context) {
  const time = getCurrentTime(context);
  const duration = getDuration(context);
  const currentLabel = context.root.querySelector('#current-time');
  const durationLabel = context.root.querySelector('#duration-time');
  const slider = context.root.querySelector('#seek-slider');
  const playButton = context.root.querySelector('#play-toggle');
  if (currentLabel) currentLabel.textContent = formatTime(time);
  if (durationLabel) durationLabel.textContent = formatTime(duration);
  if (slider) { slider.max = String(duration); slider.step = '0.001'; slider.value = String(time); }
  if (playButton) {
    const isPlaying = context.player && !context.player.paused;
    playButton.innerHTML = icon(isPlaying ? 'pause' : 'play');
    playButton.setAttribute('aria-label', isPlaying ? '暂停播放' : '播放媒体');
    playButton.title = isPlaying ? '暂停播放' : '播放媒体';
  }
  context.onTimeChange?.(time);
}

function checkSegmentEnd(context) {
  const segment = context.activeSegment;
  if (!segment || !context.player || context.player.currentTime < segment.end) return;
  if (context.loop) {
    context.player.currentTime = segment.start;
    void playMedia(context);
  } else {
    context.player.pause();
    context.player.currentTime = segment.end;
    context.activeSegment = null;
  }
}

function notifyDimensions(context) {
  const visual = context.root.querySelector('#visual-media') || context.player;
  context.onDuration?.({
    duration: getDuration(context),
    width: visual?.naturalWidth || visual?.videoWidth || context.task.media.width || 0,
    height: visual?.naturalHeight || visual?.videoHeight || context.task.media.height || 0,
  });
  syncTransport(context);
  context.repaint();
}

function installPlayback(context) {
  const listen = (node, event, callback) => node?.addEventListener(event, callback, { signal: context.abort.signal });
  const player = context.player;
  listen(player, 'loadedmetadata', () => notifyDimensions(context));
  listen(player, 'timeupdate', () => { checkSegmentEnd(context); syncTransport(context); context.repaint(); });
  for (const event of ['play', 'pause', 'seeked', 'ended']) {
    listen(player, event, () => { if (event === 'ended') checkSegmentEnd(context); syncTransport(context); context.repaint(); });
  }
  listen(player, 'error', () => context.onError?.('无法读取该媒体，请检查文件编码或重新关联原文件。'));
  listen(context.root.querySelector('#visual-media'), 'load', () => notifyDimensions(context));
  listen(context.root.querySelector('#visual-media'), 'error', () => context.onError?.('图片加载失败，请重新关联原文件。'));
  listen(context.root.querySelector('#seek-slider'), 'input', event => {
    context.activeSegment = null;
    setCurrentTime(context, Number(event.target.value));
  });
  listen(context.root.querySelector('#playback-speed'), 'change', event => {
    const speed = Number(event.target.value);
    if (player && Number.isFinite(speed) && speed > 0) player.playbackRate = speed;
  });
  if (player?.readyState >= 1 || context.root.querySelector('#visual-media')?.complete) {
    queueMicrotask(() => { if (!context.abort.signal.aborted) notifyDimensions(context); });
  }
}

function timelinePoint(context, event) {
  const bounds = context.canvas.getBoundingClientRect();
  return { x: clamp(event.clientX - bounds.left, 0, bounds.width), width: bounds.width };
}

function finishTimelineDrag(context, event) {
  const drag = context.timelineDrag;
  context.timelineDrag = null;
  if (!drag) return;
  const point = timelinePoint(context, event);
  const duration = getDuration(context);
  const start = Math.min(drag.x, point.x) / point.width * duration;
  const end = Math.max(drag.x, point.x) / point.width * duration;
  if (context.editable && Math.abs(drag.x - point.x) >= MIN_DRAG_PIXELS && end - start >= MIN_SEGMENT_SECONDS) {
    context.onCreateSegment?.({ start: Number(start.toFixed(3)), end: Number(end.toFixed(3)) });
  } else {
    const time = point.x / point.width * duration;
    const segment = context.task.segments.find(item => time >= item.start && time <= item.end);
    if (segment) context.onSelectSegment?.(segment.id);
    context.activeSegment = null;
    setCurrentTime(context, time);
  }
  context.repaint();
}

function installTimeline(context) {
  if (!context.canvas) return;
  const canvas = context.canvas;
  const eventOptions = { signal: context.abort.signal };
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || getDuration(context) <= 0) return;
    event.preventDefault();
    context.timelineDrag = { ...timelinePoint(context, event), pointerId: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
  }, eventOptions);
  canvas.addEventListener('pointermove', event => {
    if (!context.timelineDrag) return;
    context.timelineDrag.currentX = timelinePoint(context, event).x;
    context.repaint();
  }, eventOptions);
  canvas.addEventListener('pointerup', event => finishTimelineDrag(context, event), eventOptions);
  canvas.addEventListener('pointercancel', () => { context.timelineDrag = null; context.repaint(); }, eventOptions);
}

function paintTimelineGrid(drawing) {
  const { ctx, width, duration } = drawing;
  ctx.clearRect(0, 0, width, TIMELINE_HEIGHT);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, TIMELINE_HEIGHT);
  ctx.font = '9px Consolas, monospace';
  const tickCount = Math.max(2, Math.floor(width / 90));
  for (let index = 0; index <= tickCount; index += 1) {
    const x = index / tickCount * width;
    ctx.strokeStyle = '#edf0f5'; ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, TIMELINE_HEIGHT); ctx.stroke();
    ctx.fillStyle = '#959bab'; ctx.textAlign = index === 0 ? 'left' : index === tickCount ? 'right' : 'center';
    ctx.fillText(formatTime(index / tickCount * duration), x, 12);
  }
}

function paintTimelineSegments(context, drawing) {
  const { ctx, width, duration } = drawing;
  const selectedId = context.getSelection().segmentId;
  context.task.segments.forEach((segment, index) => {
    const left = segment.start / duration * width;
    const length = (segment.end - segment.start) / duration * width;
    const selected = segment.id === selectedId;
    ctx.fillStyle = selected ? '#e9e1fc' : '#f1eef9';
    ctx.fillRect(left, 26, length, 85);
    ctx.strokeStyle = selected ? '#8968d6' : '#ded7ee'; ctx.lineWidth = selected ? 1.4 : 0.7;
    ctx.strokeRect(left + 0.7, 26, Math.max(0, length - 1.4), 85);
    ctx.fillStyle = SEGMENT_COLORS[index % SEGMENT_COLORS.length]; ctx.textAlign = 'left';
    if (length > 32) ctx.fillText(`片段 ${index + 1}`, left + 7, 104, Math.max(0, length - 14));
  });
}

function paintWaveform(context, drawing) {
  const { ctx, width } = drawing;
  const baseline = 66;
  ctx.strokeStyle = '#e0d8ef'; ctx.beginPath(); ctx.moveTo(0, baseline); ctx.lineTo(width, baseline); ctx.stroke();
  if (context.task.modality !== 'audio') return;
  const peaks = context.task.media.peaks;
  if (!Array.isArray(peaks) || !peaks.length) {
    ctx.fillStyle = '#9691a4'; ctx.textAlign = 'center'; ctx.fillText('未生成波形', width / 2, baseline - 8); return;
  }
  const barCount = Math.min(peaks.length, Math.max(1, Math.floor(width / 3)));
  ctx.fillStyle = '#a18ad7';
  for (let index = 0; index < barCount; index += 1) {
    const sourceIndex = Math.min(peaks.length - 1, Math.floor(index / barCount * peaks.length));
    const amplitude = Number.isFinite(peaks[sourceIndex]) ? clamp(Math.abs(peaks[sourceIndex])) : 0;
    const height = Math.max(1, amplitude * 60);
    ctx.fillRect(index / barCount * width, baseline - height / 2, Math.max(1, width / barCount - 1.4), height);
  }
}

function paintTimeline(context) {
  if (!context.canvas) return;
  const canvas = context.canvas;
  const width = canvas.getBoundingClientRect().width;
  if (!width) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
  if (canvas.height !== TIMELINE_HEIGHT * ratio) canvas.height = TIMELINE_HEIGHT * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const duration = getDuration(context);
  const drawing = { ctx, width, duration: duration || 1 };
  paintTimelineGrid(drawing); paintTimelineSegments(context, drawing); paintWaveform(context, drawing);
  if (context.timelineDrag?.currentX !== undefined && context.editable) {
    const left = Math.min(context.timelineDrag.x, context.timelineDrag.currentX);
    ctx.fillStyle = '#9c7cdd55'; ctx.fillRect(left, 23, Math.abs(context.timelineDrag.currentX - context.timelineDrag.x), 89);
  }
  const pointerX = duration ? getCurrentTime(context) / duration * width : 0;
  ctx.strokeStyle = '#7452c3'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pointerX, 20); ctx.lineTo(pointerX, TIMELINE_HEIGHT); ctx.stroke();
  ctx.fillStyle = '#7452c3'; ctx.beginPath(); ctx.moveTo(pointerX - 4, 18); ctx.lineTo(pointerX + 4, 18); ctx.lineTo(pointerX, 24); ctx.fill();
}

function createSvgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function getVisibleBoxes(context) {
  if (context.task.modality === 'image') return context.task.regions;
  return context.task.tracks.flatMap(track => {
    const box = interpolateTrack(track, getCurrentTime(context));
    return box ? [{ id: track.id, label: track.label, ...box }] : [];
  });
}

function appendBox(context, box, selected, preview = false) {
  const group = createSvgElement('g', { 'data-annotation-id': box.id || '', cursor: context.editable ? 'move' : 'pointer' });
  const color = selected ? '#c1afff' : '#a18df0';
  const left = box.x * SVG_SIZE; const top = box.y * SVG_SIZE;
  const rectangle = createSvgElement('rect', { x: left, y: top, width: box.width * SVG_SIZE, height: box.height * SVG_SIZE,
    fill: selected ? '#ab91f521' : '#ab91f50c', stroke: color, 'stroke-width': selected ? 2.5 : 1.5,
    'stroke-dasharray': preview ? '6 4' : '', 'vector-effect': 'non-scaling-stroke' });
  group.append(rectangle);
  if (!preview) {
    const label = `${box.label || '未命名'} · ${String(box.id).slice(-5)}`;
    const labelTop = Math.max(0, top - 35);
    group.append(createSvgElement('rect', { x: left, y: labelTop, width: Math.min(300, Math.max(110, label.length * 17)), height: 34, fill: color, stroke: 'none' }));
    const text = createSvgElement('text', { x: left + 8, y: labelTop + 24, fill: '#211932', 'font-size': 22, 'font-family': 'Microsoft YaHei, sans-serif' });
    text.textContent = label; group.append(text);
  }
  context.overlay.append(group);
}

function paintOverlay(context) {
  if (!context.overlay) return;
  context.overlay.replaceChildren();
  context.overlay.setAttribute('viewBox', `0 0 ${SVG_SIZE} ${SVG_SIZE}`);
  context.overlay.setAttribute('preserveAspectRatio', 'none');
  const selection = context.getSelection();
  context.overlay.style.cursor = context.editable && selection.tool === 'box' ? 'crosshair' : 'default';
  getVisibleBoxes(context).forEach(box => {
    const displayed = context.boxDrag?.type === 'move' && context.boxDrag.id === box.id ? { ...box, ...context.boxDrag.preview } : box;
    appendBox(context, displayed, box.id === selection.regionId || box.id === selection.trackId);
  });
  if (context.boxDrag?.type === 'create' && context.boxDrag.preview) appendBox(context, context.boxDrag.preview, true, true);
}

function overlayPoint(context, event) {
  const bounds = context.overlay.getBoundingClientRect();
  return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
}

function startBoxDrag(context, event) {
  if (event.button !== 0) return;
  const id = event.target.closest('[data-annotation-id]')?.dataset.annotationId;
  const point = overlayPoint(context, event);
  if (!context.editable) { if (id) context.onSelectRegion?.(id); return; }
  if (context.getSelection().tool === 'box') context.boxDrag = { type: 'create', start: point };
  else if (id) {
    const box = getVisibleBoxes(context).find(item => item.id === id);
    if (box) context.boxDrag = { type: 'move', id, start: point, original: box, preview: box };
  }
  if (context.boxDrag) { event.preventDefault(); context.overlay.setPointerCapture(event.pointerId); }
}

function updateBoxDrag(context, event) {
  const drag = context.boxDrag;
  if (!drag) return;
  const point = overlayPoint(context, event);
  if (drag.type === 'create') {
    drag.preview = { x: Math.min(point.x, drag.start.x), y: Math.min(point.y, drag.start.y), width: Math.abs(point.x - drag.start.x), height: Math.abs(point.y - drag.start.y) };
  } else {
    const { width, height } = drag.original;
    drag.preview = { x: clamp(drag.original.x + point.x - drag.start.x, 0, 1 - width), y: clamp(drag.original.y + point.y - drag.start.y, 0, 1 - height), width, height };
  }
  context.repaint();
}

function finishBoxDrag(context) {
  const drag = context.boxDrag;
  context.boxDrag = null;
  if (!drag) return;
  const box = drag.preview;
  if (drag.type === 'move') {
    if (box && (box.x !== drag.original.x || box.y !== drag.original.y)) {
      if (context.task.modality === 'image') context.onMoveRegion?.({ id: drag.id, x: box.x, y: box.y, width: box.width, height: box.height });
      else {
        context.onSelectRegion?.(drag.id);
        context.onCreateKeyframe?.({ x: box.x, y: box.y, width: box.width, height: box.height, time: getCurrentTime(context) });
      }
    } else context.onSelectRegion?.(drag.id);
  } else if (box?.width >= MIN_BOX_SIZE && box.height >= MIN_BOX_SIZE) {
    if (context.task.modality === 'image') context.onCreateRegion?.(box);
    else context.onCreateKeyframe?.({ ...box, time: getCurrentTime(context) });
  }
  context.repaint();
}

function installOverlay(context) {
  if (!context.overlay) return;
  const eventOptions = { signal: context.abort.signal };
  context.overlay.addEventListener('pointerdown', event => startBoxDrag(context, event), eventOptions);
  context.overlay.addEventListener('pointermove', event => updateBoxDrag(context, event), eventOptions);
  context.overlay.addEventListener('pointerup', () => finishBoxDrag(context), eventOptions);
  context.overlay.addEventListener('pointercancel', () => { context.boxDrag = null; context.repaint(); }, eventOptions);
}

function createController(context, observer) {
  return {
    destroy() { context.abort.abort(); observer.disconnect(); context.player?.pause(); },
    playPause() {
      if (!context.player) return;
      if (!context.player.paused) context.player.pause();
      else void playMedia(context);
    },
    playSegment(id) {
      const segment = id ? context.task.segments.find(item => item.id === id) : getSelectedSegment(context);
      if (!segment || !context.player || segment.end <= segment.start) return;
      context.activeSegment = { ...segment };
      setCurrentTime(context, segment.start);
      void playMedia(context);
    },
    seek(time) { context.activeSegment = null; setCurrentTime(context, time); },
    nudge(seconds) { context.activeSegment = null; setCurrentTime(context, getCurrentTime(context) + seconds); },
    setLoop(enabled) {
      context.loop = Boolean(enabled);
      context.activeSegment = enabled ? getSelectedSegment(context) || null : null;
      if (context.activeSegment && (getCurrentTime(context) < context.activeSegment.start || getCurrentTime(context) >= context.activeSegment.end)) setCurrentTime(context, context.activeSegment.start);
    },
    repaint() { context.repaint(); },
    get currentTime() { return getCurrentTime(context); },
    get duration() { return getDuration(context); },
  };
}

/** This factory coordinates one mounted media surface; each renderer owns one concern. */
export function mountMedia(options) {
  const context = { ...options, abort: new AbortController(), loop: false, activeSegment: null, timelineDrag: null, boxDrag: null,
    player: options.root.querySelector('#media-player'), canvas: options.root.querySelector('#timeline-canvas'), overlay: options.root.querySelector('#annotation-overlay') };
  context.repaint = () => { if (!context.abort.signal.aborted) { paintTimeline(context); paintOverlay(context); } };
  const observer = new ResizeObserver(() => context.repaint());
  if (context.canvas) observer.observe(context.canvas);
  const surface = options.root.querySelector('#visual-surface');
  if (surface) observer.observe(surface);
  installPlayback(context); installTimeline(context); installOverlay(context);
  syncTransport(context); context.repaint();
  return createController(context, observer);
}
