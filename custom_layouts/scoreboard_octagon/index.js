(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const setInnerHtml = window.SetInnerHtml;
  let animationReady = false;
  let setTrackingReady = false;
  let lastSetId = null;
  let pendingSetId = null;
  let setTransitionInProgress = false;
  let entranceAnimationFrame = null;
  let setTransitionGeneration = 0;
  const renderedSetParts = new Set();
  const requiredSetParts = new Set([
    "p1-name",
    "p1-score",
    "p2-name",
    "p2-score",
  ]);

  window.SetInnerHtml = (element, html, settings = {}) => {
    const target = element?.get?.(0) ?? element?.[0];
    const skipContentFade =
      target?.classList.contains("score") || setTransitionInProgress;
    const update = setInnerHtml(
      element,
      html,
      skipContentFade
        ? {
            ...settings,
            fadeTime: 0,
            anim_in: {
              ...settings.anim_in,
              autoAlpha: 1,
              duration: 0,
              stagger: 0,
            },
            anim_out: {
              ...settings.anim_out,
              autoAlpha: 1,
              duration: 0,
              stagger: 0,
            },
          }
        : settings,
    );

    trackRenderedSetPart(target, update);
    return update;
  };

  const pulseWheelFitting = (score) => {
    const player = score.closest(".player");
    const fittingIndex = player?.classList.contains("p1") ? 6 : 2;
    const fitting = document.querySelector(`.wheel-bolt[style*="--i: ${fittingIndex}"]`);

    if (!fitting) {
      return;
    }

    gsap.fromTo(
      fitting,
      { backgroundColor: "#ffffff", filter: "brightness(1.75)" },
      {
        backgroundColor: "#e3ad4f",
        filter: "brightness(1)",
        duration: 0.36,
        ease: "power2.out",
        overwrite: true,
      },
    );
  };

  const addBellRing = (score) => {
    const ring = document.createElement("span");
    ring.className = "score-ring";
    score.append(ring);

    gsap.fromTo(
      ring,
      { autoAlpha: 0.9, scale: 0.86 },
      {
        autoAlpha: 0,
        scale: 1.28,
        duration: 0.48,
        ease: "power2.out",
        onComplete: () => ring.remove(),
      },
    );
  };

  const addFoamParticles = (score) => {
    [-1, 1].forEach((direction, index) => {
      const particle = document.createElement("span");
      particle.className = "score-particle";
      score.append(particle);

      gsap.fromTo(
        particle,
        { autoAlpha: 0.9, scale: 0.65, xPercent: -50, yPercent: -50 },
        {
          autoAlpha: 0,
          scale: 1.15,
          x: direction * (24 + index * 5),
          y: -18 - index * 7,
          duration: 0.42,
          delay: index * 0.025,
          ease: "power2.out",
          onComplete: () => particle.remove(),
        },
      );
    });
  };

  const animateReducedMotion = (score) => {
    gsap.fromTo(
      score,
      { filter: "brightness(1.4)" },
      {
        filter: "brightness(1)",
        duration: 0.18,
        ease: "power1.out",
        overwrite: true,
      },
    );
  };

  const animateScoreChange = (score, previousValue) => {
    if (reducedMotion.matches) {
      animateReducedMotion(score);
      return;
    }

    const currentText = score.querySelector(":scope > .text");
    const previousText = document.createElement("span");
    previousText.className = "score-old";
    previousText.textContent = previousValue;
    score.append(previousText);

    gsap.killTweensOf(score);
    gsap.set(score, { scale: 1 });

    const timeline = gsap.timeline({
      onComplete: () => previousText.remove(),
    });

    timeline
      .to(score, {
        scale: 0.92,
        duration: 0.07,
        ease: "power1.in",
      })
      .to(score, {
        scale: 1.16,
        duration: 0.16,
        ease: "power2.out",
      })
      .to(score, {
        scale: 1,
        duration: 0.32,
        ease: "back.out(1.8)",
      });

    gsap.fromTo(
      previousText,
      { autoAlpha: 0.85, y: 0 },
      {
        autoAlpha: 0,
        y: -26,
        duration: 0.24,
        ease: "power2.in",
      },
    );

    if (currentText) {
      gsap.fromTo(
        currentText,
        { autoAlpha: 0, y: 22 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          delay: 0.07,
          ease: "back.out(1.6)",
          overwrite: true,
        },
      );
    }

    addBellRing(score);
    addFoamParticles(score);
    pulseWheelFitting(score);
  };

  const hasLoadedEntrants = (scoreboard) =>
    ["1", "2"].every((teamNumber) =>
      Object.values(scoreboard?.team?.[teamNumber]?.player ?? {}).some(
        (player) => String(player?.name ?? "").trim(),
      ),
    );

  // TSH publishes the set ID before its asynchronous player render finishes.
  const getRenderedSetPart = (target) => {
    if (
      !target ||
      (!target.classList.contains("name") &&
        !target.classList.contains("score"))
    ) {
      return null;
    }

    const player = target.closest(".p1, .p2");
    if (!player) {
      return null;
    }

    const playerNumber = player.classList.contains("p1") ? "p1" : "p2";
    const field = target.classList.contains("name") ? "name" : "score";
    return `${playerNumber}-${field}`;
  };

  function trackRenderedSetPart(target, update) {
    const part = getRenderedSetPart(target);

    if (!setTransitionInProgress || !part) {
      return;
    }

    const generation = setTransitionGeneration;
    Promise.resolve(update).then(() => {
      if (
        setTransitionInProgress &&
        generation === setTransitionGeneration
      ) {
        renderedSetParts.add(part);
      }
    });
  }

  const hasRenderedSet = () =>
    [...requiredSetParts].every((part) => renderedSetParts.has(part));

  const cancelScheduledEntrance = () => {
    if (entranceAnimationFrame !== null) {
      window.cancelAnimationFrame(entranceAnimationFrame);
      entranceAnimationFrame = null;
    }
  };

  const scheduleTransitionEnd = (setId, replayEntrance) => {
    cancelScheduledEntrance();

    const finishTransition = () => {
      if (lastSetId !== setId) {
        return;
      }

      if (replayEntrance && !hasRenderedSet()) {
        entranceAnimationFrame =
          window.requestAnimationFrame(finishTransition);
        return;
      }

      entranceAnimationFrame = window.requestAnimationFrame(() => {
        entranceAnimationFrame = null;

        if (
          replayEntrance &&
          lastSetId === setId &&
          typeof window.Start === "function"
        ) {
          window.Start();
        }

        setTransitionInProgress = false;
      });
    };

    entranceAnimationFrame =
      window.requestAnimationFrame(finishTransition);
  };

  document.addEventListener("tsh_update", (event) => {
    const scoreboard = event.data?.score?.[window.scoreboardNumber];
    const currentSetId = scoreboard?.set_id ?? null;

    if (!setTrackingReady) {
      lastSetId = currentSetId;
      setTrackingReady = true;
      return;
    }

    if (currentSetId !== lastSetId) {
      cancelScheduledEntrance();
      lastSetId = currentSetId;
      pendingSetId = currentSetId;
      setTransitionInProgress = true;
      setTransitionGeneration += 1;
      renderedSetParts.clear();

      if (currentSetId === null) {
        pendingSetId = null;
        scheduleTransitionEnd(null, false);
      }

      return;
    }

    if (
      pendingSetId === null ||
      currentSetId !== pendingSetId ||
      !hasLoadedEntrants(scoreboard)
    ) {
      return;
    }

    pendingSetId = null;
    setTransitionGeneration += 1;
    renderedSetParts.clear();
    scheduleTransitionEnd(currentSetId, true);
  });

  document.addEventListener("tsh_init", () => {
    animationReady = true;

    if (reducedMotion.matches) {
      return;
    }

    gsap.fromTo(
      ".brand-rig",
      { rotate: -3, scale: 0.94 },
      {
        rotate: 0,
        scale: 1,
        duration: 0.45,
        ease: "back.out(1.6)",
        transformOrigin: "center center",
      },
    );

    gsap.fromTo(
      ".log-tentacle",
      { autoAlpha: 0, x: -18 },
      {
        autoAlpha: 1,
        x: 0,
        duration: 0.5,
        delay: 0.08,
        ease: "power2.out",
      },
    );
  });

  document.querySelectorAll(".score").forEach((score) => {
    let previousValue = null;

    const observer = new MutationObserver(() => {
      const currentValue = score
        .querySelector(":scope > .text")
        ?.textContent.trim();

      if (!currentValue || currentValue === previousValue) {
        return;
      }

      if (
        animationReady &&
        previousValue !== null &&
        !setTransitionInProgress
      ) {
        animateScoreChange(score, previousValue);
      }

      previousValue = currentValue;
    });

    observer.observe(score, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
})();
