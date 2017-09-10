let menuModes = {
  // menuMode:
  // 0 : all
  // 1 : recent
  // 2 : dups
  // 3 : search
  menuMode: 0,

  // Flags for setChangeModeByModeIndex.
  isSetChangeModeTimerRunning: false,
  lastSetChangeMode: undefined,

  //////////////////////////////////////////////////////////////////////
  // MENU UTILS

  displayMessage(msg) {
    if (msg) {
      messageContainer.style.display = "block";
      messageContainer.textContent = msg;
    } else {
      messageContainer.style.display = "none";
    }
  },

  getActiveID() {
    for (let tabId of CURRENT_TABS_LIST) {
      let { active } = CURRENT_TABS_HASH[tabId].data.userDefined.properties;
      if (active) {
        return tabId;
      }
    }
    return null;
  },

  //////////////////////////////////////////////////////////////////////
  // UPDATE THE MENU

  // "ALL" MENU
  setAllMenu() {
    CURRENT_MENU_DATA = [];
    let len = CURRENT_TABS_LIST.length;
    for (let i=0;i<len;i++) {
      let tabId = CURRENT_TABS_LIST[i];
      let data = CURRENT_TABS_HASH[tabId];

      delete(data.userDefined.classes.divideritem);
      delete(data.userDefined.classes.searchresultmenuitem);

      CURRENT_MENU_DATA.push(data);
    }
    OPTI_MENU.updateMenu(CURRENT_MENU_DATA);
  },

  // "RECENT" MENU
  setRecentMenu() {
    CURRENT_MENU_DATA = [];
    let tRecent = globals.tabsRecentIdsArr;

    if (!tRecent.length) {
      // If there is nothing in tRecent, most likely it is because we just
      // started up.  We want to at least have the current tab in the list.
      let tabId = this.getActiveID();
      if (tabId) {
        tRecent.unshift(tabId);
      } else {
        return;
      }
    }

    let tabsRecentHash = {};
    let len = tRecent.length;
    for (let i=0;i<len;i++) {
      let tabId = tRecent[i];
      tabsRecentHash[tabId] = true;
      let data = CURRENT_TABS_HASH[tabId];

      // Sanity check - make sure tabId is still in the list.
      if (data) {
        delete(data.userDefined.classes.divideritem);
        delete(data.userDefined.classes.searchresultmenuitem);
        CURRENT_MENU_DATA.push(data);
      }
    }
    // Put a divider after the last recent item.
    CURRENT_MENU_DATA[CURRENT_MENU_DATA.length - 1]
        .userDefined.classes.divideritem = true;

    // Set remaining items in tabs order, skipping the tabId's we already listed.
    let len2 = CURRENT_TABS_LIST.length;
    for (let i=0;i<len2;i++) {
      let tabId = CURRENT_TABS_LIST[i];
      if (tabsRecentHash[tabId]) {
        continue;
      }
      let data = CURRENT_TABS_HASH[tabId];
      delete(data.userDefined.classes.divideritem);
      delete(data.userDefined.classes.searchresultmenuitem);
      CURRENT_MENU_DATA.push(data);
    }
    OPTI_MENU.updateMenu(CURRENT_MENU_DATA);
  },

  // "DUPS" MENU
  setDupsMenu() {
    CURRENT_MENU_DATA = [];
    let dupsHash = {};
    let dupsFoundArray = [];

    for (let tabId of CURRENT_TABS_LIST) {
      let data = CURRENT_TABS_HASH[tabId];

      let urlbase = data.userDefined.properties.url.replace(/\#.*/,'');
      if (!dupsHash[urlbase]) {
        dupsHash[urlbase] = [data];
      } else {
        // dup was found, record its url into the array.
        if (dupsHash[urlbase].length == 1) {
          dupsFoundArray.push(urlbase);
        }
        dupsHash[urlbase].push(data);
      }
    }

    if (!dupsFoundArray.length) {
      // No dups found.  Display message, update menu (to blank) and return.
      this.displayMessage("No dups found");
      OPTI_MENU.updateMenu(CURRENT_MENU_DATA);
      return;
    }

    let miCount = 0;
    for (let urlbase of dupsFoundArray) {
      let dups = dupsHash[urlbase];
      let len = dups.length;
      let last = len - 1;
      for (let i=0;i<len;i++) {
        let data = dups[i];
        data.userDefined.classes.divideritem = i == last;
        delete(data.userDefined.classes.searchresultmenuitem);
        CURRENT_MENU_DATA.push(data);
      }
    }
    OPTI_MENU.updateMenu(CURRENT_MENU_DATA);
  },

  // "SEARCH" MENU
  setSearchMenu() {
    search.initSearch();
  },

  /////////////////////////
  // MENU SETTING UTILITIES

  refreshCurrentMenu() {
    if (this.menuMode == 0) {
      this.setAllMenu();
    } else if (this.menuMode == 1) {
      this.setRecentMenu();
    } else if (this.menuMode == 2) {
      this.setDupsMenu();
    } else if (this.menuMode == 3) {
      this.setSearchMenu();
    }
  },

  setButtonAppearance(mode) {
    buttons.setAttribute("mode", mode);
  },

  modeChangeAll(force) {
    let prevMenuMode = this.menuMode;
    this.menuMode = 0;
    this.setButtonAppearance("all");
    // Clear message if there is one.
    this.displayMessage();

    if (prevMenuMode !== 0 || force) {
      this.setAllMenu();
    }
  },

  modeChangeRecent(force) {
    let prevMenuMode = this.menuMode;
    this.menuMode = 1;
    this.setButtonAppearance("recent");
    // Clear message if there is one.
    this.displayMessage();

    if (prevMenuMode != 1 || force) {
      this.setRecentMenu();
    }
  },

  modeChangeDups(force) {
    let prevMenuMode = this.menuMode;
    this.menuMode = 2;
    this.setButtonAppearance("dups");
    // Clear message if there is one.
    this.displayMessage();

    if (prevMenuMode != 2 || force) {
      this.setDupsMenu();
    }
  },

  modeChangeSearch() {
    let prevMenuMode = this.menuMode;
    this.menuMode = 3;
    this.setButtonAppearance("search");
    // Clear message if there is one.
    this.displayMessage();

    this.setSearchMenu();
  },

  setChangeModeByModeIndex(mode, execute) {
    // Rapid-fire suppression.
    // (uncomment for diagnostic override:)
    //execute = true;

    if (!execute) {
      if (!this.isSetChangeModeTimerRunning) {
        let _this = this;
        setTimeout(function() {
          _this.isSetChangeModeTimerRunning = false;
          // arg[1] (execute) will bypass everything and update with last index.
          _this.setChangeModeByModeIndex(_this.lastSetChangeMode, true)
        },200);
        this.isSetChangeModeTimerRunning = true;
      }
      if (typeof(mode) == "number") {
        this.lastSetChangeMode = mode;
      }
      return;
    }
    this.lastSetChangeMode = undefined;

    // If no args do a refresh;
    let refresh = typeof(mode) != "number";
    if (refresh) {
      mode = this.menuMode;
    }
    if (mode == 0) {
      this.modeChangeAll(refresh);
    } else if (mode == 1) {
      this.modeChangeRecent(refresh);
    } else if (mode == 2) {
      this.modeChangeDups(refresh);
    } else if (mode == 3) {
      this.modeChangeSearch(refresh);
    }
  },
}
