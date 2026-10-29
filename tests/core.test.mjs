import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCer, getAnnotationSnapshot, interpolateTrack, markEdited, validateBackup, validateTask } from '../src/core.js';

function createTask(modality = 'audio') {
  return {
    id: 'task_1', modality, title: '模拟标注', media: { name: 'speech.wav', url: 'blob:temporary', duration: 5, imported: false },
    split: 'train', caption: '三个橙子摆在桌上。', tags: ['静物'],
    segments: [{ id: 'segment_1', start: 0, end: 5, label: 'speech', text: '今天开会', speaker: 'speaker_1', language: '中文', dialect: '普通话', scene: '会议', mixed: false,
      description: { subject: '球体', action: '滚动', camera: '固定镜头', lighting: '均匀', physics: '连续滚动', material: '光滑', interaction: '接触桌面' } }],
    regions: [], tracks: [], revision: 0, status: 'draft', reviews: [],
    evaluation: { asrOriginal: '今天开汇', reference: '今天开会', ratings: {}, outcome: '', notes: '' }, updatedAt: '2026-10-29T00:00:00Z', isDemo: true,
  };
}

function createTrack() {
  return { id: 'track_1', label: '球', keyframes: [
    { time: 1, x: 0.1, y: 0.2, width: 0.2, height: 0.3 },
    { time: 3, x: 0.5, y: 0.4, width: 0.3, height: 0.4 },
  ] };
}

test('audio submission validates time bounds against the loaded duration', () => {
  const task = createTask();
  assert.deepEqual(validateTask(task), []);
  task.segments[0].end = 5.0005;
  assert.deepEqual(validateTask(task), []);
  task.segments[0].end = 5.1;
  assert.ok(validateTask(task).some(issue => issue.field === 'segments.0.end'));
  task.segments[0].end = 0;
  assert.ok(validateTask(task).some(issue => issue.field === 'segments.0.end'));
});

test('speech requires a transcript, a speaker and a language; noise does not', () => {
  const task = createTask();
  Object.assign(task.segments[0], { text: '', speaker: '', language: '' });
  assert.equal(validateTask(task).length, 3);
  task.segments[0].label = 'noise';
  assert.deepEqual(validateTask(task), []);
  task.segments[0].label = 'Noise'; task.updatedAt = null;
  assert.deepEqual(validateTask(task), []);
});

test('image submission requires caption and labels and checks optional normalized boxes', () => {
  const task = createTask('image');
  task.caption = '';
  task.tags = [];
  assert.equal(validateTask(task).length, 2);
  task.caption = '三只橙子'; task.tags = ['静物'];
  task.regions = [{ id: 'region_1', label: '橙子', x: 0.8, y: 0.1, width: 0.3, height: 0.2 }];
  assert.ok(validateTask(task).some(issue => issue.field === 'regions.0'));
  task.regions[0].width = 0.2;
  assert.deepEqual(validateTask(task), []);
});

test('video checks all seven caption dimensions and track keyframe bounds', () => {
  const task = createTask('video');
  task.segments[0].description.physics = '';
  task.tracks = [createTrack()];
  task.tracks[0].keyframes.push({ time: 6, x: 0.1, y: 0.1, width: 0.2, height: 0.2 });
  const issues = validateTask(task);
  assert.ok(issues.some(issue => issue.field === 'segments.0.description.physics'));
  assert.ok(issues.some(issue => issue.field === 'tracks.0.keyframes.2.time'));
});

test('backup permits incomplete drafts but rejects malformed input without throwing', () => {
  const draft = createTask();
  draft.caption = ''; draft.tags = []; draft.segments = []; draft.media.duration = null;
  assert.deepEqual(validateBackup({ schemaVersion: 'annota/1', tasks: [draft] }), []);
  for (const invalid of [null, {}, [], { schemaVersion: 'annota/1', tasks: [null] }, { schemaVersion: 'annota/1', tasks: [{ ...draft, segments: 'bad' }] }]) {
    assert.doesNotThrow(() => validateBackup(invalid));
    assert.ok(validateBackup(invalid).length);
  }
});

test('backup rejects invalid enums, duplicates, unsafe numbers and oversized arrays', () => {
  const task = createTask();
  const backup = tasks => ({ schemaVersion: 'annota/1', tasks });
  assert.ok(validateBackup(backup([task, task])).some(issue => issue.field.endsWith('.id')));
  assert.ok(validateBackup(backup([{ ...task, status: '__proto__' }])).length);
  assert.ok(validateBackup(backup([{ ...task, modality: 'script' }])).length);
  assert.ok(validateBackup(backup([{ ...task, media: { duration: Infinity } }])).length);
  assert.ok(validateBackup(backup(Array(1001).fill(task))).length);
  assert.ok(validateBackup(backup([{ ...task, segments: Array(2001).fill({}) }])).length);
});

