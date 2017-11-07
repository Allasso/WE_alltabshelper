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
