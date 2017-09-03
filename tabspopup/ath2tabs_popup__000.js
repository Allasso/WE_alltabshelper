const messageCntnr = document.getElementById('messagecontainer');
const tabsMenuCntnr = document.getElementById('tabsmenucontainer');
const searchInput = document.getElementById('searchinput');
const buttons = document.getElementById('buttons');
const buttonAll = document.getElementById('buttonall');
const buttonRecent = document.getElementById('buttonrecent');
const buttonDups = document.getElementById('buttondups');
const buttonSearch = document.getElementById('buttonsearch');
const messageContainer = document.getElementById('message');
const contextMenuContainer = document.getElementById('contextmenu');
const DEFAULT_FAVICON_URL = "../icons/transparent_16x16.png";
const LOADING_FAVICON_URL = "../icons/loading.png";
const CLOSE_BUTTON_URL = "../icons/button_close_12.png";

let titlebarHeight = 24;
let bottomReveal = 4;

let BPW;
let BPG;

let globals = {
  currentWindowId: 0,
  tabsRecentIdsArr: [],
};

let tabsPopupNomWidth = 300;
let tabsPopupNomHeight = 400;
let searchResultsPanelNominalWidth = 300;
let searchResultsPanelCurrentWidth = 0;

browser.windows.onFocusChanged.addListener((windowId) => {
  //dump("Newly focused window: " + windowId+"\n");
});

async function init() {
  window.removeEventListener("load", init);

  let win = await browser.runtime.getBackgroundPage();
  BPW = win;
  BPG = win.globals;

try {
  dump("LOAD 2 : "+globals.tabsRecentIdsArr+"\n");
} catch(e) {
  dump("LOAD : NO WAY : "+e+"\n");
}

  let winData = await browser.windows.getCurrent();
  setPanelStructureSizeParams(winData.width, winData.height);

  globals.currentWindowId = BPG.currentWindowId;
  let recentTabsState = BPW.getRecentTabsState();
  globals.tabsRecentIdsArr = JSON.parse(recentTabsState);

  initManage();
  initializePanelDims();

  let tabData = await getActiveTab();
  updateTabsRecent(tabData[0].id);

  window.addEventListener("resize", onResize);

  /*
  // TODO: remove when satisfied
  window.addEventListener("click", function(evt) {
    let target = evt.target;
    if (target.classList && target.classList.contains("searchresult")) {
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }
  }, true);
  window.addEventListener("mouseup", function(evt) {
    let target = evt.target;
    if (target.classList && target.classList.contains("searchresult")) {
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }
  }, true);
  */
}

async function initializePanelDims() {
  let storage = await browser.storage.local.get("alltabshelper:panel_dims");
  let panelDimsStr = storage["alltabshelper:panel_dims"];
  if (panelDimsStr) {
    let panelDims = JSON.parse(panelDimsStr);
    tabsPopupNomWidth = panelDims.width;
    tabsPopupNomHeight = panelDims.height;
  }
  setPanelContentsDims(true);
}

async function setPanelContentsDims() {
  let winData = await browser.windows.getCurrent();
  recordPanelDims(winData.width, winData.height);
  setPanelStructureSizeParams(winData.width, winData.height);
  isResizeTimerRunning = false;
}

async function recordPanelDims(width, height) {
  tabsPopupNomWidth = width - searchResultsPanelCurrentWidth;
  tabsPopupNomHeight = height;
  await browser.storage.local
    .set({"alltabshelper:panel_dims": JSON.stringify({ width, height })});
}

async function expandPopupForSearchResults(mode, displayLeft) {
  if (mode == !!searchResultsPanelCurrentWidth) {
    return;
  }
  let width = tabsPopupNomWidth;
  if (mode) {
    width += searchResultsPanelNominalWidth;
  }
  if (displayLeft) {
    let { left } = await browser.windows.get(BPG.tabsPopupId);
    left = mode ? left - searchResultsPanelNominalWidth :
                  left + searchResultsPanelNominalWidth;
    browser.windows.update(BPG.tabsPopupId, { width, left });
  } else {
    browser.windows.update(BPG.tabsPopupId, { width });
  }
  searchResultsPanelCurrentWidth = mode ? searchResultsPanelNominalWidth : 0;
}

let isHorOverflowed = false;
tabsMenuCntnr.addEventListener("overflow", function(e) {
  if (e.detail != 1) {
    if (!isHorOverflowed) {
      isHorOverflowed = true;
      setPanelStructureSizeParams(prevWindowWidth, prevWindowHeight);
    }
  }
});
tabsMenuCntnr.addEventListener("underflow", function(e) {
  if (e.detail != 1) {
    if (isHorOverflowed) {
      isHorOverflowed = false;
      setPanelStructureSizeParams(prevWindowWidth, prevWindowHeight);
    }
  }
});

function onBeforeunload() {
dump("onBeforeunload\n");
  BPW.recordRecentTabsState
        (globals.currentWindowId, JSON.stringify(globals.tabsRecentIdsArr));

  // TODO : Is this test necessary?  The reasoning behind the test is that
  // if FF is shutting down, these objects may no longer exist.
  if (BPG && BPG.tabsPopupId != undefined && globals.tabsRecentIdsArr) {
    BPG.tabsPopupId = null;
  }
}

let isResizeTimerRunning = false;
function onResize() {
  if (!isResizeTimerRunning) {
    // Make timeout slightly less than timeout used in OptiMenu for correcting
    // menuitems widths.
    setTimeout(function() {
      setPanelContentsDims();
    },90);
    isResizeTimerRunning = true;
  }
}

function onFocusedWindowUpdate(newCurrentWindowId) {
  BPW.recordRecentTabsState
        (globals.currentWindowId, JSON.stringify(globals.tabsRecentIdsArr));
  let state = BPW.getRecentTabsState(newCurrentWindowId);
  globals.currentWindowId = newCurrentWindowId;

  globals.tabsRecentIdsArr = JSON.parse(state);

  initTabsMenu(true);
}

function handleMessage(request) {
  if (request.currentWindowUpdated) {
    onFocusedWindowUpdate(request.currentWindowUpdated);
  }
}

browser.runtime.onMessage.addListener(handleMessage);

////////////////////////////////////////////////////////////////////////////////
// SET TABS LIST SIZE PARAMETERS

let tabsMenuCntnrHeightCorrection;
let prevWindowWidth;
let prevWindowHeight;
function setPanelStructureSizeParams(width, height) {
  // Sets the dimensions which make up the basic structure of the menu, eg,
  // tabsMenuCntnr height, menuitem widths.  Handles correction of menuitems widths
  // according to whether scrollbars are appearing or not.

  prevWindowWidth = width;
  prevWindowHeight = height;

  if (tabsMenuCntnrHeightCorrection === undefined) {
    let rectTL = tabsMenuCntnr.getBoundingClientRect();
    tabsMenuCntnrHeightCorrection = titlebarHeight + rectTL.top + bottomReveal
  }

  let style = document.getElementById("dynamiccss");
  style.innerHTML = "#buttons { width: "+tabsPopupNomWidth+"px; }"+
                    "#messagecontainer { width: "+tabsPopupNomWidth+"px; }"+
                    "#searchinput { width: "+(tabsPopupNomWidth - 22)+"px; }"+
                    "#tabsmenucontainer { width: "+tabsPopupNomWidth+"px; height: "+
                                    (height - tabsMenuCntnrHeightCorrection)+"px }"+
                    ""+
                    "";
}

window.addEventListener("load", init);
window.addEventListener("beforeunload", onBeforeunload);
