let textRetriever = {
  getFrames(topWin) {
    function getframes(win, frameList) {
      for (var i = 0; win.frames && i < win.frames.length; i++) {
        let frame = win.frames[i];
        if (!frame || !frame.document || !frame.frameElement) {
          continue;
        }
        frameList.push(frame);
        getframes(frame, frameList);
      }
    }
    let frameList = [topWin];
    getframes(topWin, frameList);

    return frameList;
  },

  getTabContentText() {
    let frames = this.getFrames(window);
    let text = "";

    for (let i = 0; i < frames.length; i++) {
      let iframe = frames[i];
      let doc = iframe.document;
      let body = doc.body;
      if (body) {
        text += " "+this.getTextInDocument(doc, body);
      }
    }

    return text.replace(/\s/g, ' ').replace(/  +/g, ' ');
  },

  getTextInDocument(doc, body) {
    // we don't want to select "alt" text in images
    // We'll put it back in after we've selected.
    let holdArr = [];
    let elems = doc.getElementsByTagName("img");
    for (let i = 0; i < elems.length; i++) {
      let elem = elems[i];
      let attrName = "alt";
      if (elem.hasAttribute(attrName)) {
        let attrVal = elem.getAttribute(attrName);
        elem.removeAttribute(attrName);
        holdArr.push({elem: elem, attrName: attrName, attrVal: attrVal});
      }
    }

    let selection = doc.getSelection();
    selection.selectAllChildren(body);
    let sel = doc.getSelection();
    let text = sel.toString();
  //sel.collapse(body, 0);
    sel.removeAllRanges();

    // put the alt attributes back in that we took out
    for (let i = 0; i < holdArr.length; i++) {
      let attrData = holdArr[i];
      attrData.elem.setAttribute(attrData.attrName, attrData.attrVal);
    }

    // Collapse all consecutive whitespace into single spaces, and
    // get rid of those notorious soft hyphens.
    text = text.replace(/\s+/g," ").replace(/[\u00AD]/g,"");

    return text;
  },
}

/**
 * CUSTOM HIGHLIGHTING SECTION
 */
let localHighlighter = {
  highlighterDivs: [],

  /**
   * setCustomHighlighting
   * Uses rectData returned from browser.find.find.
   */
  setCustomHighlighting(params) {
    // overlay:
    // Whether to draw borders around result text, or use "highlighter" style,
    // which will overlay the text with a colored background div and re-write the
    // text in the div.
    //
    // **NOTE**: if using overlay, remember that you have injected new text into
    // the document, which will then also be searched on subsequent searches.
    // ie, be sure to remove those before searching again.
    //
    // **NOTE**: Due to bug 1366646 highlighting of text within frames which have
    // borders will be offset by a value equal to the border width.  If frames
    // are nested within frames, this will be additive.
    let { rectData, currentResult, overlay } = params;

    this.clearCustomHighlighting();
    let fragment = document.createDocumentFragment();

    for (let i = 0; i < rectData.length; i++) {
      let datum = rectData[i]
      let { rectsAndTexts } = datum;

      let { rectList, textList } = rectsAndTexts;
      for (let j = 0; j < rectList.length; j++) {
        let rect = rectList[j];
        let text = textList[j];
        let { left, top, right, bottom } = rect;
        let width = right - left;
        let height = bottom - top;

        let div = document.createElement("div");
        div.style.width = width+"px";
        div.style.height = height+"px";
        div.style.position = "absolute";

        let divBG;
        let offset = 0;
        if (i == currentResult) {
          divBG = "#a7f432";
          border = "solid 1px blue";
          offset = 1;
        } else {
          divBG = "#fff700"
          border = "solid 1px red"
          offset = 1;
        }
        if (overlay) {
          div.textContent = text;
          div.style.fontSize = height+"px";
          div.style.backgroundColor = divBG;
        } else {
          // We'll be offsetting the div to compensate for border width.
          offset = 1;
          div.style.border = border;
        }
        div.style.left = (left - offset)+"px";
        div.style.top = (top - offset)+"px";

        fragment.appendChild(div);
        this.highlighterDivs.push(div);
      }
    }
    window.document.body.appendChild(fragment);

    this.scrollIntoView(rectData[currentResult].rectsAndTexts.rectList);
  },

  /**
   * findBarTweakAnimate
   *
   * A very crude attempt to emulate FindBarTweak style animated "target" highlighting.
   * Uses rectData returned from browser.find.find.
   */
  findBarTweakAnimate(rectData, currentResult) {
    this.clearCustomHighlighting();

    let { rectList } = rectData[currentResult].rectsAndTexts;
    let rect = rectList[0];
    let { left, top, right, bottom } = rect;
    let width = right - left;
    let height = bottom - top;

    let div = document.createElement("div");
    div.style.width = "30px";
    div.style.height = "30px";
    div.style.position = "absolute";

    div.style.borderRadius = "50px";
    div.style.border = "solid 3px #ef0fff";
    div.style.left = left+"px";
    div.style.top = top+"px";

    window.document.body.appendChild(div);
    div.style.transition = "transform .2s ease-in";

    // Don't know why, but we need to throw this out of the event loop or the
    // transform won't take effect and it will scale immediately.  I think this
    // can be done purely css with @keyframes though, but I'm just wanting to
    // keep the demo simple.
    setTimeout(() => {
      div.style.transform = "scale(10)";
      // Make it disappear when it is to size.
      setTimeout(() => {
        div.remove();
      }, 200);
    }, 10);

    this.highlighterDivs.push(div);

    this.scrollIntoView(rectList);
  },

  clearCustomHighlighting() {
    for (let div of this.highlighterDivs) {
      div.remove();
    }
    highlighters = [];
  },

  scrollIntoView(rectList) {
    // Vertical scroll coordinate:
    let vCenter = Math.round(document.documentElement.clientHeight / 2);
    let scrollY = rectList[0].bottom - vCenter;

    // Horizonatal scroll coordinate:
    let pageWidth = document.documentElement.clientWidth;
    let { maxLeft, maxRight } = this.getXEndpointsOfRectList(rectList);

    let scrollX = document.documentElement.scrollLeft;
    if (maxLeft < scrollX) {
      scrollX = maxLeft;
    } else if (maxRight > scrollX + pageWidth) {
      scrollX = Math.min(maxLeft, maxRight - pageWidth);
    }

    window.scroll(scrollX, scrollY);
  },

  getXEndpointsOfRectList(rectList) {
    let maxLeft;
    let maxRight;

    for (let rect of rectList) {
      let { left, right } = rect;
      if (maxLeft === undefined) {
        maxLeft = left;
        maxRight = right;
      } else {
        maxLeft = Math.min(left, maxLeft);
        maxRight = Math.max(right, maxRight);
      }
    }

    return { maxLeft, maxRight }
  },
}

/**
 * END CUSTOM HIGHLIGHTING SECTION
 */

browser.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    let topic = request.topic;
    let tabId = request.tabId;
    if (topic == "alltabshelper:getTabContentText") {
      sendResponse({ tabId: tabId, contentText: textRetriever.getTabContentText() });
    }
    if (topic == "alltabshelper:getResultsContext") {
    }
    if (topic == "alltabshelper:setCustomHighlighting") {
      localHighlighter.setCustomHighlighting(request);
    }
    if (topic == "alltabshelper:findBarTweakAnimate") {
      localHighlighter.findBarTweakAnimate(request.rectData, request.currentResult)
    }
    if (topic == "alltabshelper:clearCustomHighlighting") {
      localHighlighter.clearCustomHighlighting();
    }
  }
);
