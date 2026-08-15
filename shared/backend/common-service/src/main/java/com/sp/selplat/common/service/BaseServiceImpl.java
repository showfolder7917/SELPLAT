package com.sp.selplat.common.service;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.grid.GridColumnDefinitionProvider;
import com.sp.selplat.common.service.grid.GridColumnDefinitionSupport;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.service.logging.OperationLog;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 为业务 Service 统一装配强类型 {@link BaseDao} 门面并提供默认 CRUD 主流程。
 * 主键发号和固定结果构建继续复用 {@link BaseExtendsServiceImpl} 的受保护公共能力。
 *
 * @param <D> 当前业务 Service 对应的 BaseDao 子接口，例如 {@code UniauthUserDao}
 */
public abstract class BaseServiceImpl<D extends BaseDao> extends BaseExtendsServiceImpl<D> implements BaseService {

    // 租户与操作员审计字段只允许由服务端身份上下文写入，前端同名参数会在持久化前被覆盖。
    private static final String TENANT_ID_COLUMN = "tenantId";
    private static final String OPERATOR_ID_COLUMN = "lastOperateUserId";

    // 当前业务 DAO 由 Spring 按子类声明的泛型类型注入，避免每个 ServiceImpl 重复声明 DAO 字段和构造函数。
    @Autowired
    private D dao;

    // 当前工程可选的 Reference Data 本地提供者由 Spring 注入；应用拆分后该列表可以为空。
    @Autowired(required = false)
    private List<GridColumnDefinitionProvider> gridColumnDefinitionProviders = List.of();

    // 环境配置只用于读取未来独立 Reference Data 服务地址，不把机器地址写入源码。
    @Autowired
    private Environment environment;

    /**
     * 返回当前业务 Service 绑定的强类型 DAO 门面。
     *
     * @return Spring 按泛型注入的 DAO 门面，例如 {@code UniauthUserDao} 代理
     */
    @Override
    protected D getDao() {
        // 统一返回 Spring 已按业务 Service 泛型注入的 DAO，子类只能通过 BaseDao 公开契约访问持久层。
        return dao;
    }

    /**
     * 返回当前登录操作员的数据库主键，供全部写入入口统一维护审计字段。
     * 真实传参示例：当前方法无参数；管理员登录上下文对应操作员主键 {@code 1L}。
     * 真实返回示例：当前登录能力接入前固定返回管理员操作员主键 {@code 1L}。
     * 异常或副作用示例：当前实现不读取 Cookie 且不抛异常；登录接入后只替换本方法的身份来源。
     *
     * @return 当前操作员主键；现阶段固定为管理员 {@code 1L}
     */
    protected Long getCurrentOperatorId() {
        // 登录模块尚未接入时统一使用管理员操作员，业务 Service 不再自行写死或接收前端操作员。
        return 1L;
    }

    /**
     * 返回当前登录操作员所属租户的数据库主键，供全部写入入口统一维护数据归属。
     * 真实传参示例：当前方法无参数；管理员所属默认租户主键为 {@code 1L}。
     * 真实返回示例：当前登录能力接入前固定返回默认租户主键 {@code 1L}。
     * 异常或副作用示例：当前实现不读取 Cookie 且不抛异常；登录接入后只替换本方法的租户来源。
     *
     * @return 当前租户主键；现阶段固定为默认租户 {@code 1L}
     */
    protected Long getCurrentTenantId() {
        // 登录模块尚未接入时统一使用默认租户，业务 Service 不再自行写死或接收前端租户。
        return 1L;
    }

    /**
     * 判断当前登录操作员是否拥有管理员权限，供业务 Service 统一保护管理能力。
     * 真实传参示例：当前方法无参数；页面编辑保存前由业务 Service 直接调用。
     * 真实返回示例：登录权限接入前固定返回 {@code true}，表示操作员 {@code 1L} 是管理员。
     * 异常或副作用示例：当前实现不读取 Cookie 且不修改数据；登录接入后只替换本方法的权限来源。
     *
     * @return 当前操作员是否为管理员；现阶段固定返回 {@code true}
     */
    protected boolean isAdmin() {
        // 登录权限模块尚未接入时统一把当前操作员视为管理员，业务 Service 不再各自写死权限结论。
        return true;
    }

