searchInput.addEventListener("input", onSearchInput)

let searchInputTimer = null;
let FindInitedTabs = {};
let searchResultsCache = {};
let currentlyDisplayedSearchResults = {};

const SEARCH_INPUT_TIMEOUT = 500;

function onSearchInput(evt) {
  if (menuMode == 1 || menuMode == 2) {
    return;
  }
  clearTimeout(searchInputTimer);
  searchInputTimer = setTimeout(function() {
    if (menuMode == 0) {
      filterItems();
    } else if (menuMode == 3) {
      initSearch();
    }
  }, SEARCH_INPUT_TIMEOUT);
}

function filterItems() {
  let value = searchInput.value.trim();
  let valueRegex = new RegExp(value, 'i');

  currentMenuData = [];
  let len = currentTabsList.length;
  for (let i=0;i<len;i++) {
    let tabId = currentTabsList[i];
    let data = currentTabsHash[tabId];
    if (valueRegex.test(data.userDefined.properties.tabtitle)) {
      delete(data.userDefined.classes.divideritem);
      currentMenuData.push(data);
    }
  }
  optiMenu.updateMenu(currentMenuData);
}

let lastSearchValue;
let searchResultsHash = {};

function initSearch() {
  currentMenuData = [];
  searchedTabs = {};

  let value = searchInput.value.trim();
  lastSearchValue = value;

  if (value.length < 2) {
    messageContainer.textContent = "Please enter 3 or more characters";
    messageContainer.style.display = "block";
    optiMenu.updateMenu(currentMenuData);
    return;
  }
  searchResultsHash = {};
  searchResultsCache = {};
  currentlyDisplayedSearchResults = {};

  searchTabsContent(value);
}

async function searchTabsContent(value) {
  let tabs = await getTabsInCurrentWindow();
  getContentsForTabs(tabs, value);
}

let cachedTextHash = {};
let currentSearchId;

async function getContentsForTabs(tabs, value) {
  let foundTextHash = {};
  let len = tabs.length;
  let searchId = Date.now();
  this.currentSearchId = searchId;
  let messageCount = 0;
  let resultFound = false;
  let interimFoundTextHash = {};

  for (let i = 0; i < len; i++) {
    let tab = tabs[i];

    // Only work on activated tabs.
    if (!BPG.tabsActivated[tab.id]) {
      continue;
    }

    // Abort if a new search was started while iterating this one.
    if (searchId != this.currentSearchId) {
      return;
    }

    let text;
    if (cachedTextHash[tab.id]) {
      text = cachedTextHash[tab.id];
    } else {
      try {
        let message = await browser.tabs.sendMessage(tab.id,
                  { topic: "alltabshelper:getTabContentText",
                    tabId: tab.id });
        text = message.contentText;
        cachedTextHash[tab.id] = text;
        messageCount++;
      } catch(e) {
        // Error here means the tab hasn't been loaded, and thus is not
        // searchable anyway.  Simply ignore.
      }
    }
    if (text && text.indexOf(value) > -1) {
      foundTextHash[tab.id] = true;
      resultFound = true;
    }
    // If a lot of messages are being processed update the menu intermittently,
    // so user isn't just staring at a blank menu.
    if (messageCount == 20) {
      updateMenuWithSearchResults(foundTextHash);
      // Reset foundTextHash so we don't duplicate menu items.
      foundTextHash = {};
      messageCount = 0;
    }
  }

  updateMenuWithSearchResults(foundTextHash);
  setSearchResultsFoundMessage(resultFound);
}

function updateMenuWithSearchResults(foundTextHash) {
  let len = currentTabsList.length;
  for (let i=0;i<len;i++) {
    let tabId = currentTabsList[i];
    if (foundTextHash[tabId]) {
      let data = currentTabsHash[tabId];
      data.userDefined.classes.searchresultmenuitem = true;
      delete(data.userDefined.classes.divideritem);
      delete(data.userDefined.classes.searchresults_collapse_icon);

      currentMenuData.push(data);
    }
  }
  optiMenu.updateMenu(currentMenuData);
}

function setSearchResultsFoundMessage(resultFound) {
  if (resultFound) {
    messageContainer.style.display = "none";
  } else {
    messageContainer.textContent = "No results found";
    messageContainer.style.display = "block";
  }
}

function toggleDisplaySearchResultsForTab(menuitem) {
  let { tabId } = menuitem;

  // Initialize results for this tab and cache them.
  if (!searchResultsCache[tabId]) {
    let results = getSearchResultsForTab(menuitem);
    searchResultsCache[tabId] = { results, count: results.length, showing: false };
  }

  let { results, count, showing } = searchResultsCache[tabId];

  // In **theory** count == 0 should never happen.
  if (count > 0) {
    let { index, data } = getCurrentMenuDataAtTabId(tabId);
    if (showing) {
      currentMenuData.splice(index + 1, count);
      searchResultsCache[tabId].showing = false;
      currentlyDisplayedSearchResults.tabId = undefined;
      delete(data.userDefined.classes.searchresults_collapse_icon);
    } else {
      currentMenuData.splice(index + 1, 0, ...results);
      data.userDefined.classes.searchresults_collapse_icon = true;

      let tabId2 = currentlyDisplayedSearchResults.tabId;
      if (tabId2 && tabId != tabId2) {
        let menuData2 = getCurrentMenuDataAtTabId(tabId2);
        let index2 = menuData2.index;
        let data2 = menuData2.data;
        let count2 = searchResultsCache[tabId2].count;
        currentMenuData.splice(index2 + 1, count2);
        searchResultsCache[tabId2].showing = false;
        delete(data.userDefined.classes.searchresults_collapse_icon);
      }

      searchResultsCache[tabId].showing = true;
      currentlyDisplayedSearchResults.tabId = tabId;
      currentlyDisplayedSearchResults.menuitem = menuitem;
    }
    optiMenu.updateMenu(currentMenuData);
  }
}

