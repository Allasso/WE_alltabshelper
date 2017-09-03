function getResultsContext(data) {
try {

dump("getResultsContext\n");
  let { caseSensitive } = data;
  let queryRegexp = processQueryPhrase(data.queryphrase, caseSensitive);

  // Ensure we don't search text that was injected from a previous highlighting action.
  clearCustomHighlighting();

  getTextNodes();

  stringifyText(caseSensitive);

  getResults(queryRegexp)

dump("resultsList count: "+resultsList.length+"\n");

} catch(e) { dump(e+"    line : "+e.lineNumber+"\n"); }
}

function processQueryPhrase(phrase, caseSensitive) {
  if (!caseSensitive) {
    phrase = phrase.toLocaleLowerCase();
  }
//dump("processQueryPhrase\n");
  let queryList = phrase.split(/\s+/u);
  if (queryList.length == 1) {
    return new RegExp(queryList[0], "g");
  } else {
    let expStr = ""
    let last = queryList.length - 1;
    for (let i = 0; i < last; i++) {
      expStr += queryList[i] + "\\s+";
    }
    expStr += queryList[last];
    return new RegExp(expStr, "g");
  }
}

let visibleTextNodes;
let visibleTextNodeMap;

function getTextNodes() {
  visibleTextNodes = [];
  visibleTextNodeMap = new WeakMap();
  let textNodeFullCount = 0;
  let wins = getFrames(window);

  for (let i = 0; i < wins.length; i++) {
    let win = wins[i]

    let doc = win.document;
    if (!doc) {
      continue;
    }

    let NodeFilter = win.NodeFilter;
    let iterator = doc.createNodeIterator(doc, NodeFilter.SHOW_TEXT, function(node) {
      return node.parentNode.offsetParent === null ?
               node.parentNode == doc.body ?
                 NodeFilter.FILTER_ACCEPT :
                 NodeFilter.FILTER_REJECT :
               NodeFilter.FILTER_ACCEPT;
    }, false);

    let textNodeCount = 0;
    let node;
    while(node = iterator.nextNode()) {
      let text = node.textContent;
      let pos = textNodeFullCount;
      textNodeFullCount += text.length;
      let nextPos = textNodeFullCount;
      visibleTextNodes.push({ frame: win, node, text, pos, nextPos });
      visibleTextNodeMap.set(node, { frame: win, nodePos: textNodeCount });
      textNodeCount++;
    }
  }
}

let visibleTextString;

function stringifyText(caseSensitive) {
//dump("stringifyText ----------\n");
  visibleTextString = "";
  for (let node of visibleTextNodes) {
    visibleTextString += node.text;
  }
  if (!caseSensitive) {
    visibleTextString = visibleTextString.toLocaleLowerCase();
  }
}

let resultsList;

function getResults(queryRegexp) {
  resultsList = [];
  let nodeCount = 0;
  let nodesLen = visibleTextNodes.length;
  let result;
  while (result = queryRegexp.exec(visibleTextString)) {
    let end = queryRegexp.lastIndex;
    let start = end - result[0].length;
    let startData;
    let endData;
    while (nodeCount < nodesLen) {
      let nodeData = visibleTextNodes[nodeCount];
      if (!startData && nodeData.nextPos > start) {
        startData = nodeData;
      }
      if (!endData && nodeData.nextPos >= end) {
        endData = nodeData;
      }
      if (startData && endData) {
        let frame = nodeData.frame;
        let range = frame.document.createRange();
        range.setStart(startData.node, start - startData.pos);
        range.setEnd(endData.node, end - endData.pos);
        resultsList.push({ frame, range });
        break;
      }
      nodeCount++;
    }
  }
}

