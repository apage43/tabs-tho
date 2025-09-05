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
        const tabs = await chrome.tabs.query({});
        const sortedTabs = sortTabsByDomainThenTitle([...tabs]);

        for (let i = 0; i < sortedTabs.length; i++) {
            await chrome.tabs.move(sortedTabs[i].id, { index: i });
        }
        console.log('All tabs sorted by domain then title');
    } catch (error) {
        console.error('Error sorting all tabs:', error);
    }
}

async function sortThisWindow() {
    try {
        const currentWindow = await chrome.windows.getCurrent();
        const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
        const sortedTabs = sortTabsByDomainThenTitle([...tabs]);

        for (let i = 0; i < sortedTabs.length; i++) {
            await chrome.tabs.move(sortedTabs[i].id, { index: i });
        }
        console.log('Current window tabs sorted by domain then title');
    } catch (error) {
        console.error('Error sorting window tabs:', error);
    }
}

async function extractThisDomain() {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = new URL(activeTab.url);
        const domain = url.hostname;

        const domainTabs = await chrome.tabs.query({ url: `*://${domain}/*` });

        if (domainTabs.length > 1) {
            const tabIds = domainTabs.map(tab => tab.id);
            const newWindow = await chrome.windows.create({ tabId: tabIds[0] });

            // Move remaining tabs to the new window
            for (let i = 1; i < tabIds.length; i++) {
                await chrome.tabs.move(tabIds[i], { windowId: newWindow.id, index: -1 });
            }

            // Sort the tabs in the new window
            const newWindowTabs = await chrome.tabs.query({ windowId: newWindow.id });
            const sortedTabs = sortTabsByDomainThenTitle([...newWindowTabs]);

            for (let i = 0; i < sortedTabs.length; i++) {
                await chrome.tabs.move(sortedTabs[i].id, { index: i });
            }

            console.log(`Extracted ${domainTabs.length} tabs for ${domain} into new window and sorted`);
        } else {
            console.log(`Only one tab found for ${domain}, no extraction needed`);
        }
    } catch (error) {
        console.error('Error extracting domain:', error);
    }
}
