// scripts/hash-example-password.js
const bcrypt = require("bcryptjs");
const pwd = process.argv[2] || "12345";
bcrypt.hash(pwd, 10).then((h) => {
  console.log("Password:", pwd);
  console.log("Hash:", h);
  process.exit(0);
});
