async function dumpTabToMenuitemRelationship() {
  dump("dumpTabToMenuitemRelationship:\n");
  dump("        tab.index  mi.index    tab.id     mi.id\n");
  let menuitems = tabsMenuCntnr.childNodes
  let tabs = await getTabsInCurrentWindow();
  let len = tabs.length;

  for (let i=0;i<len;i++) {
    let tab = tabs[i];
    let menuitem = menuitems[i];
    dump("    >>> "+tab.index+"          "+menuitem.index+"           "+tab.id+"          "+menuitem.tabId+"\n");
  }
}

function dumpTabsRecent() {
  dump("dumpTabsRecent\n");
  let tRecent = globals.tabsRecentIdsArr;
  for (let i=0;i<tRecent.length;i++) {
    let tabId = tRecent[i];
    dump("    >> "+currentTabsHash[tabId].index+"    "+tabId+"    "+currentTabsHash[tabId].menutextstr+"\n");
  }
}

function dumpCurrentMenuData(currentMenuData) {
  dump("dumpCurrentMenuData\n");
  for (let datum of currentMenuData) {
    let { tabId, menutextstr } = datum.data;
    dump("    >> "+tabId+"    "+menutextstr+"\n");
  }
}

function dumpTabsListPropertiesAndOrder() {
  dump("dumpTabsListPropertiesAndOrder\n");
  let menuitems = tabsMenuCntnr.childNodes;
  let len = menuitems.length - 1;
  for (let i=1;i<len;i++) {
    let menuitem = menuitems[i];
    dump("    index : "+menuitem.index+"    tabId : "+menuitem.tabId+"    title : "+menuitem.tabtitle+"    isDivideritem : "+menuitem.classList.contains("divideritem")+"\n");
  }
}

function waitForTimeout(timeout) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

