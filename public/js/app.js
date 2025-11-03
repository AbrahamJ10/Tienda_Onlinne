// public/js/app.js
// Frontend JS completo y corregido para manejar productos, filtros, tipos y marcas

const tabla = document.querySelector("#tablaProductos tbody");
const form = document.querySelector("#formProducto");
const popup = document.getElementById("popupForm");
const overlay = document.getElementById("overlay");
const btnAgregar = document.getElementById("btnAgregar");
const cerrarBtn = document.getElementById("cerrarBtn");

let editId = null;
let productosGlobal = [];

/* ---------------------------
   POPUPS TIPO / MARCA ELEMENTS
   --------------------------- */
const btnTipo = document.getElementById("btnTipo");
const btnMarca = document.getElementById("btnMarca");
const popupTipo = document.getElementById("popupTipo");
const popupMarca = document.getElementById("popupMarca");
const cerrarTipo = document.getElementById("cerrarTipo");
const cerrarMarca = document.getElementById("cerrarMarca");

/* ---------------------------
   POPUP PRODUCTO (ABRIR / CERRAR)
   --------------------------- */
btnAgregar.addEventListener("click", () => {
  editId = null;
  form.reset();
  popup.style.display = "block";
  overlay.style.display = "block";
});

cerrarBtn.addEventListener("click", () => {
  popup.style.display = "none";
  overlay.style.display = "none";
});

/* ---------------------------
   FUNCIONES UTILES
   --------------------------- */
