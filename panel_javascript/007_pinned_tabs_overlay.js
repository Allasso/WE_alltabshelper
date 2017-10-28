function PinnedTabsOverlay(pinnedTabsCntnr, win) {
  this.window = win;
  this.pinnedTabsCntnr = pinnedTabsCntnr;

  this.init();
}

PinnedTabsOverlay.prototype = {
  init(selectedPlusHover) {
    this.pinnedTabsCntnr.addEventListener("click", this);
    this.window.addEventListener("contextmenu", this);
  },

  activityActionListeners: [],
  activityActionListenersMap: new WeakMap(),

  addActivityActionListener(callback) {
    if (this.activityActionListenersMap[callback]) {
      return;
    }
    this.activityActionListenersMap[callback];
    this.activityActionListeners.push(callback);
  },

  removeActivityActionListener(callback) {
    if (this.activityActionListenersMap[callback]) {
      return;
    }
  },

  callActivityActionListeners(e) {
    for (let listener of this.activityActionListeners) {
      listener(e);
    }
  },

  updatePinnedTabsOverlay(hide) {
    if (hide) {
      pinnedTabsOverlayContainer.style.display = "none";
      return;
    }

    let { top, left } = tabsMenuCntnr.getBoundingClientRect();

    pinnedTabsOverlayContainer.innerHTML = "";
    let frag = document.createDocumentFragment();

    let len = CURRENT_MENU_DATA.length;
    for (let i = 0; i < len; i++ ) {
      let data = CURRENT_MENU_DATA[i];
      if (data.userDefined.classes.tabpinned) {
        let menuitem = OPTI_MENU.createMenuitem();
        OPTI_MENU.setMenuitemProperties(menuitem, data, i);
        frag.appendChild(menuitem);
      } else {
        break;
      }
    }

    pinnedTabsOverlayContainer.style.top = top + "px";
    pinnedTabsOverlayContainer.style.left = left + "px";
    pinnedTabsOverlayContainer.appendChild(frag);
    pinnedTabsOverlayContainer.style.display = "unset";
  },

  handleEvent(e) {
    let target = e.target;

    switch(e.type) {
      case 'click':
        if (e.button != 0 || this.frozenHoveredItem) {
          return;
        }

        let menuitem;

        // "opti_menuicon1" and "opti_menuicon2" must precede "opti_menuitem" as they would
        // also trigger a menuitem click.

        if (target.className == "opti_menuicon1") {
          menuitem = target.opti_menuitem;

          e.hybridType = "action1click";
          e.menuitem = menuitem;
          this.callActivityActionListeners(e);

          // Hack alert!
          this.window.setTimeout(() => {
            this.updatePinnedTabsOverlay();
          }, 100);

          return;
        }

        if (target.className == "opti_menuicon2") {
          menuitem = target.opti_menuitem;

          e.hybridType = "action2click";
          e.menuitem = menuitem;
          this.callActivityActionListeners(e);

          return;
        }

        if (target.opti_menuitem || target.isOptiMenuitem) {
          menuitem = target.opti_menuitem || target;
        }

        if (menuitem) {
          e.hybridType = "menuitemclick";
          e.menuitem = menuitem;
          this.callActivityActionListeners(e);

          // Hack alert!
          this.window.setTimeout(() => {
            this.updatePinnedTabsOverlay();
          }, 100);

          return;
        }

        this.callActivityMouseListeners(e);
        break;
      case 'contextmenu':
        e.preventDefault();
        break;
    }
  },
}
