const PATHS = {
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M9 12h6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.2.6-1.7 1.2-1.7 2.7M12 17h.01"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  audio:'<path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/>',
  video:'<rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-3v10l-4-3"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  play:'<path d="m8 4 12 8-12 8V4Z"/>', pause:'<path d="M8 4v16M16 4v16"/>',
  back:'<path d="m14 5-7 7 7 7M5 5v14"/>',next:'<path d="m10 5 7 7-7 7M19 5v14"/>',
  pointer:'<path d="m4 3 6 18 3-8 8-3L4 3Z"/>',box:'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M2 2h4M2 2v4M22 22h-4M22 22v-4"/>',
  undo:'<path d="M3 10h11a6 6 0 1 1-5 9M3 10l5-5M3 10l5 5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  fit:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  loop:'<path d="M3 8h15l-3-3M21 16H6l3 3M21 8v5M3 16v-5"/>',
  check:'<path d="m5 12 4 4L20 5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  flag:'<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>'
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.info}</svg>`;
}
export function hydrateIcons(root=document) {
  root.querySelectorAll('[data-icon]').forEach(element=>{element.innerHTML=icon(element.dataset.icon);});
}
