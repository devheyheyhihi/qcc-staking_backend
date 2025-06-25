function unscientificNotation(x) {
  x = x.toString();
  if (!x.toString().includes("e")) {
    return x;
  }
  if (Math.abs(x) < 1.0) {
    var e = parseInt(x.split("e-")[1]);
    if (e) {
      x = x.split("e-")[0].replace(".", "");
      x = "0." + new Array(e).join("0") + x;
    }
  } else {
    var e = parseInt(x.split("+")[1]);
    x = x.split("e")[0].replace(".", "");
    const xLength = x.length;
    x += new Array(e - xLength + 2).join("0");
  }
  return x;
}

module.exports = {
  unscientificNotation
};