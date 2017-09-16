let manage = {
  contextMenu: undefined,

  async updateTabsListAfterMove() {
  // TODO : Update the current tabs data based on prediction of the move instead
  // of waiting for exceedingly slow browser.tabs.query()?  (see bug 1322869)
  // TODO : Currently still allowing onMoved listener to also update the UI -
  // Should we implement an inhibitor?  We still want to update here because
  // it is more immediate/better UX.
    await this.updateCurrentTabsData();
    menuModes.setAllMenu();
  },

  menuActivityDDListener(e) {
    if(e.hybridType == "drop") {
      manage.handleMenuDrop(e);
      return;
    }
  },

  async handleMenuDrop(e) {
    let selectedData = e.opti_selectedMenuData;
    let menuitem = e.menuitem;

    if (!menuitem || !selectedData.length) {
      return;
    }

    let tabIds = selectedData.map(datum => datum.userDefined.properties.tabId);

    let index = CURRENT_TABS_HASH[menuitem.tabId].userDefined.properties.index;

dump("handleMenuDrop : index : "+index+"\n");

    tabs.moveTabs(tabIds, index);
  },

  menuActivityActionListener(e) {
    let menuitem = e.menuitem;
    let tabId = menuitem.tabId;

    if(e.hybridType == "menuitemclick") {
      // Force immediate update for actions done in the menu.
      tabs.updateForceTabsOnActivated[tabId] = true;
      browser.tabs.update(tabId, { active: true });

      // If we're clicking on a search result, highlight the result on the page.
      if (typeof(menuitem.rangeIndex) == "number") {
        search.findAndHighlight(tabId, menuitem.rangeIndex);
      }
      return;
    }
    if(e.hybridType == "action1click") {
      if (menuModes.menuMode == 3) {
        search.toggleDisplaySearchResultsForTab(menuitem)
        return;
      }

      // Force immediate update for actions done in the menu.
      tabs.updateForceTabsOnActivated[tabId] = true;
      browser.tabs.update(tabId, { active: true });
      return;
    }
    if(e.hybridType == "action2click") {
      // Force immediate update for actions done in the menu.
      tabs.updateForceTabsOnRemoved[tabId] = true;
      browser.tabs.remove(tabId);
      return;
    }
  },

  contextmenuShowingListener() {
    let selected = OPTI_MENU.getSelectedMenuData();
    let hasSelected = !!selected.length
    //if (!hasSelected) {
      let item = OPTI_MENU.freezeHoveredItem();
    //}
    manage.contextMenu.setDisabled({ "close_selected_tabs": !hasSelected,
                                     "discard_selected_tabs": !hasSelected,
                                     "move_selected_tabs": !hasSelected,
                                     "cut_selected_tabs": !hasSelected,
                                     "paste_cut_tabs": hasSelected ||
                                                       !BPW.getRecordedTabIds() ||
                                                       !JSON.parse(BPW.getRecordedTabIds()).tabIds.length,
                                  })
  },

  contextmenuHidingListener() {
    // Unfreeze main menu.
    OPTI_MENU.freezeHoveredItem(true);
    OPTI_MENU.select.clearMenuitemSelection();
  },

  contextmenuMousedownListener(target) {
    if (target.id == "paste_cut_tabs") {
      let hoveredItemIndex = OPTI_MENU.getFrozenHoveredItemIndex();
      if (typeof hoveredItemIndex == "number") {
        tabs.pasteCutTabs(hoveredItemIndex);
      }
      return;
    }

    let selectedData = OPTI_MENU.getSelectedMenuData();
    let tabIds = selectedData.map(datum => datum.userDefined.properties.tabId);
    switch(target.id) {
      case "close_selected_tabs":
        tabs.closeSelectedTabs(tabIds);
        break;
      case "discard_selected_tabs":
        tabs.discardSelectedTabs(tabIds);
        break;
      case "move_selected_tabs":
        let hoveredItemIndex = OPTI_MENU.getFrozenHoveredItemIndex();
        if (typeof hoveredItemIndex == "number") {
          tabs.moveTabs(tabIds, hoveredItemIndex);
        }
        break;
      case "cut_selected_tabs":
        tabs.cutSelectedTabs(tabIds);
        break;
    }
  },

  getTabsInCurrentWindow() {
    return browser.tabs.query({ currentWindow: true });
  },

  setCurrentTabsHashItem(tab) {
//dump("setCurrentTabsHashItem :\n    tab.index : "+tab.index+"\n    tab.id : "+tab.id+"\n    tab.active : "+tab.active+"\n    tab.title : "+tab.title+"\n    tab.url : "+tab.url+"\n    tab.favIconUrl : "+tab.favIconUrl+
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
  },

  updateCurrentTabsData() {
    return new Promise(async function(resolve) {
      let tabs = await manage.getTabsInCurrentWindow();
      CURRENT_TABS_LIST = [];
      CURRENT_TABS_HASH = {};

      for (let tab of tabs) {
        CURRENT_TABS_HASH[tab.id] = manage.setCurrentTabsHashItem(tab);
        CURRENT_TABS_LIST.push(tab.id);
      }
      resolve();
    });
  },

  async initTabsMenu(currentMode) {
    await this.updateCurrentTabsData();
    let menuMode = BPW.getMenuMode(THIS_WINDOW_ID);
    menuModes.setChangeModeByModeIndex(menuMode);
  },

  initContextMenuItems() {
    let items = [
                  { text: "Close selected tabs", id: "close_selected_tabs" },
                  { text: "Unload selected tabs", id: "discard_selected_tabs" },
                  { text: "Move selected tabs to", id: "move_selected_tabs" },
                  { menuseparator: true },
                  { text: "Record selected tabs for moving", id: "cut_selected_tabs" },
                  { text: "Move recorded tabs to", id: "paste_cut_tabs" },
                  ];
    this.contextMenu.addItems(items);
  },

  initManage() {
    browser.tabs.onActivated.addListener(tabs.tabsOnActivatedListener);
    browser.tabs.onCreated.addListener(tabs.tabsOnCreatedListener);
    browser.tabs.onRemoved.addListener(tabs.tabsOnRemovedListener);
    browser.tabs.onMoved.addListener(tabs.tabsOnMovedListener);
    browser.tabs.onDetached.addListener(tabs.tabsOnDetachedListener);
    browser.tabs.onUpdated.addListener(tabs.tabsOnUpdatedListener);

    OPTI_MENU = new OptiMenu(tabsMenuCntnr, window);
    OPTI_MENU.addActivityDDListener(this.menuActivityDDListener);
    OPTI_MENU.addActivityActionListener(this.menuActivityActionListener);

    this.initTabsMenu(false);

    // Side-car assistant to scroll menu while hovering/dragging.  See
    // documentation in 029_hover_scroll_assistant.js.
    DRAG_SCROLL_ASSISTANT =
      new DragScrollAssistant(tabsMenuCntnr, topHoverDetector, bottomHoverDetector);

    this.contextMenu = new ContextMenu(window);
    this.contextMenu.addContextmenuMousedownListener(this.contextmenuMousedownListener);
    this.contextMenu.addContextmenuShowingListener(this.contextmenuShowingListener);
    this.contextMenu.addContextmenuHidingListener(this.contextmenuHidingListener);
    this.initContextMenuItems();
  },

  getCurrentMenuDataAtTabId(tabId) {
    let len = CURRENT_MENU_DATA.length;
    for (let index = 0; index < len; index++) {
      let data = CURRENT_MENU_DATA[index];
      if (data.userDefined.properties.tabId == tabId) {
        return { index, data };
      }
    }
  },
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS

document.addEventListener("click", function(e) {
  if (e.button != 0) { return; }

  if (e.target.id == "buttonall") {
    menuModes.modeChangeAll();
    return;
  }
  if (e.target.id == "buttonrecent") {
    menuModes.modeChangeRecent();
    return;
  }
  if (e.target.id == "buttondups") {
    menuModes.modeChangeDups();
    return;
  }
  if (e.target.id == "buttonsearch") {
    menuModes.modeChangeSearch();
    return;
  }
});

