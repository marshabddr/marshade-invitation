document.addEventListener("DOMContentLoaded", function () {
    const musicController = initMusic();

    initGuestName();
    initCover(musicController);
    initCountdown();
    initWorldCamera();
    initDetailReveals();
});

function initWorldCamera() {
    const journey = document.getElementById("worldJourney");
    const stage = document.getElementById("worldStage");
    const camera = document.getElementById("worldCamera");
    const canvas = document.getElementById("worldCanvas");
    const narrative = document.getElementById("worldNarrative");

    if (!journey || !stage || !camera || !canvas || !narrative) {
        return;
    }

    const orderedNodes = [
        narrative.querySelector(".world-shot--establish"),
        document.getElementById("couple"),
        narrative.querySelector(".world-cluster--story"),
        narrative.querySelector(".world-shot--date"),
        narrative.querySelector(".world-cluster--event"),
        narrative.querySelector(".world-gallery"),
        narrative.querySelector(".world-gift-passage"),
        narrative.querySelector(".world-shot--gift-configured"),
        document.getElementById("rsvpForm")?.closest(".world-shot"),
        document.getElementById("wishForm")?.closest(".world-shot"),
        document.getElementById("quranInterlude"),
        narrative.querySelector(".world-shot--closing")
    ];

    orderedNodes.forEach(function (node) {
        if (node) narrative.appendChild(node);
    });

    const mergedIslamicOpening = narrative.querySelector(".world-legacy-merged");
    if (mergedIslamicOpening) {
        mergedIslamicOpening.hidden = true;
    }

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileLayout = window.matchMedia("(max-width: 899px)");
    const shotElements = Array.from(narrative.querySelectorAll("[data-camera-desktop][data-camera-mobile]"));
    const worldObjects = Array.from(canvas.querySelectorAll("[data-world-id]"));
    let frames = [];
    let frameRequested = false;
    let cameraEnabled = false;
    let currentShot = "";

    const clamp = function (value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    };

    const smoothstep = function (value) {
        const progress = clamp(value, 0, 1);
        return progress * progress * (3 - (2 * progress));
    };

    const parseCamera = function (element) {
        const attribute = mobileLayout.matches ? "cameraMobile" : "cameraDesktop";
        const values = String(element.dataset[attribute] || "0.5,0.5,1")
            .split(",")
            .map(Number);

        return {
            x: Number.isFinite(values[0]) ? values[0] : 0.5,
            y: Number.isFinite(values[1]) ? values[1] : 0.5,
            scale: Number.isFinite(values[2]) ? values[2] : 1
        };
    };

    const normalizeWorldId = function (shotName) {
        if (shotName === "establishing") return "couple";
        if (shotName.indexOf("story-2026") === 0) return "story-2026";
        if (shotName === "rsvp" || shotName === "wishes") return "responses";
        if (shotName.indexOf("gift") === 0) return "gift";
        return shotName;
    };

    const setActiveShot = function (shot) {
        if (!shot || currentShot === shot.name) return;
        currentShot = shot.name;
        stage.dataset.activeShot = normalizeWorldId(shot.name);

        shotElements.forEach(function (element) {
            element.classList.toggle("world-shot-active", element === shot.element);
        });

        const activeWorldId = normalizeWorldId(shot.name);
        worldObjects.forEach(function (object) {
            object.classList.toggle("is-world-focus", object.dataset.worldId === activeWorldId);
        });
    };

    const refreshFrames = function () {
        if (!cameraEnabled) return;

        frames = shotElements
            .filter(function (element) {
                return !element.hidden && element.getClientRects().length > 0;
            })
            .map(function (element) {
                const rect = element.getBoundingClientRect();
                return {
                    element: element,
                    name: element.dataset.shot || "",
                    center: rect.top + window.scrollY + (rect.height * 0.5),
                    camera: parseCamera(element)
                };
            });

        requestCameraFrame();
    };

    const updateCamera = function () {
        frameRequested = false;
        if (!cameraEnabled || !frames.length) return;

        const viewportFocus = window.scrollY + (window.innerHeight * 0.5);
        let from = frames[0];
        let to = frames[0];
        let rawProgress = 0;

        if (viewportFocus >= frames[frames.length - 1].center) {
            from = frames[frames.length - 1];
            to = from;
        } else {
            for (let index = 0; index < frames.length - 1; index += 1) {
                const candidate = frames[index];
                const next = frames[index + 1];

                if (viewportFocus >= candidate.center && viewportFocus < next.center) {
                    from = candidate;
                    to = next;
                    rawProgress = (viewportFocus - candidate.center) / Math.max(1, next.center - candidate.center);
                    break;
                }

                if (viewportFocus < frames[0].center) {
                    break;
                }
            }
        }

        const progress = smoothstep(rawProgress);
        const x = from.camera.x + ((to.camera.x - from.camera.x) * progress);
        const y = from.camera.y + ((to.camera.y - from.camera.y) * progress);
        const scale = from.camera.scale + ((to.camera.scale - from.camera.scale) * progress);
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        const translateX = (window.innerWidth * 0.5) - (x * canvasWidth * scale);
        const translateY = (window.innerHeight * 0.5) - (y * canvasHeight * scale);

        camera.style.transform = "translate3d(" + translateX.toFixed(2) + "px," + translateY.toFixed(2) + "px,0) scale(" + scale.toFixed(4) + ")";
        canvas.style.setProperty("--depth-x", clamp((0.5 - x) * 100, -52, 52).toFixed(2) + "px");
        canvas.style.setProperty("--depth-y", clamp((0.5 - y) * 76, -46, 46).toFixed(2) + "px");

        setActiveShot(rawProgress < 0.5 ? from : to);
    };

    function requestCameraFrame() {
        if (frameRequested || !cameraEnabled) return;
        frameRequested = true;
        window.requestAnimationFrame(updateCamera);
    }

    const setCameraMode = function () {
        cameraEnabled = !motionPreference.matches;
        document.body.classList.toggle("world-camera-ready", cameraEnabled);
        document.body.classList.toggle("world-camera-static", !cameraEnabled);

        if (!cameraEnabled) {
            camera.style.removeProperty("transform");
            canvas.style.removeProperty("--depth-x");
            canvas.style.removeProperty("--depth-y");
            shotElements.forEach(function (element) {
                element.classList.add("world-shot-active");
            });
            return;
        }

        window.requestAnimationFrame(refreshFrames);
    };

    if ("IntersectionObserver" in window) {
        const shotObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("world-shot-visible");
                }
            });
        }, { rootMargin: "35% 0px 35% 0px", threshold: 0.01 });

        shotElements.forEach(function (element) {
            shotObserver.observe(element);
        });
    } else {
        shotElements.forEach(function (element) {
            element.classList.add("world-shot-visible");
        });
    }

    window.addEventListener("scroll", requestCameraFrame, { passive: true });
    window.addEventListener("resize", refreshFrames);
    mobileLayout.addEventListener("change", refreshFrames);
    motionPreference.addEventListener("change", setCameraMode);

    if ("ResizeObserver" in window) {
        const worldResizeObserver = new ResizeObserver(refreshFrames);
        worldResizeObserver.observe(narrative);
        worldResizeObserver.observe(canvas);
    }

    setCameraMode();
}

