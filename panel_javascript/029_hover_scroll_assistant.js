/* Side-car assistant to scroll menu while hovering/dragging.  In actuality,
 * this feature should be built-in to OptiMenu.  However that could require
 * nested divs, which doesn't seem to work well with browserAction and
 * sidebarAction panels.
 */

function DragScrollAssistant(elementToScroll, topHoverElement, bottomHoverElement) {
  this.elementToScroll = elementToScroll;
  this.topHoverElement = topHoverElement;
  this.bottomHoverElement = bottomHoverElement;

  this.init();
}

DragScrollAssistant.prototype = {
  inhibit: false,

  init() {
    this.topHoverElement.addEventListener("mouseenter", this.scrollUp.bind(this));
    this.topHoverElement.addEventListener("mouseleave", this.scrollUp.bind(this));
    this.bottomHoverElement.addEventListener("mouseenter", this.scrollDown.bind(this));
    this.bottomHoverElement.addEventListener("mouseleave", this.scrollDown.bind(this));
  },

  scrollTimerID: null,

  scrollDown(e) {
dump("scrollDown : "+e.type+"    "+this.inhibit+"\n");
    if (!this.inhibit) {
      if (e.type == "mouseenter") {
        let _this = this;
        this.scrollTimerID = setInterval(() => {
          _this.elementToScroll.scrollBy(0, 36);
        }, 75);
      } else {
        clearInterval(this.scrollTimerID);
      }
    }
  },

  scrollUp(e) {
dump("scrollUp : "+e.type+"    "+this.inhibit+"\n");
    if (!this.inhibit) {
      if (e.type == "mouseenter") {
        let _this = this;
        this.scrollTimerID = setInterval(() => {
          _this.elementToScroll.scrollBy(0, -36);
        }, 75);
      } else {
        clearInterval(this.scrollTimerID);
      }
    }
  },
}