    /**
     * 使用当前服务端身份覆盖一条待写入参数中的租户和操作员字段。
     * 真实传参示例：前端伪造 {@code {tenantId:99,lastOperateUserId:88}} 时传入该参数对象。
     * 真实返回示例：业务表存在两个审计列时，执行后参数包含 {@code {tenantId:1,lastOperateUserId:1}}。
     * 异常或副作用示例：参数为空时抛出空指针异常；MDA 等无身份列控制表保持参数原样。
     *
     * @param writeIn 即将进入 DAO 的新增、更新或假删除参数
     */
    protected void applyCurrentIdentity(CommonParam writeIn) {
        // 真实表包含租户列时才覆盖，兼容按规则明确不保存身份字段的 MDA 控制表。
        Map<String, ColumnMetadata> dbColumns = getDao().getDbColumnsMap();
        if (dbColumns.containsKey(TENANT_ID_COLUMN)) {
            // 当前租户覆盖前端同名值，阻止调用方把数据写入其他租户。
            writeIn.putParam(TENANT_ID_COLUMN, getCurrentTenantId());
        }
        if (dbColumns.containsKey(OPERATOR_ID_COLUMN)) {
            // 当前操作员覆盖前端同名值，保证审计字段不能由客户端冒充。
            writeIn.putParam(OPERATOR_ID_COLUMN, getCurrentOperatorId());
        }
    }

    /**
     * 返回当前业务资源指定 Grid 的默认字段列元数据。
     *
     * @param viewCode 前端 Grid 实例编码，例如 {@code user-management}
     * @param locale 当前语言，例如 {@code zh-CN}
     * @return 成功结果，例如配置命中时返回
     *     {@code {"success":true,"data":{"source":"REFERENCE_DATA_TABLE_ELEMENT",}
     *     {@code "viewCode":"user-management","columns":[{"field":"loginName","label":"登录账号"}]}}}；
     *     配置不可用时返回 {@code label=loginName} 的字段名列且不产生页面提示
     * @throws CommonBusinessException viewCode 或 locale 为空时抛出，例如
     *     {@code CommonBusinessException("INVALID_VIEW_CODE", "表格实例编码不能为空。")}
     */
    @Override
    @OperationLog
    public CommonResult getGridColumn(String viewCode, String locale) {
        // 每个前端 Grid 必须有稳定 viewCode，空值统一转换为可识别的业务异常。
        if (!StringUtils.hasText(viewCode)) {
            // 使用稳定错误编码，让前端可以定位 Grid 实例参数。
            throw new CommonBusinessException("INVALID_VIEW_CODE", "表格实例编码不能为空。");
        }
        // 当前语言必须明确传递，避免未来配置接入时无法选择对应标题。
        if (!StringUtils.hasText(locale)) {
            // 语言错误进入公共业务异常响应，不向前端暴露 IllegalArgumentException。
            throw new CommonBusinessException("INVALID_LOCALE", "语言编码不能为空。");
        }
        // 当前 DAO 元数据同时提供真实表名和静默降级字段清单，只读取一次避免重复扫描数据库。
        Map<String, ColumnMetadata> metadata = getDao().getDbColumnsMap();
        String tableName = metadata.values().stream()
                .map(ColumnMetadata::getTableName)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse("");
        // 本地提供者优先；未来配置 service-url 后自动兼容独立 Reference Data HTTP 服务。
        GridColumnDefinitionSupport.Resolution resolution = GridColumnDefinitionSupport.resolve(
                gridColumnDefinitionProviders,
                environment.getProperty("selplat.grid-column.service-url", ""),
                tableName,
                viewCode,
                locale,
                metadata);
        // 使用有序结果保持来源、页面、语言和标准列清单的固定输出顺序。
        Map<String, Object> gridColumn = new LinkedHashMap<>();
        // 来源只用于调用方诊断；无配置不是错误，也不会成为页面提示。
        gridColumn.put("source", resolution.source());
        // 原样保留 Grid 实例编码，供前端区分同一资源的不同表格。
        gridColumn.put("viewCode", viewCode);
        // 原样保留语言，供未来 reference-data 选择对应字段标题。
        gridColumn.put("locale", locale);
        // 无论配置是否命中都返回同一种 SEL Grid 列数组，前端不再维护两套解析分支。
        gridColumn.put("columns", resolution.columns());
        // 返回公共成功结构，业务模块不再重复组装 Grid 字段列。
        return buildSuccessResult(gridColumn, "Grid 字段列查询完成。");
    }

