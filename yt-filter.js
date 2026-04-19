// ==UserScript==
// @name         YouTube Filter
// @version      1.0.2
// @description  Declutter YouTube
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-body
// @updateURL    https://raw.githubusercontent.com/ncarchar/tampermonkey/refs/heads/main/yt-filter.js
// @downloadURL  https://raw.githubusercontent.com/ncarchar/tampermonkey/refs/heads/main/yt-filter.js
// ==/UserScript==

(function () {
    "use strict";

    const CONFIG = {
        minViews: 1000,
        debug: true,
        debounceMs: 200,
        titlesToHide: ["AI"],
        elementsToHide: [
            "#voice-search-button",
            "ytd-talk-to-recs-flow-renderer",
            "ytd-statement-banner-renderer",
            "ytd-rich-section-renderer",
            "grid-shelf-view-model",
            "ytd-rich-shelf-renderer",
            "ytd-chips-shelf-with-video-shelf-renderer",
            "ytd-brand-video-shelf-renderer",
            "ytd-horizontal-card-list-renderer",
            "ytd-reel-shelf-renderer",
            "ytd-mini-guide-renderer",
            "ytd-shelf-renderer",
        ],
        customCss: `
            ytd-app, html, :root {
                --ytd-mini-guide-width: 0px !important;
            }
        `,
    };

    /* css injection */
    const injectStyles = () => {
        const style = document.createElement("style");

        const hideRules = CONFIG.elementsToHide.join(",\n") + " { display: none !important; }";

        style.textContent = `
            ${CONFIG.customCss}
            ${hideRules}
        `;
        document.head.appendChild(style);
    };

    /* view parsing & filtering */
    const parseViews = (textArray) => {
        const viewString =
            textArray.find((s) => s && s.toLowerCase().includes("view")) || textArray[2];

        if (!viewString) return NaN;

        const match = String(viewString)
            .toLowerCase()
            .match(/([\d,.]+)\s*([kmb])?\s*view/);

        if (!match) return NaN;

        const num = parseFloat(match[1].replace(/,/g, ""));
        if (Number.isNaN(num)) return NaN;

        const mult = match[2] === "k" ? 1e3 : match[2] === "m" ? 1e6 : match[2] === "b" ? 1e9 : 1;
        return Math.round(num * mult);
    };

    const filterVideos = () => {
        if (window.location.pathname !== "/") return;

        const items = document
            .querySelector("ytd-rich-grid-renderer")
            .querySelectorAll("ytd-rich-item-renderer:not([data-yt-filtered])");
        if (items.length === 0) return;

        const logs = [];

        items.forEach((item) => {
            item.setAttribute("data-yt-filtered", "true");

            /* skip if the element is not visible */
            if (item.offsetParent === null) return;

            const textElements = Array.from(
                item.querySelectorAll(
                    ".yt-core-attributed-string, .ytContentMetadataViewModelMetadataRow"
                )
            );

            const texts = textElements.map((e) => e.textContent);

            const titleNode = item.querySelector("h3.ytLockupMetadataViewModelHeadingReset");

            const videoTitle = titleNode?.getAttribute("title");

            const hasMatch = CONFIG.titlesToHide.some((word) => {
                const safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const regex = new RegExp(`(^|\\W)${safeWord}(\\W|$)`, "i");
                return regex.test(videoTitle ?? "");
            });

            const views = parseViews(texts);

            if (Number.isNaN(views) || views < CONFIG.minViews || hasMatch) {
                item.style.display = "none";
                if (CONFIG.debug) {
                    logs.push({ title: texts[0] || "Unknown", views: views });
                }
            }
        });

        if (CONFIG.debug && logs.length > 0) {
            console.groupCollapsed(`[YouTube Filter] Hid ${logs.length} low-view videos`);
            console.table(logs);
            console.groupEnd();
        }
    };

    /* initialization */
    let debounceTimer;
    const debouncedFilter = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(filterVideos, CONFIG.debounceMs);
    };

    const init = () => {
        injectStyles();

        debouncedFilter();

        const observer = new MutationObserver((mutations) => {
            const hasNewNodes = mutations.some((mutation) => mutation.addedNodes.length > 0);
            if (hasNewNodes) {
                debouncedFilter();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        if (CONFIG.debug) console.log("[YouTube Filter] Script active and observing...");
    };

    init();
})();
