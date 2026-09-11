(() => {
  const cfg = window.IRON_APPWRITE;
  if (!cfg) throw new Error("IRON_APPWRITE configuration missing");
  if (!window.Appwrite) throw new Error("Appwrite Web SDK missing");

  const client = new Appwrite.Client()
    .setEndpoint(cfg.endpoint)
    .setProject(cfg.projectId);

  const account = new Appwrite.Account(client);
  const tablesDB = new Appwrite.TablesDB(client);
  const ID = Appwrite.ID;
  const Query = Appwrite.Query;

  function errorInfo(e) {
    return {
      message: e?.message || String(e),
      code: e?.code ?? null,
      type: e?.type ?? null
    };
  }

  async function currentUser() {
    try {
      return await account.get();
    } catch (e) {
      // 401 means Appwrite is reachable but no active session exists.
      if (e?.code === 401) return null;
      throw e;
    }
  }

  async function login(email, password) {
    await account.createEmailPasswordSession({ email, password });
    return await account.get();
  }

  async function logout() {
    await account.deleteSession({ sessionId: "current" });
  }

  async function list(tableId, queries=[]) {
    const result = await tablesDB.listRows({
      databaseId: cfg.databaseId,
      tableId,
      queries
    });
    return result.rows || [];
  }

  async function create(tableId, data, rowId=ID.unique()) {
    return await tablesDB.createRow({
      databaseId: cfg.databaseId,
      tableId,
      rowId,
      data
    });
  }

  async function update(tableId, rowId, data) {
    return await tablesDB.updateRow({
      databaseId: cfg.databaseId,
      tableId,
      rowId,
      data
    });
  }

  async function remove(tableId, rowId) {
    return await tablesDB.deleteRow({
      databaseId: cfg.databaseId,
      tableId,
      rowId
    });
  }

  async function get(tableId, rowId) {
    return await tablesDB.getRow({
      databaseId: cfg.databaseId,
      tableId,
      rowId
    });
  }

  async function diagnose() {
    const result = {
      sdk: true,
      endpoint: cfg.endpoint,
      projectId: cfg.projectId,
      databaseId: cfg.databaseId,
      hostname: location.hostname,
      user: null,
      account: null,
      tables: {}
    };

    try {
      const u = await account.get();
      result.user = { id: u.$id, email: u.email };
      result.account = { ok: true };
    } catch(e) {
      const info = errorInfo(e);
      result.account = { ok: e?.code === 401, loggedIn: false, ...info };
      if (e?.code !== 401) return result;
    }

    if (!result.user) return result;

    for (const [name, tableId] of Object.entries(cfg.tables)) {
      try {
        const rows = await list(tableId, [Query.limit(1)]);
        result.tables[name] = { ok: true, id: tableId, readable: true, sampleCount: rows.length };
      } catch(e) {
        result.tables[name] = { ok: false, id: tableId, ...errorInfo(e) };
      }
    }
    return result;
  }

  window.IRONCloud = {
    cfg, client, account, tablesDB, ID, Query,
    currentUser, login, logout, list, create, update, remove, get, diagnose, errorInfo
  };
})();
