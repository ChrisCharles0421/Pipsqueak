// DOM-based UI: prompts, objectives, toasts, reader, journal, fades and screens.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      prompt: $('prompt'), objective: $('objective'), toast: $('toast'), reticle: $('reticle'), hint: $('hint'),
      reader: $('reader'), readerTitle: $('reader-title'), readerBody: $('reader-body'), readerImage: $('reader-image'),
      hidingOverlay: $('hidingOverlay'), endingImage: $('ending-image'),
      journal: $('journal'), jItems: $('journal-items'), jClues: $('journal-clues'),
      fade: $('fade'), title: $('title'), pause: $('pause'), death: $('death'), deathText: $('death-text'),
      ending: $('ending'), endingText: $('ending-text'), again: $('again'), hud: $('hud'),
    };
    this.toastTimer = 0;
    this.readerOpen = false;
    this.journalOpen = false;
  }
  setPrompt(text) {
    this.el.prompt.textContent = text ? `[E] ${text}` : '';
    this.el.reticle.classList.toggle('active', !!text);
  }
  setObjective(text) {
    const o = this.el.objective;
    o.style.opacity = 0;
    setTimeout(() => { o.textContent = text || ''; o.style.opacity = 1; }, 400);
  }
  toast(text, sec = 4.5) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastTimer = sec;
  }
  hint(text) { this.el.hint.textContent = text || ''; }
  update(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
  }
  openReader(title, body, image = null) {
    this.el.readerTitle.textContent = title;
    if (image) { this.el.readerImage.src = image; this.el.readerImage.classList.remove('hidden'); }
    else this.el.readerImage.classList.add('hidden');
    this.el.readerBody.textContent = body;
    this.el.reader.classList.remove('hidden');
    this.readerOpen = true;
  }
  closeReader() { this.el.reader.classList.add('hidden'); this.readerOpen = false; }
  toggleJournal(items, clues, onRead = null) {
    this.journalOpen = !this.journalOpen;
    this.el.journal.classList.toggle('hidden', !this.journalOpen);
    if (this.journalOpen) {
      this.el.jItems.innerHTML = items.length ? items.map((i) => `<li>${i.label}</li>`).join('') : '<li>Nothing</li>';
      this.el.jClues.innerHTML = clues.length ? clues.map((c) => `<li data-id="${c.id}">${c.title}</li>`).join('') : '<li>Nothing yet</li>';
      if (onRead) this.el.jClues.querySelectorAll('li[data-id]').forEach((li) => (li.onclick = () => { this.toggleJournal(); onRead(li.dataset.id); }));
    }
  }
  fade(to, sec = 0.4) {
    this.el.fade.style.transition = `opacity ${sec}s`;
    this.el.fade.style.opacity = to;
  }
  show(name, on = true) { this.el[name].classList.toggle('hidden', !on); }
}
