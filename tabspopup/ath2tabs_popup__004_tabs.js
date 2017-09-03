let updateForceTabsOnActivated = {};
let updateForceTabsOnRemoved = {};

function _updateTabsMenuActivated(tabId) {
  // Utility function for simple one-off event which doesn't alter
  // tabs order, we just manipulate the data store directly.
  for (let id in currentTabsHash) {
    currentTabsHash[id].userDefined.properties.active = id == tabId;
    currentTabsHash[id].userDefined.classes.activetab = id == tabId;
  }
}

function tabsOnActivatedListener(data) {
  let tabId = data.tabId;

  let suppressRapidFire = !updateForceTabsOnActivated[tabId];
  if (!suppressRapidFire) {
    delete(updateForceTabsOnActivated[tabId]);
  }

  _updateTabsMenuActivated(tabId);

  let tasks = { typeUpdateTabsRecent: false,
                doRefreshCurrentMenu: menuMode == 1,
                doUpdateMenu: menuMode != 1 };

  updateUIGateway(tabId, tasks, suppressRapidFire)
}

function tabsOnCreatedListener(tab) {
  // Simple one-off event, we just manipulate the data store directly.
  currentTabsHash[tab.id] = { menutextstr : tab.title || tab.url,
                              menuiconurl1 : tab.favIconUrl,
                              menuiconurl2 : CLOSE_BUTTON_URL,
                              userDefined: {
                                properties: {
                                  tabId : tab.id,
                                  index : tab.index,
                                  tabtitle: tab.title || tab.url,
                                  url : tab.url,
                                  active : tab.active,
                                },
                                classes: {
                                  activetab: tab.active,
                                }
                              }
                            };
  currentTabsList.splice(tab.index, 0, tab.id);
  // If tab is active, tabsOnActivated gets sent before tabsOnCreated,so we
  // must explicitly call _updateTabsMenuActivated() now.
  if (tab.active) {
    _updateTabsMenuActivated(tab.id);
  }

  // Mass tab creation is unlikely, so just update the current menu directly.
  refreshCurrentMenu();
}

function tabsOnRemovedListener(tabId, data) {
//dump("tabsOnRemovedListener : "+tabId+"    "+Date.now()+"\n");
  let suppressRapidFire = !updateForceTabsOnRemoved[tabId];
  if (!suppressRapidFire) {
    delete(updateForceTabsOnRemoved[tabId]);
  }

  // Simple one-off event, we just manipulate the data store directly.
  delete(currentTabsHash[tabId]);
  let arr = [];
  for (let id of currentTabsList) {
    if (id != tabId) {
      arr.push(id);
    }
  }
  currentTabsList = arr;

  let tasks = { typeUpdateTabsRecent: true,
                doRefreshCurrentMenu: true };

  updateUIGateway(tabId, tasks, suppressRapidFire)
}

function tabsOnMovedListener(tabId, data) {
  currentTabsHash[tabId].userDefined.properties.index = data.index;
  updateUIGateway(tabId, { doUpdateMenu: true })
}

// Flags for updateUIGateway.
let isUpdateMenuGateTimerRunning = false;
let tasksUpdateMenuGate = {};

function updateUIGateway(tabId, tasks, suppressRapidFire) {
  // Rapid-fire suppression.
  if (tasks) {
    let { typeUpdateTabsRecent, doRefreshCurrentMenu, doUpdateMenu } = tasks;
    if (typeof(typeUpdateTabsRecent) == "boolean") {
      // Boolean value of typeUpdateTabsRecent tells whether to remove or not.
      updateTabsRecent(tabId, typeUpdateTabsRecent, true)
      tasksUpdateMenuGate.flagUpdateTabsRecent = true;
    }
    if (doRefreshCurrentMenu) {
      tasksUpdateMenuGate.flagRefreshCurrentMenu = true;
    }
    if (doUpdateMenu) {
      tasksUpdateMenuGate.flagUpdateMenu = true;
    }

    if (suppressRapidFire) {
      if (!isUpdateMenuGateTimerRunning) {
        setTimeout(function() {
          isUpdateMenuGateTimerRunning = false;
          // No args will bypass everything and update according to flags collected.
          updateUIGateway();
        },100);
        isUpdateMenuGateTimerRunning = true;
      }
      return;
    }
  }
  let { flagUpdateTabsRecent, flagRefreshCurrentMenu, flagUpdateMenu } = tasksUpdateMenuGate;
  if (flagUpdateTabsRecent) {
    updateTabsRecent();
  }
  if (flagRefreshCurrentMenu) {
    refreshCurrentMenu();
  }
  // refreshCurrentMenu() will have run optiMenu.updateMenu();
  if (flagUpdateMenu && !flagRefreshCurrentMenu) {
    optiMenu.updateMenu(currentMenuData);
  }
}

