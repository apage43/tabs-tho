document.getElementById('sortAll').addEventListener('click', sortAllTabs);
document.getElementById('sortWindow').addEventListener('click', sortThisWindow);
document.getElementById('extractDomain').addEventListener('click', extractThisDomain);

function getSortableDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function sortTabsByDomainThenTitle(tabs) {
    return tabs.sort((a, b) => {
        const domainA = getSortableDomain(a.url);
        const domainB = getSortableDomain(b.url);
        const domainCompare = domainA.localeCompare(domainB);
        if (domainCompare !== 0) return domainCompare;
        return a.title.localeCompare(b.title);
    });
}

async function sortAllTabs() {
    try {
        const allTabs = await chrome.tabs.query({});
        const windows = {};

        // Group tabs by window
        allTabs.forEach(tab => {
            if (!windows[tab.windowId]) {
                windows[tab.windowId] = [];
            }
            windows[tab.windowId].push(tab);
        });

        // Sort tabs within each window
        for (const windowId in windows) {
            const windowTabs = windows[windowId];
            const pinnedTabs = windowTabs.filter(tab => tab.pinned);
            const unpinnedTabs = windowTabs.filter(tab => !tab.pinned);
            const sortedUnpinnedTabs = sortTabsByDomainThenTitle([...unpinnedTabs]);

            console.log(`Sorted unpinned tabs for window ${windowId}:`, sortedUnpinnedTabs.map(tab => [getSortableDomain(tab.url), tab.title]));

            // Move unpinned tabs starting after pinned tabs
            const startIndex = pinnedTabs.length;
            for (let i = 0; i < sortedUnpinnedTabs.length; i++) {
                await chrome.tabs.move(sortedUnpinnedTabs[i].id, { index: startIndex + i });
            }
        }
        console.log('All tabs sorted by domain then title (pinned tabs preserved)');
    } catch (error) {
        console.error('Error sorting all tabs:', error);
    }
}

async function sortThisWindow() {
    try {
        const currentWindow = await chrome.windows.getCurrent();
        const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
        const pinnedTabs = tabs.filter(tab => tab.pinned);
        const unpinnedTabs = tabs.filter(tab => !tab.pinned);
        const sortedUnpinnedTabs = sortTabsByDomainThenTitle([...unpinnedTabs]);

        console.log('Sorted unpinned tabs:', sortedUnpinnedTabs.map(tab => [getSortableDomain(tab.url), tab.title]));

        // Move unpinned tabs starting after pinned tabs
        const startIndex = pinnedTabs.length;
        for (let i = 0; i < sortedUnpinnedTabs.length; i++) {
            await chrome.tabs.move(sortedUnpinnedTabs[i].id, { index: startIndex + i });
        }
        console.log('Current window tabs sorted by domain then title (pinned tabs preserved)');
    } catch (error) {
        console.error('Error sorting window tabs:', error);
    }
}

async function extractThisDomain() {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = new URL(activeTab.url);
        const domain = url.hostname;

        const allDomainTabs = await chrome.tabs.query({ url: `*://${domain}/*` });
        const domainTabs = allDomainTabs.filter(tab => !tab.pinned);

        if (domainTabs.length > 1) {
            const tabIds = domainTabs.map(tab => tab.id);
            const newWindow = await chrome.windows.create({ tabId: tabIds[0] });

            // Move remaining tabs to the new window
            for (let i = 1; i < tabIds.length; i++) {
                await chrome.tabs.move(tabIds[i], { windowId: newWindow.id, index: -1 });
            }

            // Sort the tabs in the new window (no pinned tabs in new window)
            const newWindowTabs = await chrome.tabs.query({ windowId: newWindow.id });
            const sortedTabs = sortTabsByDomainThenTitle([...newWindowTabs]);

            for (let i = 0; i < sortedTabs.length; i++) {
                await chrome.tabs.move(sortedTabs[i].id, { index: i });
            }

            console.log(`Extracted ${domainTabs.length} tabs for ${domain} into new window and sorted (pinned tabs excluded)`);
        } else {
            console.log(`Only one unpinned tab found for ${domain}, no extraction needed`);
        }
    } catch (error) {
        console.error('Error extracting domain:', error);
    }
}
