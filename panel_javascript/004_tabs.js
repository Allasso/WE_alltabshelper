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
            doUpdateTabsCount,
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
      if (doUpdateTabsCount) {
        this.tasksUpdateMenuGate.flagUpdateTabsCount = true;
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
          flagRefreshCurrentMenu,
          flagUpdateMenu,
          flagUpdateTabsCount } = this.tasksUpdateMenuGate;

    // If we need to update current tabs data, we must do that before any menu updates.
    if (flagUpdateCurrentTabsData) {
      await manage.updateCurrentTabsData();
    }
    if (flagUpdateTabsCount) {
      this.updateTabsCount();
    }

    // Menu updating calls, run these two last.  Both are mutually exclusive, as
    // menuModes.refreshCurrentMenu() will have run OPTI_MENU.updateMenu();
    if (flagRefreshCurrentMenu) {
      menuModes.refreshCurrentMenu();
    } else if (flagUpdateMenu) {
      OPTI_MENU.updateMenu(manage.sanitizeMenuTextInCurrentMenuData(CURRENT_MENU_DATA));
    }
  },

  tabsOnActivatedListener(data) {
    // Activated tab is in another window.
    if (data.windowId != THIS_WINDOW_ID) {
      return;
    }

    let tabId = data.tabId;

    let fireImmediately = !tabs.updateForceTabsOnActivated[tabId];
    if (!fireImmediately) {
      delete(tabs.updateForceTabsOnActivated[tabId]);
    }

    // Explicitly update the tabs hash discarded class.
    CURRENT_TABS_HASH[tabId].userDefined.classes.tabdiscarded = false;

    tabs._updateTabsMenuActivated(tabId);

    // Pass a definitive boolean false for typeUpdateTabsRecent so updateUIAccumulator
    // knows that there is a tabs recent update of some kind.
    let tasks = { doRefreshCurrentMenu: menuModes.menuMode == 1,
                  doUpdateMenu: menuModes.menuMode != 1,
                  doUpdateTabsCount: true,
                  typeUpdateTabsRecent: false };

    tabs.updateUIAccumulator({ tasks, tabId, fireImmediately });

    if (menuModes.menuMode === 0) {
      PINNED_TABS_OVERLAY.updatePinnedTabsOverlay();
    }
  },

  tabsOnCreatedListener(tab) {
    // Created in another window.
    if (tab.windowId != THIS_WINDOW_ID) {
      return;
    }

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
    tabs.updateTabsCount();

    // If tab is active, tabsOnActivated gets sent before tabsOnCreated,so we
    // must explicitly call _updateTabsMenuActivated() now.
    if (tab.active) {
      tabs._updateTabsMenuActivated(tab.id);
    }

    // Mass tab creation is unlikely, so bypass the accumulator and update
    // the current menu directly.
    menuModes.refreshCurrentMenu();
  },

  tabsOnRemovedListener(tabId, data) {
    // Removed from another window.
    if (data.windowId != THIS_WINDOW_ID) {
      return;
    }

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
    tabs.updateTabsCount();

    let tasks = { typeUpdateTabsRecent: true,
                  doRefreshCurrentMenu: true };

    tabs.updateUIAccumulator({ tasks, tabId, fireImmediately })
  },

  tabMovedFromAnotherWindowIds: {},

  tabsOnMovedListener(tabId, data) {
    // Moved tab is from another window.
    if (data.windowId != THIS_WINDOW_ID) {
      return;
    }

    let tasks = { doUpdateCurrentTabsData: true,
                  doRefreshCurrentMenu: true };
    tabs.updateUIAccumulator({ tasks })
  },

  tabsOnDetachedListener(tabId, info) {
    let tasks = { doUpdateCurrentTabsData: true,
                  doRefreshCurrentMenu: true };
    tabs.updateUIAccumulator({ tasks })
  },

  async tabsOnUpdatedListener(tabId, data) {
    // Unfortunately, windowId is not available from data.
    let tab = await browser.tabs.get(tabId);

    // Update is from tab in another window.
    if (tab.windowId != THIS_WINDOW_ID) {
      return;
    }

    let menuData = manage.getCurrentMenuDataAtTabId(tabId);
    if (!menuData) {
      return;
    }

    let updated = false;

    if ("pinned" in data) {
      CURRENT_TABS_HASH[tabId].userDefined.classes.tabpinned = data.pinned;
      if (menuModes.menuMode === 0) {
        PINNED_TABS_OVERLAY.updatePinnedTabsOverlay();
      }
      updated = true;
    }

    if ("url" in data && data.url != CURRENT_TABS_HASH[tabId].userDefined.properties.url) {
      CURRENT_TABS_HASH[tabId].userDefined.properties.url = data.url;
      updated = true;
    }

    if ("title" in data && data.title != CURRENT_TABS_HASH[tabId].menutextstr) {
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
    
    if ("status" in data) {
      if (data.status != "loading" && CURRENT_TABS_HASH[tabId].isLastStatusLoading) {
        // TODO: The test is a hack to get rid of the spinner for now, as the
        // mozapps generic icon doesn't seem to get applied, perhaps because
        // it's a chrome:// url?
        CURRENT_TABS_HASH[tabId].menuiconurl1 =
          CURRENT_TABS_HASH[tabId].lastFavIconUrl.indexOf("extensionGeneric-16.svg") > -1 ?
          "" : CURRENT_TABS_HASH[tabId].lastFavIconUrl;
        updated = true;
      }
      CURRENT_TABS_HASH[tabId].isLastStatusLoading = data.status == "loading";
    }

    // Don't update for this, just keep track.
    if ("favIconUrl" in data) {
      CURRENT_TABS_HASH[tabId].lastFavIconUrl = data.favIconUrl;
    }

    if (updated) {
      // TODO: Find a more efficient way of doing this, since we're only updating
      // a single item.
      OPTI_MENU.updateSingleMenuItem
        (manage.sanitizeMenuTextInCurrentMenuData(CURRENT_MENU_DATA), menuData.index);
    }
  },

  updateTabsCount() {
    // We're not waiting on anything here.
    browser.tabs.query({currentWindow: true}).then(tabsList => {
      let activeTabsCount = 0;
      for (let tab of tabsList) {
        if (!tab.discarded) {
          activeTabsCount++
        }
      }
      tabsCountContainer.textContent = tabsList.length + "/" + activeTabsCount;
    });
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
    browser.tabs.remove(tabIds);
  },

  /**
   *  Discard selected tabs.
   *
   *  tabIds : list of tab ids correlating to tabs to discard
   */
  async discardSelectedTabs(tabIds) {
    browser.expsessionstore.discardTabs(tabIds);
  },

  /**
   *  Move selected tabs.
   *
   *  tabIds : list of tab ids correlating to tabs to discard
   */
  async moveSelectedTabs(tabIds, targetTabId) {
    this.moveTabs(tabIds, targetTabId);
  },

  /**
   *  Cut selected tabs.
   *
   *  tabIds : list of tab ids correlating to tabs to "cut", meaning, putting them
   *  in a list to be moved.
   */
  async cutSelectedTabs(tabIds) {
    BPW.recordTabIds(JSON.stringify({ windowId: THIS_WINDOW_ID, tabIds }));
  },

  /**
   *  Paste cut tabs.
   *
   *  Move tabs from "cut" list to just after the hovered tab position.
   */
  async pasteCutTabs(index) {
    let { windowId, tabIds } = JSON.parse(BPW.getRecordedTabIds());

    if (!tabIds || ! tabIds.length) {
      return;
    }

    this.moveTabs(tabIds, index, windowId);
  },
}
