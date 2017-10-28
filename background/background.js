globals = {
  tabsRecentIds: {},
  tabsRecentPointer: {},
  menuModesMap: {},
  recordedTabIds: "",
  resultsContextLength: 40,
  findHighlightingMode: 1,
  allTabsMenuScrollPos: 0,
  searchMenuScrollPos: 0,
  lastSearchTerm: "",
  lastActivatedTabId: undefined,
};

background = {
  recordMenuMode(currentWindowId, menuMode) {
    globals.menuModesMap[currentWindowId] = menuMode;
  },

  getMenuMode(currentWindowId) {
    return globals.menuModesMap[currentWindowId] || 0;
  },

  recordTabIds(tabIdsData) {
    if (tabIdsData) {
      globals.recordedTabIds = tabIdsData;
    } else {
      globals.recordedTabIds = "";
    }
  },

  getRecordedTabIds() {
    return globals.recordedTabIds;
  },

  async newTabNextToSelected(tabId) {
    // Grab tabs.lastActivatedTabId now because onActivated may get fired while
    // we're waiting async stuff here.
    let lastActivatedTabId = globals.lastActivatedTabId;
    if (typeof lastActivatedTabId == "undefined") {
      return;
    }
    let storage = await browser.storage.local.get("alltabshelper:pref_bool_tab_next_to_current");
    let prefValue = storage["alltabshelper:pref_bool_tab_next_to_current"];
    if (prefValue) {
      let lastActivatedTab = await browser.tabs.get(lastActivatedTabId);
      let pinnedTabs = await browser.tabs.query({currentWindow: true, pinned: true});
      let moveToIndex = Math.max(lastActivatedTab.index + 1, pinnedTabs.length);
      await browser.tabs.move([tabId], { index : moveToIndex });
    }
  },
}

let inhibitTabsRecentUpdate;

function updateTabsRecent(tabId, windowId, remove) {
  if (tabId == inhibitTabsRecentUpdate) {
    delete(inhibitTabsRecentUpdate);
    return;
  }

  // Always reset the pointer.
  globals.tabsRecentPointer[windowId] = 0;

  if (!globals.tabsRecentIds[windowId]) {
    globals.tabsRecentIds[windowId] = [tabId];
    return;
  }

  let newRecents = [];
  let foundIds = {};
  let tabsRecentIds = globals.tabsRecentIds[windowId];
  let start = tabsRecentIds.length - 1;

  for (let i = start; i > -1; i--) {
    let recentTabId = tabsRecentIds[i];
    if (recentTabId == tabId || foundIds[recentTabId]) {
      continue;
    }
    newRecents.unshift(recentTabId);
    foundIds[recentTabId] = true;
  }
  
  if (!remove) {
    newRecents.unshift(tabId);
  }

  globals.tabsRecentIds[windowId] = newRecents;
}

browser.runtime.onMessage.addListener((request) => {
  if (request.topic == "alltabshelper:clearNativeHighlighting") {
    browser.find.removeHighlighting();
  }
});

browser.tabs.onActivated.addListener((tab) => {
  globals.lastActivatedTabId = tab.tabId;
  updateTabsRecent(tab.tabId, tab.windowId);
});

browser.tabs.onCreated.addListener((tab) => {
  background.newTabNextToSelected(tab.id);
});

browser.tabs.onRemoved.addListener((tabId, data) => {
  updateTabsRecent(tabId, data.windowId);
});

browser.tabs.query({currentWindow: true, active: true}).then(tabs => {
  let tab = tabs[0];
  globals.lastActivatedTabId = tab.id;
  updateTabsRecent(tab.id, tab.windowId);
});

browser.commands.onCommand.addListener(async function(command) {
  if (command == "tabs-history-back" || command == "tabs-history-forward") {
    let dir = command == "tabs-history-back" ? 1 : -1
    let winData = await browser.windows.getCurrent();
    currentWindowId = winData.id;
    let tabsRecentIds = globals.tabsRecentIds[currentWindowId];

    let index = globals.tabsRecentPointer[currentWindowId] + dir;
    if (index > tabsRecentIds.length - 1 || index < 0) {
      return;
    }

    let targetId = tabsRecentIds[index];
    inhibitTabsRecentUpdate = targetId;
    browser.tabs.update(targetId, {active: true});
    globals.tabsRecentPointer[currentWindowId] = index;
    return;
  }
});

