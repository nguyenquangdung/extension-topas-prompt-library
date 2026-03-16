chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Listen for update check requests from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkForUpdates') {
        fetch('https://api.github.com/repos/pirateson/extension-topas-prompt-library/releases/latest')
            .then(res => {
                if (!res.ok) throw new Error('No releases found');
                return res.json();
            })
            .then(release => {
                let latestVersion = release.tag_name;
                if (latestVersion.startsWith('v')) latestVersion = latestVersion.substring(1);
                sendResponse({
                    success: true,
                    latestVersion: latestVersion,
                    zipball_url: release.zipball_url,
                    html_url: release.html_url
                });
            })
            .catch(err => {
                sendResponse({ success: false, error: err.message });
            });
        return true; // keep the message channel open for async sendResponse
    }
});
