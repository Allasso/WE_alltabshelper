globals = {
  currentWindowId: null,
  tabsRecentIdsMap: {},
  menuModesMap: {},
  recordedTabIds: [],
  resultsContextLength: 40,
  findHighlightingMode: 3,
};

background = {
  recordMenuMode(currentWindowId, menuMode) {
    globals.menuModesMap[currentWindowId] = menuMode;
  },

  getMenuMode(currentWindowId) {
    return globals.menuModesMap[currentWindowId] || 0;
  },

  recordRecentTabsState(currentWindowId, state) {
    globals.tabsRecentIdsMap[currentWindowId] = JSON.parse(state);
  },

  getRecentTabsState(currentWindowId) {
    if (!globals.tabsRecentIdsMap[currentWindowId]) {
      globals.tabsRecentIdsMap[currentWindowId] = [];
    }
    return JSON.stringify(globals.tabsRecentIdsMap[currentWindowId]);
  },

  recordTabIds(tabIds) {
    if (tabIds) {
      globals.recordedTabIds = tabIds;
    } else {
      globals.recordedTabIds = [];
    }
  },

  getRecordedTabIds() {
    return globals.recordedTabIds;
  },
}
