const CryptoJS = require('crypto-js');
const nacl = require('tweetnacl');

const HEX_TIME_SIZE = 14;
const KEY_SIZE = 64;

const timeHash = (obj, utime) => {
  return hextime(utime) + hash(obj);
};

const utime = () => {
  return Date.now() * 1000;
};

const hextime = (_utime) => {
  let time = _utime;
  if (typeof time !== "number") {
    time = utime();
  }

  return time.toString(16).padStart(HEX_TIME_SIZE, "0").slice(0, HEX_TIME_SIZE);
};

const cryptoHash = (algo, stringData) => {
  return CryptoJS[algo](stringData).toString(CryptoJS.enc.Hex);
};

const stringToUnicode = (str) => {
  if (!str) {
    return "";
  }

  return Array.prototype.map
    .call(str, function (char) {
      let c = char.charCodeAt(0).toString(16);

      if (c.length > 2) {
        return "\\u" + c;
      }

      return char;
    })
    .join("");
};

const toString = (input) => {
  let s;

  if (typeof input === "object" && input !== null) {
    s = JSON.stringify(input);
  } else {
    s = String(input);
  }

  return stringToUnicode(s.replace(/\//g, "\\/"));
};

const hash = (obj) => {
  return cryptoHash("SHA256", toString(obj));
};

const txHash = (tx) => {
  return timeHash(hash(tx), tx.timestamp);
};

const checksum = (h) => {
  return hash(hash(h)).slice(0, 4);
};

const shortHash = (obj) => {
  return cryptoHash("RIPEMD160", hash(obj));
};

const idHash = (obj) => {
  const short_hash = shortHash(obj);
  return short_hash + checksum(short_hash);
};

const stringToByte = (str) => {
  const byte_array = new Uint8Array(str.length);

  for (let i = 0; i < str.length; i++) {
    byte_array[i] = str.charCodeAt(i);
  }

  return byte_array;
};

const hexToByte = (hex) => {
  if (!hex) {
    return new Uint8Array();
  }

  const bytes = [];

  for (let i = 0, length = hex.length; i < length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }

  return new Uint8Array(bytes);
};

const byteToHex = (byte_array) => {
  if (!byte_array) {
    return "";
  }

  return Array.prototype.map
    .call(byte_array, function (byte) {
      return ("0" + (byte & 0xff).toString(16)).slice(-2);
    })
    .join("")
    .toLowerCase();
};

// Private Key to Public Key
const publicKey = (private_key) => {
  return byteToHex(
    nacl.sign.keyPair.fromSeed(hexToByte(private_key)).publicKey,
  );
};

const address = (public_key) => {
  return idHash(public_key);
};

const signature = (obj, private_key) => {
  return byteToHex(
    nacl.sign.detached(
      stringToByte(toString(obj)),
      hexToByte(private_key + publicKey(private_key)),
    ),
  );
};

const keyValidity = (key) => {
  return /^[a-fA-F0-9]{64}$/.test(key);
};

const signedData = (item, private_key, type = "transaction") => {
  if (!keyValidity(private_key)) {
    console.error("Invalid private key: " + private_key);
    return { public_key: "", signature: "" };
  }

  const data = { public_key: "", signature: "" };

  item.from = address(publicKey(private_key));

  if (typeof item.timestamp !== "number") {
    item.timestamp = utime() + (type === "transaction" ? 2000000 : 0);
  }

  data[type] = item;
  data.public_key = publicKey(private_key);
  data.signature = signature(txHash(item), private_key);

  return data;
};

const buildSendRequestData = (private_key, to, amount, timestamp) => {
  const data = { type: "Send", to, amount, timestamp };
  const d = signedData(data, private_key);
  return JSON.stringify(d);
};

module.exports = {
  buildSendRequestData,
  publicKey,
  address,
  keyValidity
};