function initDetailReveals() {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionPreference.matches || !("IntersectionObserver" in window)) return;

    const elements = document.querySelectorAll("[data-detail-reveal]");
    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add("detail-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08 });

    elements.forEach(function (element) {
        element.classList.add("detail-reveal");
        observer.observe(element);
    });
    motionPreference.addEventListener("change", function (event) {
        if (event.matches) {
            observer.disconnect();
            elements.forEach(function (element) {
                element.classList.remove("detail-reveal");
            });
        }
    });
}

function initLoader() {
    const loader = document.querySelector(".loader");

    if (!loader) {
        return;
    }

    const brand = document.getElementById("brand");
    const text = "Craft By Marshade...";
    let textIndex = 0;
    let typingTimer = null;

    if (brand) {
        const typeText = function () {
            brand.textContent = text.substring(0, textIndex);
            textIndex += 1;

            if (textIndex > text.length) {
                window.clearInterval(typingTimer);
            }
        };

        typeText();
        typingTimer = window.setInterval(typeText, 150);
    }

    const hideLoader = function () {
        window.setTimeout(function () {
            const cover = document.getElementById("cover");

            if (cover) {
                cover.classList.add("is-ready");
            }

            loader.style.opacity = "0";

            const removeLoader = function () {
                if (loader.isConnected) {
                    loader.remove();
                }
            };

            loader.addEventListener("transitionend", removeLoader, { once: true });
            window.setTimeout(removeLoader, 2200);
        }, 3000);
    };

    hideLoader();
}

