/*
 *    Copyright (C) 2018  Kevin Jones
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU General Public License as published by
 *    the Free Software Foundation, either version 3 of the License, or
 *    (at your option) any later version.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU General Public License for more details.
 *
 *    You should have received a copy of the GNU General Public License
 *    along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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
