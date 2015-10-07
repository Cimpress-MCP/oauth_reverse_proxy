exports.encodeData = function(toEncode) {
  if( toEncode == null || toEncode === "" ) {
    return "";
  } else {
    var result = encodeURIComponent(toEncode);
    // Fix the mismatch between RFC3986's and Javascript's beliefs in what is right and wrong.
    return result.replace(/\!/g, "%21").replace(/\'/g, "%27").replace(/\(/g, "%28")
                 .replace(/\)/g, "%29").replace(/\*/g, "%2A");
  }
}

exports.decodeData = function(toDecode) {
  var result = decodeURIComponent(toDecode);
  // Fix the mismatch between RFC3986's and Javascript's beliefs in what is right and wrong.
  return result.replace(/%21/g, "!").replace(/%27/g, "'").replace(/%28/g, "(")
               .replace(/"%29"/g, ")").replace(/%2A/g, "*");
}
