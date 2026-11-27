const methodMotion = matchMedia("(prefers-reduced-motion: reduce)");

document.querySelectorAll("[data-method]").forEach(panel => {
  const steps = [...panel.querySelectorAll("[data-method-step]")];
  const captions = [...panel.querySelectorAll("[data-method-caption]")];
  const history = [...panel.querySelectorAll("[data-reveal-phase]")];
  const lanes = [...panel.querySelectorAll(".ppo-lane")];
  const track = panel.querySelector(".method-track");
  const toggle = panel.querySelector("[data-method-play]");
  const status = panel.querySelector("[data-method-status]");
  const timing = panel.dataset.timing.split(" ").map(Number);
  const frames = [...panel.querySelectorAll("[data-method-frames]")].map(image => ({
    image,
    samples: image.dataset.methodFrames.split("|").map(phase => phase.split(" "))
  }));
  const assets = new Map();
  let phase = 0;
  let elapsed = 0;
  let progress = 0;
  let frame;
  let previousTick;
  let playing = false;
  let finished = false;
  let started = false;

  function render(nextProgress) {
    progress = nextProgress;
    steps[phase].style.setProperty("--progress", progress);
    lanes.find(lane => lane.hasAttribute("data-active"))?.style.setProperty("--progress", progress);

    frames.forEach(({ image, samples }) => {
      const sequence = samples[phase];
      const sample = sequence[Math.min(sequence.length - 1, Math.floor(progress * sequence.length))];
      const url = `assets/method-${sample}.webp`;
      if (image.getAttribute("src") === url) return;
      const preload = assets.get(url);
      if (preload && !preload.naturalWidth) return;
      if (!methodMotion.matches && image.complete && image.naturalWidth) {
        image.parentElement.style.backgroundImage = `url("${image.currentSrc}")`;
      }
      image.src = url;
      if (!methodMotion.matches) {
        image.animate([{ opacity: .12 }, { opacity: 1 }], { duration: 310, easing: "cubic-bezier(.2,.72,.25,1)" });
      }
    });
  }

  function show(nextPhase, announce = false) {
    phase = nextPhase;
    elapsed = 0;
    panel.dataset.phase = phase;
    steps.forEach((step, index) => {
      step.setAttribute("aria-pressed", String(index === phase));
      step.style.setProperty("--progress", index < phase ? 1 : 0);
    });
    captions.forEach((caption, index) => { caption.hidden = index !== phase; });
    history.forEach(item => item.toggleAttribute("data-revealed", Number(item.dataset.revealPhase) <= phase));
    const activeLane = phase < 2 ? 0 : phase < 4 ? 1 : 2;
    lanes.forEach((lane, index) => lane.toggleAttribute("data-active", index === activeLane));
    render(playing ? 0 : 1);
    if (announce) status.textContent = steps[phase].textContent;
  }

  function prefetch() {
    frames.flatMap(({ samples }) => samples.flat()).forEach(sample => {
      const url = `assets/method-${sample}.webp`;
      if (assets.has(url)) return;
      const image = new Image();
      assets.set(url, image);
      image.addEventListener("load", () => render(progress), { once: true });
      image.src = url;
    });
  }

  function updateToggle() {
    toggle.toggleAttribute("data-playing", playing);
    toggle.querySelector("span").textContent = playing ? "Pause walkthrough" : finished ? "Replay walkthrough" : "Play walkthrough";
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    previousTick = undefined;
    updateToggle();
  }

  function advance(now) {
    if (previousTick !== undefined) elapsed += Math.min(now - previousTick, 100);
    previousTick = now;
    render(Math.min(elapsed / timing[phase], 1));
    if (progress === 1) {
      if (phase === steps.length - 1) {
        finished = true;
        pause();
        return;
      }
      show(phase + 1);
    }
    frame = requestAnimationFrame(advance);
  }

  function play() {
    started = true;
    playing = true;
    if (finished) {
      finished = false;
      show(0);
    }
    updateToggle();
    frame = requestAnimationFrame(advance);
  }

  function select(index) {
    started = true;
    finished = false;
    pause();
    prefetch();
    show(index, true);
  }

  steps.forEach((button, index) => {
    button.addEventListener("click", () => select(index));
    button.addEventListener("keydown", event => {
      const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      const next = (index + delta + steps.length) % steps.length;
      steps[next].focus();
      select(next);
    });
  });
  toggle.addEventListener("click", () => { if (playing) pause(); else play(); });
  methodMotion.addEventListener("change", event => { if (event.matches && playing) pause(); });
  track.hidden = false;
  toggle.hidden = false;
  show(0);

  new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= .25) {
      prefetch();
      if (!started && !methodMotion.matches && !navigator.connection?.saveData) play();
    } else if (playing) {
      pause();
    }
  }, { threshold: .25 }).observe(panel);
});
