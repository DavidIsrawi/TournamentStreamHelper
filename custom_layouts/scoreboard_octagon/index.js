(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const setInnerHtml = window.SetInnerHtml;
  let animationReady = false;
  let setTrackingReady = false;
  let lastSetId = null;
  let waitingForEntrants = false;
  let setTransitionInProgress = false;
  let setTransitionGeneration = 0;
  let activeRenderContext = null;
  let updateQueue = Promise.resolve();
  const renderedSetTargets = new Set();
  const requiredSetTargets = new Set([
    document.querySelector(".p1 .name"),
    document.querySelector(".p1 .score"),
    document.querySelector(".p2 .name"),
    document.querySelector(".p2 .score"),
  ]);

  window.SetInnerHtml = (element, html, settings = {}) => {
    const target = element?.get?.(0) ?? element?.[0];
    const skipContentFade =
      target?.classList.contains("score") ||
      setTransitionInProgress ||
      activeRenderContext?.setTransition;
    const update = skipContentFade
      ? setInnerHtmlImmediately(element, html, settings)
      : setInnerHtml(element, html, settings);

    trackRenderedSetPart(target);
    return update;
  };

  function setInnerHtmlImmediately(element, html, settings) {
    if (element == null || settings.force === false) {
      return Promise.resolve();
    }

    const content = String(html ?? "");
    let text = element.find(".text");

    if (text.length === 0) {
      element.html("<div class='text'></div>");
      text = element.find(".text");
    }

    const normalizeHtml = (value) => {
      const container = document.createElement("div");
      container.innerHTML = String(value);
      return container.innerHTML;
    };

    if (
      settings.force !== true &&
      normalizeHtml(text.html()) === normalizeHtml(content)
    ) {
      if (activeRenderContext?.setTransition) {
        gsap.killTweensOf(text);
        gsap.set(text, { autoAlpha: 1 });
      }
      return Promise.resolve();
    }

    gsap.killTweensOf(text);
    text.html(content);

    const isEmpty = content.trim().length === 0;
    text.toggleClass("text_empty", isEmpty);
    element.toggleClass("text_empty", isEmpty);
    FitText(element);
    settings.middleFunction?.();
    gsap.set(text, { autoAlpha: 1 });

    return Promise.resolve();
  }

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

  const animateTemporaryScoreEffect = (
    score,
    className,
    fromVars,
    toVars,
  ) => {
    const effect = document.createElement("span");
    effect.className = className;
    score.append(effect);

    gsap.fromTo(effect, fromVars, {
      ...toVars,
      onComplete: () => effect.remove(),
    });
  };

  const addBellRing = (score) => {
    animateTemporaryScoreEffect(
      score,
      "score-ring",
      { autoAlpha: 0.9, scale: 0.86 },
      {
        autoAlpha: 0,
        scale: 1.28,
        duration: 0.48,
        ease: "power2.out",
      },
    );
  };

  const addFoamParticles = (score) => {
    [-1, 1].forEach((direction, index) => {
      animateTemporaryScoreEffect(
        score,
        "score-particle",
        { autoAlpha: 0.9, scale: 0.65, xPercent: -50, yPercent: -50 },
        {
          autoAlpha: 0,
          scale: 1.15,
          x: direction * (24 + index * 5),
          y: -18 - index * 7,
          duration: 0.42,
          delay: index * 0.025,
          ease: "power2.out",
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

  function trackRenderedSetPart(target) {
    if (
      !activeRenderContext?.setTransition ||
      !requiredSetTargets.has(target)
    ) {
      return;
    }

    activeRenderContext.renderedTargets.add(target);
  }

  const hasRenderedSet = () =>
    [...requiredSetTargets].every((target) =>
      renderedSetTargets.has(target),
    );

  const installUpdateQueue = () => {
    const updateWrapper = window.UpdateWrapper;
    const queuedUpdateWrapper = (event) => {
      const setId =
        event.data?.score?.[window.scoreboardNumber]?.set_id ?? null;
      const context = {
        generation: setTransitionGeneration,
        setId,
        setTransition:
          setTransitionInProgress || waitingForEntrants,
        renderedTargets: new Set(),
      };

      const renderUpdate = async () => {
        activeRenderContext = context;

        try {
          await updateWrapper(event);
        } catch (error) {
          if (
            context.generation === setTransitionGeneration &&
            context.setId === lastSetId
          ) {
            setTransitionGeneration += 1;
            waitingForEntrants = context.setId !== null;
            setTransitionInProgress = false;
          }
          throw error;
        } finally {
          activeRenderContext = null;
        }

        if (
          context.generation === setTransitionGeneration &&
          context.setId === lastSetId
        ) {
          context.renderedTargets.forEach((target) =>
            renderedSetTargets.add(target),
          );
        }
      };

      const queuedUpdate = updateQueue.then(renderUpdate);
      updateQueue = queuedUpdate.catch((error) => {
        console.error("Octagon scoreboard update failed", error);
      });
      return queuedUpdate;
    };

    queueMicrotask(() => {
      document.removeEventListener("tsh_update", updateWrapper);
      document.addEventListener("tsh_update", queuedUpdateWrapper);
    });
  };

  const scheduleTransitionEnd = (generation, replayEntrance) => {
    const finishTransition = () => {
      if (generation !== setTransitionGeneration) {
        return;
      }

      if (replayEntrance && !hasRenderedSet()) {
        window.requestAnimationFrame(finishTransition);
        return;
      }

      window.requestAnimationFrame(() => {
        if (generation !== setTransitionGeneration) {
          return;
        }

        if (replayEntrance && typeof window.Start === "function") {
          window.Start();
        }

        setTransitionInProgress = false;
      });
    };

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
      lastSetId = currentSetId;
      waitingForEntrants =
        currentSetId !== null && !hasLoadedEntrants(scoreboard);
      setTransitionInProgress = true;
      setTransitionGeneration += 1;
      renderedSetTargets.clear();

      scheduleTransitionEnd(
        setTransitionGeneration,
        currentSetId !== null && !waitingForEntrants,
      );

      return;
    }

    if (
      !waitingForEntrants ||
      !hasLoadedEntrants(scoreboard)
    ) {
      return;
    }

    waitingForEntrants = false;
    setTransitionInProgress = true;
    setTransitionGeneration += 1;
    renderedSetTargets.clear();
    scheduleTransitionEnd(setTransitionGeneration, true);
  });

  document.addEventListener("tsh_init", () => {
    installUpdateQueue();
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
