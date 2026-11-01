import {AUDIO_OPTIONS, getOptionValues} from './attributes.js';
import {isObject, checkText, checkEnum, checkIds, checkTime, issue} from './checks.js';

export function validateAudio(doc, options = {}) {
  const errors = [];
  if (!Array.isArray(doc.speakers) || !doc.speakers.length) errors.push(issue('/speakers','E_REQUIRED','至少定义一位说话人'));
  const speakers = Array.isArray(doc.speakers) ? doc.speakers : [];
  checkIds(speakers, '/speakers', errors);
  const speakerIds = new Set(speakers.filter(isObject).map(item => item.id));
  doc.segments.forEach((segment, index) => {
    if (!isObject(segment)) return;
    const path = `/segments/${index}`;
    checkTime(segment, {path, duration:doc.media.duration_s, code:'E_TIME_OUT_OF_RANGE'}, errors);
    checkText(segment.transcript, `${path}/transcript`, errors);
    checkEnum(segment.boundary_status,['confirmed','pending_listen'],`${path}/boundary_status`,errors);
    for (const [key, values] of Object.entries(AUDIO_OPTIONS)) checkEnum(segment[key],getOptionValues(values),`${path}/${key}`,errors);
    if (!speakerIds.has(segment.speaker_id)) errors.push(issue(`${path}/speaker_id`,'E_SPEAKER_REF','说话人未定义'));
    if (typeof segment.overlap !== 'boolean') errors.push(issue(`${path}/overlap`,'E_BOOLEAN','重叠标记须为 true 或 false'));
    if (segment.quality === 'unclear') checkText(segment.note,`${path}/note`,errors);
    if (options.submission && segment.boundary_status !== 'confirmed') errors.push(issue(`${path}/boundary_status`,'E_CONFIRM_BOUNDARY',`${segment.id} 尚未人工确认边界`));
  });
  checkOverlaps(doc.segments.filter(isObject), errors);
  return errors;
}
function checkOverlaps(segments, errors) {
  segments.forEach((first, index) => {
    segments.slice(index + 1).forEach((second, offset) => {
      if (first.start_s >= second.end_s || second.start_s >= first.end_s) return;
      if (first.speaker_id === second.speaker_id || !first.overlap || !second.overlap) {
        errors.push(issue(`/segments/${index + offset + 1}/start_s`,'E_OVERLAP',`${first.id} 与 ${second.id} 重叠；同说话人不允许，多人重叠需双方明确标记`));
      }
    });
  });
}
