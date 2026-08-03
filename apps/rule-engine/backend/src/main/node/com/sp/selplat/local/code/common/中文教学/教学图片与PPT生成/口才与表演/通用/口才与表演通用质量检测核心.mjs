// 口才三册共用的页面几何、文字密度和拼音对齐检测核心。

// 16:9课件画布采用1280×720设计单位，Open XML内部统一换算为EMU。
const EMU_PER_PIXEL = 9525;
// 页面边界用于拦截被挤出画布的文字和图片对象。
const CANVAS = {
  x: 0,
  y: 0,
  cx: 1280 * EMU_PER_PIXEL,
  cy: 720 * EMU_PER_PIXEL,
};

/**
 * 把XML文本节点还原为实际可见文字。
 */
export function extractVisibleText(xml) {
  // 页面全部文本运行按出现顺序组合，保留换行用于段落和密度判断。
  return [...String(xml || "").matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    // 只还原课件正文可能出现的常见实体。
    .map((match) => match[1]
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&apos;", "'"))
    // 不同运行用换行隔开，避免检测时误把相邻对象拼成一个词。
    .join("\n");
}

/**
 * 提取页面中全部具备几何信息的文本形状。
 */
export function extractTextShapes(xml) {
  // 每个原生文本形状独立解析，保证相交检查使用真实对象边界。
  return [...String(xml || "").matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].flatMap((match) => {
    // 当前对象的完整XML包含名称、位置、字号和正文。
    const block = match[0];
    // 业务对象名称由生成器写入，便于跨册使用同一检查语义。
    const name = block.match(/<p:cNvPr[^>]*\sname="([^"]*)"/)?.[1] || "";
    // 坐标和尺寸缺一时无法做可靠几何判断。
    const transform = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/);
    // 无坐标对象交给原检测器处理，本核心不猜测其位置。
    if (!transform) return [];
    // 当前形状中的所有显式字号以百分之一磅存储。
    const fontSizes = [...block.matchAll(/\bsz="(\d+)"/g)].map((item) => Number(item[1]) / 100);
    // 文本内容用于字号、密度和格式判断。
    const text = extractVisibleText(block);
    // 空文本装饰形状不参与文字质量检测。
    if (!text.trim()) return [];
    // 返回跨册检测需要的完整证据。
    return [{
      name,
      text,
      x: Number(transform[1]),
      y: Number(transform[2]),
      cx: Number(transform[3]),
      cy: Number(transform[4]),
      width: Number(transform[3]) / EMU_PER_PIXEL,
      height: Number(transform[4]) / EMU_PER_PIXEL,
      minFontSize: fontSizes.length ? Math.min(...fontSizes) : null,
      maxFontSize: fontSizes.length ? Math.max(...fontSizes) : null,
      lineSpacing: Number(block.match(/<a:spcPct val="(\d+)"/)?.[1] || 120000) / 100000,
    }];
  });
}

/**
 * 提取文本与装饰形状的名称和几何边界。
 */
export function extractNamedShapes(xml) {
  // 文本框、底板和栏目徽标都由原生形状表达，统一提取供包含关系检查。
  return [...String(xml || "").matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].flatMap((match) => {
    // 当前形状XML包含业务名称和几何变换。
    const block = match[0];
    // 业务名称用于区分栏目底层、文字底板和可编辑文本。
    const name = block.match(/<p:cNvPr[^>]*\sname="([^"]*)"/)?.[1] || "";
    // 没有稳定名称的模板装饰不参与通用业务门禁。
    if (!name) return [];
    // 坐标与尺寸必须同时存在才能判断包含关系。
    const transform = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/);
    // 几何信息缺失时由册别检测器继续处理。
    if (!transform) return [];
    // 返回EMU坐标，避免多次像素换算引入误差。
    return [{
      name,
      x: Number(transform[1]),
      y: Number(transform[2]),
      cx: Number(transform[3]),
      cy: Number(transform[4]),
      width: Number(transform[3]) / EMU_PER_PIXEL,
      height: Number(transform[4]) / EMU_PER_PIXEL,
    }];
  });
}

/**
 * 判断外层矩形是否完整包住内层矩形。
 */
function rectangleContains(outer, inner, tolerance = 2 * EMU_PER_PIXEL) {
  // 轻微边框误差不影响视觉包含关系。
  return inner.x >= outer.x - tolerance
    && inner.y >= outer.y - tolerance
    && inner.x + inner.cx <= outer.x + outer.cx + tolerance
    && inner.y + inner.cy <= outer.y + outer.cy + tolerance;
}

/**
 * 判断两个矩形是否发生实际面积相交。
 */
