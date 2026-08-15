package com.sp.selplat.referencedata.referencedatawindow.service.impl;

import com.sp.selplat.referencedata.common.util.code.ReferenceDataCodeServiceImpl;
import com.sp.selplat.referencedata.referencedatawindow.dao.ReferenceDataWindowDao;
import com.sp.selplat.referencedata.referencedatawindow.service.ReferenceDataWindowService;
import com.sp.selplat.common.util.CommonParam;
import org.springframework.stereotype.Service;

/** 使用公共新增链为 Window 发号、生成 code 并维护默认几何状态。 */
@Service
public class ReferenceDataWindowServiceImpl
        extends ReferenceDataCodeServiceImpl<ReferenceDataWindowDao>
        implements ReferenceDataWindowService {

    /**
     * 将 Window 配置编码标记为 window，尺寸与位置仍保存在当前业务表。
     * 真实传参示例：{@code {"pageCode":"page101017","width":"960px"}}。
     * 真实返回示例：返回 {@code window}，最终 code 形如 {@code window101064}。
     * 异常或副作用示例：本方法不修改 Window 几何状态；公共新增链负责覆盖前端伪造 code。
     *
     * @param saveIn Window 新增参数
     * @return Window 对象前缀
     */
    @Override
    protected String resolveCodePrefix(CommonParam saveIn) {
        return "window";
    }
}
