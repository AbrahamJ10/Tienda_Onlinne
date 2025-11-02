import bcrypt from "bcryptjs";

const password = "12345"; // 👉 tu contraseña actual

bcrypt.hash(password, 10).then((hash) => {
  console.log("Contraseña encriptada:", hash);
});
