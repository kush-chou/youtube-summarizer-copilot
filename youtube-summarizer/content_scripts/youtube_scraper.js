// youtube_scraper.js (v4.4)

// --- Button Creation ---
function createSummarizeButton(isThumbnail) {
    const button = document.createElement('button');
    button.className = isThumbnail ? 'thumbnail-btn' : 'summarizer-btn';

    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/summarize-icon.svg');
    
    button.appendChild(icon);
    button.appendChild(document.createTextNode('Summarize Link'));

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        let videoUrl = '';
        if (isThumbnail) {
            // --- FIX for Thumbnail URL ---
            // Find the closest 'a' tag which acts as the link for the thumbnail.
            const linkElement = e.target.closest('a#thumbnail');
            if (linkElement && linkElement.href) {
                // new URL() correctly constructs the full URL from a relative path.
                videoUrl = new URL(linkElement.getAttribute('href'), window.location.origin).href;
            } else {
                 console.error('[Summarizer] Could not find video link from thumbnail.');
                 return; // Stop if no link is found
            }
        } else {
            // On the watch page, the URL is simply the current page's URL.
            videoUrl = window.location.href;
        }
        
        if (videoUrl) {
            chrome.runtime.sendMessage({ action: 'summarize_link', url: videoUrl });
        }
    });
    return button;
}

function createTranscriptButton() {
    const button = document.createElement('button');
    button.className = 'summarizer-btn';
    button.textContent = 'Summarize Transcript';

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'start_scrape' });
    });
    return button;
}


// --- Injection Logic ---

function injectButtonsOnWatchPage() {
    // --- FIX for Video Page Buttons ---
    // This is a more modern and stable selector for the button container.
    const buttonContainer = document.querySelector('#menu-container > #menu > ytd-menu-renderer');
    
    if (buttonContainer && !buttonContainer.querySelector('.summarizer-btn')) {
        console.log('[Summarizer] Injecting buttons on watch page.');
        const linkButton = createSummarizeButton(false);
        const transcriptButton = createTranscriptButton();

        // Prepending puts our buttons first, which is a common layout pattern.
        buttonContainer.prepend(transcriptButton);
        buttonContainer.prepend(linkButton);
    }
}

function injectButtonsOnThumbnails(node) {
    const thumbnails = node.querySelectorAll('ytd-thumbnail:not([data-summarizer-injected])');
    thumbnails.forEach(thumb => {
        thumb.classList.add('thumbnail-wrapper');
        const button = createSummarizeButton(true);
        thumb.appendChild(button);
        thumb.dataset.summarizerInjected = 'true';
    });
}

// --- Main Execution ---

function runInjection() {
    if (window.location.href.includes('/watch')) {
        injectButtonsOnWatchPage();
    } else {
        injectButtonsOnThumbnails(document);
    }
}

// Initial run
runInjection();

// Observe the page for changes (infinite scroll, navigation)
const observer = new MutationObserver((mutations) => {
    runInjection();
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for scrape requests originating from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_scrape") {
    scrapeTranscriptAndSend();
  }
});

async function scrapeTranscriptAndSend() {
    try {
        const expander = document.querySelector("#description-inline-expander #expand");
        if (expander) expander.click();

        const button = document.querySelector("ytd-video-description-transcript-section-renderer button");
        if (!button) throw new Error("Transcript button not found in description.");
        button.click();

        const transcriptContainer = await new Promise(resolve => setTimeout(() => resolve(document.querySelector('ytd-transcript-renderer')), 500));
        if (!transcriptContainer) throw new Error("Transcript panel did not appear.");
        
        const segments = transcriptContainer.querySelectorAll("ytd-transcript-segment-renderer yt-formatted-string");
        if (segments.length === 0) throw new Error("Transcript segments are empty.");

        const transcriptText = Array.from(segments).map(s => s.textContent.trim()).join(' ');
        
        chrome.runtime.sendMessage({ action: 'summarize_transcript', data: transcriptText });
    } catch (error) {
        console.error("[YT Scraper] Transcript scrape error:", error.message);
        alert(`Could not scrape transcript: ${error.message}`);
    }
}