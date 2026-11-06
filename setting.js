// Pengaturan pemain: sensitivitas, kesulitan, mode ringan, dan efek kejutan.
// Disimpan di localStorage bila tersedia. Jika tidak, pengaturan tetap berjalan untuk sesi ini.

const Settings = (() => {
  const KEY = 'malam-sukamaju-settings';
  const DEFAULTS = { sens: 100, difficulty: 'normal', reduce: false, scare: true, seenGuide: false };
  const DIFF = {
    easy: { speed: 0.8, damage: 0.6, drain: 0.75 },
    normal: { speed: 1, damage: 1, drain: 1 }
  };

  let data = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* abaikan: pakai nilai bawaan */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* abaikan */ }
  }

  const el = {
    overlay: document.getElementById('settings'),
    sens: document.getElementById('sens'),
    sensVal: document.getElementById('sens-val'),
    diffBtns: document.querySelectorAll('[data-diff]'),
    reduce: document.getElementById('reduce-toggle'),
    scare: document.getElementById('scare-toggle'),
    close: document.getElementById('settings-close')
  };

  function refreshUI() {
    el.sens.value = data.sens;
    el.sensVal.textContent = data.sens + '%';
    el.diffBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.diff === data.difficulty)));
    el.reduce.setAttribute('aria-pressed', String(data.reduce));
    el.reduce.textContent = data.reduce ? 'Nyala' : 'Mati';
    el.scare.setAttribute('aria-pressed', String(data.scare));
    el.scare.textContent = data.scare ? 'Nyala' : 'Mati';
  }

  el.sens.addEventListener('input', () => {
    data.sens = Number(el.sens.value);
    el.sensVal.textContent = data.sens + '%';
    save();
  });
  el.diffBtns.forEach(b => b.addEventListener('click', () => {
    data.difficulty = b.dataset.diff;
    refreshUI();
    save();
  }));
  el.reduce.addEventListener('click', () => { data.reduce = !data.reduce; refreshUI(); save(); });
  el.scare.addEventListener('click', () => { data.scare = !data.scare; refreshUI(); save(); });

  let onClose = null;
  function open(returnFn) {
    onClose = returnFn || null;
    refreshUI();
    el.overlay.hidden = false;
    el.close.focus();
  }
  function closeOverlay() {
    el.overlay.hidden = true;
    const cb = onClose;
    onClose = null;
    if (cb) cb();
  }
  el.close.addEventListener('click', closeOverlay);

  function markGuideSeen() {
    data.seenGuide = true;
    save();
  }

  return {
    open,
    markGuideSeen,
    seenGuide: () => !!data.seenGuide,
    sensMul: () => data.sens / 100,
    diff: () => DIFF[data.difficulty] || DIFF.normal,
    reduce: () => !!data.reduce,
    scare: () => !!data.scare
  };
})();
