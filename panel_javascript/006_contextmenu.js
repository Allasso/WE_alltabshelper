function ContextMenu(win) {
  this.window = win;
  this.document = win.document;

  this.init();
}

ContextMenu.prototype = {
  dynamicCSSDisplayPosition: null,
  items: [],

  init() {
    this.window.addEventListener("contextmenu", this);
    this.window.addEventListener("mousedown", this, true);
    this.window.addEventListener("mouseup", this, true);
    this.window.addEventListener("click", this, true);

    this.createMenu();

    let style1 = document.getElementById("contextmenu_dynamic_css_menu_display");
    if (!style1) {
      style1 = document.createElement("style");
      style1.id = "contextmenu_dynamic_css_menu_display";
      this.window.document.head.appendChild(style1);
      this.dynamicCSSDisplayPosition = style1
    }
  },

  createMenu() {
    this.menu = this.document.createElement("div");
    this.menu.className = "contextmenu_outer_container";
    this.document.body.appendChild(this.menu);
  },

  display(params) {
    if (!params) {
      this.menu.classList.remove("contextmenu_display");
      this.callContextmenuHidingListeners();
      return;
    }

    this.loadContextMenu();

    this.callContextmenuShowingListeners();

    let { x, y } = params;

    this.menu.classList.add("contextmenu_display");

    let mRect = this.menu.getBoundingClientRect();
    x = Math.min(x, this.window.innerWidth - mRect.width);
    y = Math.min(y, this.window.innerHeight - mRect.height);

    this.dynamicCSSDisplayPosition.textContent =
      ".contextmenu_outer_container { left: "+x+"px; top: "+y+"px }\n";
  },

  loadContextMenu() {
    let menu = this.menu;
    let doc = this.document;
    let frag = doc.createDocumentFragment();
    menu.innerHTML = "";

    for (let item of this.items) {
      let { text, id, checkbox } = item;
      let menuitem = doc.createElement("div");

      if (item.menuseparator) {
        menuitem.className = "context_menu_menuseparator";
      } else {
        let textCont = doc.createElement("div");
        textCont.textContent = text;
        if (id) {
          menuitem.id = id;
        }
        menuitem.className = "context_menu_menuitem";
        textCont.className = "context_menu_textcontainer";
        menuitem.appendChild(textCont);
      }
      frag.appendChild(menuitem);
    }

    menu.appendChild(frag);
  },

  addItems(items) {
    this.items = this.items.concat(items);
  },

  removeItem() {
  },

  contextmenuMousedownListeners: [],
  contextmenuMousedownListenersMap: new WeakMap(),
  contextmenuShowingListeners: [],
  contextmenuShowingListenersMap: new WeakMap(),
  contextmenuHidingListeners: [],
  contextmenuHidingListenersMap: new WeakMap(),

  addContextmenuMousedownListener(callback) {
    if (this.contextmenuMousedownListenersMap[callback]) {
      return;
    }
    this.contextmenuMousedownListenersMap[callback];
    this.contextmenuMousedownListeners.push(callback);
  },

  removeContextmenuMousedownListener(callback) {
    if (this.contextmenuMousedownListenersMap[callback]) {
      return;
    }
  },

  callContextmenuMousedownListeners(e) {
    for (let listener of this.contextmenuMousedownListeners) {
      listener(e);
    }
  },

  addContextmenuShowingListener(callback) {
    if (this.contextmenuShowingListenersMap[callback]) {
      return;
    }
    this.contextmenuShowingListenersMap[callback];
    this.contextmenuShowingListeners.push(callback);
  },

  removeContextmenuShowingListener(callback) {
    if (this.contextmenuShowingListenersMap[callback]) {
      return;
    }
  },

  callContextmenuShowingListeners(e) {
    for (let listener of this.contextmenuShowingListeners) {
      listener(e);
    }
  },

  addContextmenuHidingListener(callback) {
    if (this.contextmenuHidingListenersMap[callback]) {
      return;
    }
    this.contextmenuHidingListenersMap[callback];
    this.contextmenuHidingListeners.push(callback);
  },

  removeContextmenuHidingListener(callback) {
    if (this.contextmenuHidingListenersMap[callback]) {
      return;
    }
  },

  callContextmenuHidingListeners(e) {
    for (let listener of this.contextmenuHidingListeners) {
      listener(e);
    }
  },

  setDisabled(ids) {
    let nodes = this.menu.childNodes;
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i];
      if (ids[node.id]) {
        node.classList.add("disabled");
      } else {
        node.classList.remove("disabled");
      }
    }
  },

  mouseupInhibit: false,
  clickInhibit: false,

  handleEvent(e) {
    let target = e.target;

    switch(e.type) {
      case 'mousedown':
        if (e.button == 0) {
          if (this.menu.classList.contains("contextmenu_display")) {
            e.stopImmediatePropagation();
            this.mouseupInhibit = true;
            this.clickInhibit = true;

            // Always return the menuitem itself as the target
            let menuitem = target.classList.contains("context_menu_menuitem") ? target :
                           target.classList.contains("context_menu_textcontainer") ? target.parentNode :
                           null;
            if (menuitem && !menuitem.classList.contains("disabled")) {
              this.callContextmenuMousedownListeners(menuitem);
            }
            // Hide menu last.
            this.display();
          }
        }
        break;
      case 'mouseup':
        if (this.mouseupInhibit) {
          this.mouseupInhibit = false;
          e.stopImmediatePropagation();
        }
        break;
      case 'click':
        if (this.clickInhibit) {
          this.clickInhibit = false;
          e.stopImmediatePropagation();
        }
        break;
      case 'contextmenu':
        this.display({ x: e.clientX, y: e.clientY });
        e.preventDefault();
        break;
    }
  },
}
