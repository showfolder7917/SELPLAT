package com.sp.selplat.referencedata.referencedatacontrollayout.service.impl;

import com.sp.selplat.referencedata.common.util.code.ReferenceDataCodeServiceImpl;
import com.sp.selplat.referencedata.referencedatacontrollayout.dao.ReferenceDataControlLayoutDao;
import com.sp.selplat.referencedata.referencedatacontrollayout.service.ReferenceDataControlLayoutService;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 使用公共新增链创建不可变控件 code，并统一维护页面布局记录。 */
@Service
public class ReferenceDataControlLayoutServiceImpl
        extends ReferenceDataCodeServiceImpl<ReferenceDataControlLayoutDao>
        implements ReferenceDataControlLayoutService {

    /**
     * 生成控件 code 后强制让 PAGE 根的 pageCode 等于自身 code，普通控件保持所提交的页面归属。
     * 真实传参示例：PAGE 参数含占位 {@code pageCode=bootstrap}，生成主键为 101017。
     * 真实返回示例：最终写入 {@code code=page101017,pageCode=page101017}。
     * 异常或副作用示例：公共发号或前缀校验失败时直接抛错；前端伪造的 PAGE pageCode 会被覆盖。
     *
     * @param saveIn 已取得主键、尚未写入数据库的页面控件参数
     * @param generatedIdMap 公共新增链生成的主键映射
     */
    @Override
    protected void prepareGeneratedInsert(CommonParam saveIn, Map<String, Long> generatedIdMap) {
        super.prepareGeneratedInsert(saveIn, generatedIdMap);
        if ("PAGE".equals(String.valueOf(saveIn.getParam("controlKind")))) {
            saveIn.putParam("pageCode", saveIn.getParam("code"));
        }
    }

    /**
     * 页面根记录使用 page 前缀，页面内其他可编辑控件统一使用 control 前缀。
     * 真实传参示例：{@code {"controlKind":"PAGE"}} 或 {@code {"controlKind":"DROPDOWN"}}。
     * 真实返回示例：分别返回 {@code page} 与 {@code control}，最终形成 {@code page101017} 等编码。
     * 异常或副作用示例：{@code parentKind=WINDOW} 时抛出
     *     {@code CommonBusinessException("REFERENCE_DATA_WINDOW_CHILD_FORBIDDEN", ...)}。
     *
     * @param saveIn 页面控件布局新增参数
     * @return 页面或普通控件对象前缀
     */
    @Override
    protected String resolveCodePrefix(CommonParam saveIn) {
        rejectWindowChild(saveIn);
        String controlKind = String.valueOf(saveIn.getParam("controlKind"));
        if ("PAGE".equals(controlKind)) {
            // 页面根没有父容器，服务端移除前端残留值，避免形成页面自引用。
            saveIn.getParamMap().remove("parentKind");
            saveIn.getParamMap().remove("parentCode");
            return "page";
        }
        // 页面直属控件未显式选择父容器时，自动归属当前 pageCode；Window 或面板嵌套仍需明确提交。
        Object parentKind = saveIn.getParam("parentKind");
        Object parentCode = saveIn.getParam("parentCode");
        if (parentKind == null || String.valueOf(parentKind).isBlank()) {
            saveIn.putParam("parentKind", "PAGE");
        }
        if (parentCode == null || String.valueOf(parentCode).isBlank()) {
            saveIn.putParam("parentCode", saveIn.getParam("pageCode"));
        }
        return "control";
    }

    /**
     * 更新页面控件前拒绝已废弃的 Window 子控件父级，其余字段继续走公共更新链。
     * 真实传参示例：{@code {"id":103020,"parentKind":"PAGE"}}。
     * 真实返回示例：返回公共更新结果 {@code {"success":true,"data":{"id":103020}}}。
     * 异常或副作用示例：传入 {@code parentKind=WINDOW} 时在 DAO 写入前抛出业务异常。
     *
     * @param saveIn 页面控件主键和待更新字段
     * @return 公共更新结果
     */
    @Override
    public CommonResult update(CommonParam saveIn) {
        rejectWindowChild(saveIn);
        return super.update(saveIn);
    }

    /**
     * 批量更新页面控件前逐项拒绝 Window 子控件父级，避免批量接口绕过单条约束。
     * 真实传参示例：{@code {"items":[{"id":103020,"parentKind":"TOOLBAR"}]}}。
     * 真实返回示例：返回公共批量结果并保留真实影响行数。
     * 异常或副作用示例：任一项含 {@code parentKind=WINDOW} 时整批在 DAO 写入前失败。
     *
     * @param saveIn 页面控件批量更新参数
     * @return 公共批量更新结果
     */
    @Override
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        if (saveIn != null) {
            saveIn.getItems().forEach(this::rejectWindowChild);
        }
        return super.updateBatch(saveIn);
    }

    /**
     * 校验页面控件不得归属 Window；Window 只保存自身外框几何，不登记内部字段。
     * 真实传参示例：{@code {"parentKind":"TOOLBAR"}}。
     * 真实返回示例：合法父级无返回值且参数保持不变。
     * 异常或副作用示例：{@code {"parentKind":"WINDOW"}} 抛出固定业务错误且不访问 DAO。
     *
     * @param values 待新增或更新的页面控件参数
     */
    private void rejectWindowChild(CommonParam values) {
        if (values != null && "WINDOW".equals(String.valueOf(values.getParam("parentKind")).trim())) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_WINDOW_CHILD_FORBIDDEN",
                    "Window 内部字段不登记为页面控件；请只在 ReferenceDataWindow 保存外框位置和大小。");
        }
    }
}