    /**
     * 使用前端分页参数查询当前 DAO 对应表。
     *
     * @param queryIn 来自 Controller 的分页参数和动态查询字段，例如
     *     {@code {"pageNo":1,"pageSize":10,"status":1,"loginNameLike":"admin"}}
     * @return 固定分页结果，例如
     *     {@code {"records":[{"id":1,"loginName":"admin"}],"totalCount":1,"pageNo":1,"pageSize":10}}
     */
    @OperationLog
    public CommonPageResult getStore(CommonPageParam queryIn) {
        // 单独取得前端动态查询字段，避免 DAO 调用同时承担参数解析职责。
        Map<String, Object> queryColumnValueMap = queryIn.getParamMap();
        // 单独取得前端页码，明确分页入口使用的当前页。
        Integer pageNo = queryIn.getPageNo();
        // 单独取得前端每页条数，明确分页入口使用的页面容量。
        Integer pageSize = queryIn.getPageSize();
        // 基础 Service 统一调用 BaseDao 默认分页入口，让业务模块直接复用公共排序口径。
        CommonPageResult pageResult = getDao().getPageList(queryColumnValueMap, pageNo, pageSize);
        // 返回 DAO 已构建的固定分页结构，不在业务 Service 再次包装。
        return pageResult;
    }

    /**
     * 使用前端主键参数查询当前 DAO 对应的单条记录。
     *
     * @param queryIn 来自 Controller 的单主键或复合主键参数，例如 {@code {"id":1}} 或
     *     {@code {"tenantId":10,"orderId":20}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":{"id":1,"loginName":"admin"},"msg":"详情查询完成。"}}
     * @throws CommonBusinessException 当主键不完整或数据库未命中记录时抛出，例如
     *     {@code CommonBusinessException("RECORD_NOT_FOUND", "未找到对应的数据。")}
     */
    @OperationLog
    public CommonResult getById(CommonParam queryIn) {
        // 基础 Service 把原始主键参数交给 BaseDao，由 DAO 元数据解析单主键或复合主键。
        Map<String, Object> record = getDao().getById(queryIn);
        // 未提供完整主键或数据库未命中记录时统一返回明确业务异常。
        if (record == null) {
            throw new CommonBusinessException("RECORD_NOT_FOUND", "未找到对应的数据。");
        }
        // 复用扩展基础层的固定结果构建能力生成详情查询成功结果。
        CommonResult result = buildSuccessResult(record, "详情查询完成。");
        // 返回已经完成统一字段填充的详情结果。
        return result;
    }

    /**
     * 使用前端批量主键参数查询当前 DAO 对应的多条记录。
     *
     * @param queryIn 来自 Controller 的多组单主键或复合主键参数，例如
     *     {@code {"items":[{"id":1},{"id":2}]}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":[{"id":1},{"id":2}],"msg":"批量详情查询完成。"}}
     */
    @OperationLog
    public CommonResult getByIds(CommonBatchParam queryIn) {
        // 基础 Service 把全部主键项一次交给 BaseDao，避免业务模块循环执行单条查询。
        List<Map<String, Object>> records = getDao().getByIds(queryIn);
        // 复用扩展基础层的固定结果构建能力承接 DAO 返回的记录列表。
        CommonResult result = buildSuccessResult(records, "批量详情查询完成。");
        // 返回已经完成统一字段填充的批量详情结果。
        return result;
    }

