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

  async function currentUser() {
    try { return await account.get(); } catch { return null; }
  }

  async function login(email, password) {
    await account.createEmailPasswordSession({ email, password });
    return account.get();
  }

  async function logout() {
    try { await account.deleteSession({ sessionId: "current" }); } catch {}
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
    return tablesDB.createRow({
      databaseId: cfg.databaseId,
      tableId,
      rowId,
      data
    });
  }

  async function update(tableId, rowId, data) {
    return tablesDB.updateRow({
      databaseId: cfg.databaseId,
      tableId,
      rowId,
      data
    });
  }

  async function remove(tableId, rowId) {
    return tablesDB.deleteRow({
      databaseId: cfg.databaseId,
      tableId,
      rowId
    });
  }

  async function get(tableId, rowId) {
    return tablesDB.getRow({
      databaseId: cfg.databaseId,
      tableId,
      rowId
    });
  }

  window.IRONCloud = { cfg, client, account, tablesDB, ID, Query, currentUser, login, logout, list, create, update, remove, get };
})();