function formatearFecha(fechaStr) {
  if (!fechaStr) return "";
  const fecha = new Date(fechaStr);
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/* ---------------------------
   CARGAR TIPOS Y MARCAS (SELECTS)
   --------------------------- */
async function cargarTiposYMarcas() {
  try {
    const [tiposRes, marcasRes] = await Promise.all([
      fetch("/api/tipos"),
      fetch("/api/marcas"),
    ]);
    const tipos = await tiposRes.json();
    const marcas = await marcasRes.json();

    document.getElementById("id_tipo").innerHTML = tipos.length
      ? tipos.map((t) => `<option value="${t.id}">${t.tipo}</option>`).join("")
      : "<option value=''>--Sin tipos--</option>";

    document.getElementById("id_marca").innerHTML = marcas.length
      ? marcas
          .map((m) => `<option value="${m.id}">${m.marca}</option>`)
          .join("")
      : "<option value=''>--Sin marcas--</option>";
  } catch (err) {
    console.error("Error cargando tipos/marcas:", err);
  }
}

/* ---------------------------
   CARGAR PRODUCTOS
   --------------------------- */
async function cargarProductos() {
  try {
    const res = await fetch("/api/productos");
    productosGlobal = await res.json();
    mostrarProductos(productosGlobal);
  } catch (err) {
    console.error("Error al cargar productos:", err);
  }
}

function mostrarProductos(lista) {
  tabla.innerHTML = lista
    .map(
      (p) => `
    <tr>
      <td>${p.id}</td>
      <td>${formatearFecha(p.fecha)}</td>
      <td>${p.tipo || ""}</td>
      <td>${p.marca || ""}</td>
      <td>${p.peso || ""}</td>
      <td>${p.descripcion || ""}</td>
      <td>${formatearFecha(p.fv)}</td>
      <td>${p.stock ?? ""}</td>
      <td>${p.costo ?? ""}</td>
      <td>${p.imagen ? `<img src="${p.imagen}" width="50">` : ""}</td>
      <td>${p.estado ? "Disponible" : "Agotado"}</td>
      <td>
        <button class="edit" onclick="editar('${p.id}')">Editar</button>
        <button class="delete" onclick="eliminar('${p.id}')">Eliminar</button>
      </td>
    </tr>`
    )
    .join("");
}

/* ---------------------------
   EDITAR / ELIMINAR PRODUCTO
   --------------------------- */
async function editar(id) {
  const p = productosGlobal.find((x) => x.id === id);
  if (!p) return alert("Producto no encontrado");

  editId = id;

  // 1️⃣ Cargar tipos y marcas antes de mostrar el popup
  await cargarTiposYMarcas();

  // 2️⃣ Aseguramos que los select tengan los valores correctos (por id o por nombre)
  const tipoSelect = form.id_tipo;
  const marcaSelect = form.id_marca;

  // Buscar por ID
  if (p.id_tipo && [...tipoSelect.options].some((o) => o.value == p.id_tipo)) {
    tipoSelect.value = p.id_tipo;
  }
  // Buscar por texto (fallback)
  else if (p.tipo) {
    const optTipo = [...tipoSelect.options].find(
      (o) => o.textContent === p.tipo
    );
    if (optTipo) tipoSelect.value = optTipo.value;
  }

  if (
    p.id_marca &&
    [...marcaSelect.options].some((o) => o.value == p.id_marca)
  ) {
    marcaSelect.value = p.id_marca;
  } else if (p.marca) {
    const optMarca = [...marcaSelect.options].find(
      (o) => o.textContent === p.marca
    );
    if (optMarca) marcaSelect.value = optMarca.value;
  }

  // 3️⃣ Asignar los demás valores
  form.peso.value = p.peso || "";
  form.descripcion.value = p.descripcion || "";
  form.fv.value = p.fv ? p.fv.split("T")[0] : "";
  form.stock.value = p.stock ?? "";
  form.costo.value = p.costo ?? "";
  form.estado.value = p.estado ? "Disponible" : "Agotado";

  // 4️⃣ Mostrar previsualización de imagen (opcional)
  const imgPrev = document.getElementById("imgPreview");
  if (imgPrev) {
    imgPrev.src = p.imagen || "";
    imgPrev.style.display = p.imagen ? "block" : "none";
  }

  // 5️⃣ Mostrar popup
  popup.style.display = "block";
  overlay.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.editar = editar; // exponer global

/* ---------------------------
   GUARDAR PRODUCTO (POST / PUT)
   --------------------------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = new FormData(form);
    const url = editId ? `/api/productos/${editId}` : "/api/productos";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, { method, body: data });
    if (res.ok) {
      await cargarProductos();
      await cargarTiposYMarcas();
      popup.style.display = "none";
      overlay.style.display = "none";
      editId = null;
    } else {
      const err = await res.json();
      alert("Error: " + (err.error || "no se pudo guardar"));
    }
  } catch (err) {
    console.error("Error guardando producto:", err);
  }
});

/* ---------------------------
   FILTROS (ya existentes)
   --------------------------- */
const filtroGeneral = document.getElementById("filtroGeneral");
const filtroEstado = document.getElementById("filtroEstado");
const filtroStockMin = document.getElementById("filtroStockMin");
const filtroFV = document.getElementById("filtroFV");

if (filtroGeneral) filtroGeneral.addEventListener("input", aplicarFiltros);
if (filtroEstado) filtroEstado.addEventListener("change", aplicarFiltros);
if (filtroStockMin) filtroStockMin.addEventListener("input", aplicarFiltros);
if (filtroFV) filtroFV.addEventListener("input", aplicarFiltros);

document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
  filtroGeneral.value = "";
  filtroEstado.value = "";
  filtroStockMin.value = "";
  filtroFV.value = "";
  mostrarProductos(productosGlobal);
});

function aplicarFiltros() {
  const texto = (filtroGeneral.value || "").toLowerCase();
  const estado = filtroEstado.value;
  const stockMin = parseInt(filtroStockMin.value) || 0;
  const fvFiltro = filtroFV.value;

  const filtrados = productosGlobal.filter((p) => {
    const coincideTexto =
      (p.descripcion || "").toLowerCase().includes(texto) ||
      ((p.tipo || "") + "").toLowerCase().includes(texto) ||
      ((p.marca || "") + "").toLowerCase().includes(texto);

    const coincideEstado = estado ? p.estado === estado : true;
    const coincideStock = (p.stock ?? 0) >= stockMin;
    const coincideFV = fvFiltro ? new Date(p.fv) <= new Date(fvFiltro) : true;

    return coincideTexto && coincideEstado && coincideStock && coincideFV;
  });

  mostrarProductos(filtrados);
}