    /**
     * 为前端新增参数生成主键并写入当前 DAO 对应表。
     *
     * @param saveIn 来自 Controller 的新增字段，例如
     *     {@code {"loginName":"admin","displayName":"管理员"}}
     * @return 含生成主键的固定结果，例如
     *     {@code {"success":true,"data":{"id":100001,"loginName":"admin","displayName":"管理员"},"msg":"新增完成。"}}
     */
    @OperationLog
    public CommonResult insert(CommonParam saveIn) {
        // 复用扩展基础层发号能力，根据当前 DAO 元数据取得单主键或复合主键的全部生成值。
        Map<String, Long> generatedIdMap = getSequence();
        // 把生成主键按字段名写回同一个前端参数对象，供 DAO 直接落库。
        generatedIdMap.forEach(saveIn::putParam);
        // 允许业务聚合在公共发号完成后、DAO 写入前派生只读业务字段，例如用生成主键构造不可变 code。
        prepareGeneratedInsert(saveIn, generatedIdMap);
        // 发号完成后由服务端身份覆盖租户和操作员，前端不再拥有两个字段的写入权。
        applyCurrentIdentity(saveIn);
        // 基础 Service 直接调用 BaseDao 新增入口，不在应用 DAO 建立同义包装方法。
        getDao().insert(saveIn);
        // 单独取得新增后的最终字段映射，供统一返回结构直接复用。
        Map<String, Object> resultData = saveIn.getParamMap();
        // 复用扩展基础层的固定结果构建能力生成新增成功结果。
        CommonResult result = buildSuccessResult(resultData, "新增完成。");
        // 返回包含生成主键和实际新增字段的结果。
        return result;
    }

    /**
     * 为前端批量新增参数逐项生成主键并写入当前 DAO 对应表。
     *
     * @param saveIn 来自 Controller 的批量新增字段，例如
     *     {@code {"items":[{"loginName":"admin"},{"loginName":"auditor"}]}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":[{"id":100001},{"id":100002}],"affectedRows":2,"msg":"批量新增完成。"}}
     */
    @Transactional
    @OperationLog
    public CommonResult insertBatch(CommonBatchParam saveIn) {
        // 单独取得前端批量项，保证主键生成、DAO 调用和结果构建使用同一有序集合。
        List<CommonParam> saveItems = saveIn.getItems();
        // 逐项生成当前表需要的单主键或复合主键。
        for (CommonParam saveItem : saveItems) {
            // 复用扩展基础层发号能力生成本项全部主键值。
            Map<String, Long> generatedIdMap = getSequence();
            // 把本项全部生成主键按字段名写回同一个参数对象。
            generatedIdMap.forEach(saveItem::putParam);
            // 每个批量项都复用同一扩展点派生服务端字段，禁止调用方绕开发号链自行拼接。
            prepareGeneratedInsert(saveItem, generatedIdMap);
            // 每个批量项独立覆盖当前身份，禁止其中任一项携带其他租户或操作员。
            applyCurrentIdentity(saveItem);
        }
        // 公共 DAO 按每组最多一千条执行真实批量新增并返回累计影响行数。
        int affectedRows = getDao().insertBatch(saveIn);
        // 复用扩展基础层的固定结果构建能力返回原批量项和顶层影响行数。
        CommonResult result = buildSuccessResult(saveItems, affectedRows, "批量新增完成。");
        // 返回已经完成统一字段填充的批量新增结果。
        return result;
    }

    /**
     * 在公共号段已经写回新增参数后补充由主键派生的服务端字段。
     * 真实传参示例：发号结果为 {@code {"id":101001}}，业务参数为
     *     {@code {"projectCode":"reference-data","id":101001}}。
     * 真实返回示例：默认实现无返回值且不改变参数；Reference Data 可补入
     *     {@code {"code":"referenceData101001"}}。
     * 异常或副作用示例：子类校验项目编码失败时抛出业务异常，当前新增不会进入 DAO；已消费号段允许跳号。
     *
     * @param saveIn 已写入公共号段主键、尚未进入 DAO 的新增参数
     * @param generatedIdMap 本次公共发号生成的字段和值
     */
    protected void prepareGeneratedInsert(CommonParam saveIn, Map<String, Long> generatedIdMap) {
        // 普通业务表不需要派生字段，保持原有新增行为完全不变。
    }

