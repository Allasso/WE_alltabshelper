globals = {
  tabsPopupId: null,
  currentWindowId: null,
  tabsRecentIdsMap: {},
  resultsContextLength: 40,
  findHighlightingMode: 3,
  tabsActivated: {}
};

async function openPanel() {
  let winData = await browser.windows.getCurrent();
  //setTabsRecentIdsMap(globals.currentWindowId, winData.id);
  globals.currentWindowId = winData.id;
dump("openPanel : "+globals.currentWindowId+"\n");

  if (globals.tabsPopupId) {
    browser.windows.update(globals.tabsPopupId, { focused: true });
  } else {
    let width;
    let height;
    let storage = await browser.storage.local.get("alltabshelper:panel_dims");
    let panelDimsStr = storage["alltabshelper:panel_dims"];
    if (panelDimsStr) {
      let panelDims = JSON.parse(panelDimsStr);
      width = panelDims.width;
      height = panelDims.height;
    }
    var createData = {
      url: "../tabspopup/ath2tabs_popup.html",
      type: "popup",
      width: width || 300,
      height: height || 400,
      left: 0,
      top: 0
    };
    let data = await browser.windows.create(createData);
    globals.tabsPopupId = data.id;
  }
}

async function updateCurrentWindowStatus(windowId) {
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
}

function recordRecentTabsState(windowId, state) {
  globals.tabsRecentIdsMap[windowId] = JSON.parse(state);
}

function getRecentTabsState(windowId) {
  windowId = windowId || globals.currentWindowId;

  if (!globals.tabsRecentIdsMap[windowId]) {
    globals.tabsRecentIdsMap[windowId] = [];
  }
  return JSON.stringify(globals.tabsRecentIdsMap[windowId]);
}

function browserActionOnClicked() {
  openPanel();
}

function tabsOnActivated(data) {
  globals.tabsActivated[data.tabId] = true;
}

browser.windows.onFocusChanged.addListener(updateCurrentWindowStatus);
browser.browserAction.onClicked.addListener(browserActionOnClicked);
browser.tabs.onActivated.addListener(tabsOnActivated);


