package com.sp.selplat.referencedata.referencedatacontrollayout.service.impl;

import com.sp.selplat.referencedata.common.util.code.ReferenceDataCodeServiceImpl;
import com.sp.selplat.referencedata.referencedatacontrollayout.dao.ReferenceDataControlLayoutDao;
import com.sp.selplat.referencedata.referencedatacontrollayout.service.ReferenceDataControlLayoutService;
import com.sp.selplat.common.util.CommonParam;
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
     * 异常或副作用示例：controlKind 缺失时按普通控件处理，后续数据库非空约束仍会阻止非法新增。
     *
     * @param saveIn 页面控件布局新增参数
     * @return 页面或普通控件对象前缀
     */
    @Override
    protected String resolveCodePrefix(CommonParam saveIn) {
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
}