function rectanglesOverlap(left, right, tolerance = 2 * EMU_PER_PIXEL) {
  // 小于2像素的抗锯齿或边框接触不属于可见内容重叠。
  return left.x + left.cx > right.x + tolerance
    && right.x + right.cx > left.x + tolerance
    && left.y + left.cy > right.y + tolerance
    && right.y + right.cy > left.y + tolerance;
}

/**
 * 判断文本对象是否越出画布。
 */
function isOutsideCanvas(shape) {
  // 任一边越界超过1像素都可能在放映时被裁切。
  const tolerance = EMU_PER_PIXEL;
  return shape.x < CANVAS.x - tolerance
    || shape.y < CANVAS.y - tolerance
    || shape.x + shape.cx > CANVAS.cx + tolerance
    || shape.y + shape.cy > CANVAS.cy + tolerance;
}

/**
 * 估算正文在当前栏宽和字号下所需的视觉行数。
 */
export function estimateVisualLineCount(text, width, fontSize) {
  // 左右内边距合计按32设计单位扣除，与全册生成器正文安全区保持一致。
  const usableWidth = Math.max(1, width - 32);
  // 中文全角字宽采用保守系数，避免字体差异导致几何上未溢出但视觉上拥挤。
  const charsPerLine = Math.max(1, Math.floor(usableWidth / (fontSize * 0.95)));
  // 空行是有意的段落呼吸位，也计入一行。
  return String(text || "")
    .split(/\n/)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil([...line].length / charsPerLine)), 0);
}

/**
 * 根据正文长度给出适龄阅读的字号上下限。
 */
function bodyFontRange(text, name) {
  // 教材补充事实通常信息更密集，允许比普通教学正文略小，但仍不得小于22磅。
  const supplement = /^SUPPLEMENT_BODY_/u.test(name);
  // 去除布局空白后再计算真实教学字符量。
  const length = [...String(text || "").replace(/\s+/g, "")].length;
  // 短句需要足够醒目，避免大画布上形成“小字孤岛”。
  if (length <= 36) return { minimum: supplement ? 24 : 26, maximum: 34 };
  // 中等内容保持课堂投影可读性和页面呼吸感。
  if (length <= 90) return { minimum: supplement ? 22.5 : 22.5, maximum: 29 };
  // 长段正文必须控制字号上限，避免自动分页或文本压住插图。
  if (length <= 150) return { minimum: 22, maximum: 25 };
  // 超长内容应优先重组段落，字号只允许在窄范围内微调。
  return { minimum: 21, maximum: 23.5 };
}

/**
 * 对单页执行全册通用的几何、字号、段落和拼音质量检查。
 */
