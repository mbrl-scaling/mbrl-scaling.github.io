(() => {
  const figure = document.querySelector("[data-ppo-story]");
  if (!figure) return;

  const find = selector => figure.querySelector(selector);
  const board = find("[data-ppo-board]");
  const prepareMedia = prepareMethodMedia(figure, board);
  const canvas = find("[data-ppo-paths]");
  const ink = canvas.getContext("2d");
  const flights = find("[data-ppo-flights]");
  const tracks = find("[data-ppo-tracks]");
  const advantages = find("[data-ppo-advantages]");
  const update = find("[data-ppo-update]");
  const loop = find("[data-ppo-loop]");
  const button = find("[data-ppo-play]");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = matchMedia("(max-width: 820px)");
  const duration = 11600;
  const rows = [...tracks.children].map(track => {
    const name = track.dataset.ppoTrack;
    const source = find(`[data-ppo-pick="${name}"]`);
    const frame = document.createElement("img");
    frame.alt = "";
    frame.decoding = "async";
    frame.hidden = true;
    flights.append(frame);
    return {
      images: [...track.querySelectorAll(".ppo-frames img")],
      color: getComputedStyle(track).getPropertyValue("--ppo-track").trim(),
      source, frame,
      score: find(`[data-ppo-score="${name}"]`)
    };
  });

  let layout;
  let elapsed = 0;
  let frame;
  let last;
  let playing = false;
  let visible = false;
  let autoplay = !navigator.connection?.saveData;

  const between = (time, start, span) => Math.max(0, Math.min(1, (time - start) / span));
  const ease = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;

  function curve(from, to, vertical = false) {
    const middle = vertical ? (from.y + to.y) / 2 : (from.x + to.x) / 2;
    return vertical
      ? [from, { x: from.x, y: middle }, { x: to.x, y: middle }, to]
      : [from, { x: middle, y: from.y }, { x: middle, y: to.y }, to];
  }

  function position([a, b, c, d], t) {
    const u = 1 - t;
    const value = axis => u ** 3 * a[axis] + 3 * u * u * t * b[axis] + 3 * u * t * t * c[axis] + t ** 3 * d[axis];
    return { x: value("x"), y: value("y") };
  }

  function trace(path, color, signal, arrow = false) {
    if (!ink) return;
    const [a, b, c, d] = path;
    ink.beginPath();
    ink.moveTo(a.x, a.y);
    ink.bezierCurveTo(b.x, b.y, c.x, c.y, d.x, d.y);
    ink.lineWidth = arrow ? 1.5 : 1.1;
    ink.strokeStyle = color;
    ink.globalAlpha = arrow ? .27 + .45 * signal : .31;
    ink.stroke();

    if (arrow) {
      const angle = Math.atan2(d.y - c.y, d.x - c.x);
      ink.beginPath();
      ink.moveTo(d.x - 5 * Math.cos(angle - .55), d.y - 5 * Math.sin(angle - .55));
      ink.lineTo(d.x, d.y);
      ink.lineTo(d.x - 5 * Math.cos(angle + .55), d.y - 5 * Math.sin(angle + .55));
      ink.stroke();
    }

    if (signal > 0 && signal < 1) {
      ink.fillStyle = color;
      for (let index = 3; index >= 0; index--) {
        const { x, y } = position(path, Math.max(0, signal - index * .043));
        ink.globalAlpha = (1 - index / 4) * Math.min(1, Math.sin(Math.PI * signal) * 4);
        ink.beginPath();
        ink.arc(x, y, 2.9 - index * .4, 0, 2 * Math.PI);
        ink.fill();
      }
    }
    ink.globalAlpha = 1;
  }

  function measure() {
    const bounds = board.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(bounds.width * dpr);
    canvas.height = Math.round(bounds.height * dpr);
    ink?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const box = element => {
      const rect = element.getBoundingClientRect();
      const x = rect.x - bounds.x, y = rect.y - bounds.y;
      const center = { x: x + rect.width / 2, y: y + rect.height / 2 };
      return {
        width: element.offsetWidth, center,
        top: { x: center.x, y: y - 3 },
        bottom: { x: center.x, y: y + rect.height + 3 },
        left: { x: x - 3, y: center.y },
        right: { x: x + rect.width + 3, y: center.y }
      };
    };

    const compact = narrow.matches;
    const signal = box(advantages);
    const policy = box(update);
    const launch = box(tracks);
    const loopLabel = box(loop);
    const gutter = bounds.width - 5;
    const feedback = compact
      ? [policy.right, { x: gutter, y: policy.right.y }, { x: gutter, y: launch.bottom.y }, { x: launch.right.x, y: launch.bottom.y }]
      : [policy.bottom, { x: policy.bottom.x, y: loopLabel.center.y }, { x: launch.bottom.x, y: loopLabel.center.y }, launch.bottom];
    layout = {
      width: bounds.width, height: bounds.height,
      intoUpdate: curve(signal.bottom, policy.top, true),
      feedback
    };
    for (const row of rows) {
      const source = box(row.source);
      const first = box(row.images[0]);
      const final = box(row.images.at(-1));
      const score = box(row.score);
      row.sampling = compact ? curve(source.bottom, first.top, true) : curve(source.right, first.left);
      row.flight = curve(source.center, first.center, compact);
      row.scorePath = compact
        ? [final.right, { x: launch.right.x + 8, y: final.center.y }, { x: score.right.x + 14, y: score.center.y }, score.right]
        : curve(final.right, score.left);
      row.rewardPath = curve(score.right, signal.left);
      row.width = { from: source.width, to: first.width };
    }
    render();
  }

  function set(element, variable, value) {
    element.style.setProperty(variable, value.toFixed(3));
  }

  function render() {
    if (!layout) return;
    const staticView = motion.matches;
    const time = staticView ? duration : elapsed;
    ink?.clearRect(0, 0, layout.width, layout.height);
    rows.forEach((row, lane) => {
      const pick = between(time, 690 + lane * 245, 1000);
      const selected = ease(between(time, 430 + lane * 240, 360));
      set(row.source, "--ppo-pick", selected);
      trace(row.sampling, row.color, pick);
      row.frame.hidden = !(pick > 0 && pick < 1);
      if (!row.frame.hidden) {
        if (!row.frame.hasAttribute("src")) row.frame.src = row.source.src;
        const t = ease(pick);
        const { x, y } = position(row.flight, t);
        const scale = mix(row.width.from, row.width.to, t) / 100;
        row.frame.style.transform = `translate3d(${x - 50}px,${y - 28.125 - 13 * Math.sin(Math.PI * t)}px,0) scale(${scale})`;
      }
      row.images.forEach((img, index) => {
        const appearance = index === 0 ? between(pick, .84, .16) : between(time, 2440 + lane * 220 + (index - 1) * 800, 545);
        set(img, "--ppo-reveal", ease(appearance));
      });

      const grading = between(time, 5360 + lane * 300, 970);
      const outcome = ease(between(grading, .64, .36));
      set(row.score, "--ppo-score", outcome);
      set(row.score, "--ppo-score-glow", Math.sin(Math.PI * grading));
      trace(row.scorePath, "#ab8245", grading);
      trace(row.rewardPath, "#9a7952", between(time, 6830 + lane * 215, 820));
    });
    const gae = between(time, 7730, 920);
    set(advantages, "--ppo-advantage", Math.sin(Math.PI * gae));
    trace(layout.intoUpdate, "#557eb4", gae);
    set(update, "--ppo-update", ease(between(time, 8500, 960)));
    const feedback = between(time, 9620, 1320);
    set(loop, "--ppo-loop", feedback);
    trace(layout.feedback, "#4a75b0", feedback, true);
  }

  function updateButton() {
    const label = playing ? "Pause" : elapsed === duration ? "Replay" : "Play";
    button.toggleAttribute("data-playing", playing);
    button.setAttribute("aria-label", `${label} PPO training animation`);
    button.querySelector("span").textContent = label;
  }

  function pause() {
    playing = false;
    last = undefined;
    cancelAnimationFrame(frame);
    updateButton();
  }

  function tick(now) {
    if (last !== undefined) elapsed = Math.min(duration, elapsed + Math.min(now - last, 100));
    last = now;
    render();
    if (elapsed < duration) frame = requestAnimationFrame(tick);
    else {
      autoplay = false;
      pause();
    }
  }

  async function play(manual = false) {
    if (playing || motion.matches) return;
    if (!await prepareMedia() || playing || motion.matches || (!manual && (!visible || !autoplay))) return;
    if (elapsed === duration) elapsed = 0;
    playing = true;
    updateButton();
    frame = requestAnimationFrame(tick);
  }

  button.addEventListener("click", () => {
    autoplay = !playing;
    if (playing) {
      pause();
    } else {
      if (figure.getBoundingClientRect().top < document.querySelector(".site-header").offsetHeight) {
        figure.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      play(true);
    }
  });
  motion.addEventListener("change", () => {
    button.hidden = motion.matches;
    if (motion.matches) pause();
    render();
  });
  figure.setAttribute("data-ppo-enhanced", "");
  button.hidden = motion.matches;
  measure();
  new ResizeObserver(measure).observe(board);
  document.fonts?.ready.then(measure);
  new IntersectionObserver(([entry]) => {
    visible = entry.intersectionRatio >= .27;
    if (visible && autoplay) play();
    else if (!visible && playing) pause();
  }, { threshold: .27 }).observe(board);
})();