// Persistence for updateTabsRecent.
let accumUpdateTabsRecentRemove = {};
let accumUpdateTabsRecentAdd = [];

function updateTabsRecent(tabId, remove, accumulate) {
  if (tabId) {
    if (remove) {
      accumUpdateTabsRecentRemove[tabId] = true;
    } else {
      accumUpdateTabsRecentAdd.unshift(tabId);
    }
  }

  if (accumulate) {
    return;
  }

  let nominalArr = accumUpdateTabsRecentAdd.concat(globals.tabsRecentIdsArr);
  let dupsHash = {};
  let arr = [];
  for (let i = 0; i < nominalArr.length; i++) {
    let id = nominalArr[i];
    if (!accumUpdateTabsRecentRemove[id] && !dupsHash[id]) {
      arr.push(id);
      // Prevent duplicate entries down the line.
      dupsHash[id] = true;
    }
  }

  accumUpdateTabsRecentRemove = {};
  accumUpdateTabsRecentAdd = [];
  globals.tabsRecentIdsArr = arr;
}

function tabsOnUpdatedListener(tabId, data) {
  // WHAT TODO: Just return here?  Or build the hash entry?
  if (!currentTabsHash[tabId]) {
    return;
  }
  /*
  if (!currentTabsHash[tabId]) {
    currentTabsHash[tabId] = { userDefined: {  }};
  }
  */

  let menuData = getCurrentMenuDataAtTabId(tabId);
  if (!menuData) {
    return;
  }

  let updated = false;

  if (data.url && data.url != currentTabsHash[tabId].userDefined.properties.url) {
    currentTabsHash[tabId].userDefined.properties.url = data.url;
    updated = true;
  }
  if (data.title && data.title != currentTabsHash[tabId].menutextstr) {
    currentTabsHash[tabId].menutextstr = data.title;
    currentTabsHash[tabId].userDefined.properties.tabtitle = data.title;
    updated = true;
  }

  // If status switched from "loading" and there is no data.favIconUrl,
  // favIconUrl won't get updated and a busy icon will be left.  Cover that
  // case by backing up the favIconUrl when switching to "loading" and using
  // the backup if status switched back again but there is no data.favIconUrl.
  // (Note that favIconUrl is written as menuiconurl1)
  if (data.status == "loading" && !currentTabsHash[tabId].isLastStatusLoading) {
dump("start loading : "+currentTabsHash[tabId].menutextstr+"\n");
    currentTabsHash[tabId].lastFavIconUrl = currentTabsHash[tabId].menuiconurl1;
    currentTabsHash[tabId].menuiconurl1 = LOADING_FAVICON_URL;
    updated = true;
  }
  if (data.status !== undefined) {
    if (data.status != "loading" && currentTabsHash[tabId].isLastStatusLoading) {
      currentTabsHash[tabId].menuiconurl1 = data.favIconUrl || currentTabsHash[tabId].lastFavIconUrl;
dump("end loading : "+currentTabsHash[tabId].menutextstr+"    "+currentTabsHash[tabId].menuiconurl1+"\n");
      updated = true;
    }
    currentTabsHash[tabId].isLastStatusLoading = data.status == "loading";
  }

  // Don't update for this, just keep track.
  if (data.favIconUrl) {
    currentTabsHash[tabId].lastFavIconUrl = data.favIconUrl;
  }

  if (updated) {
    optiMenu.updateSingleMenuItem(currentMenuData, menuData.index);
  }
}







/**
 *  Move a list of tabs to just after a given tab.
 *
 *  ids : list of tab ids correlating to tabs to move
 *  tabId : id of the tab to insert the tabs after
 */
async function moveTabs(ids, tabId, callback) {
  // Workaround for bug 1323311 - first move all tabs to the end of the list,
  // then move them into the desired positions.
  // TODO: There is probably a more efficient workaround for this.
  await browser.tabs.move(ids, { index : -1 });

  let tab = await browser.tabs.get(tabId);
  await browser.tabs.move(ids, { index : tab.index });

  if (typeof callback == "function") {
    callback();
  }
}

