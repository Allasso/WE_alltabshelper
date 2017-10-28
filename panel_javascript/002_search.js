let search = {
  searchInputTimer: null,
  searchResultsCache: {},
  currentlyDisplayedSearchResults: {},
  SEARCH_INPUT_TIMEOUT: 500,
  filterMode: false,

  filterItems() {
    let value = searchInput.value.trim();

    PINNED_TABS_OVERLAY.updatePinnedTabsOverlay(!!value);

    let valueRegex = new RegExp(value, 'i');

    CURRENT_MENU_DATA = [];
    let len = CURRENT_TABS_LIST.length;
    for (let i=0;i<len;i++) {
      let tabId = CURRENT_TABS_LIST[i];
      let data = CURRENT_TABS_HASH[tabId];
      if (valueRegex.test(data.userDefined.properties.tabtitle) ||
          valueRegex.test(data.userDefined.properties.url)) {
        delete(data.userDefined.classes.divideritem);
        CURRENT_MENU_DATA.push(data);
      }
    }
    OPTI_MENU.updateMenu(manage.sanitizeMenuTextInCurrentMenuData(CURRENT_MENU_DATA));
    this.filterMode = true;
  },

  lastSearchValue: undefined,
  searchResultsHash: {},

  initSearch() {
    CURRENT_MENU_DATA = [];
    searchedTabs = {};

    let value = searchInput.value.trim();
    this.lastSearchValue = value;
    BPG.lastSearchValue = value;

    if (value.length < 2) {
      messageContainer.textContent = "Please enter 3 or more characters";
      messageContainer.style.display = "block";
      OPTI_MENU.updateMenu([]);
      return;
    }
    this.searchResultsHash = {};
    this.searchResultsCache = {};
    this.currentlyDisplayedSearchResults = {};

    this.searchTabsContent(value);
  },

  onSearchInput(evt) {
    if (menuModes.menuMode == 1 || menuModes.menuMode == 2) {
      return;
    }

    clearTimeout(search.searchInputTimer);
    this.searchInputTimer = setTimeout(function() {
      if (menuModes.menuMode == 0) {
        search.filterItems();
      } else if (menuModes.menuMode == 3) {
        search.initSearch();
      }
    }, search.SEARCH_INPUT_TIMEOUT);
  },

  async searchTabsContent(value) {
    let tabs = await manage.getTabsInCurrentWindow();
    this.getContentsForTabs(tabs, value);
  },

  cachedTextHash: {},
  currentSearchId: undefined,

  async getContentsForTabs(tabs, value) {
    let foundTextHash = {};
    let len = tabs.length;
    let messageCount = 0;
    let resultFound = false;
    let interimFoundTextHash = {};
    let searchId = Date.now();
    this.currentSearchId = searchId;

    for (let i = 0; i < len; i++) {
      let tab = tabs[i];

      // Only work on activated tabs; especially, avoid instantiating lazy tabs.
      if (tab.discarded) {
        continue;
      }

      // Abort if a new search was started while iterating this one.
      if (searchId != this.currentSearchId) {
        return;
      }

      let text;
      if (this.cachedTextHash[tab.id]) {
        text = this.cachedTextHash[tab.id];
      } else {
        try {
          let message = await browser.tabs.sendMessage(tab.id,
                    { topic: "alltabshelper:getTabContentText",
                      tabId: tab.id });
          text = message.contentText;
          this.cachedTextHash[tab.id] = text;
          messageCount++;
        } catch(e) {
          // Error here means the tab hasn't been loaded, and thus is not
          // searchable anyway.  Simply ignore.
        }
      }
      if (text && text.toLowerCase().indexOf(value.toLowerCase()) > -1) {
        foundTextHash[tab.id] = true;
        resultFound = true;
      }
      // If a lot of messages are being processed update the menu intermittently,
      // so user isn't just staring at a blank menu.
      if (messageCount == 20) {
        this.updateMenuWithSearchResults(foundTextHash);
        // Reset foundTextHash so we don't duplicate menu items.
        foundTextHash = {};
        messageCount = 0;
      }
    }

    this.updateMenuWithSearchResults(foundTextHash);
    this.setSearchResultsFoundMessage(resultFound);
  },

  updateMenuWithSearchResults(foundTextHash) {
    let len = CURRENT_TABS_LIST.length;
    for (let i=0;i<len;i++) {
      let tabId = CURRENT_TABS_LIST[i];
      if (foundTextHash[tabId]) {
        let data = CURRENT_TABS_HASH[tabId];
        data.userDefined.classes.searchresultmenuitem = true;
        delete(data.userDefined.classes.divideritem);
        delete(data.userDefined.classes.searchresults_collapse_icon);

        CURRENT_MENU_DATA.push(data);
      }
    }
    OPTI_MENU.updateMenu(manage.sanitizeMenuTextInCurrentMenuData(CURRENT_MENU_DATA));
  },

  setSearchResultsFoundMessage(resultFound) {
    if (resultFound) {
      messageContainer.style.display = "none";
    } else {
      messageContainer.textContent = "No results found";
      messageContainer.style.display = "block";
    }
  },

  toggleDisplaySearchResultsForTab(menuitem) {
    let { tabId } = menuitem;

    // Initialize results for this tab and cache them.
    if (!this.searchResultsCache[tabId]) {
      let results = this.getSearchResultsForTab(menuitem);
      this.searchResultsCache[tabId] = { results, count: results.length, showing: false };
    }

    let { results, count, showing } = this.searchResultsCache[tabId];

    // In **theory** count == 0 should never happen.
    if (count > 0) {
      let { index, data } = manage.getCurrentMenuDataAtTabId(tabId);
      if (showing) {
        CURRENT_MENU_DATA.splice(index + 1, count);
        this.searchResultsCache[tabId].showing = false;
        this.currentlyDisplayedSearchResults.tabId = undefined;
        delete(data.userDefined.classes.searchresults_collapse_icon);
      } else {
        CURRENT_MENU_DATA.splice(index + 1, 0, ...results);
        data.userDefined.classes.searchresults_collapse_icon = true;

        let tabId2 = this.currentlyDisplayedSearchResults.tabId;
        if (tabId2 && tabId != tabId2) {
          let menuData2 = manage.getCurrentMenuDataAtTabId(tabId2);
          let index2 = menuData2.index;
          let data2 = menuData2.data;
          let count2 = this.searchResultsCache[tabId2].count;
          CURRENT_MENU_DATA.splice(index2 + 1, count2);
          this.searchResultsCache[tabId2].showing = false;
          delete(data.userDefined.classes.searchresults_collapse_icon);
        }

        this.searchResultsCache[tabId].showing = true;
        this.currentlyDisplayedSearchResults.tabId = tabId;
        this.currentlyDisplayedSearchResults.menuitem = menuitem;
      }
      OPTI_MENU.updateMenu(manage.sanitizeMenuTextInCurrentMenuData(CURRENT_MENU_DATA));
    }
  },

  getSearchResultsForTab(menuitem) {
    let { tabId } = menuitem;

    if(!this.searchResultsHash[tabId]) {
      this.getContextResultsForTab(tabId);
    }

    if (!this.searchResultsHash[tabId] ||
        !this.searchResultsHash[tabId].resultList.length) {
      return;
    }

    let resultList = this.searchResultsHash[tabId].resultList;
    let len = resultList.length;
    let results = []

    for (let i = 0; i < len; i++) {
      let result = resultList[i];
      // Wrap query string with span tag for styling.  HTML syntax is encoded
      // so sanitizer won't sanitize but instead replace with appropriate syntax.
      // opti_menuitem_descendent class ensures that mouse events will be
      // associated with menuitem mouse events in OptiMenu.
      let resultHTML = result[0]+
                       "HTMLLESSTHANspan class='searchresultkeyword opti_menuitem_descendent'HTMLGREATERTHAN"+
                       result[1]+
                       "HTMLLESSTHAN/spanHTMLGREATERTHAN"+
                       result[2];
      results.push(this.defineSearchResultMenuitemProperties(resultHTML, tabId, i))
    }

    return results;
  },

  defineSearchResultMenuitemProperties(resultHTML, tabId, rangeIndex) {
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
  },

  getContextResultsForTab(tabId) {
    let text = this.cachedTextHash[tabId]
    let result = this.searchTextAndExtractContext(this.lastSearchValue, text);
    this.searchResultsHash[tabId] = result;
  },

  searchTextAndExtractContext(value, text) {
    // all searches are case insensitive.
    // That could become optional at some point.
    let textLower = text.toLowerCase();
    value = value.toLowerCase().trim();
    let valLen = value.length;

    if (textLower.indexOf(value) == -1) {
      return { resultList: null };
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
      return { resultList };
    }
  },

  searchResultsData: undefined,

  async findAndHighlight(tabId, rangeIndex) {
    let includeRangeData = false;
    let hlmode = BPG.findHighlightingMode;
    let includeRectData = hlmode != 1;

    if (hlmode == 3) {
      await browser.tabs.sendMessage(tabId, { topic: "alltabshelper:clearCustomHighlighting" });
    }

    // TODO: Cache results.
    this.searchResultsData =
      await browser.find.find(this.lastSearchValue,
                              { tabId, includeRangeData, includeRectData });

    if (hlmode == 1) {
      await browser.find.highlightResults({ tabId, rangeIndex });
    } else if (hlmode == 4) {
      await browser.find.highlightResults({ tabId });
    }

    let data = this.searchResultsData;

    if (includeRangeData) {
      await browser.tabs.sendMessage(tabId,
      {
        topic: "alltabshelper:getResultsContext",
        tabId: tabId,
        rangeData: data.rangeData
      });
    }
    if (includeRectData) {
      let topic = hlmode == 4 ? "alltabshelper:findBarTweakAnimate" : "alltabshelper:setCustomHighlighting";
      let overlay = hlmode == 3;
      await browser.tabs.sendMessage(tabId,
          { topic, tabId, rectData: data.rectData, currentResult: rangeIndex, overlay });
    }
  },
}

searchInput.addEventListener("input", search.onSearchInput);
