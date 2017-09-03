// menuMode:
// 0 : all
// 1 : recent
// 2 : dups
// 3 : search
let menuMode = 0;

// Flags for setChangeModeByModeIndex.
let isSetChangeModeTimerRunning = false;
let lastSetChangeMode;

function setChangeModeByModeIndex(mode, execute) {
  // Rapid-fire suppression.
  // (uncomment for diagnostic override:)
  //execute = true;

  if (!execute) {
    if (!isSetChangeModeTimerRunning) {
      setTimeout(function() {
        isSetChangeModeTimerRunning = false;
        // arg[1] (execute) will bypass everything and update with last index.
        setChangeModeByModeIndex(lastSetChangeMode, true)
      },200);
      isSetChangeModeTimerRunning = true;
    }
    if (typeof(mode) == "number") {
      lastSetChangeMode = mode;
    }
    return;
  }
  lastSetChangeMode = undefined;

  // If no args do a refresh;
  let refresh = typeof(mode) != "number";
  if (refresh) {
    mode = menuMode;
  }
  if (mode == 0) {
    modeChangeAll(refresh);
  } else if (mode == 1) {
    modeChangeRecent(refresh);
  } else if (mode == 2) {
    modeChangeDups(refresh);
  } else if (mode == 3) {
    modeChangeSearch(refresh);
  }
}

// Flags for refreshCurrentMenu.
let isRefreshCurrentMenueTimerRunning = false;

function refreshCurrentMenu() {
  if (menuMode == 0) {
    setAllMenu();
  } else if (menuMode == 1) {
    setRecentMenu();
  } else if (menuMode == 2) {
    setDupsMenu();
  } else if (menuMode == 3) {
    setSearchMenu();
  }
}

function modeChangeAll(force) {
  let prevMenuMode = menuMode;
  menuMode = 0;
  setButtonAppearance("all");
  // Clear message if there is one.
  displayMessage();

  if (prevMenuMode !== 0 || force) {
    setAllMenu();
  }
}

let forceRecentMenuUpdateOkay = false;

function modeChangeRecent(force) {
  let prevMenuMode = menuMode;
  menuMode = 1;
  setButtonAppearance("recent");
  // Clear message if there is one.
  displayMessage();

  if (prevMenuMode != 1 || force || forceRecentMenuUpdateOkay) {
    setRecentMenu();
  }
}

function modeChangeDups(force) {
  let prevMenuMode = menuMode;
  menuMode = 2;
  setButtonAppearance("dups");
  // Clear message if there is one.
  displayMessage();

  if (prevMenuMode != 2 || force) {
    setDupsMenu();
  }
}

function modeChangeSearch() {
  let prevMenuMode = menuMode;
  menuMode = 3;
  setButtonAppearance("search");
  // Clear message if there is one.
  displayMessage();

  setSearchMenu();
}

//////////////////////////////////////////////////////////////////////
// SET BUTTON APPEARANCE

function setButtonAppearance(mode) {
  buttons.setAttribute("mode", mode);
}

//////////////////////////////////////////////////////////////////////
// UPDATE THE MENU

////////////////////
// "ALL" MENU

function setAllMenu() {
  currentMenuData = [];
  let len = currentTabsList.length;
  for (let i=0;i<len;i++) {
    let tabId = currentTabsList[i];
    let data = currentTabsHash[tabId];

    delete(data.userDefined.classes.divideritem);
    delete(data.userDefined.classes.searchresultmenuitem);
    cleanupAfterSearch(data);

    currentMenuData.push(data);
  }
  optiMenu.updateMenu(currentMenuData);
}

////////////////////
// "RECENT" MENU

function setRecentMenu() {
  currentMenuData = [];
  let tRecent = globals.tabsRecentIdsArr;

  if (!tRecent.length) {
    // If there is nothing in tRecent, most likely it is because we just
    // started up.  We want to at least have the current tab in the list.
    let tabId = getActiveID();
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
    let data = currentTabsHash[tabId];

    // Sanity check - make sure tabId is still in the list.
    if (data) {
      cleanupAfterSearch(data);
      delete(data.userDefined.classes.divideritem);
      delete(data.userDefined.classes.searchresultmenuitem);
      currentMenuData.push(data);
    }
  }
  // Put a divider after the last recent item.
  currentMenuData[currentMenuData.length - 1]
      .userDefined.classes.divideritem = true;

  // Set remaining items in tabs order, skipping the tabId's we already listed.
  let len2 = currentTabsList.length;
  for (let i=0;i<len2;i++) {
    let tabId = currentTabsList[i];
    if (tabsRecentHash[tabId]) {
      continue;
    }
    let data = currentTabsHash[tabId];
    delete(data.userDefined.classes.divideritem);
    delete(data.userDefined.classes.searchresultmenuitem);
    currentMenuData.push(data);
  }
  optiMenu.updateMenu(currentMenuData);
}

////////////////////
// "DUPS" MENU

function setDupsMenu() {
  currentMenuData = [];
  let dupsHash = {};
  let dupsFoundArray = [];

  for (let tabId of currentTabsList) {
    let data = currentTabsHash[tabId];
    cleanupAfterSearch(data);

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
    displayMessage("No dups found");
    optiMenu.updateMenu(currentMenuData);
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
      currentMenuData.push(data);
    }
  }
  optiMenu.updateMenu(currentMenuData);
}

////////////////////
// "SEARCH" MENU

function setSearchMenu() {
  initSearch();
}

//////////////////////////////////////////////////////////////////////
// MENU UTILS

function displayMessage(msg) {
  if (msg) {
    messageContainer.style.display = "block";
    messageContainer.textContent = msg;
  } else {
    messageContainer.style.display = "none";
  }
}

function getActiveID() {
  for (let tabId of currentTabsList) {
    let { active } = currentTabsHash[tabId].data.userDefined.properties;
    if (active) {
      return tabId;
    }
  }
  return null;
}

/**
 * cleanupAfterSearch
 * TODO: what to do with this?
 */
function cleanupAfterSearch(data) {
}

