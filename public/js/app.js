// public/js/app.js
async function api(path, opts = {}) {
  const res = await fetch(
    path,
    Object.assign(
      {
        headers: { "Content-Type": "application/json" },
      },
      opts
    )
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function checkAuth() {
  try {
    await api("/api/me");
  } catch {
    window.location.href = "/";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== "/dashboard.html") {
    return;
  }

  await checkAuth();

  const navBtns = document.querySelectorAll(".nav-btn");
  const content = document.getElementById("content");
  const title = document.getElementById("sectionTitle");

  navBtns.forEach((b) =>
    b.addEventListener("click", () => {
      navBtns.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      loadView(b.dataset.view);
    })
  );

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    window.location.href = "/";
  });

  // Load default
  loadView("usuarios");

  async function loadView(view) {
    title.textContent = view.charAt(0).toUpperCase() + view.slice(1);
    content.innerHTML = '<p class="small">Cargando...</p>';
    try {
      if (view === "usuarios") return renderUsuarios();
      if (view === "productos") return renderProductos();
      if (view === "config") return renderConfig();
    } catch (err) {
      content.innerHTML = `<p class="small">Error: ${
        err.error || JSON.stringify(err)
      }</p>`;
    }
  }

  async function renderUsuarios() {
    const { usuarios } = await api("/api/usuarios");
    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML = `<thead><tr><th>Id</th><th>Nombre</th><th>Usuario</th><th>Cargo</th><th></th></tr></thead>`;
    const body = document.createElement("tbody");
    usuarios.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${u.id}</td><td>${u.nombre} ${u.apellido}</td><td>${
        u.username
      }</td><td class="small">${u.cargo || ""}</td>
                      <td><button data-id="${
                        u.id
                      }" class="btn-ghost">Borrar</button></td>`;
      body.appendChild(tr);
    });
    table.appendChild(body);
    // Form para crear usuario
    const form = document.createElement("div");
    form.innerHTML = `
      <h3>Crear usuario</h3>
      <input id="u_nombre" placeholder="Nombre" />
      <input id="u_apellido" placeholder="Apellido" />
      <input id="u_username" placeholder="Username" />
      <input id="u_password" placeholder="Password" />
      <button id="crearUsuario" class="btn">Crear</button>
      <hr/>
    `;
    content.innerHTML = "";
    content.appendChild(form);
    content.appendChild(table);

    // borrar
    table.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Borrar usuario " + id + "?")) return;
        await api("/api/usuarios/" + id, { method: "DELETE" });
        renderUsuarios();
      });
    });

    document
      .getElementById("crearUsuario")
      .addEventListener("click", async () => {
        const nombre = document.getElementById("u_nombre").value;
        const apellido = document.getElementById("u_apellido").value;
        const username = document.getElementById("u_username").value;
        const password = document.getElementById("u_password").value;
        await api("/api/usuarios", {
          method: "POST",
          body: JSON.stringify({ nombre, apellido, username, password }),
        });
        renderUsuarios();
      });
  }

  async function renderProductos() {
    const { productos } = await api("/api/productos");
    const container = document.createElement("div");
    container.className = "card-grid";
    productos.forEach((p) => {
      const c = document.createElement("div");
      c.className = "product-card";
      c.innerHTML = `<strong>${p.id}</strong><div class="small">${
        p.marca || ""
      } • ${p.tipo || ""}</div>
                     <p>${p.descripcion || ""}</p>
                     <div class="small">Stock: ${p.stock || 0} — Costo: ${
        p.costo || 0
      }</div>
                     <div style="margin-top:8px">
                       <button class="btn-ghost" data-id="${
                         p.id
                       }">Borrar</button>
                     </div>`;
      container.appendChild(c);
    });
    content.innerHTML = "<h3>Productos</h3>";
    content.appendChild(container);

    content.querySelectorAll("button[data-id]").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = b.dataset.id;
        if (!confirm("Borrar producto " + id + "?")) return;
        await api("/api/productos/" + id, { method: "DELETE" });
        renderProductos();
      });
    });

    // Form simple para añadir
    const form = document.createElement("div");
    form.innerHTML = `
      <h4>Añadir producto rápido</h4>
      <input id="p_desc" placeholder="Descripcion" />
      <input id="p_stock" placeholder="Stock" />
      <input id="p_costo" placeholder="Costo" />
      <button id="addProd" class="btn">Agregar</button>
    `;
    content.insertBefore(form, container);
    document.getElementById("addProd").addEventListener("click", async () => {
      const descripcion = document.getElementById("p_desc").value;
      const stock = parseInt(document.getElementById("p_stock").value || 0);
      const costo = parseFloat(document.getElementById("p_costo").value || 0);
      await api("/api/productos", {
        method: "POST",
        body: JSON.stringify({ descripcion, stock, costo }),
      });
      renderProductos();
    });
  }

  async function renderConfig() {
    const [cargosRes, tiposRes, marcasRes] = await Promise.all([
      api("/api/config/cargos"),
      api("/api/config/tipos"),
      api("/api/config/marcas"),
    ]);
    content.innerHTML = `<h3>Configuración</h3>
      <div><strong>Cargos</strong><pre>${JSON.stringify(
        cargosRes.cargos,
        null,
        2
      )}</pre></div>
      <div><strong>Tipos</strong><pre>${JSON.stringify(
        tiposRes.tipos,
        null,
        2
      )}</pre></div>
      <div><strong>Marcas</strong><pre>${JSON.stringify(
        marcasRes.marcas,
        null,
        2
      )}</pre></div>
    `;
  }
});
