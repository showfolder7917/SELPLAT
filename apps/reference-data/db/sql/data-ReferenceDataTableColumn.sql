-- 五个管理模块的初始表头采用缺失补充策略；以后在页面修改后，重启不会覆盖真实配置。
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004001, 'ReferenceDataType', 'type-management', 'coordinate', 'resourceCode', 'projectCode', '类型坐标', 'タイプ座標', 'Type coordinate', '18%', 'stack', TRUE, 1, 10
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataType' AND viewCode='type-management' AND columnCode='coordinate');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004002, 'ReferenceDataType', 'type-management', 'nameZh', 'nameZh', '中文名称', '中国語名', 'Chinese name', '18%', 'text', TRUE, 1, 20
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataType' AND viewCode='type-management' AND columnCode='nameZh');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004003, 'ReferenceDataType', 'type-management', 'localized', 'nameEn', 'nameJa', '英文 / 日文', '英語 / 日本語', 'English / Japanese', '22%', 'stack', TRUE, 1, 30
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataType' AND viewCode='type-management' AND columnCode='localized');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004004, 'ReferenceDataType', 'type-management', 'status', 'status', '状态', '状態', 'Status', '9%', 'badge', TRUE, 1, 40
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataType' AND viewCode='type-management' AND columnCode='status');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004005, 'ReferenceDataType', 'type-management', 'sortnum', 'sortnum', '排序', '並び順', 'Order', '8%', 'text', TRUE, 1, 50
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataType' AND viewCode='type-management' AND columnCode='sortnum');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004006, 'ReferenceDataType', 'type-management', 'updatedAt', 'updatedAt', '更新时间', '更新日時', 'Updated at', '15%', 'time', TRUE, 1, 60
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataType' AND viewCode='type-management' AND columnCode='updatedAt');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004007, 'ReferenceDataType', 'type-management', 'actions', 'id', '操作', '操作', 'Actions', '10%', 'actions', TRUE, 1, 70
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataType' AND viewCode='type-management' AND columnCode='actions');

INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004011, 'ReferenceDataTreeNode', 'tree-node-management', 'node', 'nodeCode', 'nodeValue', '节点编码 / 值', 'ノードコード / 値', 'Node code / value', '20%', 'stack', TRUE, 1, 10
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTreeNode' AND viewCode='tree-node-management' AND columnCode='node');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004012, 'ReferenceDataTreeNode', 'tree-node-management', 'relation', 'typeId', 'parentId', '类型 / 父节点', 'タイプ / 親ノード', 'Type / parent', '14%', 'stack', TRUE, 1, 20
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTreeNode' AND viewCode='tree-node-management' AND columnCode='relation');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004013, 'ReferenceDataTreeNode', 'tree-node-management', 'labelZh', 'labelZh', '中文名称', '中国語名', 'Chinese label', '18%', 'text', TRUE, 1, 30
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTreeNode' AND viewCode='tree-node-management' AND columnCode='labelZh');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004014, 'ReferenceDataTreeNode', 'tree-node-management', 'localized', 'labelEn', 'labelJa', '英文 / 日文', '英語 / 日本語', 'English / Japanese', '20%', 'stack', TRUE, 1, 40
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTreeNode' AND viewCode='tree-node-management' AND columnCode='localized');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004015, 'ReferenceDataTreeNode', 'tree-node-management', 'status', 'status', '状态', '状態', 'Status', '9%', 'badge', TRUE, 1, 50
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTreeNode' AND viewCode='tree-node-management' AND columnCode='status');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004016, 'ReferenceDataTreeNode', 'tree-node-management', 'sortnum', 'sortnum', '排序', '並び順', 'Order', '8%', 'text', TRUE, 1, 60
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTreeNode' AND viewCode='tree-node-management' AND columnCode='sortnum');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004017, 'ReferenceDataTreeNode', 'tree-node-management', 'actions', 'id', '操作', '操作', 'Actions', '11%', 'actions', TRUE, 1, 70
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTreeNode' AND viewCode='tree-node-management' AND columnCode='actions');

INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004021, 'ReferenceDataOption', 'option-management', 'option', 'optionValue', 'groupCode', '选项值 / 分组', '選択値 / グループ', 'Value / group', '20%', 'stack', TRUE, 1, 10
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataOption' AND viewCode='option-management' AND columnCode='option');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004022, 'ReferenceDataOption', 'option-management', 'typeId', 'typeId', '所属类型', '所属タイプ', 'Type', '10%', 'text', TRUE, 1, 20
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataOption' AND viewCode='option-management' AND columnCode='typeId');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004023, 'ReferenceDataOption', 'option-management', 'labelZh', 'labelZh', '中文名称', '中国語名', 'Chinese label', '18%', 'text', TRUE, 1, 30
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataOption' AND viewCode='option-management' AND columnCode='labelZh');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004024, 'ReferenceDataOption', 'option-management', 'localized', 'labelEn', 'labelJa', '英文 / 日文', '英語 / 日本語', 'English / Japanese', '20%', 'stack', TRUE, 1, 40
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataOption' AND viewCode='option-management' AND columnCode='localized');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004025, 'ReferenceDataOption', 'option-management', 'disabled', 'disabled', '禁止选择', '選択禁止', 'Disabled', '9%', 'boolean', TRUE, 1, 50
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataOption' AND viewCode='option-management' AND columnCode='disabled');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004026, 'ReferenceDataOption', 'option-management', 'status', 'status', '状态', '状態', 'Status', '9%', 'badge', TRUE, 1, 60
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataOption' AND viewCode='option-management' AND columnCode='status');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004027, 'ReferenceDataOption', 'option-management', 'actions', 'id', '操作', '操作', 'Actions', '12%', 'actions', TRUE, 1, 70
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataOption' AND viewCode='option-management' AND columnCode='actions');

INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004031, 'ReferenceDataContextMenuItem', 'context-menu-management', 'item', 'itemCode', 'command', '菜单编码 / 命令', 'メニューコード / コマンド', 'Menu code / command', '22%', 'stack', TRUE, 1, 10
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataContextMenuItem' AND viewCode='context-menu-management' AND columnCode='item');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004032, 'ReferenceDataContextMenuItem', 'context-menu-management', 'relation', 'typeId', 'parentId', '类型 / 父菜单', 'タイプ / 親メニュー', 'Type / parent', '14%', 'stack', TRUE, 1, 20
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataContextMenuItem' AND viewCode='context-menu-management' AND columnCode='relation');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004033, 'ReferenceDataContextMenuItem', 'context-menu-management', 'labelZh', 'labelZh', '中文名称', '中国語名', 'Chinese label', '18%', 'text', TRUE, 1, 30
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataContextMenuItem' AND viewCode='context-menu-management' AND columnCode='labelZh');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004034, 'ReferenceDataContextMenuItem', 'context-menu-management', 'localized', 'labelEn', 'labelJa', '英文 / 日文', '英語 / 日本語', 'English / Japanese', '20%', 'stack', TRUE, 1, 40
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataContextMenuItem' AND viewCode='context-menu-management' AND columnCode='localized');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004035, 'ReferenceDataContextMenuItem', 'context-menu-management', 'disabled', 'disabled', '禁止执行', '実行禁止', 'Disabled', '9%', 'boolean', TRUE, 1, 50
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataContextMenuItem' AND viewCode='context-menu-management' AND columnCode='disabled');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004036, 'ReferenceDataContextMenuItem', 'context-menu-management', 'status', 'status', '状态', '状態', 'Status', '9%', 'badge', TRUE, 1, 60
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataContextMenuItem' AND viewCode='context-menu-management' AND columnCode='status');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004037, 'ReferenceDataContextMenuItem', 'context-menu-management', 'actions', 'id', '操作', '操作', 'Actions', '8%', 'actions', TRUE, 1, 70
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataContextMenuItem' AND viewCode='context-menu-management' AND columnCode='actions');

INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004041, 'ReferenceDataTableColumn', 'table-column-management', 'target', 'tableCode', 'viewCode', '数据库表 / 页面', 'テーブル / ページ', 'Table / view', '20%', 'stack', TRUE, 1, 10
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTableColumn' AND viewCode='table-column-management' AND columnCode='target');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004042, 'ReferenceDataTableColumn', 'table-column-management', 'field', 'columnCode', 'fieldCode', '列编码 / 字段', '列コード / フィールド', 'Column / field', '18%', 'stack', TRUE, 1, 20
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTableColumn' AND viewCode='table-column-management' AND columnCode='field');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004043, 'ReferenceDataTableColumn', 'table-column-management', 'labelZh', 'labelZh', '中文表头', '中国語見出し', 'Chinese header', '16%', 'text', TRUE, 1, 30
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTableColumn' AND viewCode='table-column-management' AND columnCode='labelZh');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, secondaryField, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004044, 'ReferenceDataTableColumn', 'table-column-management', 'display', 'width', 'renderer', '宽度 / 渲染', '幅 / レンダラー', 'Width / renderer', '14%', 'stack', TRUE, 1, 40
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTableColumn' AND viewCode='table-column-management' AND columnCode='display');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004045, 'ReferenceDataTableColumn', 'table-column-management', 'visible', 'visible', '页面显示', 'ページ表示', 'Visible', '10%', 'boolean', TRUE, 1, 50
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTableColumn' AND viewCode='table-column-management' AND columnCode='visible');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004046, 'ReferenceDataTableColumn', 'table-column-management', 'status', 'status', '状态', '状態', 'Status', '9%', 'badge', TRUE, 1, 60
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTableColumn' AND viewCode='table-column-management' AND columnCode='status');
INSERT INTO ReferenceDataTableColumn (id, tableCode, viewCode, columnCode, fieldCode, labelZh, labelJa, labelEn, width, renderer, visible, status, sortnum)
SELECT 900000004047, 'ReferenceDataTableColumn', 'table-column-management', 'actions', 'id', '操作', '操作', 'Actions', '13%', 'actions', TRUE, 1, 70
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTableColumn WHERE tableCode='ReferenceDataTableColumn' AND viewCode='table-column-management' AND columnCode='actions');