function getSearchResultsForTab(menuitem) {
  let { tabId } = menuitem;

  if(!searchResultsHash[tabId]) {
    getContextResultsForTab(tabId);
  }

  if (!searchResultsHash[tabId] ||
      !searchResultsHash[tabId].resultList.length) {
    return;
  }

  let resultList = searchResultsHash[tabId].resultList;
  let len = resultList.length;
  let results = []

  for (let i = 0; i < len; i++) {
    let result = resultList[i];
    // opti_menuitem_descendent class ensures that mouse events will be
    // associated with menuitem mouse events in OptiMenu.
    let resultHTML = result[0]+"<span class='searchresultkeyword opti_menuitem_descendent'>"+result[1]+"</span>"+result[2];
    results.push(defineSearchResultMenuitemProperties(resultHTML, tabId, i))
  }

  return results;
}

function defineSearchResultMenuitemProperties(resultHTML, tabId, rangeIndex) {
  return  { menutextstr: resultHTML,
            noPrefixIcon: true,
            noSuffixIcon: true,
            userDefined: {
              properties: {
                tabId,
                rangeIndex,
              },
              classes: {
                searchresult: true,
              }
            }
          };
}

function getContextResultsForTab(tabId) {
  let text = cachedTextHash[tabId]
  let result = searchTextAndExtractContext(lastSearchValue, text);
  searchResultsHash[tabId] = result;
}

function searchTextAndExtractContext(value, text) {
  // all searches are case insensitive.
  // That could become optional at some point.
  let textLower = text.toLowerCase();
  value = value.toLowerCase().trim();
  let valLen = value.length;

  if (textLower.indexOf(value) == -1) {
    return { resultsFound: false };
  } else {

    let valIdx = 0 - valLen;

    let posDataArr = [];
    let adFixLength = Math.floor(BPG.resultsContextLength / 2);

    let textLen = textLower.length;

    while(((valIdx = textLower.indexOf(value,valIdx+valLen)) > -1)) {

      let x1 = valIdx - adFixLength;
      let x2 = valIdx;
      let x3 = valIdx + valLen;
      let x4 = x3 + adFixLength;

      // make sure we are within the boundaries of the text
      x1 = Math.max(0,x1);
      x4 = Math.min(textLen,x4);

      posDataArr.push({ x1:x1,
                        x2:x2,
                        x3:x3,
                        x4:x4,
                        });

    }

    // we're done with this, free up resources right away
    delete(textLower);

    let first_tab_result = true;
    let resultList = [];

    for (let i=0;i<posDataArr.length;i++) {

      let posData = posDataArr[i];

      if (!posData) {
        continue;
      }

      let x1 = posData.x1;
      let x2 = posData.x2;
      let x3 = posData.x3;
      let x4 = posData.x4;

      let str1 = text.substr(x1,x2 - x1);
      let str2 = text.substr(x2,x3 - x2);
      let str3 = text.substr(x3,x4 - x3);

      resultList.push([str1,str2,str3,i]);
    }

    // we're done with this too now, free up resources right away
    delete(text);
    return { resultsFound: true, resultList: resultList };
  }
}

let searchResultsData;
let lastSearchParams = {};

async function findAndHighlight(tabId, rangeIndex) {
dump("findAndHighlight\n");
  let includeRangeData = false;
  let includeRectData = true;

  //let searchParams = { lastSearchValue,  }

  let hlmode = BPG.findHighlightingMode;
hlmode = 3;

  if (hlmode == 3) {
    await browser.tabs.sendMessage(tabId, { topic: "alltabshelper:clearCustomHighlighting" });
  }

  if (browser.find) {
    searchResultsData =
      await browser.find.find( lastSearchValue,
                                 { tabId, includeRangeData, includeRectData });
  } else {
    searchResultsData = findInPage(tabId, { queryphrase: lastSearchValue,
                                            caseSensitive: false,
                                            includeRangeData,
                                            includeRectData });
  }

  if (hlmode == 1) {
    await browser.find.highlightResults({ tabId, rangeIndex });
  } else if (hlmode == 4) {
    await browser.find.highlightResults({ tabId });
  }

  // TODO: scroll to range at rangeIndex

  FindInitedTabs[tabId] = true;
  let data = searchResultsData;

  if (includeRangeData) {
    await browser.tabs.sendMessage(tabId,
    {
      topic: "alltabshelper:getResultsContext",
      tabId: tabId,
      rangeData: data.rangeData
    });
  }
  if (includeRectData && (hlmode != 1)) {
    let topic = hlmode == 4 ? "alltabshelper:findBarTweakAnimate" : "alltabshelper:setCustomHighlighting";
    let overlay = hlmode == 3;
    await browser.tabs.sendMessage(tabId,
        { topic, tabId, rectData: data.rectData, currentResult: rangeIndex, overlay });
  }
}

function findInPage(queryphrase, data) {
  var { tabId, includeRangeData, includeRectData } = data;
  var response = browser.tabs.sendMessage(tabId,
  {
    message_nature: "get_results_context",
    data: { queryphrase: queryphrase,
            caseSensitive: caseSensitive,
            }
  }).then(function(response) {
dump("response from get_results_context\n");
  });
}