    /**
     * 使用前端主键和更新字段修改当前 DAO 对应记录。
     *
     * @param saveIn 来自 Controller 的主键和更新字段，例如
     *     {@code {"id":1,"displayName":"管理员"}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":{"id":1,"displayName":"管理员"},"msg":"更新完成。"}}
     */
    @OperationLog
    public CommonResult update(CommonParam saveIn) {
        // 更新前统一写入当前租户和操作员，客户端同名字段不会进入数据库。
        applyCurrentIdentity(saveIn);
        // 基础 Service 把服务端已补身份的参数交给 BaseDao，由 DAO 自动分离主键条件和更新字段。
        getDao().update(saveIn);
        // 单独取得更新后的同一字段映射，保持前端参数来源可追踪。
        Map<String, Object> resultData = saveIn.getParamMap();
        // 复用扩展基础层的固定结果构建能力生成更新成功结果。
        CommonResult result = buildSuccessResult(resultData, "更新完成。");
        // 返回已经完成统一字段填充的更新结果。
        return result;
    }

    /**
     * 使用前端批量主键和更新字段修改当前 DAO 对应记录。
     *
     * @param saveIn 来自 Controller 的批量主键和更新字段，例如
     *     {@code {"items":[{"id":1,"status":0},{"id":2,"status":0}]}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":[{"id":1,"status":0},{"id":2,"status":0}],}
     *     {@code "affectedRows":2,"msg":"批量更新完成。"}}
     */
    @Transactional
    @OperationLog
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        // 单独取得前端批量项，保证 DAO 调用与最终返回使用同一有序集合。
        List<CommonParam> saveItems = saveIn.getItems();
        // 每个批量更新项统一覆盖当前身份，避免不同项冒充其他租户或操作员。
        saveItems.forEach(this::applyCurrentIdentity);
        // 公共 DAO 按一千条分组并按更新字段结构执行真实批量更新。
        int affectedRows = getDao().updateBatch(saveIn);
        // 复用扩展基础层的固定结果构建能力返回原批量项和顶层影响行数。
        CommonResult result = buildSuccessResult(saveItems, affectedRows, "批量更新完成。");
        // 返回已经完成统一字段填充的批量更新结果。
        return result;
    }

    /**
     * 使用前端主键和服务端当前身份假删除当前 DAO 对应记录。
     *
     * @param deleteIn 来自 Controller 的主键，例如 {@code {"id":1}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":{"id":1,"lastOperateUserId":1,"status":0},"msg":"删除完成。"}}
     */
    @OperationLog
    public CommonResult delete(CommonParam deleteIn) {
        // 假删除前由服务端补入当前身份，前端只需要提交目标主键。
        applyCurrentIdentity(deleteIn);
        // 基础 Service 只开放 BaseDao 假删除入口，由 DAO 统一补状态和更新时间。
        getDao().softDelete(deleteIn);
        // 单独取得 DAO 已补删除字段的参数映射。
        Map<String, Object> resultData = deleteIn.getParamMap();
        // 复用扩展基础层的固定结果构建能力生成假删除成功结果。
        CommonResult result = buildSuccessResult(resultData, "删除完成。");
        // 返回已经完成统一字段填充的假删除结果。
        return result;
    }

    /**
     * 使用前端批量主键和审计字段假删除当前 DAO 对应记录。
     *
     * @param deleteIn 来自 Controller 的批量主键和审计字段，例如
     *     {@code {"items":[{"id":1},{"id":2}]}}
     * @return 固定结果，例如
     *     {@code {"success":true,"data":[{"id":1,"status":0},{"id":2,"status":0}],}
     *     {@code "affectedRows":2,"msg":"批量删除完成。"}}
     */
    @Transactional
    @OperationLog
    public CommonResult deleteBatch(CommonBatchParam deleteIn) {
        // 单独取得前端批量项，保证 DAO 补充的删除字段可以直接进入最终返回。
        List<CommonParam> deleteItems = deleteIn.getItems();
        // 每个批量删除项统一使用当前身份，客户端不再提交审计字段。
        deleteItems.forEach(this::applyCurrentIdentity);
        // 公共 DAO 按一千条分组执行假删除并返回累计影响行数。
        int affectedRows = getDao().softDeleteBatch(deleteIn);
        // 复用扩展基础层的固定结果构建能力返回已补删除字段的批量项和顶层影响行数。
        CommonResult result = buildSuccessResult(deleteItems, affectedRows, "批量删除完成。");
        // 返回已经完成统一字段填充的批量假删除结果。
        return result;
    }
}
