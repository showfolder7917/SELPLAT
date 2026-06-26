package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.config.CommonDbSource;
import com.sp.selplat.common.db.config.CommonDbSourceResolver;
import com.sp.selplat.common.db.domain.ColumnMetadata;
import com.sp.selplat.common.db.metadata.DatabaseMetadataReader;
import com.sp.selplat.common.db.metadata.DefaultDatabaseMetadataReader;
import com.sp.selplat.common.db.metadata.MetadataSelectColumnBuilder;
import java.util.List;
import org.springframework.util.StringUtils;

// 公共 DAO 基类直接桥接 BaseTemplateDao，让简单主数据模块只配置表信息就能复用通用 CRUD。
public abstract class BaseDaoImpl extends BaseDaoImplExtends {

  
}
