window.__robPost = function (path) {
  var url = path.charAt(0) === "/" ? path : "/" + path;
  if (window.$ && window.$.ajax) {
    return new Promise(function (resolve, reject) {
      window.$.ajax({
        url: url,
        type: "POST",
        success: function (data) {
          resolve(typeof data === "string" ? data : JSON.stringify(data));
        },
        error: function (xhr) {
          reject(
            new Error(
              "HTTP " + (xhr.status || "?") + " " + String(xhr.responseText || "").slice(0, 160),
            ),
          );
        },
      });
    });
  }
  return fetch(url, { method: "POST", credentials: "include" }).then(function (r) {
    return r.text().then(function (text) {
      if (!r.ok) throw new Error("HTTP " + r.status + " " + text.slice(0, 160));
      return text;
    });
  });
};
