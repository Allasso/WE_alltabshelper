let devUtils = {
  async dumpTabToMenuitemRelationship() {
    dump("dumpTabToMenuitemRelationship:\n");
    dump("        tab.index  mi.index    tab.id     mi.id\n");
    let menuitems = tabsMenuCntnr.childNodes
    let tabs = await manage.getTabsInCurrentWindow();
    let len = tabs.length;

    for (let i=0;i<len;i++) {
      let tab = tabs[i];
      let menuitem = menuitems[i];
      dump("    >>> "+tab.index+"          "+menuitem.index+"           "+tab.id+"          "+menuitem.tabId+"\n");
    }
  },

  dumpTabsRecent() {
    dump("dumpTabsRecent\n");
    let tRecent = globals.tabsRecentIdsArr;
    for (let i=0;i<tRecent.length;i++) {
      let tabId = tRecent[i];
      dump("    >> "+CURRENT_TABS_HASH[tabId].index+"    "+tabId+"    "+CURRENT_TABS_HASH[tabId].menutextstr+"\n");
    }
  },

  dumpCurrentMenuData(CURRENT_MENU_DATA) {
    dump("dumpCurrentMenuData\n");
    for (let datum of CURRENT_MENU_DATA) {
      let { tabId, menutextstr } = datum.data;
      dump("    >> "+tabId+"    "+menutextstr+"\n");
    }
  },

  dumpTabsListPropertiesAndOrder() {
    dump("dumpTabsListPropertiesAndOrder\n");
    let menuitems = tabsMenuCntnr.childNodes;
    let len = menuitems.length - 1;
    for (let i=1;i<len;i++) {
      let menuitem = menuitems[i];
      dump("    index : "+menuitem.index+"    tabId : "+menuitem.tabId+"    title : "+menuitem.tabtitle+"    isDivideritem : "+menuitem.classList.contains("divideritem")+"\n");
    }
  },

  waitForTimeout(timeout) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, timeout);
    });
  },
}
