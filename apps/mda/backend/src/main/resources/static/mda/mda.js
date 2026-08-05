(function () {
  'use strict';

  const api = {
    connections: '/api/mda/connections/getStore.htm?pageNo=1&pageSize=200&status=1',
    detail: '/api/mda/connections/getById.htm',
    create: '/api/mda/connections/create.htm',
    update: '/api/mda/connections/update.htm',
    remove: '/api/mda/connections/delete.htm',
    test: '/api/mda/connections/test.htm',
    tree: '/api/mda/metadata/tree.htm',
    execute: '/api/mda/sql/execute.htm'
  };
  const state = { connections: [], selected: null };
  const byId = function (id) { return document.getElementById(id); };

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    loadConnections();
  });

  function bindEvents() {
    byId('addConnectionButton').addEventListener('click', function () { openConnectionDialog(); });
    byId('editConnectionButton').addEventListener('click', editSelectedConnection);
    byId('deleteConnectionButton').addEventListener('click', deleteSelectedConnection);
    byId('refreshTreeButton').addEventListener('click', loadMetadata);
    byId('executeButton').addEventListener('click', executeSql);
    byId('connectionFilter').addEventListener('input', renderConnections);
    byId('connectionForm').addEventListener('submit', saveConnection);
    byId('testConnectionButton').addEventListener('click', testDialogConnection);
    byId('databaseType').addEventListener('change', applyDefaultPort);
    byId('sqlEditor').addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); executeSql(); }
    });
  }

  async function loadConnections(preferredId) {
    setStatus('正在读取连接…');
    try {
      const payload = await selAjax.get(api.connections);
      state.connections = payload.records || [];
      renderConnections();
      const selected = state.connections.find(function (item) { return String(item.id) === String(preferredId); })
        || state.connections.find(function (item) { return state.selected && String(item.id) === String(state.selected.id); })
        || state.connections[0];
      if (selected) { selectConnection(selected); } else { clearSelection(); }
      setStatus('连接列表已更新', state.connections.length + ' 个有效连接');
    } catch (error) { showError(error); }
  }

  function renderConnections() {
    const filter = byId('connectionFilter').value.trim().toLowerCase();
    const root = byId('connectionList');
    root.replaceChildren();
    state.connections.filter(function (item) {
      return !filter || String(item.connectionName || '').toLowerCase().includes(filter)
        || String(item.databaseType || '').toLowerCase().includes(filter);
    }).forEach(function (item) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mda-connection-item' + (state.selected && String(item.id) === String(state.selected.id) ? ' is-active' : '');
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', button.classList.contains('is-active'));
      button.innerHTML = '<span class="mda-db-badge">' + escapeHtml(shortType(item.databaseType)) + '</span>'
        + '<span class="mda-connection-copy"><strong>' + escapeHtml(item.connectionName) + '</strong><small>'
        + escapeHtml(connectionSubtitle(item)) + '</small></span>';
      button.addEventListener('click', function () { selectConnection(item); });
      root.appendChild(button);
    });
  }

  function selectConnection(item) {
    state.selected = item;
    renderConnections();
    byId('activeConnectionLabel').textContent = item.connectionName + ' · ' + item.databaseType;
    ['editConnectionButton', 'deleteConnectionButton', 'refreshTreeButton', 'executeButton'].forEach(function (id) { byId(id).disabled = false; });
    byId('autoCommitInput').checked = item.defaultAutoCommit !== false;
    loadMetadata();
  }

  function clearSelection() {
    state.selected = null;
    byId('activeConnectionLabel').textContent = '未选择连接';
    ['editConnectionButton', 'deleteConnectionButton', 'refreshTreeButton', 'executeButton'].forEach(function (id) { byId(id).disabled = true; });
    byId('metadataTree').replaceChildren();
  }

  async function loadMetadata() {
    if (!state.selected) { return; }
    byId('schemaMeta').textContent = '正在读取数据库结构…';
    byId('metadataTree').innerHTML = '<div class="mda-empty-state"><small>读取中…</small></div>';
    try {
      const payload = await selAjax.post(api.tree, { connectionId: state.selected.id });
      const data = payload.data || {};
      byId('schemaMeta').textContent = (data.databaseProductName || state.selected.databaseType) + ' · ' + (data.tableCount || 0) + ' 个表/视图';
      renderTree(data.nodes || []);
      setStatus('数据库结构已读取', data.truncated ? '达到 1000 表显示上限' : state.selected.connectionName);
    } catch (error) {
      byId('schemaMeta').textContent = '结构读取失败';
      byId('metadataTree').replaceChildren();
      showError(error);
    }
  }

  function renderTree(nodes) {
    const root = byId('metadataTree');
    root.replaceChildren();
    nodes.forEach(function (node) { root.appendChild(treeNode(node, 0)); });
    if (!nodes.length) { root.innerHTML = '<div class="mda-empty-state"><small>没有可见数据库对象</small></div>'; }
  }

  function treeNode(node, depth) {
    if (!node.children || !node.children.length) {
      const leaf = document.createElement('div');
      leaf.className = 'mda-tree__leaf';
      leaf.textContent = iconFor(node.type) + ' ' + node.label;
      if (node.typeName) {
        const type = document.createElement('span'); type.className = 'mda-tree__type'; type.textContent = node.typeName; leaf.appendChild(type);
      }
      return leaf;
    }
    const details = document.createElement('details');
    details.open = depth < 2;
    const summary = document.createElement('summary');
    summary.textContent = iconFor(node.type) + ' ' + node.label;
    details.appendChild(summary);
    node.children.forEach(function (child) { details.appendChild(treeNode(child, depth + 1)); });
    return details;
  }

  async function executeSql() {
    if (!state.selected) { return; }
    const sql = byId('sqlEditor').value;
    byId('executeButton').disabled = true;
    byId('resultSummary').textContent = '执行中…';
    setStatus('SQL 正在执行…', state.selected.connectionName);
    try {
      const payload = await selAjax.post(api.execute, {
        connectionId: state.selected.id,
        sql: sql,
        autoCommit: byId('autoCommitInput').checked,
        maxRows: Number(byId('maxRowsInput').value),
        queryTimeoutSeconds: Number(byId('timeoutInput').value)
      });
      renderResults(payload.data || {});
      setStatus('SQL 执行完成', (payload.data && payload.data.elapsedMs || 0) + ' ms');
      loadMetadata();
    } catch (error) {
      byId('resultSummary').textContent = '执行失败';
      byId('resultArea').innerHTML = '<div class="mda-empty-state"><strong>SQL 执行失败</strong><small>' + escapeHtml(error.message) + '</small></div>';
      showError(error);
    } finally { byId('executeButton').disabled = false; }
  }

  function renderResults(data) {
    const root = byId('resultArea');
    root.replaceChildren();
    const results = data.results || [];
    results.forEach(function (result, index) {
      const block = document.createElement('section'); block.className = 'mda-result-block';
      const caption = document.createElement('div'); caption.className = 'mda-result-caption';
      if (result.kind === 'updateCount') {
        caption.textContent = '结果 ' + (index + 1) + ' · 影响 ' + result.updateCount + ' 行'; block.appendChild(caption);
      } else {
        caption.textContent = '结果 ' + (index + 1) + ' · ' + result.rowCount + ' 行' + (result.truncated ? '（已到显示上限）' : '');
        block.appendChild(caption); block.appendChild(resultTable(result));
      }
      root.appendChild(block);
    });
    if (!results.length) { root.innerHTML = '<div class="mda-empty-state"><strong>执行完成</strong><small>驱动没有返回结果集或更新计数</small></div>'; }
    const rows = results.reduce(function (sum, item) { return sum + (item.rowCount || 0); }, 0);
    byId('resultSummary').textContent = results.length + ' 个结果 · ' + rows + ' 行 · ' + (data.elapsedMs || 0) + ' ms';
  }

  function resultTable(result) {
    const table = document.createElement('table'); table.className = 'mda-grid';
    const head = document.createElement('thead'); const headRow = document.createElement('tr');
    (result.columns || []).forEach(function (column) { const th = document.createElement('th'); th.textContent = column.label; th.title = column.typeName || ''; headRow.appendChild(th); });
    head.appendChild(headRow); table.appendChild(head);
    const body = document.createElement('tbody');
    (result.rows || []).forEach(function (row) { const tr = document.createElement('tr'); row.forEach(function (value) { const td = document.createElement('td'); td.textContent = value === null ? 'NULL' : String(value); td.title = td.textContent; tr.appendChild(td); }); body.appendChild(tr); });
    table.appendChild(body); return table;
  }

  function openConnectionDialog(profile) {
    const form = byId('connectionForm'); form.reset();
    byId('connectionDialogTitle').textContent = profile ? '编辑连接' : '新建连接';
    byId('dialogMessage').textContent = '';
    if (profile) { Object.keys(profile).forEach(function (key) { if (form.elements[key] && key !== 'password') { form.elements[key].value = profile[key] == null ? '' : profile[key]; } }); }
    else { form.elements.databaseType.value = 'H2'; form.elements.defaultAutoCommit = true; applyDefaultPort(); }
    byId('connectionDialog').showModal();
  }

  async function editSelectedConnection() {
    if (!state.selected) { return; }
    try { const payload = await selAjax.post(api.detail, { id: state.selected.id }); openConnectionDialog(payload.data); }
    catch (error) { showError(error); }
  }

  async function saveConnection(event) {
    event.preventDefault();
    const values = formValues(); const endpoint = values.id ? api.update : api.create;
    if (!values.password) { delete values.password; }
    try {
      const payload = await selAjax.post(endpoint, values);
      byId('connectionDialog').close();
      await loadConnections(payload.data && payload.data.id);
      setStatus('连接已保存', values.connectionName);
    } catch (error) { setDialogMessage(error.message, true); }
  }

  async function testDialogConnection() {
    const values = formValues();
    if (values.id && !values.password) { values.connectionId = values.id; }
    try {
      setDialogMessage('正在连接…');
      const payload = await selAjax.post(api.test, values);
      setDialogMessage('连接成功 · ' + payload.data.databaseProductName + ' ' + payload.data.databaseProductVersion);
    } catch (error) { setDialogMessage(error.message, true); }
  }

  async function deleteSelectedConnection() {
    if (!state.selected || !window.confirm('删除连接“' + state.selected.connectionName + '”？')) { return; }
    try { await selAjax.post(api.remove, { id: state.selected.id, lastOperateUserId: 1 }); state.selected = null; await loadConnections(); }
    catch (error) { showError(error); }
  }

  function formValues() {
    const data = Object.fromEntries(new FormData(byId('connectionForm')).entries());
    if (data.id) { data.id = Number(data.id); } else { delete data.id; }
    if (data.port) { data.port = Number(data.port); } else { delete data.port; }
    data.defaultAutoCommit = true;
    return data;
  }

  function applyDefaultPort() {
    const ports = { H2: '', MYSQL: 3306, SQLSERVER: 1433, ORACLE: 1521, POSTGRESQL: 5432 };
    byId('port').value = ports[byId('databaseType').value];
  }

  function connectionSubtitle(item) {
    return item.customJdbcUrl || ([item.host, item.port].filter(Boolean).join(':') + (item.databaseName ? ' / ' + item.databaseName : '')) || item.databaseName;
  }
  function shortType(type) { return ({ SQLSERVER: 'MSS', POSTGRESQL: 'PG', MYSQL: 'MY', ORACLE: 'ORA', H2: 'H2' })[type] || '?'; }
  function iconFor(type) { return ({ catalog: '▣', schema: '◇', table: '▦', column: '·' })[type] || '·'; }
  function setDialogMessage(message, error) { const el = byId('dialogMessage'); el.textContent = message; el.classList.toggle('is-error', Boolean(error)); }
  function setStatus(message, detail) { byId('statusMessage').textContent = message; byId('statusDetail').textContent = detail || 'H2 · MySQL · SQL Server · Oracle · PostgreSQL'; byId('statusMessage').parentElement.classList.remove('is-error'); }
  function showError(error) { byId('statusMessage').textContent = error.message; byId('statusMessage').parentElement.classList.add('is-error'); }
  function escapeHtml(value) { const span = document.createElement('span'); span.textContent = value == null ? '' : String(value); return span.innerHTML; }
})();
