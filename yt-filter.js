// ==UserScript==
// @name         YouTube Filter
// @version      1.0.0
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
        minViews: 2000,
        debug: false,
        debounceMs: 250,
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

        const items = document.querySelectorAll("ytd-rich-item-renderer:not([data-yt-filtered])");
        if (items.length === 0) return;

        const logs = [];

        items.forEach((item) => {
            item.setAttribute("data-yt-filtered", "true");

            /* skip if the element is not visible */
            if (item.offsetParent === null) return;

            const textElements = Array.from(item.querySelectorAll(".yt-core-attributed-string"));
            const texts = textElements.map((e) => e.textContent);

            const views = parseViews(texts);

            if (Number.isNaN(views) || views < CONFIG.minViews) {
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
