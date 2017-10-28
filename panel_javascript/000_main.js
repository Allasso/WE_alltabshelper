const messageCntnr = document.getElementById('messagecontainer');
const tabsMenuCntnr = document.getElementById('tabsmenucontainer');
const searchInput = document.getElementById('searchinput');
const buttons = document.getElementById('buttons');
const buttonAll = document.getElementById('buttonall');
const buttonRecent = document.getElementById('buttonrecent');
const buttonDups = document.getElementById('buttondups');
const buttonSearch = document.getElementById('buttonsearch');
const topHoverDetector = document.getElementById('tophoverdetector');
const messageContainer = document.getElementById('message');
const bottomHoverDetector = document.getElementById('bottomhoverdetector');
const contextMenuContainer = document.getElementById('contextmenu');
const tabsCountContainer = document.getElementById('tabscount');
const pinnedTabsOverlayContainer = document.getElementById('pinnedtabsoverlay');

const LOADING_FAVICON_URL = "../icons/loading.png";
const CLOSE_BUTTON_URL = "../icons/button_close_12.png";

let BPW;
let BPG;
let CURRENT_TABS_HASH = {};
let CURRENT_TABS_LIST = [];
let CURRENT_MENU_DATA = [];
let OPTI_MENU;
let PINNED_TABS_OVERLAY;
let DRAG_SCROLL_ASSISTANT;
let THIS_WINDOW_ID;
let FAYT = false;

let main = {
  titlebarHeight: 24,
  bottomReveal: 4,
  tabsPopupNomWidth: 300,
  tabsPopupNomHeight: 400,
  isResizeTimerRunning: false,

  /**************************/
  /* BEGIN TODO *************/
  /* Unless we devise a way for users to opt in menu width for browserAction
   * popup, onresize dimension recording (for persistence) won't be necessary.
   */

  onResize() {
    if (!main.isResizeTimerRunning) {
      // Make timeout slightly less than timeout used in OptiMenu for correcting
      // menuitems widths.
      setTimeout(function() {
        main.recordPanelContentsDims();
      },90);
      main.isResizeTimerRunning = true;
    }
  },

  async recordPanelDims(width, height) {
    this.tabsPopupNomWidth = width;
    this.tabsPopupNomHeight = height;
    await browser.storage.local
      .set({"alltabshelper:panel_dims": JSON.stringify({ width, height })});
  },

  async recordPanelContentsDims() {
    let winData = await browser.windows.getCurrent();
    this.recordPanelDims(winData.width, winData.height);
    this.isResizeTimerRunning = false;
  },

  async initializePanelDims() {
    let storage = await browser.storage.local.get("alltabshelper:panel_dims");
    let panelDimsStr = storage["alltabshelper:panel_dims"];
    if (panelDimsStr) {
      let panelDims = JSON.parse(panelDimsStr);
      this.tabsPopupNomWidth = panelDims.width;
      this.tabsPopupNomHeight = panelDims.height;
    }
    this.recordPanelContentsDims(true);
  },

  /* END TODO ***************/
  /**************************/

  getActiveTab() {
    return browser.tabs.query({ currentWindow: true, active: true });
  },

  async init() {
    window.removeEventListener("load", this.init);

    let win = await browser.runtime.getBackgroundPage();
    BPW = win.background;
    BPG = win.globals;

    if (THIS_WINDOW_ID === undefined) {
      let winData = await browser.windows.getCurrent();
      THIS_WINDOW_ID = winData.id;
    }

    manage.initManage();
    main.initializePanelDims();

    // Initialize recent tabs data
    // with the currently active tab.
    let tabData = await main.getActiveTab();
    let activeTabId = tabData[0].id;
    tabs.updateTabsRecent(activeTabId);
    
    window.addEventListener("resize", main.onResize);

    // Stop-gap workaround for bug 1398625 (beforeunload event not fired for
    // browserAction popup), otherwise we would just grab the value on closing
    // of the menu.
    tabsMenuCntnr.addEventListener("scroll", (e) => {
      if (menuModes.menuMode === 0) {
        BPG.allTabsMenuScrollPos = OPTI_MENU.getScrollPosition();
      } else if (menuModes.menuMode == 3) {
        BPG.searchMenuScrollPos = OPTI_MENU.getScrollPosition();
      }
    });
  },

  async handlePanelBeforeunload() {
dump("XXX : handlePanelBeforeunload\n");
  },
}

window.addEventListener("load", main.init);
window.addEventListener("beforeunload", main.handlePanelBeforeunload);
