const methodPlayer = document.querySelector("[data-method]");
const methodChapters = [...methodPlayer.querySelectorAll("[data-method-chapter]")];
const methodToggle = methodPlayer.querySelector("[data-method-play]");
const methodStatus = methodPlayer.querySelector("[data-method-status]");
const methodPaper = methodPlayer.querySelector("[data-method-paper]");
const methodMotion = matchMedia("(prefers-reduced-motion: reduce)");
const methodPanels = [...methodPlayer.querySelectorAll("[data-method-panel]")].map(panel => ({
  panel,
  steps: [...panel.querySelectorAll("[data-method-step]")],
  captions: [...panel.querySelectorAll("[data-method-caption]")],
  timing: panel.dataset.timing.split(" ").map(Number),
  history: [...panel.querySelectorAll("[data-reveal-phase]")],
  lanes: [...panel.querySelectorAll(".ppo-lane")],
  frames: [...panel.querySelectorAll("[data-method-frames]")].map(image => ({
    image,
    steps: image.dataset.methodFrames.split("|").map(phase => phase.split(" "))
  }))
}));
const methodAssets = new Map();
let methodChapter = 0;
let methodPhase = 0;
let methodFrame;
let methodElapsed = 0;
let methodProgress = 0;
let methodTick;
let methodPlaying = false;
let methodComplete = false;
let methodStarted = false;

function renderMethod(progress) {
  methodProgress = progress;
  const { steps, frames, lanes } = methodPanels[methodChapter];
  steps[methodPhase].style.setProperty("--progress", progress);
  lanes.find(lane => lane.hasAttribute("data-active"))?.style.setProperty("--progress", progress);
  frames.forEach(({ image, steps: story }) => {
    const samples = story[methodPhase];
    const sample = samples[Math.min(samples.length - 1, Math.floor(progress * samples.length))];
    const url = `assets/method-${sample}.webp`;
    if (image.getAttribute("src") === url) return;
    const preload = methodAssets.get(url);
    if (preload && !preload.naturalWidth) return;
    if (!methodMotion.matches && image.complete && image.naturalWidth) {
      image.parentElement.style.backgroundImage = `url("${image.currentSrc}")`;
    }
    image.src = url;
    if (!methodMotion.matches) image.animate([{ opacity: .12 }, { opacity: 1 }], { duration: 310, easing: "cubic-bezier(.2,.72,.25,1)" });
  });
}

function showMethod(chapter, phase, announce = false) {
  const chapterChanged = methodChapter !== chapter;
  methodChapter = chapter;
  methodPhase = phase;
  methodElapsed = 0;
  methodPanels.forEach(({ panel, steps }, index) => {
    panel.hidden = index !== chapter;
    panel.querySelector(".method-track").hidden = false;
    methodChapters[index].setAttribute("aria-pressed", String(chapter === index));
    steps.forEach((step, i) => {
      step.setAttribute("aria-pressed", String(chapter === index && phase === i));
      step.style.setProperty("--progress", i < phase && chapter === index ? 1 : 0);
    });
  });
  const { panel, captions, history, lanes, steps } = methodPanels[chapter];
  panel.dataset.phase = phase;
  captions.forEach((caption, index) => { caption.hidden = index !== phase; });
  history.forEach(item => item.toggleAttribute("data-revealed", Number(item.dataset.revealPhase) <= phase));
  const activeLane = phase < 2 ? 0 : phase < 4 ? 1 : 2;
  lanes.forEach((lane, index) => lane.toggleAttribute("data-active", index === activeLane));
  methodPaper.href = `assets/paper.pdf#page=${[3, 6, 8][chapter]}`;
  renderMethod(methodPlaying ? 0 : 1);
  if (chapterChanged && !methodMotion.matches) {
    panel.animate([{ opacity: .35, transform: "translateY(9px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 420, easing: "cubic-bezier(.2,.72,.25,1)" });
  }
  if (announce) methodStatus.textContent = `${methodChapters[chapter].textContent}: ${steps[phase].textContent}`;
}

function prefetchMethod() {
  if (methodAssets.size) return;
  methodPanels.flatMap(({ frames }) => frames).forEach(({ steps }) => {
    steps.flat().forEach(frame => {
      const url = `assets/method-${frame}.webp`;
      if (methodAssets.has(url)) return;
      const image = new Image();
      methodAssets.set(url, image);
      image.addEventListener("load", () => renderMethod(methodProgress), { once: true });
      image.src = url;
    });
  });
}

function updateMethodToggle() {
  methodToggle.toggleAttribute("data-playing", methodPlaying);
  methodToggle.querySelector("span").textContent = methodPlaying ? "Pause walkthrough" :
    methodComplete ? "Replay walkthrough" : "Play walkthrough";
}

function pauseMethod() {
  methodPlaying = false;
  cancelAnimationFrame(methodFrame);
  methodTick = undefined;
  updateMethodToggle();
}

function advanceMethod(now) {
  if (methodTick !== undefined) methodElapsed += Math.min(now - methodTick, 100);
  methodTick = now;
  const panel = methodPanels[methodChapter];
  const progress = Math.min(methodElapsed / panel.timing[methodPhase], 1);
  renderMethod(progress);
  if (progress === 1) {
    if (methodPhase + 1 < panel.steps.length) {
      showMethod(methodChapter, methodPhase + 1);
    } else if (methodChapter + 1 < methodPanels.length) {
      showMethod(methodChapter + 1, 0);
    } else {
      methodComplete = true;
      pauseMethod();
      return;
    }
  }
  methodFrame = requestAnimationFrame(advanceMethod);
}

function playMethod() {
  methodStarted = true;
  methodPlaying = true;
  if (methodComplete) {
    methodComplete = false;
    showMethod(0, 0);
  }
  updateMethodToggle();
  methodFrame = requestAnimationFrame(advanceMethod);
}

function selectMethod(chapter, phase) {
  methodStarted = true;
  methodComplete = false;
  pauseMethod();
  showMethod(chapter, phase, true);
  prefetchMethod();
}

function bindMethodButtons(buttons, select) {
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => select(index));
    button.addEventListener("keydown", event => {
      const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      const next = (index + delta + buttons.length) % buttons.length;
      buttons[next].focus();
      select(next);
    });
  });
}

methodToggle.addEventListener("click", () => {
  if (methodPlaying) pauseMethod();
  else playMethod();
});
bindMethodButtons(methodChapters, index => selectMethod(index, 0));
methodPanels.forEach(({ steps }, chapter) => bindMethodButtons(steps, index => selectMethod(chapter, index)));
methodPlayer.querySelector(".method-chapters").hidden = false;
methodToggle.hidden = false;
showMethod(0, 0);

function selectLinkedChapter() {
  const chapter = { "#world-model": 1, "#ppo": 2 }[location.hash];
  if (chapter !== undefined) selectMethod(chapter, 0);
}
selectLinkedChapter();
window.addEventListener("hashchange", selectLinkedChapter);
methodMotion.addEventListener("change", event => { if (event.matches) pauseMethod(); });
new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio >= .15) {
    prefetchMethod();
    if (!methodStarted && !methodMotion.matches && !navigator.connection?.saveData) playMethod();
  } else if (methodPlaying) {
    pauseMethod();
  }
}, { threshold: .15 }).observe(methodPlayer);
