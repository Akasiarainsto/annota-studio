import {isObject, isNumber, checkText, checkEnum, checkIds, issue} from './checks.js';
import {IMAGE_LABELS} from './attributes.js';

export function validateImage(doc, options = {}) {
  const errors = [];
  checkText(doc.caption,'/caption',errors);
  checkEnum(doc.scene,['market','street','indoor','nature','other'],'/scene',errors);
  checkEnum(doc.lighting,['daylight','lowlight','artificial','uncertain'],'/lighting',errors);
  if (!Array.isArray(doc.tags)||!doc.tags.length||doc.tags.some(tag=>!Object.hasOwn(IMAGE_LABELS,tag))) errors.push(issue('/tags','E_IMAGE_TAGS','选择至少一个合法图像标签'));
  if (!isNumber(doc.media.width)||doc.media.width<=0||!isNumber(doc.media.height)||doc.media.height<=0) errors.push(issue('/media','E_IMAGE_SIZE','图像宽高须为正数'));
  if (!Array.isArray(doc.boxes)) return [...errors,issue('/boxes','E_ARRAY','boxes 须为数组')];
  checkIds(doc.boxes,'/boxes',errors);
  doc.boxes.forEach((box,index) => {
    if (!isObject(box)) return;
    const path = `/boxes/${index}`;
    checkEnum(box.label,Object.keys(IMAGE_LABELS),`${path}/label`,errors);
    if (!['x','y','width','height'].every(key=>isNumber(box[key]))) return errors.push(issue(path,'E_BOX_TYPE','坐标须为有限数值，单位为原图像素'));
    if (box.x<0||box.y<0||box.width<=0||box.height<=0||box.x+box.width>doc.media.width+.001||box.y+box.height>doc.media.height+.001) errors.push(issue(path,'E_BOX_BOUNDS','矩形超出图像，或宽高不为正数'));
    if (typeof box.occluded !== 'boolean') errors.push(issue(`${path}/occluded`,'E_BOOLEAN','遮挡须为 true 或 false'));
  });
  if (options.submission && !doc.boxes.length) errors.push(issue('/boxes','E_BOX_REQUIRED','本例至少框选一个主体'));
  if (options.submission && !doc.content_confirmed) errors.push(issue('/content_confirmed','E_CONFIRM_IMAGE','请确认 Caption、标签和区域与图像一致'));
  return errors;
}
