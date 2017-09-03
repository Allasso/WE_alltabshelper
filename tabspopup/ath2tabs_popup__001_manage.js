let windowsFocusedList = [];
let currentTabsHash = {};
let currentTabsList = [];
let currentMenuData = [];
let optiMenu;
let contextMenu;

function initManage() {
  browser.tabs.onActivated.addListener(tabsOnActivatedListener);
  browser.tabs.onCreated.addListener(tabsOnCreatedListener);
  browser.tabs.onRemoved.addListener(tabsOnRemovedListener);
  browser.tabs.onMoved.addListener(tabsOnMovedListener);
  browser.tabs.onUpdated.addListener(tabsOnUpdatedListener);

  optiMenu = new OptiMenu(tabsMenuCntnr, window);
  contextMenu = new ContextMenu(window);
  window.addEventListener("contextmenu", e => e.preventDefault());

  optiMenu.addActivityDDListener(this.menuActivityDDListener);
  optiMenu.addActivityActionListener(this.menuActivityActionListener);

  initTabsMenu(false);

dump("here I am...\n");
}

function getTabsInCurrentWindow() {
  return browser.tabs.query({ windowId: globals.currentWindowId });
}

function getActiveTab() {
  return browser.tabs.query({ windowId: globals.currentWindowId, active: true });
}

function menuActivityDDListener(e) {
  if(e.hybridType == "drop") {
    handleMenuDrop(e);
    return;
  }
}

function menuActivityActionListener(e) {
  let menuitem = e.menuitem;
  let tabId = menuitem.tabId;

  if(e.hybridType == "menuitemclick") {
    // Force immediate update for actions done in the menu.
    updateForceTabsOnActivated[tabId] = true;
    browser.tabs.update(tabId, { active: true });

    // If we're clicking on a search result, highlight the result on the page.
    if (typeof(menuitem.rangeIndex) == "number") {
      findAndHighlight(tabId, menuitem.rangeIndex);
    }
    return;
  }
  if(e.hybridType == "action1click") {
    if (menuMode == 3) {
      toggleDisplaySearchResultsForTab(menuitem)
      return;
    }

    // Force immediate update for actions done in the menu.
    updateForceTabsOnActivated[tabId] = true;
    browser.tabs.update(tabId, { active: true });
    return;
  }
  if(e.hybridType == "action2click") {
    // Force immediate update for actions done in the menu.
    updateForceTabsOnRemoved[tabId] = true;
    browser.tabs.remove(tabId);
    return;
  }
}

/////////////////////////////////////////////////////////////////
// LIST REBUILD AND MODIFICATION

async function initTabsMenu(currentMode) {
  await updateCurrentTabsData();
  setChangeModeByModeIndex();
}

function updateCurrentTabsData() {
  return new Promise(async function(resolve) {
    let tabs = await getTabsInCurrentWindow();
    currentTabsList = [];
    currentTabsHash = {};

    for (let tab of tabs) {
      currentTabsHash[tab.id] = setCurrentTabsHashItem(tab);
      currentTabsList.push(tab.id);
    }
    resolve();
  });
}

function setCurrentTabsHashItem(tab) {
  return { menutextstr: tab.title || tab.url,
           menuiconurl1: tab.favIconUrl,
           menuiconurl2: CLOSE_BUTTON_URL,

           userDefined: {
             properties: {
               tabId: tab.id,
               active: tab.active,
               tabtitle: tab.title || tab.url,
               url: tab.url,
               index: tab.index,
             },
             classes: {
               activetab: tab.active,
             }
           }
         };
}

function getCurrentMenuDataAtTabId(tabId) {
//dump("getCurrentMenuDataAtTabId : "+tabId+"\n");
  let len = currentMenuData.length;
  for (let index = 0; index < len; index++) {
    let data = currentMenuData[index];
    if (data.userDefined.properties.tabId == tabId) {
      return { index, data };
    }
  }
}

/////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////

function handleMenuDrop(e) {
  let selectedMenuitems = e.selectedMenuitems;
  let menuitem = e.menuitem;

  if (!selectedMenuitems.ids.length) {
    return;
  }
  if (menuitem) {
    menuitem = menuitem.nextSibling || menuitem;
    moveTabs(selectedMenuitems.ids, menuitem.tabId, function() {
      updateTabsListAfterMove();
    });
  }
}

async function updateTabsListAfterMove() {
// TODO : Update the current tabs data based on prediction of the move instead
// of waiting for exceedingly slow browser.tabs.query()?  (see bug 1322869)
// TODO : Currently still allowing onMoved listener to also update the UI -
// Should we implement an inhibitor?  We still want to update here because
// it is more immediate/better UX.
  await updateCurrentTabsData();
  setAllMenu();
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS

document.addEventListener("click", function(e) {
  if (e.button != 0) { return; }

  if (e.target.id == "buttonall") {
    modeChangeAll();
    return;
  }
  if (e.target.id == "buttonrecent") {
    modeChangeRecent();
    return;
  }
  if (e.target.id == "buttondups") {
    modeChangeDups();
    return;
  }
  if (e.target.id == "buttonsearch") {
    modeChangeSearch();
    return;
  }
});

