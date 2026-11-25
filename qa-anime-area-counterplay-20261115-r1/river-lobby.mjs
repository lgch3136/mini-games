const choices = document.getElementById("choices");
const start = document.getElementById("start");
const runtime = new URL("./game.min.js?v=canyon-locks1",import.meta.url);
let warming = false, opening = false, selected = 0;

// Download on a deliberate hero choice. No WebGL context is needed to browse these cards.
function warm() {
  if (warming || document.hidden) return;
  warming = true;
  for (const href of [runtime.href,new URL("./vendor/three.core.min.js",runtime).href,new URL("./vendor/three.module.min.js",runtime).href]) {
    const link = document.createElement("link"); link.rel = "modulepreload"; link.href = href;
    document.head.append(link);
  }
}

function choose(event) {
  const button = event.target.closest("[data-hero]");
  if (!button || !choices.contains(button)) return;
  selected = Number(button.dataset.hero);
  for (const other of choices.querySelectorAll("[data-hero]")) {
    other.classList.toggle("selected", other === button);
    other.setAttribute("aria-pressed", String(other === button));
  }
  warm();
}

let pendingAudio = null;
function releasePendingAudio() {
  const context = pendingAudio;
  pendingAudio = null;
  if (context && context.state !== "closed") context.close().catch(() => {});
}
window.addEventListener("pagehide", releasePendingAudio);

function unlockAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  try {
    const context = new Context();
    context.resume().catch(() => {});
    return context;
  } catch { return null; }
}

async function enter() {
  if (opening) return;
  opening = true; start.disabled = true; start.setAttribute("aria-busy","true");
  const label = start.textContent;
  start.textContent = "正在进入战场…";
  const audio = pendingAudio = unlockAudio();
  try {
    const battle = await import(runtime.href);
    await battle.prepareFromLobby(selected);
    if (document.hidden || (audio && pendingAudio !== audio)) {
      releasePendingAudio();
      opening = false; start.onclick = null;
      start.disabled = false; start.removeAttribute("aria-busy"); start.textContent = label;
      return;
    }
    choices.removeEventListener("click",choose);
    start.removeEventListener("click",enter);
    start.disabled = false; start.removeAttribute("aria-busy"); start.textContent = label;
    battle.selectFromLobby(selected);
    battle.enterFromLobby(audio);
    pendingAudio = null;
  } catch {
    releasePendingAudio();
    start.disabled = false; start.removeAttribute("aria-busy"); start.textContent = "重新载入战场";
    start.onclick = null;
    start.removeEventListener("click",enter);
    start.addEventListener("click",() => location.reload(),{once:true});
  }
}
const openingSkill=document.getElementById("opening-skill");
function openingLabels(button){
  if(!button)return;
  const labels=button.querySelector("span:last-child")?.textContent.split("·");
  if(labels?.length>=2)for(let slot=0;slot<2;slot++)openingSkill.options[slot].textContent=labels[slot].trim();
}
choices.addEventListener("click",event=>openingLabels(event.target.closest("[data-hero]")));
openingLabels(choices.querySelector("[aria-pressed=true]"));
choices.addEventListener("click",choose);
start.addEventListener("click",enter);

start.addEventListener("focus",warm,{once:true});
