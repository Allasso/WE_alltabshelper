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

  tabsOnActivatedListener(data) {
    let tabId = data.tabId;

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

  tabsOnMovedListener(tabId, data) {
    CURRENT_TABS_HASH[tabId].userDefined.properties.index = data.index;
    let tasks = { doUpdateCurrentTabsData: true, doRefreshCurrentMenu: true };
    tabs.updateUIAccumulator({ tasks })
  },

  tabsOnUpdatedListener(tabId, data) {
    // WHAT TODO: Just return here?  Or build the hash entry?
    if (!CURRENT_TABS_HASH[tabId]) {
      return;
    }
    /*
    if (!CURRENT_TABS_HASH[tabId]) {
      CURRENT_TABS_HASH[tabId] = { userDefined: {  }};
    }
    */

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
   *  Move a list of tabs to just after a given tab.
   *
   *  ids : list of tab ids correlating to tabs to move
   *  tabId : id of the tab to insert the tabs after
   */
  async moveTabs(ids, tabId, callback) {
    // Workaround for bug 1323311 - first move all tabs to the end of the list,
    // then move them into the desired positions.
    // TODO: There is probably a more efficient workaround for this.
    await browser.tabs.move(ids, { index : -1 });

    if (tabId != -1) {
      // TODO:  Should we use CURRENT_TABS_HASH rather than tabs.get?
      let tab = await browser.tabs.get(tabId);
      await browser.tabs.move(ids, { index : tab.index });
    }

    if (typeof callback == "function") {
      callback();
    }
  },

  cutTabIds: [],

  /**
   *  Close selected tabs.
   *
   *  ids : list of tab ids correlating to tabs to close
   */
  async closeSelectedTabs(ids) {
dump("closeSelectedTabs : "+ids+"\n");
  },

  /**
   *  Discard selected tabs.
   *
   *  ids : list of tab ids correlating to tabs to discard
   */
  async discardSelectedTabs(ids) {
dump("discardSelectedTabs : "+ids+"\n");
  },

  /**
   *  Move selected tabs.
   *
   *  ids : list of tab ids correlating to tabs to discard
   */
  async moveSelectedTabs(ids, targetTabId) {
    this.moveTabs(ids, targetTabId);
  },

  /**
   *  Cut selected tabs.
   *
   *  ids : list of tab ids correlating to tabs to "cut", meaning, putting them
   *  in a list to be moved.
   */
  async cutSelectedTabs(ids) {
    this.cutTabIds = ids;
  },

  /**
   *  Paste cut tabs.
   *
   *  Move tabs from "cut" list to just after the hovered tab position.
   */
  async pasteCutTabs(id) {
    if (id && this.cutTabIds.length) {
      this.moveTabs(this.cutTabIds, id);
    }
  },
}
