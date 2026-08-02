(async function () {
    // parent of timestamps
    let attempts = 0;
    const parent = await getParent();

    function getParent() {
        return new Promise(resolve => {
            const check = () => {
                const parent = document.querySelector('.player-controls > div > div');

                // return early if not rewindable or vod
                if (++attempts === 20)
                    return resolve(parent);

                // return correct parent after loading finishes
                if (parent && parent.children.length === 2)
                    resolve(parent);
                else
                    setTimeout(check, 250);
            }
            check();
        });
    }

    // exit if live without rewind
    if (!parent)
        return;

    // video parent
    const video = document.querySelector(".video-ref");

    // move these inside rateChanged()/updateDisplay() if they get replaced over time
    const duration = document.querySelector('[data-a-target=player-seekbar-duration]');
    const current = document.querySelector('[data-a-target=player-seekbar-current-time]') ??
        // for live rewind
        document.querySelector('[style*="user-select"] p');

    if (current === document.querySelector('[style*="user-select"] p')) {
        // wait for ffz stream uptime
        var uptime = await getUptime();

        function getUptime() {
            return new Promise(resolve => {
                const check = () => {
                    const ffzUptime = document.querySelector('.ffz-stat-text');
                    if (ffzUptime)
                        resolve(ffzUptime);
                    else
                        setTimeout(check, 250);
                }
                check();
            });
        }
    }

    function updateDisplay() {
        if (!uptime) {
            // update current time on vods
            current.textContent = video.firstChild.playbackRate === 1
                ? `${formatTime(video.firstChild.currentTime)}`
                : `${formatTime(video.firstChild.currentTime)} (${formatTime(video.firstChild.currentTime / video.firstChild.playbackRate)})`;
        } else {
            // update current time on streams with rewind
            const currentTime = current.textContent.slice(0, 8);
            const behindTime = parseTime(uptime.textContent) - parseTime(currentTime);
            // only update if actually behind live
            current.textContent = behindTime > 3
            ? `${currentTime} (-${formatTime(behindTime)})`
            : `${currentTime}`;
        }
    }

    function rateChanged() {
        // update duration on vods
        if (!uptime && video.firstChild.duration) {
            duration.textContent = video.firstChild.playbackRate === 1
                ? `${formatTime(video.firstChild.duration)}`
                : `${formatTime(video.firstChild.duration)} (${formatTime(video.firstChild.duration / video.firstChild.playbackRate)})`;
        }
        updatePreview();
        updateDisplay();
    }
    rateChanged();

    function updatePreview() {
        let preview = document.querySelector('.vod-seekbar-preview-overlay__wrapper p');
        if (preview) {
            // update preview on vods
            if (!uptime) {
                preview.textContent = video.firstChild.playbackRate === 1
                    ? `${preview.textContent.slice(0, 8)}`
                    : `${preview.textContent.slice(0, 8)} (${formatTime(parseTime(preview.textContent.slice(0, 8)) / video.firstChild.playbackRate)})`;
            }
            // update preview on streams with rewind
            else {
                const currentPreview = preview.textContent.slice(0, 8);
                const behindTime = parseTime(uptime.textContent) - parseTime(currentPreview);

                preview.textContent =
                    `${currentPreview} (-${formatTime(behindTime)})`;
            }
        }
    }

    function setListeners() {
        video.firstChild.addEventListener('timeupdate', updateDisplay);
        video.firstChild.addEventListener('ratechange', rateChanged);
    }
    setListeners();

    const observer = new MutationObserver(callback);
    observer.observe(parent, {
        childList: true,
        characterData: true,
        subtree: true
    });
    // observe video ref for video replacement switching between live and rewind
    observer.observe(video, {
        childList: true
    });

    function callback(mutationRecords) {
        //if (!isFinite(video.duration)) return;

        for (const record of mutationRecords) {
            switch (record.type) {

                case "childList":
                    if (record.addedNodes.length === 1) {
                        switch (record.target) {

                            // update preview when first hovered
                            case parent:
                                updatePreview();
                                break;

                            // refresh listeners when video is replaced switching between live and rewind
                            case video:
                                setListeners();
                                break;
                        }
                    }
                    break;

                case "characterData":
                    if (!video.firstChild.paused)
                        updateDisplay();

                    updatePreview();
                    break;
            }
        }
    }

    // Convert seconds to hh:mm:ss
    function formatTime(seconds) {
        const isNegative = seconds < 0;

        seconds = Math.floor(Math.abs(seconds));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

        return isNegative ? `-${time}` : time;
    }

    // Convert hh:mm:ss to seconds
    function parseTime(text) {
        const parts = text.split(":").map(Number);

        if (parts.length === 2)
            return parts[0] * 60 + parts[1];

        if (parts.length === 3)
            return parts[0] * 3600 + parts[1] * 60 + parts[2];

        return NaN;
    }
})();