test('malformed nested fields are rejected safely before form rendering', () => {
  const task = createTask();
  task.segments[0].text = { html: '<img>' };
  task.tracks = [{ label: '球', keyframes: [null] }];
  assert.doesNotThrow(() => validateTask(task));
  assert.ok(validateTask(task).some(issue => issue.field === 'segments.0.text'));
  assert.ok(validateTask(task).some(issue => issue.field.endsWith('.time')));
  assert.equal(interpolateTrack({ keyframes: [null, {}] }, 1), null);
  task.reviews = [{ reviewer: { arbitrary: 'object' } }];
  assert.ok(validateBackup({ schemaVersion: 'annota/1', tasks: [task] }).some(issue => issue.field.includes('reviews.0.reviewer')));
});

test('backup accepts incomplete drafts but does not restore incomplete approved annotations', () => {
  const task = createTask('image'); task.caption = ''; task.tags = [];
  assert.deepEqual(validateBackup({ schemaVersion: 'annota/1', tasks: [task] }), []);
  task.status = 'approved';
  assert.ok(validateBackup({ schemaVersion: 'annota/1', tasks: [task] }).some(issue => issue.field.endsWith('.caption')));
});

test('CER uses Unicode characters, excludes punctuation and preserves rates above 100%', () => {
  assert.deepEqual(calculateCer('今天，开会。', '今天开汇'), { distance: 1, referenceLength: 4, rate: 0.25 });
  assert.deepEqual(calculateCer('𠮷', '𠮷'), { distance: 0, referenceLength: 1, rate: 0 });
  assert.equal(calculateCer('。 ', '文字'), null);
  assert.equal(calculateCer('一', '一二三四').rate, 3);
});

test('human corrections do not alter the model result supplied to CER', () => {
  const task = createTask();
  const original = calculateCer(task.evaluation.reference, task.evaluation.asrOriginal);
  task.segments[0].text = '今天开会';
  assert.equal(original.rate, 0.25);
  assert.deepEqual(calculateCer(task.evaluation.reference, task.evaluation.asrOriginal), original);
  assert.equal(calculateCer(task.evaluation.reference, task.segments[0].text).rate, 0);
});

test('tracks interpolate only inside their own keyframe interval without mutating order', () => {
  const track = createTrack();
  track.keyframes.reverse();
  assert.equal(interpolateTrack(track, 0.9), null);
  assert.equal(interpolateTrack(track, 3.1), null);
  const box = interpolateTrack(track, 2);
  assert.ok(Math.abs(box.x - 0.3) < 0.000001);
  assert.equal(box.width, 0.25);
  assert.equal(track.keyframes[0].time, 3);
  assert.deepEqual(interpolateTrack(track, 1), { x: 0.1, y: 0.2, width: 0.2, height: 0.3 });
});

test('single keyframes are shown only within the declared 40 ms tolerance', () => {
  const track = createTrack();
  track.keyframes.pop();
  assert.ok(interpolateTrack(track, 1.03));
  assert.equal(interpolateTrack(track, 1.05), null);
  track.keyframes.push({ ...track.keyframes[0] });
  const task = createTask('video'); task.tracks = [track];
  assert.ok(validateTask(task).some(issue => /重复/.test(issue.message)));
});

test('editing invalidates approval while preserving independent evaluations and review history', () => {
  const task = createTask(); task.status = 'approved'; task.revision = 7;
  task.reviews = [{ decision: 'approved', note: '已复核' }];
  const edited = markEdited(task, '2026-10-29T01:00:00Z');
  assert.equal(edited.status, 'draft'); assert.equal(edited.revision, 8);
  assert.equal(task.status, 'approved');
  assert.deepEqual(edited.reviews, task.reviews);
  assert.deepEqual(edited.evaluation, task.evaluation);
});

test('annotation snapshots omit model evaluations and temporary media URLs and deeply clone results', () => {
  const task = createTask();
  const snapshot = getAnnotationSnapshot(task);
  assert.equal(snapshot.evaluation, undefined);
  assert.equal(snapshot.media.url, undefined);
  assert.equal(snapshot.media.name, 'speech.wav');
  snapshot.segments[0].text = '修改';
  assert.equal(task.segments[0].text, '今天开会');
  assert.equal(task.media.url, 'blob:temporary');
});
