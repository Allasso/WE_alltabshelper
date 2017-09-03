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

    this.addItem("Help me !!!");
  },

  createMenu() {
    this.menu = this.document.createElement("div");
    this.menu.className = "contextmenu_outer_container";
    this.document.body.appendChild(this.menu);
 },

  display(params) {
    if (!params) {
      this.menu.classList.remove("contextmenu_display");
      return;
    }

    let { x, y } = params;

    let _this = this;
    this.window.addEventListener("resize", function displayContexMenuResizeListener() {
      //_this.window.removeEventListener("resize", displayContexMenuResizeListener);
      dump("display : x : "+x+"    y : "+y+"    "+_this.window.innerWidth+"    "+_this.window.outerWidth+"    "+_this.menu.clientWidth+"    "+_this.menu.clientHeight+"\n");
    });
dump("display : x : "+x+"    y : "+y+"    "+_this.window.innerWidth+"    "+_this.window.outerWidth+"    "+_this.menu.clientWidth+"    "+_this.menu.clientHeight+"\n");

// create an observer instance
var observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    dump(" >> "+mutation.type+"\n");
  });
});

// configuration of the observer:
var config = { attributes: true, childList: true, characterData: true };

// pass in the target node, as well as the observer options
observer.observe(this.document.body, config);

    this.loadContextMenu();


setTimeout(() => {
//dump("display : x : "+x+"    y : "+y+"    "+this.window.innerWidth+"    "+this.window.outerWidth+"    "+this.menu.clientWidth+"    "+this.menu.clientHeight+"\n");
}, 1000);

    let innerHTML = ".contextmenu_outer_container { left: "+x+"px; top: "+y+"px }\n";

    this.dynamicCSSDisplayPosition.innerHTML = innerHTML;
    this.menu.classList.add("contextmenu_display");
  },

  loadContextMenu() {
    let menu = this.menu;
    let doc = this.document;
    let frag = doc.createDocumentFragment();
    menu.innerHTML = "";

dump("loadContextMenu\n");

    for (let item of this.items) {
      let menuitem = doc.createElement("div");
      let textCont = doc.createElement("div");
      textCont.textContent = item.text;
      menuitem.appendChild(textCont);
      frag.appendChild(menuitem);
    }

    menu.appendChild(frag);
  },

  addItem(text, id, checkbox) {
    this.items.push({ text, id, checkbox });
  },

  removeItem() {
  },

  mouseupInhibit: false,
  clickInhibit: false,

  handleEvent(e) {
    let target = e.target;

    switch(e.type) {
      case 'mousedown':
        if (e.button == 0) {
          if (this.menu.classList.contains("contextmenu_display")) {
            this.display();
            e.stopImmediatePropagation();
            this.mouseupInhibit = true;
            this.clickInhibit = true;
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
        break;
    }
  },
}
