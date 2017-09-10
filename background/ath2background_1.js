globals = {
  tabsPopupId: null,
  currentWindowId: null,
  currentWindowPos: {},
  tabsRecentIdsMap: {},
  resultsContextLength: 40,
  findHighlightingMode: 3,
  tabsActivated: {}
};

background = {
  async openPanel() {
    let winData = await browser.windows.getCurrent();
    //setTabsRecentIdsMap(globals.currentWindowId, winData.id);
    globals.currentWindowId = winData.id;

    if (globals.tabsPopupId) {
      browser.windows.update(globals.tabsPopupId, { focused: true });
    } else {
      let left;
      let top;
      let width;
      let height;
      let storage = await browser.storage.local.get("alltabshelper:panel_dims");
      let panelDimsStr = storage["alltabshelper:panel_dims"];
      if (panelDimsStr) {
        let panelDims = JSON.parse(panelDimsStr);
        width = panelDims.width;
        height = panelDims.height;
      }
      storage = await browser.storage.local.get("alltabshelper:panel_position");
      let panelPosStr = storage["alltabshelper:panel_position"];
      if (panelPosStr) {
        let panelPos = JSON.parse(panelPosStr);
        left = panelPos.left;
        top = panelPos.top;
      }
dump("XXX openPanel : "+left+"    "+top+"\n");
      var createData = {
        url: "../tabspopup/ath2tabs_popup.html",
        type: "popup",
        width: width || 300,
        height: height || 400,
        left: left || 0,
        top: top || 0,
      };
      let data = await browser.windows.create(createData);
      globals.tabsPopupId = data.id;
    }
  },

  async updateCurrentWindowStatus(windowId) {
    if (globals.tabsPopupId && windowId != -1 &&
        windowId != globals.tabsPopupId &&
        windowId != globals.currentWindowId) {
      // browser.windows.get will conveniently reject non-browser windows.
      try {
        await browser.windows.get(windowId);
        globals.currentWindowId = windowId;
        // This MUST be called before sending message, because receiver will be
        // updating data based on the data here.
        //setTabsRecentIdsMap(globals.currentWindowId, windowId);
        browser.runtime.sendMessage({ currentWindowUpdated: windowId });
      } catch(e) {
        console.log("windowId: "+windowId+" is a non-browser window.");
      }
    }
  },

  recordRecentTabsState(windowId, state) {
    globals.tabsRecentIdsMap[windowId] = JSON.parse(state);
  },

  async windowOnRemoved(windowId) {
    if (windowId == globals.tabsPopupId) {
      let left = globals.currentWindowPos.left;
      let top = globals.currentWindowPos.top;
      await browser.storage.local.set(
        {"alltabshelper:panel_position": JSON.stringify({ left, top })});
      globals.tabsPopupId = null;
    }
  },

  getRecentTabsState(windowId) {
    windowId = windowId || globals.currentWindowId;

    if (!globals.tabsRecentIdsMap[windowId]) {
      globals.tabsRecentIdsMap[windowId] = [];
    }
    return JSON.stringify(globals.tabsRecentIdsMap[windowId]);
  },

  browserActionOnClicked() {
    background.openPanel();
  },

  tabsOnActivated(data) {
    globals.tabsActivated[data.tabId] = true;
  },
}

browser.windows.onFocusChanged.addListener(background.updateCurrentWindowStatus);
browser.windows.onRemoved.addListener(background.windowOnRemoved);
browser.browserAction.onClicked.addListener(background.browserActionOnClicked);
browser.tabs.onActivated.addListener(background.tabsOnActivated);


