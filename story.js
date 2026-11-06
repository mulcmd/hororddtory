// Cerita: naskah adegan, kotak dialog dengan efek mengetik, dan penanda bab serta tujuan.

// Naskah. Setiap adegan adalah daftar [pembicara, teks].
const BEATS = {
  intro: [
    ['Bima', 'Sebulan tidak ada kabar dari Ayu. Lalu surat terakhirnya datang, dengan alamat rumah tua ini di pojok amplop.'],
    ['Bima', 'Gerbang berkarat itu terbuka sendiri saat aku mendekat. Senter, ponsel yang baterainya sekarat, dan nekat. Hanya itu yang kubawa.'],
    ['Bisikan', '...kau tidak seharusnya datang, Kak.']
  ],
  foyer: [
    ['Bima', 'Ruangan ini terasa lebih dingin dari luar. Ayu... kalau kau dengar, beri aku tanda.'],
    ['Bisikan', 'Pulanglah sebelum lampu-lampu itu padam.']
  ],
  note1: [
    ['Catatan Ayu #1', 'Ibu Wiratmaja bilang rumah ini dulu milik keluarganya. Setiap malam Jumat ada yang menyanyi pelan dari kamar tidur. Aku anggap itu cerita orang tua. Sampai aku menemukan rambut panjang di bawah ranjang, dan rambut itu basah.'],
    ['Bisikan', 'Kau mengambil kertas itu... sekarang aku bisa melihatmu.']
  ],
  photo: [
    ['Bima', 'Foto keluarga Wiratmaja. Empat orang tersenyum di depan rumah ini. Di pojok foto, seorang perempuan berdiri sendirian, kepalanya tertunduk dan wajahnya tertutup bayangan.'],
    ['Bima', 'Ayu tidak pernah suka difoto sendirian. Dan dia tidak akan berdiri di tempat seperti itu.']
  ],
  bedroom: [
    ['Bima', 'Pintu di belakangku membanting sendiri. Udara di kamar ini membeku.'],
    ['Bisikan', 'Dia tidak menjagamu, Kak. Dia menjagaku... dari siapa pun yang mencari kebenaran.']
  ],
  note2: [
    ['Catatan Ayu #2', 'Dia bukan penunggu rumah ini. Dia dikurung. Keluarga Wiratmaja memasang segel di ruang bawah tanah, di balik pintu lorong. Namanya Ratih. Jangan pernah memanggil namanya dengan lantang.'],
    ['Catatan Ayu #2', 'Segelnya hanya terlihat dalam cahaya UV, Kak. Dan dia hanya bisa dihentikan dengan cahaya yang sama.']
  ],
  key: [
    ['Bima', 'Kunci Gudang. Berkarat dan berat. Itu pasti untuk pintu di lorong, pintu yang kelihatannya dikunci sangat rapat.']
  ],
  locked: [
    ['Bima', 'Pintu ini terkunci dari dalam. Aku perlu kuncinya.']
  ],
  unlock: [
    ['Bima', 'Pintu terbuka dengan erangan panjang. Bau tanah basah dan dupa yang terbakar keluar dari celahnya.']
  ],
  note3: [
    ['Catatan Ayu #3', 'Aku sudah tahu apa yang harus dilakukan. Segel itu harus disorot dengan UV sampai terbakar, lalu Ratih harus dipaksa kembali ke tanah. Kalau kau membaca ini, Kak, berarti aku belum sempat melakukannya sendiri.']
  ],
  ritual: [
    ['Bima', 'Altar ini penuh lilin yang belum habis terbakar. Ayu... dia ada di sini, tapi aku tidak melihatnya.'],
    ['Ratih', 'Kau memanggil namaku... kau membuka pintu yang seharusnya tidak pernah dibuka.']
  ],
  ritualFight: [
    ['Bima', 'Sorot dia dengan senter UV! Tekan R untuk mode UV, lalu arahkan senter ke tubuhnya dan tahan. Jangan lepaskan sampai dia berhenti bergerak.']
  ],
  ending: [
    ['Ratih', 'Aku... ingin pulang...'],
    ['Bima', 'Ratih menjerit untuk terakhir kali, lalu lenyap jadi debu putih yang jatuh pelan ke lantai.'],
    ['Bima', 'Di ujung lorong, seorang gadis berdiri dengan kaki telanjang. Itu Ayu. Dia menatapku sebentar, lalu berlari ke pintu depan.'],
    ['Bima', 'Aku mengikutinya ke halaman. Saat langit mulai memutih di atas pepohonan, rumah itu diam. Gerbang berkarat menutup pelan di belakang kami.']
  ]
};

const Story = (() => {
  const box = document.getElementById('story-box');
  const speakerEl = document.getElementById('story-speaker');
  const textEl = document.getElementById('story-text');
  const nextEl = document.getElementById('story-next');
  const CPS = 42; // karakter per detik

  let queue = [];
  let line = null;
  let pos = 0;
  let open = false;
  let onDone = null;

  function showLine(l) {
    line = l;
    pos = 0;
    speakerEl.textContent = l[0];
    textEl.textContent = '';
    nextEl.classList.remove('ready');
  }

  function close() {
    open = false;
    box.hidden = true;
    line = null;
    const cb = onDone;
    onDone = null;
    if (cb) cb();
  }

  // Mainkan naskah adegan. onFinish dipanggil setelah baris terakhir ditutup.
  function play(key, onFinish) {
    const lines = BEATS[key];
    if (!lines) { if (onFinish) onFinish(); return; }
    queue = lines.slice(1);
    onDone = onFinish || null;
    open = true;
    box.hidden = false;
    showLine(lines[0]);
  }

  function update(dt) {
    if (!open || !line) return;
    const full = line[1];
    if (pos < full.length) {
      pos = Math.min(full.length, pos + CPS * dt);
      textEl.textContent = full.slice(0, Math.floor(pos));
      if (pos >= full.length) nextEl.classList.add('ready');
    }
  }

  // Dipanggil oleh E, Enter, Spasi, atau klik kotak.
  function advance() {
    if (!open || !line) return;
    if (pos < line[1].length) {
      pos = line[1].length;
      textEl.textContent = line[1];
      nextEl.classList.add('ready');
      return;
    }
    if (queue.length) {
      showLine(queue.shift());
    } else {
      close();
    }
  }

  // Satu baris saja, tanpa antrean naskah
  function say(speaker, text, onFinish) {
    queue = [];
    onDone = onFinish || null;
    open = true;
    box.hidden = false;
    showLine([speaker, text]);
  }

  function isOpen() { return open; }

  // Membersihkan kotak cerita saat permainan diulang (tanpa memanggil onFinish)
  function reset() {
    queue = [];
    line = null;
    onDone = null;
    open = false;
    box.hidden = true;
  }

  function setChapter(label) {
    document.getElementById('chapter-label').textContent = label;
  }

  function setObjective(text) {
    document.getElementById('objective-text').textContent = text;
  }

  let noticeT = 0;
  function notice(text) {
    const el = document.getElementById('notice');
    el.textContent = text;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth; // mulai ulang animasi
    el.style.animation = '';
    clearTimeout(noticeT);
    noticeT = setTimeout(() => { el.hidden = true; }, 3300);
  }

  box.addEventListener('click', advance);

  return { play, say, update, advance, isOpen, reset, setChapter, setObjective, notice };
})();
