(() => {
  let animationReady = false;

  document.addEventListener("tsh_init", () => {
    animationReady = true;

    gsap.fromTo(
      ".brand-outline",
      { rotate: -4, scale: 0.92 },
      {
        rotate: 0,
        scale: 1,
        duration: 0.45,
        ease: "back.out(1.8)",
        transformOrigin: "center center",
      },
    );

    gsap.fromTo(
      ".signal-sweep",
      { autoAlpha: 0, x: -250 },
      {
        autoAlpha: 0.85,
        x: 250,
        duration: 0.7,
        ease: "power2.inOut",
        yoyo: true,
        repeat: 1,
      },
    );
  });

  document.querySelectorAll(".score").forEach((score) => {
    let previousValue = null;

    const observer = new MutationObserver(() => {
      const currentValue = score.textContent.trim();
      if (!currentValue || currentValue === previousValue) {
        return;
      }

      if (animationReady && previousValue !== null) {
        gsap.fromTo(
          score,
          {
            scale: 1.22,
            filter: "brightness(1.8)",
          },
          {
            scale: 1,
            filter: "brightness(1)",
            duration: 0.35,
            ease: "back.out(2.2)",
            transformOrigin: "center center",
            overwrite: true,
          },
        );
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