function getRectsAndTexts(range) {
//dump("getRectsAndTexts\n");
  let rectList = range.getClientRects();
  let textList = [];

  let startCont = range.startContainer;
  let endCont = range.endContainer;
  let startOffset = range.startOffset;
  let endOffset = range.endOffset;
  let startPos = visibleTextNodeMap.get(startCont).nodePos;
  let endPos = visibleTextNodeMap.get(endCont).nodePos;
  let nodesCount = endPos - startPos + 1;

  let rangeText;
  let currentRect;
  let testRect;
  let testSpan = document.getElementById("unique_local_find_api_span_id");
  if (!testSpan) {
    testSpan = document.createElement("span");
    testSpan.id = "unique_local_find_api_span_id";
  }

  // Extract the desired portion of the text and replace the full text in the container
  // with it, measure the resultant container width, then return things back to normal.
  if (nodesCount == 1) {
    rangeText = startCont.textContent.substring(startOffset, endOffset);
    textList.push(rangeText);
  } else {
    rangeText = startCont.textContent.substring(startOffset);

/*
    testSpan.textContent = rangeText;
    startCont.parentNode.appendChild(testSpan);
    testRect = testSpan.getBoundingClientRect();
    currentRect = rectList[0];
dump("    >> currentRect : width : "+(currentRect.right - currentRect.left)+"    top : "+currentRect.top+"    bottom : "+currentRect.bottom+"\n");
dump("    >> testRect : width : "+(currentRect.right - currentRect.left)+"    top : "+testRect.top+"    bottom : "+testRect.bottom+"\n\n");
    testSpan.remove();
*/

    textList.push(rangeText);
    if (nodesCount > 2) {
      for (let i = startPos + 1; i < endPos; i++) {
        let cont = visibleTextNodes[i];
        textList.push(cont.text);
      }
    }
    rangeText = endCont.textContent.substring(0, endOffset);
    textList.push(rangeText);
  }

  // If textList and rectList are the same lengths, we assume texts will align
  // properly with rects, and we'll just quit here.
  if (textList.length == rectList.length) {
    return { rectList, textList };
  }

  let newRectList = [];
  let lastRect;
  let newRectCount = -1;

  for (let rect of rectList) {
    if (currentRect && compareRectsEndpoints(currentRect, rect)) {
      currentRect = addRectsHorizontally(currentRect, rect);
    } else {
      newRectCount++;
      currentRect = cloneRect(rect);
    }
    newRectList[newRectCount] = currentRect;
    lastRect = rect;
  }
  rectList = newRectList;

  // Rebuild textList here to correspend to new rectList.
  let textStr = textList.join('');
  textStr = textStr.replace(/\s\s+/, ' ');
  let textStrLen = textStr.length;

  let totalRectsLen = 0;
  for (let rect of rectList) {
    rect.width = rect.right - rect.left;
    totalRectsLen += rect.width;
  }

  textList = [];
  let start = 0;
  for (let rect of rectList) {
    let ratio = rect.width / totalRectsLen;
    let currentLen = Math.round(textStrLen * ratio);
    let end = start + currentLen;
    textList.push(textStr.substring(start, end));
    start = end;
  }

  return { rectList, textList };
}

////////////////////////////////////////////////////////////////////////////////
// UTILS

let framesMap = new WeakMap;

function getFrames(topWin) {
  function _getFrames(win, frameList) {
    for (var i = 0; win.frames && i < win.frames.length; i++) {
      let frame = win.frames[i];
      if (!frame || !frame.document || !frame.frameElement) {
        continue;
      }
      let rect = frame.frameElement.getBoundingClientRect();
      let offsetX = rect.x;
      let offsetY = rect.y;
      if (framesMap.has(frame.parent)) {
        let parentOffsets = framesMap.get(frame.parent);
        offsetX += parentOffsets.offsetX;
        offsetY += parentOffsets.offsetY;
      }
      let style = window.getComputedStyle(frame.frameElement);
      offsetX += parseInt(style.getPropertyValue("border-left-width"));
      offsetY += parseInt(style.getPropertyValue("border-top-width"));
      offsetX += parseInt(style.getPropertyValue("padding-left"));
      offsetY += parseInt(style.getPropertyValue("padding-top"));

      frameList.push(frame);
      framesMap.set(frame, { offsetX, offsetY })
      _getFrames(frame, frameList);
    }
  }
  let frameList = [topWin];
  framesMap.set(topWin, { offsetX: topWin.scrollX, offsetY: topWin.scrollY });
  _getFrames(topWin, frameList);

  return frameList;
}

function cloneRect(rect) {
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
}

function addRectsHorizontally(rect1, rect2) {
  return { left: rect1.left,
           right: rect2.right,
           top: Math.min(rect1.top, rect2.top),
           bottom: Math.max(rect1.bottom, rect2.bottom) }
}

function compareRectsEndpoints(rect1, rect2) {
  return rect1.bottom > rect2.top;
}

function clearCustomHighlighting() {
  highlightersContainer.remove();
}

function initCustomHighlighting() {
  highlightersContainer.innerHTML = "";
}

function handleMessage(request, sender, sendResponse) {
  let nature = request.message_nature;
  if (nature == "get_results_context") {
dump("find_local_api get_results_context\n");
    getResultsContext(request.data);
    sendResponse({  });
  }
}

browser.runtime.onMessage.addListener(handleMessage);
