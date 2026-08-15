package com.sp.selplat.referencedata.common.util.code;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonParam;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 为引用数据六张元数据表统一实现“公共发号后按对象类型生成不可变 code”的新增链路。
 * 具体业务服务继续负责字段白名单和业务关系校验，不得自行创建第二套发号逻辑。
 *
 * @param <D> 当前引用数据业务 DAO 类型
 */
public abstract class ReferenceDataCodeServiceImpl<D extends BaseDao> extends BaseServiceImpl<D> {

    // 项目编码只接受小写短横线格式，避免不同写法生成相同或不可预测的驼峰前缀。
    private static final Pattern PROJECT_CODE_PATTERN = Pattern.compile("^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$");
    // 编码前缀只接受 lowerCamelCase 英文标识，保证数据库中可直接辨认对象类别。
    private static final Pattern CODE_PREFIX_PATTERN = Pattern.compile("^[a-z][A-Za-z0-9]*$");

    /**
     * 使用公共链生成的主键拼接当前对象类型前缀，形成可辨认的不可变全局 code。
     * 真实传参示例：参数为 {@code {"projectCode":"reference-data","id":101001}}，发号结果为
     *     {@code {"id":101001}}。
     * 真实返回示例：类型服务返回前缀 {@code type} 时，参数被补充为 {@code {"code":"type101001"}}。
     * 异常或副作用示例：缺少 projectCode、对象前缀或 id 时抛出业务异常；前端 code 会被覆盖。
     *
     * @param saveIn 已取得公共主键、尚未写入数据库的新增参数
     * @param generatedIdMap 公共新增链本次生成的主键映射
     */
    @Override
    protected void prepareGeneratedInsert(CommonParam saveIn, Map<String, Long> generatedIdMap) {
        String projectCode = resolveProjectCode(saveIn);
        if (!PROJECT_CODE_PATTERN.matcher(projectCode).matches()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_PROJECT_CODE_INVALID",
                    "项目编码必须使用小写短横线格式。");
        }
        String codePrefix = resolveCodePrefix(saveIn);
        if (codePrefix == null || !CODE_PREFIX_PATTERN.matcher(codePrefix).matches()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_CODE_PREFIX_INVALID",
                    "引用数据对象编码前缀无效。");
        }
        Long generatedId = generatedIdMap.get("id");
        if (generatedId == null || generatedId <= 0L) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_OBJECT_ID_MISSING",
                    "引用数据对象主键生成失败。");
        }
        saveIn.putParam("code", codePrefix + generatedId);
    }

    /**
     * 解析新增对象所属项目；有 projectCode 列的表直接读取请求，子对象可按内部外键覆盖本方法。
     * 真实传参示例：表格新增参数包含 {@code {"projectCode":"reference-data"}}。
     * 真实返回示例：返回 {@code reference-data}。
     * 异常或副作用示例：默认实现不查询数据库；子对象实现可在外键不存在时抛出业务异常。
     *
     * @param saveIn 尚未写入数据库的新增参数
     * @return 当前对象所属的小写短横线项目编码
     */
    protected String resolveProjectCode(CommonParam saveIn) {
        Object projectValue = saveIn.getParam("projectCode");
        return projectValue == null ? "" : String.valueOf(projectValue).trim();
    }

    /**
     * 返回当前业务表对应的可读对象前缀，具体服务不得拼接主键或建立第二套发号逻辑。
     * 真实传参示例：Window 新增参数为 {@code {"projectCode":"reference-data"}}。
     * 真实返回示例：Window 服务返回 {@code window}，类型服务返回 {@code type}。
     * 异常或副作用示例：树节点服务会读取所属类型决定菜单或选项前缀；本方法本身不生成主键。
     *
     * @param saveIn 尚未写入数据库的新增参数
     * @return lowerCamelCase 对象类型前缀
     */
    protected abstract String resolveCodePrefix(CommonParam saveIn);
}