/* ---------------------------
   GESTIÓN TIPOS / MARCAS (POPUPS)
   --------------------------- */

// abrir popups (mostrar overlay)
btnTipo.onclick = async () => {
  popupTipo.style.display = "block";
  overlay.style.display = "block";
  await cargarListaTipos();
};

btnMarca.onclick = async () => {
  popupMarca.style.display = "block";
  overlay.style.display = "block";
  await cargarListaMarcas();
};

// cerrar popups
cerrarTipo.onclick = () => {
  popupTipo.style.display = "none";
  overlay.style.display = "none";
};
cerrarMarca.onclick = () => {
  popupMarca.style.display = "none";
  overlay.style.display = "none";
};

// agregar tipo
document.getElementById("agregarTipo").onclick = async () => {
  const nombre = document.getElementById("nuevoTipo").value.trim();
  if (!nombre) return alert("Ingrese un nombre");
  try {
    const res = await fetch("/api/tipos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: nombre }),
    });
    if (!res.ok) {
      const err = await res.json();
      return alert("Error: " + (err.error || "no se pudo agregar tipo"));
    }
    document.getElementById("nuevoTipo").value = "";
    await cargarListaTipos();
    await cargarTiposYMarcas();
  } catch (err) {
    console.error(err);
  }
};

// cargar lista tipos (mostrar con botón eliminar)
async function cargarListaTipos() {
  try {
    const tipos = await fetch("/api/tipos").then((r) => r.json());
    document.getElementById("listaTipos").innerHTML = tipos
      .map(
        (t) =>
          `<li>${t.tipo} <button onclick="eliminarTipo('${t.id}')">X</button></li>`
      )
      .join("");
  } catch (err) {
    console.error("Error cargando tipos:", err);
  }
}

// eliminar tipo
async function eliminarTipo(id) {
  if (!confirm("¿Eliminar este tipo?")) return;
  try {
    const res = await fetch(`/api/tipos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      return alert("Error: " + (err.error || "no se pudo eliminar"));
    }
    await cargarListaTipos();
    await cargarTiposYMarcas();
  } catch (err) {
    console.error(err);
  }
}
window.eliminarTipo = eliminarTipo; // exponer global (onclick inline)

// agregar marca
document.getElementById("agregarMarca").onclick = async () => {
  const nombre = document.getElementById("nuevaMarca").value.trim();
  if (!nombre) return alert("Ingrese un nombre");
  try {
    const res = await fetch("/api/marcas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marca: nombre }),
    });
    if (!res.ok) {
      const err = await res.json();
      return alert("Error: " + (err.error || "no se pudo agregar marca"));
    }
    document.getElementById("nuevaMarca").value = "";
    await cargarListaMarcas();
    await cargarTiposYMarcas();
  } catch (err) {
    console.error(err);
  }
};

// cargar lista marcas
async function cargarListaMarcas() {
  try {
    const marcas = await fetch("/api/marcas").then((r) => r.json());
    document.getElementById("listaMarcas").innerHTML = marcas
      .map(
        (m) =>
          `<li>${m.marca} <button onclick="eliminarMarca('${m.id}')">X</button></li>`
      )
      .join("");
  } catch (err) {
    console.error("Error cargando marcas:", err);
  }
}

// eliminar marca
async function eliminarMarca(id) {
  if (!confirm("¿Eliminar esta marca?")) return;
  try {
    const res = await fetch(`/api/marcas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      return alert("Error: " + (err.error || "no se pudo eliminar"));
    }
    await cargarListaMarcas();
    await cargarTiposYMarcas();
  } catch (err) {
    console.error(err);
  }
}
window.eliminarMarca = eliminarMarca; // exponer global

/* ---------------------------
   INICIALIZAR
   --------------------------- */
cargarTiposYMarcas();
cargarProductos();
