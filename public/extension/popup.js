document.getElementById('scan-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentUrl = tabs[0].url;

        // Ignore chrome internal pages
        if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('about:')) {
            alert("Cannot scan internal browser pages.");
            return;
        }

        const intelicaUrl = `https://siteintelica.com/?scan=${encodeURIComponent(currentUrl)}`;
        chrome.tabs.create({ url: intelicaUrl });
    });
});