export function inspectCommonSlideQuality(xml, slideNumber) {
  // 所有硬错误带页码返回，供册别检测器直接并入报告。
  const errors = [];
  // 页面文本形状只解析一次，后续检查共享同一几何证据。
  const shapes = extractTextShapes(xml);
  // 非文本底板与栏目徽标用于检查文字是否具备稳定背景。
  const namedShapes = extractNamedShapes(xml);
  // 任何文字对象不得在放映画布外被裁切。
  for (const shape of shapes) {
    // 越界对象记录业务名称和页码，便于直接定位生成器入口。
    if (isOutsideCanvas(shape)) {
      errors.push(`第${slideNumber}页文本对象“${shape.name || "未命名"}”越出画布。`);
    }
  }
  // 页面标题、正文和补充正文用于检查最常见的错误叠压。
  const titles = shapes.filter((shape) => shape.name === "CONTENT_TITLE");
  // 普通正文和教材补充正文都属于需要避让标题的教学内容。
  const bodies = shapes.filter((shape) => shape.name === "CONTENT_BODY" || /^SUPPLEMENT_BODY_/u.test(shape.name));
  // 机械观察标题与正文动作重复，必须由生成器隐藏而不是继续占用一层版式。
  const redundantTitles = new Set([
    "看图说一说",
    "说一说，你看到了什么？",
    "按顺序观察",
    "观察图片",
    "仔细观察图片",
    "你看到什么？",
    "你看到了什么？",
    "练一练",
  ]);
  // 压缩空白后检查全部页面标题，避免拆字排版逃过门禁。
  for (const title of titles) {
    // 当前标题转换为统一比较键。
    const titleKey = title.text.replace(/\s+/gu, "").replace(/[，。！？；：、,.!?;:]+$/gu, "");
    // 页面已有正文时，机械动作标题属于重复层级。
    if (bodies.length && [...redundantTitles].some((item) => item.replace(/\s+/gu, "").replace(/[，。！？；：、,.!?;:]+$/gu, "") === titleKey)) {
      errors.push(`第${slideNumber}页存在重复观察动作标题“${title.text.replace(/\s+/gu, "")}”，应由正文问题承担教学指令。`);
    }
  }
  // 右上栏目名称必须位于独立轻底层内，避免直接覆盖人物面部或复杂背景。
  const sectionNames = shapes.filter((shape) => shape.name === "SECTION_NAME");
  // 页面有栏目时必须同时存在栏目底层。
  for (const sectionName of sectionNames) {
    // 获取当前页稳定栏目徽标。
    const badge = namedShapes.find((shape) => shape.name === "SECTION_BADGE");
    // 缺失徽标意味着栏目仍直接叠在图片上。
    if (!badge) {
      errors.push(`第${slideNumber}页右上栏目缺少SECTION_BADGE轻底层。`);
      continue;
    }
    // 栏目文字必须完整位于底层内部。
    if (!rectangleContains(badge, sectionName)) {
      errors.push(`第${slideNumber}页右上栏目文字未完整落在SECTION_BADGE内。`);
    }
    // 底层宽度不得超过文字框的2.2倍，避免形成不必要的长条控件。
    if (badge.width > sectionName.width * 2.2) {
      errors.push(`第${slideNumber}页SECTION_BADGE相对栏目文字过宽。`);
    }
  }
  // 页面主标题不得与右上栏目完全重复，否则会形成无意义双标题。
  for (const title of titles) {
    // 标题与栏目都压缩空白和首尾标点后比较。
    const titleKey = title.text.replace(/\s+/gu, "").replace(/^[《》【】（）()]+|[《》【】（）()，。！？；：、,.!?;:]+$/gu, "");
    // 当前页逐栏目核对语义重复。
    for (const sectionName of sectionNames) {
      // 栏目名称使用相同比较口径。
      const sectionKey = sectionName.text.replace(/\s+/gu, "").replace(/^[《》【】（）()]+|[《》【】（）()，。！？；：、,.!?;:]+$/gu, "");
      // 完全相同的页面标题和栏目必须由生成器改为真实篇名或教学动作。
      if (titleKey && titleKey === sectionKey) {
        errors.push(`第${slideNumber}页CONTENT_TITLE与右上栏目重复：“${title.text.replace(/\s+/gu, "")}”。`);
      }
    }
  }
  // 整幅插画页的正文必须由比例适配轻底板承载，不能直接压在水彩主体上。
  if (/FULL_SCENE_|FULL_BLEED_|ORIGINAL_VISUAL_/u.test(String(xml || "")) && bodies.length) {
    // 找到当前页承载教学文字的轻底板。
    const card = namedShapes.find((shape) => shape.name === "TEXT_CARD");
    // 没有底板时无法稳定保证复杂背景上的可读性。
    if (!card) {
      errors.push(`第${slideNumber}页整幅插画上的教学正文缺少TEXT_CARD轻底板。`);
    } else {
      // 标题与正文共同构成需要被底板包含的文字组。
      const textGroup = [...titles, ...bodies];
      // 每个教学文字对象必须完整位于同一底板内。
      for (const textShape of textGroup) {
        // 底板不能只遮住一部分文字或反向压进人物区域。
        if (!rectangleContains(card, textShape)) {
          errors.push(`第${slideNumber}页${textShape.name}未完整位于TEXT_CARD内。`);
        }
      }
      // 计算文字组包围盒，用于拦截“大底板包少量字”的空泛版式。
      const minX = Math.min(...textGroup.map((shape) => shape.x));
      // 文字组顶部作为包围盒起点。
      const minY = Math.min(...textGroup.map((shape) => shape.y));
      // 文字组右侧边界用于计算真实占用宽度。
      const maxX = Math.max(...textGroup.map((shape) => shape.x + shape.cx));
      // 文字组底部边界用于计算真实占用高度。
      const maxY = Math.max(...textGroup.map((shape) => shape.y + shape.cy));
      // 底板面积与文字组面积比用于衡量视觉比例。
      const areaRatio = (card.cx * card.cy) / Math.max(1, (maxX - minX) * (maxY - minY));
      // 超过2.8倍说明底板远大于实际文字，不符合自适应比例。
      if (areaRatio > 2.8) {
        errors.push(`第${slideNumber}页TEXT_CARD与文字组比例失衡：面积比${areaRatio.toFixed(2)}。`);
      }
    }
  }
  // 每个标题与每个正文框都必须保持独立可读区域。
  for (const title of titles) {
    // 逐正文判断真实矩形相交，不能只凭字符串和容量推测。
    for (const body of bodies) {
      // 任何可见面积重叠都属于硬错误。
      if (rectanglesOverlap(title, body)) {
        errors.push(`第${slideNumber}页标题“${title.text.replace(/\s+/g, "")}”与${body.name}发生几何重叠。`);
      }
    }
  }
  // 正文逐框检查字号、容量、段落和格式。
  for (const body of bodies) {
    // 没有显式字号时无法保证投影可读性，必须返工。
    if (body.minFontSize === null || body.maxFontSize === null) {
      errors.push(`第${slideNumber}页${body.name}缺少显式字号。`);
      continue;
    }
    // 动态字号范围同时拦截小字和用大字硬塞长文。
    const range = bodyFontRange(body.text, body.name);
    // 最小字号低于当前内容密度的可读底线。
    if (body.minFontSize < range.minimum) {
      errors.push(`第${slideNumber}页${body.name}字号过小：${body.minFontSize.toFixed(2)}pt，当前内容最低${range.minimum}pt。`);
    }
    // 最大字号超过长文上限会破坏整体比例并诱发不合理分页。
    if (body.maxFontSize > range.maximum) {
      errors.push(`第${slideNumber}页${body.name}字号过大：${body.maxFontSize.toFixed(2)}pt，当前内容最高${range.maximum}pt。`);
    }
    // 文本框上下内边距合计按24设计单位扣除。
    const usableHeight = Math.max(1, body.height - 24);
    // PowerPoint段落还会产生附加间距，使用保守系数计算可容纳行数。
    const lineCapacity = Math.max(1, Math.floor(usableHeight / (body.minFontSize * body.lineSpacing * 1.45)));
    // 估算实际视觉行数用于拦截纵向溢出。
    const requiredLines = estimateVisualLineCount(body.text, body.width, body.maxFontSize);
    // 所需行数超过容量时必须调整布局或重组内容。
    if (requiredLines > lineCapacity) {
      errors.push(`第${slideNumber}页${body.name}容量不足：需要约${requiredLines}行，可用约${lineCapacity}行。`);
    }
    // 九行及以上长文必须在画布底部保留至少32像素，避免字体下沿在放映时被截断。
    const bottomSafeMargin = CANVAS.cy - (body.y + body.cy);
    // 长文框贴近底边属于高风险排版，即使XML容量估算暂时通过也必须返工。
    if (requiredLines >= 9 && bottomSafeMargin < 32 * EMU_PER_PIXEL) {
      errors.push(`第${slideNumber}页${body.name}长文底部安全余量不足：${(bottomSafeMargin / EMU_PER_PIXEL).toFixed(1)}px。`);
    }
    // 清理旧模板提示词后不得留下行首标点。
    if (/^[，,、；;：:。！？!?]/u.test(body.text.trim())) {
      errors.push(`第${slideNumber}页${body.name}存在前导标点。`);
    }
    // 每个视觉行都不得只剩标点或从标点开始，防止自动换行产生孤立句号。
    const brokenPunctuationLines = body.text
      .split(/\n/u)
      .map((line) => line.trim())
      .filter((line) => /^[，,、；;：:。！？!?]/u.test(line) || /^[，,、；;：:。！？!?]+$/u.test(line));
    // 任一破碎行都说明正文需要重新分句或调整字号。
    if (brokenPunctuationLines.length) {
      errors.push(`第${slideNumber}页${body.name}存在孤立或行首标点：${brokenPunctuationLines.join("、")}。`);
    }
    // 超过90字却完全没有分段会形成难读的文字墙。
    if (body.text.replace(/\s+/g, "").length > 90 && !/\n\s*\n/u.test(body.text)) {
      errors.push(`第${slideNumber}页${body.name}长文未按语义分段。`);
    }
  }
  // 拼音与汉字必须使用独立对象并共享横向中心线。
  const pinyinShapes = shapes.filter((shape) => /^PINYIN_\d+$/u.test(shape.name));
  // 每一组拼音都寻找同编号汉字对象。
  for (const pinyin of pinyinShapes) {
    // 编号决定对应汉字对象名称。
    const index = pinyin.name.match(/\d+$/u)?.[0];
    // 同编号汉字缺失属于结构错误。
    const hanzi = shapes.find((shape) => shape.name === `HANZI_${index}`);
    // 缺失时直接记录，不允许回退为空格排版。
    if (!hanzi) {
      errors.push(`第${slideNumber}页${pinyin.name}缺少对应汉字对象。`);
      continue;
    }
    // 两个对象中心偏差超过2像素时放映可见错位。
    const centerDelta = Math.abs((pinyin.x * 2 + pinyin.cx) - (hanzi.x * 2 + hanzi.cx));
    // 使用双倍中心坐标比较，避免除法精度损失。
    if (centerDelta > 4 * EMU_PER_PIXEL) {
      errors.push(`第${slideNumber}页${pinyin.name}与HANZI_${index}横向中心错位。`);
    }
  }
  // 返回可直接并入册别报告的硬错误集合。
  return errors;
}

/**
 * 对整份课件页面执行全册通用质量门禁。
 */
export function inspectCommonDeckQuality(slides) {
  // 按页汇总错误，保持稳定页面顺序。
  return slides.flatMap((slide) => inspectCommonSlideQuality(slide.xml, slide.number));
}
