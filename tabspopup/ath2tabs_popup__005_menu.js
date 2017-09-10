function OptiMenu(menuCntnr, win, selectedPlusHover) {
  this.window = win;
  this.menuCntnr = menuCntnr;

  this.init(selectedPlusHover);
}

OptiMenu.prototype = {
  miHeight: 0,
  _currentMenuData: [],
  currentMenuFillTotalHeight: 0,
  currentMenuMaxScroll: 0,
  currentMenuMaxTopIndex: 0,
  menuprespacer: null,
  menupostspacer: null,
  menuCntnr: null,
  wheelScrollDistance: 18,
  prevItemsCount: 0,
  currentIndex: 0,

  activityDDListeners: [],
  activityDDListenersMap: new WeakMap(),
  activityMouseListeners: [],
  activityMouseListenersMap: new WeakMap(),
  activityActionListeners: [],
  activityActionListenersMap: new WeakMap(),

  init(selectedPlusHover) {
    this.select._optiMenu = this;
    this.select.menuCntnr = this.menuCntnr;
    this.select.menuCntnr = this.menuCntnr;
    this.dragDrop._optiMenu = this;
    this.dragDrop.menuCntnr = this.menuCntnr;

    this.menuCntnr.className = "opti_menu_outer_container";
    if (selectedPlusHover) {
      this.menuCntnr.classList.add("opti_isselectedplushover");
    }

    // Create a menuitem and add it to the DOM, then get computedStyle height.
    // We'll use this for calculating menu spacial data.
    let menuitemInitial = this.createMenuitem();

    this.menuCntnr.appendChild(menuitemInitial);
    let miRect = menuitemInitial.getBoundingClientRect();
    this.miHeight = miRect.bottom - miRect.top;
    this.menuCntnr.removeChild(menuitemInitial);

    let menuprespacer = document.createElement("div");
    menuprespacer.classList.add("opti_menuprespacer");
    this.menuCntnr.appendChild(menuprespacer);
    this.opti_menuprespacer = menuprespacer;

    let menupostspacer = document.createElement("div");
    menupostspacer.classList.add("opti_menupostspacer");
    this.menuCntnr.appendChild(menupostspacer);
    this.opti_menupostspacer = menupostspacer;

    this.wheelScrollDistance = this.miHeight;

    this.menuCntnr.addEventListener("mousedown", this);
    this.window.addEventListener("mouseup", this);
    this.menuCntnr.addEventListener("click", this);
    this.window.addEventListener("resize", this);
    this.menuCntnr.addEventListener("overflow", this);
    this.menuCntnr.addEventListener("underflow", this);

    let dragFeedback = document.createElement("div");
    dragFeedback.id = "opti_dragfeedback";
    // TODO: append to menuCntnr?
    this.window.document.body.appendChild(dragFeedback);
    this.dragDrop.dragFeedback = dragFeedback;

    let optiM = this;
    this.menuCntnr.addEventListener("wheel", function(e) {
      e.preventDefault();
      let mult = optiM.wheelScrollDistance;
      optiM.menuCntnr.scrollTop = optiM.menuCntnr.scrollTop + (e.deltaY * mult);
    }, true);
    this.menuCntnr.addEventListener("scroll", function(e) {
      optiM.psuedoScroll(optiM.menuCntnr.scrollTop);
    }, true);

    let style1 = document.getElementById("optimenu_dynamic_css_menu_dimensions");
    if (!style1) {
      style1 = document.createElement("style");
      style1.id = "optimenu_dynamic_css_menu_dimensions";
      this.window.document.head.appendChild(style1);
      this.dynamicCSS1 = style1
    }

    this.updateMenuitemDims();
  },

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// ACTIVITY LISTENERS

  addActivityDDListener(callback) {
    if (this.activityDDListenersMap[callback]) {
      return;
    }
    this.activityDDListenersMap[callback];
    this.activityDDListeners.push(callback);
  },

  removeActivityDDListener(callback) {
    if (this.activityDDListenersMap[callback]) {
      return;
    }
  },

  callActivityDDListeners(e) {
    for (let listener of this.activityDDListeners) {
      listener(e);
    }
  },

  addActivityMouseListener(callback) {
    if (this.activityMouseListenersMap[callback]) {
      return;
    }
    this.activityMouseListenersMap[callback];
    this.activityMouseListeners.push(callback);
  },

  removeActivityMouseListener(callback) {
    if (this.activityMouseListenersMap[callback]) {
      return;
    }
  },

  callActivityMouseListeners(e) {
    for (let listener of this.activityMouseListeners) {
      listener(e);
    }
  },

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

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// MENU CONSTRUCTION

  updateMenuStructure(itemsCount) {
    this.prevItemsCount = itemsCount;

    let viewPortTop = this.menuCntnr.getBoundingClientRect().top;
    let viewPortBot = this.menuCntnr.getBoundingClientRect().bottom;
    let tlHeight = viewPortBot - viewPortTop;

    let psuedoListTotalHeight = this.miHeight * itemsCount;
    let minMenuitemsCount = Math.min((Math.ceil(tlHeight / this.miHeight) + 1), itemsCount);
    let miSpaceHeight = minMenuitemsCount * this.miHeight;
    this.currentMenuFillTotalHeight = psuedoListTotalHeight - miSpaceHeight;

    let currentMenuitemsCount = this.menuCntnr.childNodes.length - 2;
    let itemsToAddCount =  minMenuitemsCount - currentMenuitemsCount;

    if (itemsToAddCount > 0) {
      let currentMenuitems = document.createDocumentFragment();
      let menuitem;
      for (let i=0;i<itemsToAddCount;i++) {
        menuitem = this.createMenuitem();
        currentMenuitems.appendChild(menuitem);
      }
      this.menuCntnr.insertBefore(currentMenuitems, this.opti_menupostspacer);
    } else if (itemsToAddCount < 0) {
      let removeCount = 0 - itemsToAddCount;
      for (let i=0;i<removeCount;i++) {
        this.menuCntnr.removeChild(this.menuCntnr.firstChild.nextSibling);
      }
    }

    this.currentMenuMaxScroll = (itemsCount * this.miHeight) - tlHeight;
    this.currentMenuMaxTopIndex = itemsCount - minMenuitemsCount;

    // Force a refresh of the menu.
    this.psuedoScroll(this.menuCntnr.scrollTop, true);
  },

  createMenuitem() {
    let menuitem = document.createElement('div');
    let menuicon1 = document.createElement('img');
    let menutext = document.createElement('div');
    let menuicon2 = document.createElement('img');

    menuitem.className = "opti_menuitem";
    menuitem.isOptiMenuitem = true;
    menuitem.opti_menutext = menutext;
    menuitem.opti_menuicon1 = menuicon1;
    menuitem.opti_menuicon2 = menuicon2;

    menuicon1.className = "opti_menuicon1";
    menuicon1.opti_menuitem = menuitem;

    menutext.className = "opti_menutext";
    menutext.opti_menuitem = menuitem;

    menuicon2.className = "opti_menuicon2";
    menuicon2.opti_menuitem = menuitem;

    menuitem.appendChild(menuicon1);
    menuitem.appendChild(menutext);
    menuitem.appendChild(menuicon2);

    return menuitem;
  },

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// MENU DISPLAY BACKEND

  indexCurrentMenuData() {
    let len = this._currentMenuData.length;
    for (let i = 0; i < len; i++) {
      this._currentMenuData[i].opti_index = i;
    }
  },

  updateMenu(_currentMenuData, deepClone) {
    // Update _currentMenuData.

    // We have the option of a deepClone; while it takes longer, may be more
    // convenient.
    if (_currentMenuData) {
      if (deepClone) {
        this._currentMenuData = _currentMenuData.map(a => Object.assign({}, a));
      } else {
        this._currentMenuData = _currentMenuData.slice();
      }
      this.indexCurrentMenuData();
    }

    this.updateMenuUI();
  },

  updateMenuUI() {
    if (this._currentMenuData.length != this.prevItemsCount) {
      this.updateMenuStructure(this._currentMenuData.length)
    } else {
      // This gets called when updating the scroll structure, otherwise we'll
      // call it now.
      this.updateMenuDisplay(this.currentIndex);
    }
  },

  updateSingleMenuItem(_currentMenuData, index) {
    // Determine if the menuitem data at index is currently displayed,
    // and if so, just update that menuitem.

    // Update _currentMenuData.
    this._currentMenuData = _currentMenuData;
    this.indexCurrentMenuData();

    let currentIndex = this.currentIndex;
    let menuitemsCount = this.menuCntnr.childNodes.length - 2;

    if (index < currentIndex || index > currentIndex + menuitemsCount) {
      return;
    }

    let menuitemAtIndex = this.menuCntnr.childNodes[index - currentIndex + 1];
    this.setMenuitemProperties(menuitemAtIndex, _currentMenuData[index]);
  },

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// MENU DISPLAY FRONTEND

  /*
   * updateMenuDisplay
   * Updates the graphical display of the menu, in the "psuedo-scroll" context.
   *
   * {@param} index - index of _currentMenuData to begin displaying menu data
   *   (in "psuedo-scroll" context, the menu data entry to "scroll" to).
   */
  updateMenuDisplay(index) {
    index = typeof index == "number" ? index : 0;
    let _currentMenuData = this._currentMenuData;
    let nodes = this.menuCntnr.childNodes;
    let cmDataLen = _currentMenuData.length;

    // First and last nodes are fill spacers.  Ignore those.  Everything else
    // inbetween are menuitems.
    let len = (nodes.length - 1);
    for (let i = 1; i < len; i++) {
      let menuitem = nodes[i];
      if (index < cmDataLen) {
        let data = _currentMenuData[index];
        this.setMenuitemProperties(menuitem, data, index);
        index++;
      }
    }
  },

  setMenuitemProperties(menuitem, data, currentMenuDataIndex) {
    // ONLY OPTI
    // TODO: Can some of the properties being explicitly set below just be
    // accessed through opti_data?
    menuitem.opti_data = data;

    menuitem.currentMenuDataIndex = currentMenuDataIndex;

    menuitem.opti_menutext.innerHTML = data.menutextstr;

    menuitem.className = "opti_menuitem";

    if (data.menuiconurl1) {
      menuitem.opti_menuicon1.src = data.menuiconurl1;
    } else {
      menuitem.opti_menuicon1.removeAttribute("src");
    }
    if (data.noPrefixIcon) {
      menuitem.classList.add("opti_menuitem_icon1_hide");
    }

    if (data.menuiconurl2) {
      menuitem.opti_menuicon2.src = data.menuiconurl2;
    } else {
      menuitem.opti_menuicon2.removeAttribute("src");
    }
    if (data.noSuffixIcon) {
      menuitem.classList.add("opti_menuitem_icon2_hide");
    }
    if (data.isSelected) {
      menuitem.classList.add("opti_menuitemselected");
      menuitem.isSelected = true;
    } else {
      delete(menuitem.isSelected);
    }

    // USER DEFINED
    if (data.userDefined) {
      let { properties, attributes, classes } = data.userDefined;
      if (properties) {
        for (let name in properties) {
          menuitem[name] = properties[name];
        }
      }
      if (attributes) {
        for (let name in attributes) {
          let value = attributes[name];
          if (value) {
            menuitem.setAttribute(name, value);
          } else {
            menuitem.removeAttribute(name);
          }
        }
      }
      if (classes) {
        for (let name in classes) {
          let status = classes[name];
          if (status) {
            menuitem.classList.add(name);
          }
        }
      }
    }
  },

  psuedoScroll(scrollPos, forceRefresh) {
    // TODO : Not sure if we're handling forceRefresh without introducing a bug.
    if (scrollPos > this.currentMenuMaxScroll && !forceRefresh) {
      return;
    }

    let index = Math.floor(scrollPos / this.miHeight);

    if (index != this.currentIndex || forceRefresh) {
      let preheight = Math.min((index * this.miHeight), this.currentMenuFillTotalHeight);
      let postheight = this.currentMenuFillTotalHeight - preheight;
      this.opti_menuprespacer.style.height = preheight+"px";
      this.opti_menupostspacer.style.height = postheight+"px";
      this.updateMenuDisplay(Math.min(index, this.currentMenuMaxTopIndex));
    }
    this.currentIndex = index;
  },

  getSelectedMenuData() {
    let selected = [];
    for (let datum of this._currentMenuData) {
      if (datum.isSelected) {
        selected.push(datum);
      }
    }
    return selected;
  },

  isResizeTimerRunning: false,

  updateMenuitemDims(bypass) {
    if (!bypass) {
      if (!this.isResizeTimerRunning) {
        let _this = this;
        setTimeout(function() {
          _this.updateMenuitemDims(true);
          _this.isResizeTimerRunning = false;
        },100);
        this.isResizeTimerRunning = true;
      }
      return;
    }

    let cntnrWid = this.menuCntnr.clientWidth;

    let innerHTML = ".opti_menuitem { width: "+cntnrWid+"px; }\n";
    innerHTML += ".opti_menutext { width: "+(cntnrWid - 40)+"px; }\n";

    innerHTML += ".opti_menuitem_icon1_hide > .opti_menutext { width: "+(cntnrWid - 27)+"px; }\n";
    innerHTML += ".opti_menuitem_icon2_hide > .opti_menutext { width: "+(cntnrWid - 27)+"px; }\n";
    innerHTML += ".opti_menuitem_icon1_hide.opti_menuitem_icon2_hide > .opti_menutext { width: "+(cntnrWid - 12)+"px; }\n";

    this.dynamicCSS1.innerHTML = innerHTML;
  },

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// SELECT

  select: {
    _optiMenu: null,
    menuCntnr: null,

    isMenuitemSelected: false,
    lastSelectedMenuDataItem: null,

    handleMenuitemSelect(e) {
      let item = e.target;
      let menuitem = item.opti_menuitem || item;

      let menuitemData = this._optiMenu._currentMenuData[menuitem.currentMenuDataIndex];

      if (e.shiftKey) {
        // Always select for shift key.
        menuitem.isSelected = true;
        menuitem.classList.add("opti_menuitemselected");
        menuitemData.isSelected = true;

        // If shiftKey and there has already been a menuitem selected,
        // select a range between the two.
        if (this.lastSelectedMenuDataItem) {
          this.selectRange(menuitem, menuitemData, this.lastSelectedMenuDataItem);
        }
      } else {
        // If we are here it means that only ctrl and/or cmd key was pressed.
        // Toggle selection state of menuitem.
        if (menuitem.isSelected) {
          delete(menuitem.isSelected);
          menuitem.classList.remove("opti_menuitemselected");
          delete(menuitemData.isSelected);
        } else {
          menuitem.isSelected = true;
          menuitem.classList.add("opti_menuitemselected");
          menuitemData.isSelected = true;
        }
      }

      if (!menuitemData.isSelected && !this.getSelectedMenuData().length) {
        // We unselected the only selected menuitem.
        this.isMenuitemSelected = false;
        this.menuCntnr.classList.remove("opti_ismenuitemselected");
        this.lastSelectedMenuDataItem = null;
      } else {
        this.isMenuitemSelected = true;
        this.menuCntnr.classList.add("opti_ismenuitemselected");
        this.lastSelectedMenuDataItem = menuitemData;
      }
    },

    selectRange(menuitem, menuitemData, lastMenuitemData) {
      // Selects a range between menuitem1 and menuitem2, regardless of which
      // is preceding.
      if (menuitemData.opti_index == lastMenuitemData.opti_index) {
        return;
      }
      let startIndex = Math.min(menuitemData.opti_index, lastMenuitemData.opti_index);
      let endIndex = Math.max(menuitemData.opti_index, lastMenuitemData.opti_index);

      let nodes = this.menuCntnr.childNodes;
      let len = nodes.length - 1;
      for (let i = 1; i < len; i++) {
        let menuitem = nodes[i];
        if (menuitem.currentMenuDataIndex > endIndex) {
          break;
        }
        if (menuitem.currentMenuDataIndex >= startIndex) {
          menuitem.classList.add("opti_menuitemselected");
          menuitem.isSelected = true;
        }
      }
      let _currentMenuData = this._optiMenu._currentMenuData;
      len = _currentMenuData.length;
      for (let i = startIndex; i <= endIndex; i++) {
        _currentMenuData[i].isSelected = true;
      }
    },

    clearMenuitemSelection() {
      let nodes = this.menuCntnr.childNodes;
      let len = nodes.length - 1;
      for (let i=1;i<len;i++) {
        let menuitem = nodes[i];
        menuitem.classList.remove("opti_menuitemselected");
        menuitem.isSelected = false;
      }
      let _currentMenuData = this._optiMenu._currentMenuData;
      len = _currentMenuData.length;
      for (let i = 0; i < len; i++) {
        delete(_currentMenuData[i].isSelected);
      }
      this.isMenuitemSelected = false;
      this.menuCntnr.classList.remove("opti_ismenuitemselected");
      this.lastSelectedMenuDataItem = null;
    },
  },

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// DRAG/DROP

  dragDrop: {
    _optiMenu: null,
    menuCntnr: null,

    isMenuitemDragListener: false,
    isMenuitemDragging: false,
    dragStartTarget: null,

    /**
     *  dragPrepare
     *
     *  Called on mousedown event.  Prepare just in case we are going to drag.
     *  Add mousemove listener and Record target for dragStart in the event
     *  we actually do drag.  If we get a mousemove while mouse is still down,
     *  we have begun a drag.
     */
    dragPrepare(e) {
      document.addEventListener("mousemove", this);
      this.isMenuitemDragListener = true;
      this.dragStartEvent = e;
    },

    /**
     *  dragStart
     *
     *  Called on the first sign of a mousemove after mousedown (dragPrepare).
     *  We are now dragging.
     */
    dragStart() {
      let nodes = this.menuCntnr.childNodes;
      let len = nodes.length - 1;
      let count = 0;
      for (let i=1;i<len;i++) {
        let menuitem = nodes[i];
        if (menuitem.isSelected) {
          count++;
        }
      }

      // Call listeners
      let e = this.dragStartEvent;
      let target = e.target;
      let menuitem = target.opti_menuitem || (target.isOptiMenuitem ? target : null);

      e.hybridType = "dragstart";
      e.menuitem = menuitem;

      this._optiMenu.callActivityDDListeners(e);
    },

    dragMenuitem(e) {
      if (!this.isMenuitemDragging) {
        this.dragStart();
      }

      this.menuCntnr.classList.add("opti_dragging_menuitem");
      this.dragFeedback.style.display = "block";
      if (!this.isMenuitemDragging) {
        this.initDragFeedbackItem();
      }
      this.updateDragFeedbackItem(e);
      this.isMenuitemDragging = true;
    },

    initDragFeedbackItem(e) {
      let count = this._optiMenu.getSelectedMenuData().length;
      this.dragFeedback.textContent = "Moving "+count+" tab"+(count == 1 ? "" : "s");
    },

    updateDragFeedbackItem(e) {
      let x = e.clientX;
      let y = e.clientY;

      this.dragFeedback.style.display = "block";
      this.dragFeedback.style.left = (x - 10)+"px";
      this.dragFeedback.style.top = (y + 10)+"px";
    },

    /**
     *  Act on dropping on messageCntnr or a menuitem in the tabs menu.
     */
    onDrop(e) {
      if (!e.target || !this.isMenuitemDragging) {
        return;
      }

      // Call listeners
      let target = e.target;
      let menuitem = target.opti_menuitem || (target.isOptiMenuitem ? target : null);

      e.hybridType = "drop";
e.menuitem = menuitem;
      e.opti_selectedMenuData = this._optiMenu.getSelectedMenuData();

      this._optiMenu.callActivityDDListeners(e);
    },

    dragEnd(e) {
      if (!this.isMenuitemDragListener) {
        return;
      }

      this.isMenuitemDragging = false;
      document.removeEventListener("mousemove", this);
      this.isMenuitemDragListener = false;
      this.menuCntnr.classList.remove("opti_dragging_menuitem");
      this.dragFeedback.style.display = "none";
    },

    handleEvent(e) {
      switch(e.type) {
        case "mousemove":
          this.dragMenuitem(e);
          break;
      }
    },
  },

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// UTILS

  getHoveredMenuitem() {
    let nodes = this.menuCntnr.childNodes;
    let len = nodes.length - 1;
    for (let i = 1; i < len; i++) {
      let menuitem = nodes[i];
      if (menuitem.matches(".opti_menu_outer_container > div:hover")) {
        return menuitem;
      }
    }
  },

  frozenHoveredItem: null,

  freezeHoveredItem(unfreeze) {
    if (unfreeze && this.frozenHoveredItem) {
      this.menuCntnr.classList.remove("opti_menufrozen");
      this.frozenHoveredItem.classList.remove("opti_frozen_menuitem");
      this.frozenHoveredItem = null;
      return;
    }
    this.frozenHoveredItem = this.getHoveredMenuitem();
    if (this.frozenHoveredItem) {
      this.menuCntnr.classList.add("opti_menufrozen");
      this.frozenHoveredItem.classList.add("opti_frozen_menuitem");

    }
    return this.frozenHoveredItem.currentMenuDataIndex;
  },

  getFrozenHoveredItemIndex() {
    return this.frozenHoveredItem.currentMenuDataIndex;
  },

  setSelectedPlusHoverState(remove) {
    if (remove) {
      this.menuCntnr.classList.remove("opti_isselectedplushover");
    } else {
      this.menuCntnr.classList.add("opti_isselectedplushover");
    }
  },

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// EVENT HANDLERS

  clearSelectionOnMouseRelease: false,
  inhibitClick: false,

  handleEvent(e) {
    let target = e.target;

    switch(e.type) {
      case 'mousedown':
        if (e.button != 0) {
          return;
        }

        e.preventDefault();

        if (this.frozenHoveredItem) {
          return;
        }

        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          this.select.handleMenuitemSelect(e);
        } else if (this.select.isMenuitemSelected) {
          this.clearSelectionOnMouseRelease = true;
          this.dragDrop.dragPrepare(e);
        }

        this.callActivityMouseListeners(e);
        break;
      case 'mouseup':
        if (e.button != 0 || this.frozenHoveredItem) {
          return;
        }

        // Call onDrop() in case we were dragging.
        // (onDrop() will only run if isMenuitemDragging is true.)
        // Important: This must precede code that calls clearMenuitemSelection() !!!
        this.dragDrop.onDrop(e);

        if (this.clearSelectionOnMouseRelease) {
          this.clearSelectionOnMouseRelease = false;
          this.select.clearMenuitemSelection();
          // If we released on a plain click, the click event will immediately be
          // fired next, but we want to inhibit any other action (tab select or close).
          // If we released on a drag, the click event won't get fired right away, so
          // we don't want to inhibitClick on the following click.
          this.inhibitClick = !this.dragDrop.isMenuitemDragging;
        }

        // Call dragEnd() in case we were dragging.
        // (dragEnd() will only run if isMenuitemDragListener is true.)
        // Important: This must succeed the above, otherwise isMenuitemDragging
        // will get cleared, which is needed for the test above.
        this.dragDrop.dragEnd(e);

        this.callActivityMouseListeners(e);
        break;
      case 'click':
        if (e.button != 0 || this.frozenHoveredItem) {
          return;
        }

        if (this.inhibitClick) {
          this.inhibitClick = false;
          return;
        }

        if (this.select.isMenuitemSelected) {
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

          return;
        }

        if (target.className == "opti_menuicon2") {
          menuitem = target.opti_menuitem;

          e.hybridType = "action2click";
          e.menuitem = menuitem;
          this.callActivityActionListeners(e);

          return;
        }

        // This assumes this listener is only set on this.menuCntnr.
        if (target == this.menuCntnr) {
          return;
        }

        if (target.opti_menuitem || target.isOptiMenuitem) {
          menuitem = target.opti_menuitem || target;
        } else {
          // Target may be some user-defined HTML contained within a menuitem.
          // If we don't find a menuitem before reaching menuCntnr in this
          // routine, it means the user has inserted some of their own items
          // into the menu.
          let count = 0;
          let parent = target;
          while ((parent = parent.parentNode) && (parent != this.menuCntnr)) {
            if (parent.isOptiMenuitem) {
              menuitem = parent;
              break;
            }
          }
        }

        if (menuitem) {
          e.hybridType = "menuitemclick";
          e.menuitem = menuitem;
          this.callActivityActionListeners(e);

          return;
        }

        this.callActivityMouseListeners(e);
        break;
      case "resize":
        this.updateMenuitemDims();
        break;
      case "overflow":
      case "underflow":
        if (target == this.menuCntnr) {
          this.updateMenuitemDims();
        }
        break;
    }
  },
}
