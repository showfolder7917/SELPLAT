package com.sp.selplat.referencedata.referencedatatableelement.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatatableelement.service.ReferenceDataTableElementService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布以表格 code 进入后使用的表格元素管理接口。 */
@RestController
@ModuleDescription(code = "reference-data-table-element", name = "表格元素", description = "维护表格列和操作元素")
@RequestMapping(value = "/api/reference-data/admin/table-elements/", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataTableElementController extends BaseController<ReferenceDataTableElementService> {
}
