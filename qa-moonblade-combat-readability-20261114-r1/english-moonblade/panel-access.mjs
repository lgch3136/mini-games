// A single, page-local modal. World state, time and input stay owned by main.mjs.
export class PanelAccess {
  constructor({ panel, initial, background, document = panel.ownerDocument }) {
    this.panel = panel;
    this.initial = initial;
    this.background = background.filter(Boolean);
    this.document = document;
    this.saved = null;
    panel.addEventListener('keydown', (event) => this.trap(event));
  }

  open() {
    if (!this.saved) {
      this.saved = this.background.map((element) => [element, element.inert]);
      for (const element of this.background) element.inert = true;
    }
    this.panel.hidden = false;
    this.panel.scrollTop = 0;
    const card = this.panel.querySelector('.panel');
    if (card) card.scrollTop = 0;
    this.initial.focus({ preventScroll: true });
  }

  close(focusTarget = null) {
    this.panel.hidden = true;
    if (this.saved) {
      for (const [element, inert] of this.saved) element.inert = inert;
      this.saved = null;
    }
    focusTarget?.focus({ preventScroll: true });
  }

  trap(event) {
    if (this.panel.hidden || event.key !== 'Tab') return;
    const actions = [...this.panel.querySelectorAll('button')]
      .filter((button) => !button.hidden && !button.disabled);
    if (!actions.length) return;
    const first = actions[0], last = actions[actions.length - 1];
    const active = this.document.activeElement;
    if (!actions.includes(active) || (event.shiftKey ? active === first : active === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
  }
}
