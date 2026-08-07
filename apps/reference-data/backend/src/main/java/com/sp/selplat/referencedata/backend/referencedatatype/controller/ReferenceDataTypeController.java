package com.sp.selplat.referencedata.backend.referencedatatype.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.backend.referencedatatype.service.ReferenceDataTypeService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 发布 ReferenceDataType 固定表的公共分页、详情、新增、更新和假删除接口。
 */
@RestController
@ModuleDescription(
        code = "reference-data-type",
        name = "引用数据类型",
        description = "管理项目与引用数据资源的稳定坐标")
@RequestMapping(value = "/api/reference-data/admin/types/", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataTypeController extends BaseController<ReferenceDataTypeService> {
}
