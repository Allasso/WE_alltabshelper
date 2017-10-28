let main = {
  async init() {
    window.removeEventListener("load", this.init);
    
    for (let inputElem of document.getElementsByTagName("input")) {
      if (inputElem.id.indexOf("pref_bool") === 0) {
        inputElem.addEventListener("click", main.updateBoolCheckboxPref);
      }
    }

    let storage = await browser.storage.local.get();
    for (let key in storage) {
      let value = storage[key];
      let prefName = key.replace(/alltabshelper:/, "");

      if (prefName.indexOf("pref_bool") === 0) {
        let elem = document.getElementById(prefName);
        if (elem) {
          elem.checked = value;
        }
      }
    }
  },
  
  async updateBoolCheckboxPref(e) {
    let target = e.target;
    let prefObj = {};
    prefObj["alltabshelper:" + target.id] = target.checked;
    await browser.storage.local.set(prefObj);    
  },
}

window.addEventListener("load", main.init);
