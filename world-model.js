(() => {
  const figure = document.querySelector("[data-wm-motion]");
  if (!figure) return;

  const $ = selector => figure.querySelector(selector);
  const all = selector => [...figure.querySelectorAll(selector)];
  const stage = $("[data-wm-layout]");
  const canvas = $("[data-wm-paths]");
  const pen = canvas.getContext("2d");
  const sources = all("[data-wm-source]").map(source => ({
    film: source.querySelector(".wm-film"),
    color: getComputedStyle(source).getPropertyValue("--wm-source").trim()
  }));
  const tuning = $("[data-wm-tuning]");
  const policy = $("[data-wm-policy]");
  const context = $(".wm-context-frame");
  const core = $("[data-wm-generator]");
  const coreGlow = core.querySelector(".wm-core");
  const output = $("[data-wm-output-frame]");
  const history = all("[data-wm-history]");
  const outputImages = all("[data-wm-output-image]");
  const contextImages = all("[data-wm-context-image]");
  const action = $("[data-wm-action]");
  const prediction = $("[data-wm-predicted]");
  const flight = $("[data-wm-flight]");
  const toggle = $("[data-wm-play]");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const rolloutStart = 2710;
  const cycleDuration = 2910;
  const duration = rolloutStart + cycleDuration * outputImages.length + 350;
  const actions = ["a₀", "a₁", "a₂"];
  const observations = ["ô₁", "ô₂", "ô₃"];
  const colors = { context: "#5981b6", policy: "#b68835", result: "#4d73cb", feedback: "#567eb7" };

  let shape;
  let elapsed = 0;
  let previous;
  let request;
  let playing = false;
  let allowAutoplay = !navigator.connection?.saveData;

  const progress = (value, start, span) => Math.min(1, Math.max(0, (value - start) / span));
  const mix = (start, end, t) => start + (end - start) * t;
  const soften = t => t * t * (3 - 2 * t);
  const peak = t => Math.sin(Math.PI * t);
  const point = (x, y) => ({ x, y });

  function path(start, h1, h2, end) {
    return { start, h1, h2, end };
  }

  function flow(start, end) {
    const turn = (end.x - start.x) * .48;
    return path(start, point(start.x + turn, start.y), point(end.x - turn, end.y), end);
  }

  function position({ start, h1, h2, end }, t) {
    const a = 1 - t;
    const interpolate = axis => (
      a ** 3 * start[axis] + 3 * a * a * t * h1[axis] + 3 * a * t * t * h2[axis] + t ** 3 * end[axis]
    );
    return point(interpolate("x"), interpolate("y"));
  }

  function draw(route, color, alpha, signal, arrow = false) {
    if (!pen || alpha <= 0) return;
    const { start, h1, h2, end } = route;
    pen.beginPath();
    pen.moveTo(start.x, start.y);
    pen.bezierCurveTo(h1.x, h1.y, h2.x, h2.y, end.x, end.y);
    pen.lineWidth = .9;
    pen.strokeStyle = color;
    pen.globalAlpha = alpha;
    pen.stroke();
    if (arrow) {
      const angle = Math.atan2(end.y - h2.y, end.x - h2.x);
      const tip = offset => point(end.x - 4 * Math.cos(angle + offset), end.y - 4 * Math.sin(angle + offset));
      const left = tip(.63);
      const right = tip(-.63);
      pen.beginPath();
      pen.moveTo(left.x, left.y);
      pen.lineTo(end.x, end.y);
      pen.lineTo(right.x, right.y);
      pen.stroke();
    }
    pen.globalAlpha = 1;

    if (signal <= 0 || signal >= 1) return;
    for (let i = 5; i >= 0; i--) {
      const dot = position(route, Math.max(0, signal - i * .030));
      pen.beginPath();
      pen.fillStyle = color;
      pen.globalAlpha = .92 * (1 - i / 6) * Math.min(1, peak(signal) * 4);
      pen.arc(dot.x, dot.y, 3.1 - i * .31, 0, Math.PI * 2);
      pen.fill();
    }
    pen.globalAlpha = 1;
  }

  function measure() {
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    pen?.setTransform(ratio, 0, 0, ratio, 0, 0);

    function rect(element) {
      const box = element.getBoundingClientRect();
      const x = box.x - bounds.x;
      const y = box.y - bounds.y;
      return {
        x, y, width: box.width, height: box.height,
        east: point(x + box.width + 3, y + box.height / 2),
        west: point(x - 3, y + box.height / 2),
        north: point(x + box.width / 2, y - 3),
        south: point(x + box.width / 2, y + box.height + 3),
        center: point(x + box.width / 2, y + box.height / 2)
      };
    }

    const modelBox = rect(core);
    const tuningBox = rect(tuning);
    const policyBox = rect(policy);
    const contextBox = rect(context);
    const outputBox = rect(output);
    const feedbackClear = Math.max(outputBox.east.x + 8, modelBox.east.x + 12);
    const tracks = sources.map(source => {
      const from = rect(source.film).east;
      const bus = Math.max(from.x, tuningBox.east.x) + 13;
      const to = tuningBox.east;
      return path(from, point(bus, from.y), point(bus, to.y), to);
    });
    const memory = history.filter((_, index) => index % 2 === 0).slice(1).map(tile => {
      const to = rect(tile);
      const from = outputBox.center;
      const mid = mix(from.y, to.center.y, .57);
      const travel = path(from, point(from.x, mid), point(to.center.x, mid), to.center);
      return { travel, width: to.width, startWidth: outputBox.width * .66 };
    });
    const sourceLink = tuningBox.east.x < modelBox.west.x
      ? path(tuningBox.east, point(modelBox.south.x - 58, tuningBox.east.y), point(modelBox.south.x, modelBox.south.y + 42), modelBox.south)
      : null;
    const policyRoute = path(policyBox.south,
      point(policyBox.south.x, mix(policyBox.south.y, modelBox.north.y, .45)),
      point(modelBox.north.x, mix(policyBox.south.y, modelBox.north.y, .6)), modelBox.north);
    const feedbackRoute = path(outputBox.north, point(feedbackClear, policyBox.east.y - 3),
      point(policyBox.east.x + 23, policyBox.east.y), policyBox.east);
    shape = {
      width: bounds.width, height: bounds.height,
      tracks, memory, sourceLink, policyRoute, feedbackRoute,
      contextRoute: flow(contextBox.east, modelBox.west),
      resultRoute: flow(modelBox.east, outputBox.west)
    };
    render();
  }

  function showImage(image, opacity) {
    image.style.setProperty("--wm-image", opacity.toFixed(3));
  }

  function render() {
    if (!shape) return;
    const staticView = motion.matches || elapsed >= duration;
    const step = Math.min(outputImages.length - 1, Math.floor(Math.max(0, elapsed - rolloutStart) / cycleDuration));
    const time = elapsed - rolloutStart - step * cycleDuration;
    const predict = staticView ? 1 : soften(progress(time, 1020, 670));
    const append = staticView ? 1 : soften(progress(time, 2470, 245));
    const flightProgress = progress(time, 1650, 830);
    const currentObservation = staticView ? contextImages.length - 1 : step;
    const currentPrediction = staticView ? outputImages.length - 1 : step;
    const visiblePrediction = currentPrediction > 0 && predict < .5 ? currentPrediction - 1 : currentPrediction;

    // Older images remain underneath the growing layer for a true dissolve.
    contextImages.forEach((image, index) => {
      showImage(image, index === currentObservation ? 1 : index === currentObservation + 1 ? append : 0);
    });
    outputImages.forEach((image, index) => {
      const opacity = index === currentPrediction ? predict : index === currentPrediction - 1 ? 1 : 0;
      showImage(image, opacity);
    });

    if (action.textContent !== actions[currentPrediction]) action.textContent = actions[currentPrediction];
    if (prediction.textContent !== observations[visiblePrediction]) prediction.textContent = observations[visiblePrediction];
    const landed = flightProgress >= .95;
    const lastHistory = staticView ? history.length - 1 : 2 * step + (landed ? 2 : time >= 690 ? 1 : 0);
    history.forEach((tile, index) => {
      tile.toggleAttribute("data-wm-released", index <= lastHistory);
      tile.toggleAttribute("data-wm-current", index === lastHistory && lastHistory > 0 && index % 2 === 0);
    });
    policy.toggleAttribute("data-wm-active", (time >= 0 && time < 760) || (time >= 1890 && time < 2440));
    tuning.toggleAttribute("data-converged", staticView || elapsed > 2100);

    coreGlow.style.setProperty("--wm-core-glow", peak(progress(time, 430, 1180)).toFixed(3));
    output.style.setProperty("--wm-scan-x", `${mix(-100, 108, predict)}%`);
    output.style.setProperty("--wm-scan-opacity", peak(predict).toFixed(3));
    figure.dataset.wmPhase = elapsed < rolloutStart && !staticView ? "fine-tuning" : `rollout-${currentPrediction + 1}`;

    pen?.clearRect(0, 0, shape.width, shape.height);
    shape.tracks.forEach((route, index) => {
      const signal = progress(elapsed, 190 + index * 430, 950);
      const film = sources[index].film;
      film.style.setProperty("--wm-sweep", `${mix(-100, 100, signal)}%`);
      film.style.setProperty("--wm-flash", peak(signal).toFixed(3));
      draw(route, sources[index].color, .29, staticView ? 1 : signal);
    });
    if (shape.sourceLink) draw(shape.sourceLink, colors.result, .14, progress(elapsed, 1780, 950));
    draw(shape.policyRoute, colors.policy, .5, progress(time, 220, 650), true);
    draw(shape.contextRoute, colors.context, .5, progress(time, 370, 600), true);
    draw(shape.resultRoute, colors.result, .5, progress(time, 850, 680), true);
    draw(shape.feedbackRoute, colors.feedback, .46, progress(time, 1580, 720), true);

    const moving = !staticView && flightProgress > 0 && flightProgress < 1;
    flight.hidden = !moving;
    if (moving) {
      const src = outputImages[step].getAttribute("src");
      if (flight.getAttribute("src") !== src) flight.src = src;
      const memory = shape.memory[step];
      const t = soften(flightProgress);
      const p = position(memory.travel, t);
      const scale = mix(memory.startWidth, memory.width, t) / 104;
      flight.style.transform = `translate3d(${p.x - 52}px,${p.y - 29.25}px,0) scale(${scale})`;
      flight.style.opacity = Math.min(progress(flightProgress, 0, .12), 1 - progress(flightProgress, .93, .07)).toFixed(3);
    }
  }

  function updateToggle() {
    const label = playing ? "Pause" : elapsed >= duration ? "Replay" : "Play";
    toggle.toggleAttribute("data-playing", playing);
    toggle.setAttribute("aria-label", `${label} world model animation`);
    toggle.querySelector("span").textContent = label;
  }

  function pause() {
    playing = false;
    previous = undefined;
    cancelAnimationFrame(request);
    updateToggle();
  }

  function tick(now) {
    if (previous !== undefined) elapsed = Math.min(duration, elapsed + Math.min(now - previous, 100));
    previous = now;
    render();
    if (elapsed < duration) request = requestAnimationFrame(tick);
    else {
      allowAutoplay = false;
      pause();
    }
  }

  function play() {
    if (playing || motion.matches) return;
    if (elapsed >= duration) elapsed = 0;
    playing = true;
    render();
    updateToggle();
    request = requestAnimationFrame(tick);
  }

  toggle.addEventListener("click", () => {
    if (playing) {
      allowAutoplay = false;
      pause();
      return;
    }
    allowAutoplay = true;
    const top = figure.getBoundingClientRect().top;
    if (top < 0 && stage.getBoundingClientRect().bottom < innerHeight * .5) {
      figure.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    play();
  });

  motion.addEventListener("change", () => {
    toggle.hidden = motion.matches;
    if (motion.matches) pause();
    render();
  });

  figure.setAttribute("data-wm-enhanced", "");
  toggle.hidden = motion.matches;
  measure();
  updateToggle();
  new ResizeObserver(measure).observe(stage);
  document.fonts?.ready.then(measure);
  new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= .30) {
      if (allowAutoplay) play();
    } else if (playing) {
      pause();
    }
  }, { threshold: .30 }).observe(stage);
})();
