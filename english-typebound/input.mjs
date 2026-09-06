// All twenty-six letters belong to typing. Only Escape / Enter are game shortcuts.
export class TypingInput {
  constructor({
    doc = document,
    input,
    active,
    text,
    erase,
    guard,
    pause,
    notice,
    pulse,
  }) {
    this.doc = doc;
    this.input = input;
    this.active = active;
    this.composing = false;
    this.abort = new AbortController();
    const on = (el, name, fn) =>
      el.addEventListener(name, fn, { signal: this.abort.signal });
    const accept = (data) => {
      if (
        this.active() &&
        typeof data === "string" &&
        /^[a-zA-Z ]$/.test(data)
      ) {
        text(data);
        pulse(data);
        return true;
      }
      return false;
    };
    this.accept = accept;
    on(doc, "keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && !e.isComposing && !e.repeat) {
        e.preventDefault();
        pause();
        return;
      }
      if (!this.active()) return;
      if (e.isComposing || this.composing || e.keyCode === 229) {
        notice("请切换到英文键盘，输入法组词不会计错。");
        return;
      }
      if (e.repeat) {
        if (/^[a-zA-Z ]$/.test(e.key)) e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        guard();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        erase();
        pulse("Backspace");
        input.value = "";
        return;
      }
      if (e.target === input) return;
      if (/^[a-zA-Z ]$/.test(e.key)) {
        e.preventDefault();
        accept(e.key);
      }
    });
    on(input, "beforeinput", (e) => {
      if (!this.active() || e.isComposing || this.composing) return;
      if (e.inputType === "deleteContentBackward") {
        if (e.cancelable) {
          e.preventDefault();
          erase();
        }
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
        if (e.inputType === "insertText" && !accept(e.data))
          notice("请逐字输入英文；粘贴和自动补全不计入练习。");
      }
    });
    on(input, "input", (e) => {
      if (e.isComposing || this.composing) return;
      if (e.inputType === "deleteContentBackward") erase();
      else if (e.inputType === "insertText") {
        if (!accept(e.data))
          notice("请逐字输入英文；粘贴和自动补全不计入练习。");
      }
      input.value = "";
    });
    on(input, "paste", (e) => {
      e.preventDefault();
      notice("练习需要逐字输入，不支持粘贴答案。");
    });
    on(input, "drop", (e) => e.preventDefault());
    on(input, "compositionstart", () => {
      this.composing = true;
      notice("请切换到英文键盘，输入法组词不会计错。");
    });
    on(input, "compositionend", () => {
      this.composing = false;
      input.value = "";
    });
  }
  reset() {
    this.composing = false;
    this.input.value = "";
  }
  destroy() {
    this.reset();
    this.abort.abort();
  }
}
