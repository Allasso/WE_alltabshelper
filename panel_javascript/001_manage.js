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

      // If we're in search mode and not clicking on a search result,
      // toggle displaying search results for that tab.
      if (menuModes.menuMode == 3 && typeof(menuitem.rangeIndex) != "number") {
        search.toggleDisplaySearchResultsForTab(menuitem)
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

  PTOActivityActionListener(e) {
    let menuitem = e.menuitem;
    let tabId = menuitem.tabId;

    if((e.hybridType == "menuitemclick" || e.hybridType == "action1click") &&
       !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
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
    OPTI_MENU.freezeHoveredItem();
    let selected = OPTI_MENU.getSelectedMenuData();
    let hasSelected = !!selected.length
    manage.contextMenu.setDisabled({ "close_selected_tabs": !hasSelected,
                                     "discard_selected_tabs": !hasSelected,
                                     "move_selected_tabs": !hasSelected,
                                     "cut_selected_tabs": !hasSelected,
                                     "paste_cut_tabs": hasSelected ||
                                                       (BPW ? (!BPW.getRecordedTabIds() || !JSON.parse(BPW.getRecordedTabIds()).tabIds.length) :
                                                       !tabs.recordedTabIds.length),
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
      case "open_preferences":
        browser.runtime.openOptionsPage();
        /*
        let createData = {
          url: "../options_html/options.html",
          type: "popup",
          width: 400,
          height: 300,
          left: 0,
          top: 0,
        };
        browser.windows.create(createData);
        */
        break;
    }
  },

  getTabsInCurrentWindow() {
    return browser.tabs.query({ currentWindow: true });
  },

  setCurrentTabsHashItem(tab) {
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
                 // TODO: explicitly setting rangeIndex to false is a hack to
                 // compensate for the fact that userDefined.properties get set
                 // on menuitems directly in OptiMenu.  Since rangeIndex will get
                 // set if a menuitem hosts a search result, if the menuitem is
                 // then used for a tab it will never get cleared unless rangeIndex
                 // is explicitly false.  See TODO documentation in
                 // OptiMenu.setMenuitemProperties for more details.
                 rangeIndex: false,
               },
               classes: {
                 activetab: tab.active,
                 tabdiscarded: tab.discarded,
                 tabpinned: tab.pinned,
               }
             }
           };
  },

  updateCurrentTabsData() {
    return new Promise(async function(resolve) {
      let tabsList = await manage.getTabsInCurrentWindow();
      CURRENT_TABS_LIST = [];
      CURRENT_TABS_HASH = {};

      for (let tab of tabsList) {
        CURRENT_TABS_HASH[tab.id] = manage.setCurrentTabsHashItem(tab);
        CURRENT_TABS_LIST.push(tab.id);
      }
      tabs.updateTabsCount();
      resolve();
    });
  },

  sanitizeMenuTextInCurrentMenuData(currentMenuData) {
    // TODO: this is a temporary fix for a much bigger issue,
    // where I am trying to get rid of using innerHTML in OptiMenu.
    // For the time being, value for menutextstr is strictly a string (even from
    // search) and will be set in OptiMenu using textContent (not innerHTML),
    // thus we are not using any HTML in menutextstr.
    return currentMenuData;

    /*
    let newData = [];
    let len = currentMenuData.length;
    for (let i = 0; i < len; i++) {
      let item = currentMenuData[i];
      let newItem = {};
      for (let name in item) {
        // Don't sanitize for search result item - we're using the HTML here.
        if (name == "menutextstr") {
          newItem[name] = item[name].replace(/&/g, "&amp;")
                                    .replace(/</g, "&lt;")
                                    .replace(/>/g, "&gt;")
                                    .replace(/HTMLAMPSND/g, "&")
                                    .replace(/HTMLLESSTHAN/g, "<")
                                    .replace(/HTMLGREATERTHAN/g, ">");
        } else {
          newItem[name] = item[name];
        }
      }
      newData.push(newItem);
    }
    
    return newData;
    */
  },
  
  async initTabsMenu() {
    await this.updateCurrentTabsData();
    let menuMode = BPW.getMenuMode(THIS_WINDOW_ID);
    menuModes.setChangeModeByModeIndex(menuMode);
  },

  initContextMenuItems() {
    let items;
    if ("discard" in browser.tabs) {
      items = [
                  { text: "Close selected tabs", id: "close_selected_tabs" },
                  { text: "Suspend selected tabs", id: "discard_selected_tabs" },
                  { text: "Move selected tabs here", id: "move_selected_tabs" },
                  { menuseparator: true },
                  { text: "Record selected tabs for moving", id: "cut_selected_tabs" },
                  { text: "Move recorded tabs here", id: "paste_cut_tabs" },
                  { menuseparator: true },
                  { text: "Open preferences", id: "open_preferences" },
                  ];
    } else {
      items = [
                  { text: "Close selected tabs", id: "close_selected_tabs" },
                  { text: "Move selected tabs here", id: "move_selected_tabs" },
                  { menuseparator: true },
                  { text: "Record selected tabs for moving", id: "cut_selected_tabs" },
                  { text: "Move recorded tabs here", id: "paste_cut_tabs" },
                  { menuseparator: true },
                  { text: "Open preferences", id: "open_preferences" },
                  ];
    }
    this.contextMenu.addItems(items);
  },

  onStorageChange(changes, areaName) {
    if ("alltabshelper:pref_bool_fayt" in changes) {
      FAYT = changes["alltabshelper:pref_bool_fayt"].newValue;
    } else if ("alltabshelper:pref_bool_show_remaining_tabs_in_recent" in changes) {
      PREF_SHOW_REMAINING_TABS_IN_RECENT = changes["alltabshelper:pref_bool_show_remaining_tabs_in_recent"].newValue;
    }
  },

  onKeydown(e) {
    if (FAYT && document.activeElement != searchInput) {
      searchInput.focus();
    }
  },

  async initManage() {
    IS_BROWSER_ACTION_POPUP = !!document.getElementById("browser_action_popup_identifier");
      
    browser.tabs.onActivated.addListener(tabs.tabsOnActivatedListener);
    browser.tabs.onCreated.addListener(tabs.tabsOnCreatedListener);
    browser.tabs.onRemoved.addListener(tabs.tabsOnRemovedListener);
    browser.tabs.onMoved.addListener(tabs.tabsOnMovedListener);
    browser.tabs.onDetached.addListener(tabs.tabsOnDetachedListener);
    browser.tabs.onUpdated.addListener(tabs.tabsOnUpdatedListener);
    
    window.addEventListener("keydown", this.onKeydown, true);

    OPTI_MENU = new OptiMenu(tabsMenuCntnr, window);
    OPTI_MENU.addActivityDDListener(this.menuActivityDDListener);
    OPTI_MENU.addActivityActionListener(this.menuActivityActionListener);

    PINNED_TABS_OVERLAY = new PinnedTabsOverlay(pinnedTabsOverlayContainer, window);
    PINNED_TABS_OVERLAY.addActivityActionListener(this.PTOActivityActionListener);

    this.initTabsMenu();

    // Side-car assistant to scroll menu while hovering/dragging.  See
    // documentation in 029_hover_scroll_assistant.js.
    DRAG_SCROLL_ASSISTANT =
      new DragScrollAssistant(tabsMenuCntnr, topHoverDetector, bottomHoverDetector);

    this.contextMenu = new ContextMenu(window);
    this.contextMenu.addContextmenuMousedownListener(this.contextmenuMousedownListener);
    this.contextMenu.addContextmenuShowingListener(this.contextmenuShowingListener);
    this.contextMenu.addContextmenuHidingListener(this.contextmenuHidingListener);
    this.initContextMenuItems();
    
    browser.storage.onChanged.addListener(this.onStorageChange);
    
    let storage = await browser.storage.local.get();
    
    FAYT = storage["alltabshelper:pref_bool_fayt"];
    PREF_SHOW_REMAINING_TABS_IN_RECENT = storage["alltabshelper:pref_bool_show_remaining_tabs_in_recent"];
    PREF_PERSIST_ALLTABS_MENU_ACTIVE_TAB = storage["alltabshelper:pref_bool_persist_alltabs_menu_active_tab"];
    
    let customCSSText = "";
    
    if (IS_BROWSER_ACTION_POPUP && "alltabshelper:pref_int_number_input_browser_action_popup_width" in storage) {
      let value = storage["alltabshelper:pref_int_number_input_browser_action_popup_width"];
      customCSSText += "#tabsmenucontainer { width: "+value+"px; }\n";
    }
    
    if (storage["alltabshelper:pref_bool_use_larger_menu_text"]) {
      customCSSText += ".opti_menuitem > .opti_menutext { font-size: 13.5px !important; }\n";
    }
    
    if (customCSSText) {
      let styleElem = document.createElement("style");
      styleElem.id = "dynamic_css_custom";
      document.head.appendChild(styleElem);    
      styleElem.textContent = customCSSText;
    }

    setTimeout(() => {
      window.focus();
    }, 1000);
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

  ensureTabIsVisible(tabId) {
    let { index } = this.getCurrentMenuDataAtTabId(tabId);
    let margin = pinnedTabsOverlayContainer.childNodes.length;
    OPTI_MENU.ensureIndexIsVisible(index, margin);
  },
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS

document.addEventListener("click", function(e) {
  if (e.button != 0) { return; }

  if (e.target.id == "buttonall") {
    menuModes.setChangeModeByModeIndex(0);
    return;
  }
  if (e.target.id == "buttonrecent") {
    menuModes.setChangeModeByModeIndex(1);
    return;
  }
  if (e.target.id == "buttondups") {
    menuModes.setChangeModeByModeIndex(2);
    return;
  }
  if (e.target.id == "buttonsearch") {
    menuModes.setChangeModeByModeIndex(3);
    return;
  }
});
