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

let main = {
  async init() {
    window.removeEventListener("load", this.init);
    
    for (let inputElem of document.getElementsByTagName("input")) {
      if (inputElem.id.indexOf("pref_bool") === 0) {
        inputElem.addEventListener("click", main.updateBoolCheckboxPref);
      }
      if (inputElem.id.indexOf("pref_int_number_input") === 0) {
        inputElem.addEventListener("change", main.updateNumberInputPref);
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
      } else if (prefName.indexOf("pref_int_number_input") === 0) {
        let elem = document.getElementById(prefName);
        if (elem) {
          elem.value = value;
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
  
  async updateNumberInputPref(e) {
    let target = e.target;
    let prefObj = {};
    prefObj["alltabshelper:" + target.id] = target.value;
    await browser.storage.local.set(prefObj);    
  },
}

window.addEventListener("load", main.init);