function initGuestName() {
    const guestNameElements = document.querySelectorAll("[data-guest-name]");

    if (!guestNameElements.length) {
        return;
    }

    const defaultGuestName = "Tamu Undangan";
    const urlParameters = new URLSearchParams(window.location.search);
    const guestParameter = urlParameters.get("to");
    const normalizedGuestName = guestParameter
        ? guestParameter.trim().replace(/\s+/g, " ").slice(0, 80)
        : "";

    guestNameElements.forEach(function (element) {
        element.textContent = normalizedGuestName || defaultGuestName;
    });
}

function initCover(musicController) {
    const cover = document.getElementById("cover");
    const openButton = document.querySelector(".open-button");
    const invitationContent = document.getElementById("invitationContent");
    const welcomeHeading = document.getElementById("welcomeTitle");

    if (!cover || !openButton) {
        document.body.classList.remove("invitation-locked");
        document.body.classList.add("invitation-opened");

        if (invitationContent) {
            invitationContent.removeAttribute("inert");
            invitationContent.removeAttribute("aria-hidden");
        }

        return;
    }

    document.body.classList.add("invitation-enhanced", "invitation-locked");

    if (invitationContent) {
        invitationContent.setAttribute("inert", "");
        invitationContent.setAttribute("aria-hidden", "true");
    }

    window.requestAnimationFrame(function () {
        cover.classList.add("is-ready");
    });

    openButton.addEventListener("click", function () {
        document.body.classList.remove("invitation-locked");
        document.body.classList.add("invitation-opened");
        cover.classList.add("is-open");

        if (invitationContent) {
            invitationContent.removeAttribute("inert");
            invitationContent.removeAttribute("aria-hidden");
        }

        if (welcomeHeading) {
            welcomeHeading.focus({ preventScroll: true });
        }

        cover.setAttribute("aria-hidden", "true");

        if (musicController) {
            musicController.play();
        }
    });
}

function initCountdown() {
    const countdownElements = {
        days: document.getElementById("days"),
        hours: document.getElementById("hours"),
        minutes: document.getElementById("minutes"),
        seconds: document.getElementById("seconds")
    };

    const isCountdownAvailable = Object.values(countdownElements).every(Boolean);

    if (!isCountdownAvailable) {
        return;
    }

    const weddingDate = new Date("2026-12-05T09:00:00+07:00").getTime();
    let countdownTimer = null;

    const formatTime = function (value) {
        return String(value).padStart(2, "0");
    };

    const updateCountdown = function () {
        const distance = Math.max(0, weddingDate - Date.now());

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        countdownElements.days.textContent = formatTime(days);
        countdownElements.hours.textContent = formatTime(hours);
        countdownElements.minutes.textContent = formatTime(minutes);
        countdownElements.seconds.textContent = formatTime(seconds);

        if (distance === 0 && countdownTimer) {
            window.clearInterval(countdownTimer);
        }
    };

    updateCountdown();
    countdownTimer = window.setInterval(updateCountdown, 1000);
}

function initMusic() {
    const music = document.getElementById("bgMusic");
    const musicButton = document.getElementById("musicBtn");

    if (!music || !musicButton) {
        return null;
    }

    music.volume = 0.4;

    const updateMusicButton = function (isPlaying) {
        musicButton.innerHTML = isPlaying
            ? '<i class="fa-solid fa-music" aria-hidden="true"></i>'
            : '<i class="fa-solid fa-volume-xmark" aria-hidden="true"></i>';
        musicButton.setAttribute("aria-label", isPlaying ? "Jeda musik" : "Putar musik");
        musicButton.setAttribute("aria-pressed", String(isPlaying));
    };

    const playMusic = function () {
        const playPromise = music.play();

        if (playPromise && typeof playPromise.then === "function") {
            return playPromise
                .then(function () {
                    updateMusicButton(true);
                    return true;
                })
                .catch(function () {
                    updateMusicButton(false);
                    return false;
                });
        }

        updateMusicButton(!music.paused);
        return Promise.resolve(!music.paused);
    };

    const pauseMusic = function () {
        music.pause();
        updateMusicButton(false);
    };

    musicButton.addEventListener("click", function () {
        if (music.paused) {
            playMusic();
        } else {
            pauseMusic();
        }
    });

    music.addEventListener("pause", function () {
        updateMusicButton(false);
    });

    music.addEventListener("play", function () {
        updateMusicButton(true);
    });

    updateMusicButton(!music.paused);

    return {
        play: playMusic,
        pause: pauseMusic
    };
}
