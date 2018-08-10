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

let dontshow_checkbox;

function init() {
  window.removeEventListener("load", init);

  dontshow_checkbox = document.getElementById("dontshow_checkbox");
  dontshow_checkbox.addEventListener("click", dontShowAnymore);
}

async function dontShowAnymore(e) {
  if (e.target.checked) {
    let prefObj = {"alltabshelper:pref_bool_dont_show_update_notification": false};
    await browser.storage.local.set(prefObj);    
  }
}

window.addEventListener("load", init);
