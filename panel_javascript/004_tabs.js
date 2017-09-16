let tabs = {
  updateForceTabsOnActivated: {},
  updateForceTabsOnRemoved: {},

  _updateTabsMenuActivated(tabId) {
    // Utility function for simple one-off event which doesn't alter
    // tabs order, we just manipulate the data store directly.
    for (let id in CURRENT_TABS_HASH) {
      CURRENT_TABS_HASH[id].userDefined.properties.active = id == tabId;
      CURRENT_TABS_HASH[id].userDefined.classes.activetab = id == tabId;
    }
  },

  // Persistence for updateTabsRecent.
  accumUpdateTabsRecentRemove: {},
  accumUpdateTabsRecentAdd: [],

  updateTabsRecent(tabId, remove, accumulate) {
    if (tabId) {
      if (remove) {
        this.accumUpdateTabsRecentRemove[tabId] = true;
      } else {
        this.accumUpdateTabsRecentAdd.unshift(tabId);
      }
    }

    if (accumulate) {
      return;
    }

    let nominalArr = this.accumUpdateTabsRecentAdd.concat(globals.tabsRecentIdsArr);
    let dupsHash = {};
    let arr = [];
    for (let i = 0; i < nominalArr.length; i++) {
      let id = nominalArr[i];
      if (!this.accumUpdateTabsRecentRemove[id] && !dupsHash[id]) {
        arr.push(id);
        // Prevent duplicate entries down the line.
        dupsHash[id] = true;
      }
    }

    this.accumUpdateTabsRecentRemove = {};
    this.accumUpdateTabsRecentAdd = [];
    globals.tabsRecentIdsArr = arr;

    // TODO: Remove if/when bug 1398625 gets fixed.
    BPW.recordRecentTabsState(THIS_WINDOW_ID, JSON.stringify(globals.tabsRecentIdsArr));
  },

  // Properties for updateUIAccumulator.
  isUpdateMenuGateTimerRunning: false,
  tasksUpdateMenuGate: {},

  /*
   * updateUIAccumulator
   *
   * {object} params - if present, tells updateUIAccumulator to accumulate data
   *   which will determine what kind of update is needed.  Contains the following properties:
   *
   * {object} tasks - flags which tell what kind of update is needed.  These flags are
   *   accumulated during rapid-fire suppression so when the update finally takes place,
   *   the proper updating will be done, and redundancies will be dealt with.  The flags are:
   *
   *   {boolean} doUpdateCurrentTabsData - update the current tabs data.  Used primarily
   *     if tabs have been moved, which would upset the order of CURRENT_MENU_DATA.
   *   {boolean} doRefreshCurrentMenu - do a complete refresh of the current menu, which
   *     which may affect the sequence of things, such as when items are moved or removed.
   *   {boolean} doUpdateMenu - calls for an update which would only change individual
   *     menu items in place, but sequence is not changed.  This is ignored if
   *     doRefreshCurrentMenu is true, since the more comprehensive update will have
   *     handled that.
   *
   * {number} tabId -
   */
  async updateUIAccumulator(params) {
    // Rapid-fire suppression.
    if (params) {
      let { tasks, tabId, fireImmediately } = params;
      let { doUpdateCurrentTabsData,
            doRefreshCurrentMenu,
            doUpdateMenu,
            typeUpdateTabsRecent } = tasks;

      // Set flag(s)

      if (doUpdateCurrentTabsData) {
        this.tasksUpdateMenuGate.flagUpdateCurrentTabsData = true;
      }
      if (doRefreshCurrentMenu) {
        this.tasksUpdateMenuGate.flagRefreshCurrentMenu = true;
      }
      if (doUpdateMenu) {
        this.tasksUpdateMenuGate.flagUpdateMenu = true;
      }
      // In addition to setting flag, accumulate tabs recent data.
      if (typeof(typeUpdateTabsRecent) == "boolean") {
        // Passing `true` for arg[2] tells updateTabsRecent to accumulate update
        // data without actually updating.  When updateUIAccumulator dumps its
        // load we'll call updateTabsRecent to finally do the update.  Boolean
        // value of typeUpdateTabsRecent tells whether or not to remove from history.
        this.updateTabsRecent(tabId, typeUpdateTabsRecent, true)
        this.tasksUpdateMenuGate.flagUpdateTabsRecent = true;
      }

      if (!fireImmediately) {
        // Delay updating for 100ms and accumulate task flags in the meanwhile
        // in the event of "rapid-fire" calls.
        if (!this.isUpdateMenuGateTimerRunning) {
          let _this = this;
          setTimeout(function() {
            _this.isUpdateMenuGateTimerRunning = false;
            // No args will bypass accumulation and update according to flags accumulated.
            _this.updateUIAccumulator();
          },100);
          this.isUpdateMenuGateTimerRunning = true;
        }
        return;
      }
    }

    // Update stuff according to accumulated flags.

    let { flagUpdateCurrentTabsData,
          flagUpdateTabsRecent,
          flagRefreshCurrentMenu,
          flagUpdateMenu } = this.tasksUpdateMenuGate;

dump("updateUIAccumulator PASS : "+flagUpdateCurrentTabsData+"    "+flagUpdateTabsRecent+"    "+flagRefreshCurrentMenu+"    "+flagUpdateMenu+"\n");

    // If we need to update current tabs data, we must do that before any menu updates.
    if (flagUpdateCurrentTabsData) {
      await manage.updateCurrentTabsData();
    }
    if (flagUpdateTabsRecent) {
      this.updateTabsRecent();
    }

    // Menu updating calls, run these two last.  Both are mutually exclusive, as
    // menuModes.refreshCurrentMenu() will have run OPTI_MENU.updateMenu();
    if (flagRefreshCurrentMenu) {
      menuModes.refreshCurrentMenu();
    }
    if (flagUpdateMenu && !flagRefreshCurrentMenu) {
      OPTI_MENU.updateMenu(CURRENT_MENU_DATA);
    }
  },

  lastActivatedTabId: null,

  async newTabNextToSelected(tabId) {
    if (!tabs.lastActivatedTabId) {
      return;
    }
    let lastActivatedTab = await browser.tabs.get(tabs.lastActivatedTabId);
    await browser.tabs.move([tabId], { index : lastActivatedTab.index + 1 });
  },

  tabsOnActivatedListener(data) {
    // Activated tab is in another window.
    if (data.windowId != THIS_WINDOW_ID) {
      return;
    }

//dump("tabsOnActivatedListener : tabId : "+data.tabId+"    THIS_WINDOW_ID : "+THIS_WINDOW_ID+"\n");

    let tabId = data.tabId;
    tabs.lastActivatedTabId = tabId;

    let fireImmediately = !tabs.updateForceTabsOnActivated[tabId];
    if (!fireImmediately) {
      delete(tabs.updateForceTabsOnActivated[tabId]);
    }

    tabs._updateTabsMenuActivated(tabId);

    // Pass a definitive boolean false for typeUpdateTabsRecent so updateUIAccumulator
    // knows that there is a tabs recent update of some kind.
    let tasks = { doRefreshCurrentMenu: menuModes.menuMode == 1,
                  doUpdateMenu: menuModes.menuMode != 1,
                  typeUpdateTabsRecent: false };

    tabs.updateUIAccumulator({ tasks, tabId, fireImmediately })
  },

  tabsOnCreatedListener(tab) {
    // Created in another window.
    if (tab.windowId != THIS_WINDOW_ID) {
      return;
    }

//dump("tabsOnCreatedListener : tabId : "+tab.id+"    THIS_WINDOW_ID : "+THIS_WINDOW_ID+"\n");

    tabs.newTabNextToSelected(tab.id);

    // Simple one-off event, we just manipulate the data store directly.
    CURRENT_TABS_HASH[tab.id] = { menutextstr : tab.title || tab.url,
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
    CURRENT_TABS_LIST.splice(tab.index, 0, tab.id);
    // If tab is active, tabsOnActivated gets sent before tabsOnCreated,so we
    // must explicitly call _updateTabsMenuActivated() now.
    if (tab.active) {
      tabs._updateTabsMenuActivated(tab.id);
    }

    // Mass tab creation is unlikely, so just update the current menu directly.
    menuModes.refreshCurrentMenu();
  },

  tabsOnRemovedListener(tabId, data) {
    // Removed from another window.
    if (data.windowId != THIS_WINDOW_ID) {
      return;
    }

//dump("tabsOnRemovedListener : tabId : "+tabId+"    THIS_WINDOW_ID : "+THIS_WINDOW_ID+"\n");

    let fireImmediately = !tabs.updateForceTabsOnRemoved[tabId];
    if (!fireImmediately) {
      delete(tabs.updateForceTabsOnRemoved[tabId]);
    }

    // Simple one-off event, we just manipulate the data store directly.
    delete(CURRENT_TABS_HASH[tabId]);
    let arr = [];
    for (let id of CURRENT_TABS_LIST) {
      if (id != tabId) {
        arr.push(id);
      }
    }
    CURRENT_TABS_LIST = arr;

    let tasks = { typeUpdateTabsRecent: true,
                  doRefreshCurrentMenu: true };

    tabs.updateUIAccumulator({ tasks, tabId, fireImmediately })
  },

  tabMovedFromAnotherWindowIds: {},

  tabsOnMovedListener(tabId, data) {
//dump("tabsOnMovedListener XXXXXXX : tabId : "+tabId+"    THIS_WINDOW_ID : "+THIS_WINDOW_ID+"    tab in this window? : "+(data.windowId == THIS_WINDOW_ID)+"\n");
    // Moved tab is from another window.
    if (data.windowId != THIS_WINDOW_ID) {
      return;
    }

//dump("tabsOnMovedListener : tabId : "+tabId+"    THIS_WINDOW_ID : "+THIS_WINDOW_ID+"\n");

//CURRENT_TABS_HASH[tabId].userDefined.properties.index = data.index;
    let tasks = { doUpdateCurrentTabsData: true,
                  doRefreshCurrentMenu: true };
    tabs.updateUIAccumulator({ tasks })
  },

  tabsOnDetachedListener(tabId, info) {
//dump("tabsOnDetachedListener WWWWWWW : tabId : "+tabId+"    THIS_WINDOW_ID : "+THIS_WINDOW_ID+"\n");

    let tasks = { doUpdateCurrentTabsData: true,
                  doRefreshCurrentMenu: true };
    tabs.updateUIAccumulator({ tasks })
  },

  tabsOnUpdatedListener(tabId, data) {
    // Update is from tab in another window.
    if (data.windowId != THIS_WINDOW_ID) {
      return;
    }

//dump("tabsOnUpdatedListener : tabId : "+tabId+"    THIS_WINDOW_ID : "+THIS_WINDOW_ID+"\n");

    let menuData = manage.getCurrentMenuDataAtTabId(tabId);
    if (!menuData) {
      return;
    }

    let updated = false;

    if (data.url && data.url != CURRENT_TABS_HASH[tabId].userDefined.properties.url) {
      CURRENT_TABS_HASH[tabId].userDefined.properties.url = data.url;
      updated = true;
    }
    if (data.title && data.title != CURRENT_TABS_HASH[tabId].menutextstr) {
      CURRENT_TABS_HASH[tabId].menutextstr = data.title;
      CURRENT_TABS_HASH[tabId].userDefined.properties.tabtitle = data.title;
      updated = true;
    }

    // If status switched from "loading" and there is no data.favIconUrl,
    // favIconUrl won't get updated and a busy icon will be left.  Cover that
    // case by backing up the favIconUrl when switching to "loading" and using
    // the backup if status switched back again but there is no data.favIconUrl.
    // (Note that favIconUrl is written as menuiconurl1)
    if (data.status == "loading" && !CURRENT_TABS_HASH[tabId].isLastStatusLoading) {
      CURRENT_TABS_HASH[tabId].lastFavIconUrl = CURRENT_TABS_HASH[tabId].menuiconurl1;
      CURRENT_TABS_HASH[tabId].menuiconurl1 = LOADING_FAVICON_URL;
      updated = true;
    }
    if (data.status !== undefined) {
      if (data.status != "loading" && CURRENT_TABS_HASH[tabId].isLastStatusLoading) {
        CURRENT_TABS_HASH[tabId].menuiconurl1 = data.favIconUrl || CURRENT_TABS_HASH[tabId].lastFavIconUrl;
        updated = true;
      }
      CURRENT_TABS_HASH[tabId].isLastStatusLoading = data.status == "loading";
    }

    // Don't update for this, just keep track.
    if (data.favIconUrl) {
      CURRENT_TABS_HASH[tabId].lastFavIconUrl = data.favIconUrl;
    }

    if (updated) {
      OPTI_MENU.updateSingleMenuItem(CURRENT_MENU_DATA, menuData.index);
    }
  },

  /**
   * STUB - STUB - STUB - moveTabs2
   *
   * Future code proposal for the current workaround for bug 1323311 and bug 1400456
   * which first moves tabs to the end of the list, then to their desired postions.
   * The code shown below will actually workaround bug 1323311; awaiting a fix
   * for bug 1400456 to determine more effecient code for that.
   *
   * moveTabs - Move a list of tabs to just after a given tab.
   *
   * tabIds : list of tab ids correlating to tabs to move
   * index : index of the tab to insert the tabs after
   *
   * Tab moves from another window are handled differently than moves within the
   * same window.  in the case of same window moves, this method relies on
   * tabIds being sequenced in tab index order.
   */
  async moveTabs2(tabIds, index, windowId) {
    let beforeTabs = [];
    let afterTabs = [];

    if (typeof windowId == "number" && windowId !== THIS_WINDOW_ID) {
      afterTabs = tabIds.slice();
    } else {
      for (let tabId of tabIds) {
        if (CURRENT_TABS_HASH[tabId].userDefined.properties.index < index) {
          beforeTabs.push(tabId);
        } else {
          afterTabs.push(tabId);
        }
      }
    }

    if (beforeTabs.length) {
      await browser.tabs.move(tabIds, { index, windowId: THIS_WINDOW_ID });
    }

    if (afterTabs.length) {
      await browser.tabs.move(tabIds, { index: index + 1, windowId: THIS_WINDOW_ID });
    }
  },

  /**
   * moveTabs - Move a list of tabs to just after a given tab.
   *
   * tabIds : list of tab ids correlating to tabs to move
   * index : index of the tab to insert the tabs after
   *
   * Tab moves from another window are handled differently than moves within the
   * same window.
   *
   * This method makes a few assumptions:
   *
   * That the sequence of tabIds follows tabs order.
   * All tabs being moved are within the same window, whether it is this or another.
   * CURRENT_TABS_HASH remains up to date and its integrity so that all tabIds in
   *   this window are accounted for.
   *
   * Workaround for bug 1323311 and bug 1400456:
   * First move all tabs to the end of the list, then move them into the desired
   * positions.  However, before doing this, if tabs being moved are within the
   * same window, the move-to index must be adjusted for any tabs that precede
   * the move-to index, since they will all first get removed from their spots
   * that precede the index.
   * This workaround should silently degrade.
   */
  async moveTabs(tabIds, index, windowId) {
    if (typeof windowId != "number" || windowId === THIS_WINDOW_ID) {
      let beforeTabsCount = 0;
      for (let tabId of tabIds) {
        if (CURRENT_TABS_HASH[tabId].userDefined.properties.index < index) {
          beforeTabsCount++;
        }
      }
      index -= beforeTabsCount;
    }

    let movedTabs = await browser.tabs.move(tabIds, { index : -1, windowId: THIS_WINDOW_ID });

    // If tabs were moved from another window, we need to use the converted
    // tab ids when moving them again, since moving tabs between windows actually
    // destroys tabs in the old window and creates new tabs in the new window.
    let movedTabIds = movedTabs.map(tab => tab.id);

    if (index != -1) {
      await browser.tabs.move(movedTabIds, { index: index + 1, windowId: THIS_WINDOW_ID });
    }
  },

  /**
   *  Close selected tabs.
   *
   *  tabIds : list of tab ids correlating to tabs to close
   */
  async closeSelectedTabs(tabIds) {
dump("closeSelectedTabs : "+tabIds+"\n");
  },

  /**
   *  Discard selected tabs.
   *
   *  tabIds : list of tab ids correlating to tabs to discard
   */
  async discardSelectedTabs(tabIds) {
dump("discardSelectedTabs : "+tabIds+"\n");
  },

  /**
   *  Move selected tabs.
   *
   *  tabIds : list of tab ids correlating to tabs to discard
   */
  async moveSelectedTabs(tabIds, targetTabId) {
dump("discardSelectedTabs : "+tabIds+"    "+targetTabId+"\n");
    this.moveTabs(tabIds, targetTabId);
  },

  /**
   *  Cut selected tabs.
   *
   *  tabIds : list of tab ids correlating to tabs to "cut", meaning, putting them
   *  in a list to be moved.
   */
  async cutSelectedTabs(tabIds) {
dump("cutSelectedTabs : "+tabIds+"\n");
    BPW.recordTabIds(JSON.stringify({ windowId: THIS_WINDOW_ID, tabIds }));
  },

  /**
   *  Paste cut tabs.
   *
   *  Move tabs from "cut" list to just after the hovered tab position.
   */
  async pasteCutTabs(index) {
    let { windowId, tabIds } = JSON.parse(BPW.getRecordedTabIds());
dump("pasteCutTabs : index : "+index+"    windowId : "+windowId+"    tabIds : "+tabIds+"\n");

    if (!tabIds || ! tabIds.length) {
      return;
    }

    this.moveTabs(tabIds, index, windowId);
  },
}
