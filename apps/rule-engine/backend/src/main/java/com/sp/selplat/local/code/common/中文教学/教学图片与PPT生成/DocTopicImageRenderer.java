package com.sp.selplat.local.code.common.中文教学.教学图片与PPT生成;

import com.sp.selplat.local.code.common.中文教学.教学图片与PPT生成.DocTopicContentRepository.TopicContent;
import com.sp.selplat.local.code.common.中文教学.教学图片与PPT生成.DocTopicPoem.AnnotatedLine;
import com.sp.selplat.local.code.common.中文教学.教学图片与PPT生成.DocTopicPoem.AnnotatedToken;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.BasicStroke;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Composite;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.RadialGradientPaint;
import java.awt.RenderingHints;
import java.awt.geom.Path2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.logging.Logger;

/**
 * 使用 Java2D 把核定原文、拼音和审校故事绘制为稳定的竖版教学 JPG。
 */
public final class DocTopicImageRenderer {

    // 字体缓存缺失或损坏时通过规则引擎日志返回明确提示，图片生成继续使用系统回退字体。
    private static final Logger LOGGER = Logger.getLogger(DocTopicImageRenderer.class.getName());

    /** 标准参考图宽度。 */
    public static final int WIDTH = 1053;
    /** 标准参考图高度。 */
    public static final int HEIGHT = 1493;

    // 业务上所有颜色集中定义，确保批量图片保持一致的宣纸、棕金和墨色视觉体系。
    private static final Color PAPER_TOP = new Color(250, 246, 235);
    private static final Color PAPER_BOTTOM = new Color(241, 232, 210);
    private static final Color INK = new Color(44, 37, 29);
    private static final Color MUTED_INK = new Color(90, 76, 58);
    private static final Color BROWN = new Color(119, 78, 34);
    private static final Color GOLD = new Color(177, 145, 91);
    private static final Color CARD = new Color(255, 252, 243, 238);
    private static final Color MOUNTAIN = new Color(124, 145, 126, 40);
    private static final Color WATER = new Color(100, 151, 155, 55);

    // 业务上字体文件体积较大，统一缓存到当前工程 cache，避免把二进制资源提交到 Git。
    private static final String DISPLAY_FONT_FILE_NAME = "LXGWWenKai-Regular.ttf";
    // 业务上缓存路径由当前工程根派生，使切换工程后每个工程拥有可独立清理和复用的字体缓存。
    private static final Path DISPLAY_FONT_CACHE_PATH = resolveCurrentProjectRoot()
        .resolve("cache/fonts")
        .resolve(DISPLAY_FONT_FILE_NAME)
        .normalize();
    // 业务上缓存属于可删除资源，加载结果同时保留字体与提示信息，禁止缺失时联网补齐。
    private static final FontLoadResult DISPLAY_FONT_RESULT = loadCachedDisplayFont();
    // 业务上渲染器只消费已决策的字体；缓存不存在时透明使用系统中文字体继续生成。
    private static final Font DISPLAY_BASE_FONT = DISPLAY_FONT_RESULT.font();
    private static final Font TITLE_FONT = DISPLAY_BASE_FONT.deriveFont(Font.BOLD, 72f);
    private static final Font SUBTITLE_FONT = DISPLAY_BASE_FONT.deriveFont(Font.PLAIN, 23f);
    private static final Font LABEL_FONT = DISPLAY_BASE_FONT.deriveFont(Font.BOLD, 27f);
    private static final Font PINYIN_FONT = new Font("Arial", Font.PLAIN, 18);
    private static final Font HANZI_FONT = DISPLAY_BASE_FONT.deriveFont(Font.PLAIN, 40f);
    private static final Font BODY_FONT = DISPLAY_BASE_FONT.deriveFont(Font.PLAIN, 23f);
    private static final Font BULLET_FONT = DISPLAY_BASE_FONT.deriveFont(Font.PLAIN, 22f);
    private static final Font FOOTER_FONT = DISPLAY_BASE_FONT.deriveFont(Font.BOLD, 25f);

    /**
     * 工具类不创建实例，全部版式由同一套确定性模板生成。
     */
    private DocTopicImageRenderer() {
        // 业务入口统一使用 render 和 writeJpeg，避免调用方跳过尺寸与质量控制。
    }

    /**
     * 渲染一首短诗故事图片。
     *
     * @param poem 核定版原文和拼音
     * @param content 审校故事内容
     * @param illustrationPath 与当前篇目绑定的审校主题插画
     * @param studyIllustrationPath 与教材风格绑定的书卷装饰插画
     * @return 标准尺寸 RGB 图片
     */
    public static BufferedImage render(
        DocTopicPoem poem,
        TopicContent content,
        Path illustrationPath,
        Path studyIllustrationPath
    ) {
        // 业务上在创建正式画布前先解码插画，损坏素材不能退化为无配图版式继续输出。
        BufferedImage illustration = readIllustration(illustrationPath);
        // 业务上独立解码书卷装饰，避免四个栏目机械重复同一主题画面。
        BufferedImage studyIllustration = readIllustration(studyIllustrationPath);
        // 业务上画布固定为参考图比例，并使用 RGB 以保证 JPEG 跨平台可读。
        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            // 业务上启用文字和图形抗锯齿，减少打印及移动端缩放时的锯齿。
            configureGraphics(graphics);
            // 业务上先绘制不含文字的宣纸和水墨装饰，再叠放所有核定文字。
            drawBackground(graphics);
            // 业务上标题和作者形成第一阅读层级，不放置未经授权的品牌图片。
            drawHeader(graphics, poem);
            // 业务上原文恢复参考图的均衡居中排法，但卡片高度按短诗行数收紧。
            drawOriginalCard(graphics, poem, illustration);
            // 业务上四个说明栏目恢复单栏顺序，并以不同裁切的小幅插画填补边角而不抢正文。
            drawTextCard(graphics, 55, 500, 943, 175, "诗意故事", content.story(), false, BODY_FONT,
                illustration, VignettePlacement.LEFT_LOTUS);
            drawTextCard(graphics, 55, 690, 943, 175, "诗句解读", content.interpretation(), false, BODY_FONT,
                studyIllustration, VignettePlacement.RIGHT_STUDY);
            drawTextCard(graphics, 55, 880, 943, 190, "核心意境", content.coreIdeas(), true, BULLET_FONT,
                studyIllustration, VignettePlacement.LEFT_BOOKS);
            drawTextCard(graphics, 55, 1085, 943, 240, "生活启示", content.lifeTips(), true, BULLET_FONT,
                illustration, VignettePlacement.RIGHT_GOOSE);
            // 业务上页脚只显示审校总结，并与正文保持足够间距。
            drawFooter(graphics, content.footer());
        } finally {
            // 业务上无论绘制是否成功都释放本地图形资源，避免批量任务长期占用系统句柄。
            graphics.dispose();
        }
        return image;
    }

    /**
     * 返回当前实际使用的展示字体族，供跨平台测试确认缓存字体或系统回退字体已生效。
     *
     * @return 实际字体族，例如缓存存在时为 `LXGW WenKai`，缓存缺失时可能为 `Dialog`
     */
    static String displayFontFamily() {
        // 业务上测试只读取字体族名称，不暴露可变 Font 实例给外部调用方。
        return DISPLAY_BASE_FONT.getFamily();
    }

    /**
     * 返回展示字体资源状态，供调用方把可删除缓存的缺失信息展示给用户。
     *
     * @return 状态文本，例如 `字体资源不存在: .../cache/fonts/LXGWWenKai-Regular.ttf；已使用系统回退字体: Dialog`
     */
    public static String displayFontStatus() {
        // 返回静态加载阶段形成的确定状态，避免查询状态时再次访问或创建缓存。
        return DISPLAY_FONT_RESULT.message();
    }

    /**
     * 从当前工程缓存加载开源中文文楷字体；缓存缺失时返回提示并使用系统字体。
     *
     * @return 字体与状态，例如 `{font.family=Dialog, message=字体资源不存在: ...；已使用系统回退字体: Dialog}`
     */
    private static FontLoadResult loadCachedDisplayFont() {
        // 缓存可被用户随时删除；缺失时不得创建目录、下载文件或阻断图片生成。
        if (!Files.isRegularFile(DISPLAY_FONT_CACHE_PATH)) {
            // 使用当前系统可用的中文回退字体，确保缺少可选资源时仍能得到可读输出。
            Font fallbackFont = new Font("Songti SC", Font.PLAIN, 12);
            // 提示包含缺失资源和实际回退字体，调用者无需查看异常堆栈即可处理。
            String message = "字体资源不存在: " + DISPLAY_FONT_CACHE_PATH
                + "；已使用系统回退字体: " + fallbackFont.getFamily();
            // 通过标准日志返回提示，但不把可删除缓存缺失升级为错误。
            LOGGER.warning(message);
            // 返回可继续渲染的结果，避免静态初始化失败。
            return new FontLoadResult(fallbackFont, message);
        }
        try {
            // 业务上字体直接从工程缓存读取，不要求把二进制字体打进 Git 或 resources。
            try (InputStream inputStream = Files.newInputStream(DISPLAY_FONT_CACHE_PATH)) {
                // 有效缓存返回真实字体及成功状态，供测试和运行日志区分回退情形。
                Font cachedFont = Font.createFont(Font.TRUETYPE_FONT, inputStream);
                // 成功状态保留实际字体族，便于跨平台核验缓存内容。
                return new FontLoadResult(
                    cachedFont,
                    "字体资源已加载: " + DISPLAY_FONT_CACHE_PATH
                        + "；字体族: " + cachedFont.getFamily()
                );
            }
        } catch (Exception exception) {
            // 字体损坏与缺失采用相同可恢复策略，避免缓存异常阻断批量图片生成。
            Font fallbackFont = new Font("Songti SC", Font.PLAIN, 12);
            // 状态包含真实异常和回退字体，便于用户选择删除或重新准备缓存文件。
            String message = "字体资源无法加载: " + DISPLAY_FONT_CACHE_PATH
                + "；原因: " + exception.getMessage()
                + "；已使用系统回退字体: " + fallbackFont.getFamily();
            // 损坏缓存只返回警告，不自动删除用户文件或联网替换。
            LOGGER.warning(message);
            // 返回回退结果，让主业务路径继续运行并保留可观测状态。
            return new FontLoadResult(fallbackFont, message);
        }
    }

    /**
     * 保存展示字体加载结果和面向用户的资源状态。
     *
     * @param font 实际用于渲染的字体，例如 `Dialog.plain`
     * @param message 资源状态，例如 `字体资源不存在: ...；已使用系统回退字体: Dialog`
     */
    private record FontLoadResult(Font font, String message) {
    }

    /**
     * 从命令工作目录向上识别当前工程根，避免根据规则引擎源码位置把缓存写到错误工程。
     *
     * @return 当前工程根；未识别时回退到当前工作目录
     */
    private static Path resolveCurrentProjectRoot() {
        // 业务上从实际启动目录开始向上查找构建根，支持工具处理其他工程时仍写入该工程缓存。
        Path currentPath = Paths.get("").toAbsolutePath().normalize();
        // 业务上记录最近的模块构建目录作为降级值；真正工程根应优先由 settings.gradle 确定。
        Path nearestBuildModuleRoot = null;
        for (Path probePath = currentPath; probePath != null; probePath = probePath.getParent()) {
            // 业务上 settings.gradle 标识多模块工程根，命中后缓存必须进入根 cache 而不是某个子模块 cache。
            if (Files.isRegularFile(probePath.resolve("settings.gradle"))) {
                return probePath;
            }
            // 业务上单模块工程没有 settings.gradle 时，最近的 build.gradle 仍是可用的缓存归属边界。
            if (Files.isRegularFile(probePath.resolve("build.gradle"))) {
                nearestBuildModuleRoot = probePath;
            }
        }
        // 业务上单模块工程优先回退到已识别的构建目录，而不是把缓存写到任意上级目录。
        if (nearestBuildModuleRoot != null) {
            return nearestBuildModuleRoot;
        }
        // 业务上无法识别工程根时仍以调用方当前目录为边界，避免回退到系统临时目录或源码 resources。
        return currentPath;
    }

    /**
     * 按固定质量写出 JPEG。
     *
     * @param image 已渲染图片
     * @param target 目标 JPG
     * @param overwrite 是否覆盖
     * @throws IOException 写出失败
     */
    public static void writeJpeg(BufferedImage image, Path target, boolean overwrite) throws IOException {
        // 业务上默认保护已有人工检查图片，未授权覆盖时直接失败。
        if (Files.exists(target) && !overwrite) {
            throw new IllegalArgumentException("目标图片已存在，未允许覆盖: " + target);
        }
        // 业务上为每个源文件的独立目录按需创建父目录。
        Files.createDirectories(target.toAbsolutePath().normalize().getParent());
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            // 业务上运行环境没有 JPEG 写入器时不能退化成扩展名与内容不一致的文件。
            throw new IllegalStateException("当前 Java 运行环境缺少 JPEG ImageWriter");
        }
        ImageWriter writer = writers.next();
        try (ImageOutputStream outputStream = ImageIO.createImageOutputStream(Files.newOutputStream(target))) {
            // 业务上显式绑定输出流，避免 ImageIO 使用临时默认目标。
            writer.setOutput(outputStream);
            ImageWriteParam parameter = writer.getDefaultWriteParam();
            // 业务上使用 0.94 质量平衡中文边缘清晰度和批量文件大小。
            parameter.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            parameter.setCompressionQuality(0.94f);
            writer.write(null, new IIOImage(image, null, null), parameter);
        } finally {
            // 业务上释放编码器内部资源，确保 Windows 下图片文件不会持续被锁定。
            writer.dispose();
        }
    }

    /**
     * 配置绘图质量。
     *
     * @param graphics 画布
     */
    private static void configureGraphics(Graphics2D graphics) {
        // 业务上高质量渲染保证带调拼音的小字号仍可辨认。
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
    }

    /**
     * 绘制宣纸背景和低对比装饰。
     *
     * @param graphics 画布
     */
    private static void drawBackground(Graphics2D graphics) {
        // 业务上竖向渐变替代纯白背景，使打印和屏幕阅读都保持温和对比。
        graphics.setPaint(new GradientPaint(0, 0, PAPER_TOP, 0, HEIGHT, PAPER_BOTTOM));
        graphics.fillRect(0, 0, WIDTH, HEIGHT);
        // 业务上双线边框建立完整画面边界，但不挤压正文安全区。
        graphics.setColor(GOLD);
        graphics.setStroke(new BasicStroke(2.2f));
        graphics.drawRoundRect(20, 20, WIDTH - 40, HEIGHT - 40, 18, 18);
        graphics.setStroke(new BasicStroke(1.0f));
        graphics.drawRoundRect(29, 29, WIDTH - 58, HEIGHT - 58, 14, 14);
        // 业务上水墨山形只使用低透明度，不允许装饰穿过正文卡片。
        drawMountains(graphics, 0, 1070, 1053, 330);
        // 业务上右上角竹叶呼应参考图视觉方向，并与标题保持安全距离。
        drawBamboo(graphics);
    }

    /**
     * 绘制页首标题。
     *
     * @param graphics 画布
     * @param poem 作品
     */
    private static void drawHeader(Graphics2D graphics, DocTopicPoem poem) {
        // 业务上标题统一加书名号，避免和栏目标签混淆。
        String title = "《" + poem.title() + "》";
        graphics.setFont(TITLE_FONT);
        graphics.setColor(INK);
        drawCenteredString(graphics, title, 100);
        // 业务上朝代作者来源于核定表格，朝代为空时不虚构括号。
        String attribution = poem.dynasty().isBlank()
            ? poem.author()
            : "【" + poem.dynasty() + "】" + poem.author();
        graphics.setFont(SUBTITLE_FONT);
        graphics.setColor(MUTED_INK);
        drawCenteredString(graphics, attribution + "  ·  古诗故事阅读", 155);
        // 业务上标题下方使用短分隔线形成层级，不放置会被误认为正文的图形文字。
        graphics.setColor(GOLD);
        graphics.setStroke(new BasicStroke(1.5f));
        graphics.drawLine(250, 180, 803, 180);
        graphics.fillOval(516, 175, 10, 10);
    }

    /**
     * 绘制原文与逐字拼音卡片。
     *
     * @param graphics 画布
     * @param poem 作品
     * @param illustration 审校主题插画
     */
    private static void drawOriginalCard(Graphics2D graphics, DocTopicPoem poem, BufferedImage illustration) {
        // 业务上原文卡片划分为左侧注音阅读区和右侧主题插画区，让当前诗词的配图成为清晰主视觉而非淡化装饰。
        drawCard(graphics, 55, 195, 943, 290);
        // 业务上先绘制卡片内的主题图，再叠放文字，保证插画不会遮挡汉字或拼音。
        drawThemeIllustration(graphics, illustration, 570, 240, 400, 220);
        // 业务上栏目标签最后叠放在卡片左上角，维持标签与主题图的稳定层级。
        drawLabel(graphics, 70, 206, "原文与注音");
        // 业务上原文只占左半栏，给右侧主题插画预留独立安全区，避免图片被压缩成看不见的小景。
        List<AnnotatedLine> visualLines = wrapAnnotatedLines(graphics, poem.lines(), 450);
        if (visualLines.size() > 5) {
            // 业务上短诗模板最多五个显示行，超长作品必须进入多图分页而不能缩成小字。
            throw new IllegalArgumentException("原文超过单图安全行数，需要分页生成: " + poem.title());
        }
        // 业务上行距与文楷字面高度匹配，四行诗紧凑但拼音和下一行汉字不会碰撞。
        int rowHeight = 55;
        // 业务上根据实际显示行数垂直居中左侧诗文区域，避免短诗贴住标签或卡片底线。
        int totalHeight = visualLines.size() * rowHeight;
        // 业务上左侧诗文从标签下方开始，并在可用高度中计算居中起点。
        int startY = 246 + Math.max(0, (222 - totalHeight) / 2);
        for (int index = 0; index < visualLines.size(); index++) {
            // 业务上每个显示行只在左侧阅读区独立居中，逐字拼音始终位于对应汉字正上方。
            drawAnnotatedLine(graphics, visualLines.get(index), startY + index * rowHeight, 90, 450);
        }
    }

    /**
     * 在原文卡片右侧绘制当前篇目的清晰主题插画。
     *
     * @param graphics 正式页面画布
     * @param illustration 当前诗词已绑定的无文字插画
     * @param x 插画安全区左坐标
     * @param y 插画安全区上坐标
     * @param width 插画安全区宽度
     * @param height 插画安全区高度
     */
    private static void drawThemeIllustration(
        Graphics2D graphics,
        BufferedImage illustration,
        int x,
        int y,
        int width,
        int height
    ) {
        // 业务上复制图形上下文，保证裁切区域不会影响原文卡片之外的后续绘制。
        Graphics2D illustrationGraphics = (Graphics2D) graphics.create();
        try {
            // 业务上启用同一套高质量绘制参数，使主题图边缘和文字抗锯齿保持一致。
            configureGraphics(illustrationGraphics);
            // 业务上先铺浅色底，防止透明 PNG 或边缘留白露出不稳定的底图颜色。
            illustrationGraphics.setColor(new Color(247, 242, 229));
            illustrationGraphics.fillRoundRect(x, y, width, height, 18, 18);
            // 业务上限制插画仅在右侧圆角安全区内显示，主题图不会侵入左侧拼音和汉字区域。
            illustrationGraphics.clip(new RoundRectangle2D.Double(x, y, width, height, 18, 18));
            // 业务上按“覆盖裁切”计算源图区域，确保每首不同长宽的插画都能完整填满主题主视觉框。
            double sourceRatio = (double) illustration.getWidth() / illustration.getHeight();
            // 业务上以目标框比例决定从源图横裁还是竖裁，避免拉伸人物、动物或山水主体。
            double targetRatio = (double) width / height;
            int sourceLeft = 0;
            int sourceTop = 0;
            int sourceRight = illustration.getWidth();
            int sourceBottom = illustration.getHeight();
            if (sourceRatio > targetRatio) {
                // 业务上横向更宽的素材从中心裁去两侧，使主体仍保持正常比例。
                int cropWidth = (int) Math.round(illustration.getHeight() * targetRatio);
                sourceLeft = (illustration.getWidth() - cropWidth) / 2;
                sourceRight = sourceLeft + cropWidth;
            } else if (sourceRatio < targetRatio) {
                // 业务上纵向更高的素材从中心裁去上下，使右侧主视觉保持完整矩形而不留空白。
                int cropHeight = (int) Math.round(illustration.getWidth() / targetRatio);
                sourceTop = (illustration.getHeight() - cropHeight) / 2;
                sourceBottom = sourceTop + cropHeight;
            }
            // 业务上以完整不透明度绘制当前诗词插画，明确避免再次退化为难以辨认的淡化小景。
            illustrationGraphics.drawImage(
                illustration,
                x,
                y,
                x + width,
                y + height,
                sourceLeft,
                sourceTop,
                sourceRight,
                sourceBottom,
                null
            );
            // 业务上加细金边提示主题图的独立阅读区域，同时不使用文字或影响插画内容。
            illustrationGraphics.setClip(null);
            illustrationGraphics.setColor(new Color(177, 145, 91, 180));
            illustrationGraphics.setStroke(new BasicStroke(1.2f));
            illustrationGraphics.drawRoundRect(x, y, width, height, 18, 18);
        } finally {
            // 业务上立即释放复制的图形上下文，批量绘制时不会累积原生图形资源。
            illustrationGraphics.dispose();
        }
    }

    /**
     * 按实际字宽把核定行拆成页面显示行。
     *
     * @param graphics 画布
     * @param sourceLines 核定原文行
     * @param maximumWidth 最大显示宽度
     * @return 保持逐字顺序的显示行
     */
    private static List<AnnotatedLine> wrapAnnotatedLines(
        Graphics2D graphics,
        List<AnnotatedLine> sourceLines,
        int maximumWidth
    ) {
        List<AnnotatedLine> result = new ArrayList<>();
        for (AnnotatedLine sourceLine : sourceLines) {
            List<AnnotatedToken> current = new ArrayList<>();
            int currentWidth = 0;
            for (AnnotatedToken token : sourceLine.tokens()) {
                int tokenWidth = annotatedTokenWidth(graphics, token);
                if (!current.isEmpty() && currentWidth + tokenWidth > maximumWidth) {
                    // 业务上超过安全宽度时在字元边界换行，拼音和汉字不能被拆成两列。
                    result.add(new AnnotatedLine(current));
                    current = new ArrayList<>();
                    currentWidth = 0;
                }
                // 业务上按原顺序加入当前字元，不改写核定标点或拼音。
                current.add(token);
                currentWidth += tokenWidth;
            }
            if (!current.isEmpty()) {
                // 业务上收取每个源行的剩余字元，避免行尾内容丢失。
                result.add(new AnnotatedLine(current));
            }
        }
        return List.copyOf(result);
    }

    /**
     * 绘制一行逐字注音。
     *
     * @param graphics 画布
     * @param line 注音行
     * @param baselineY 拼音基线
     * @param contentX 左栏起点
     * @param contentWidth 左栏宽度
     */
    private static void drawAnnotatedLine(
        Graphics2D graphics,
        AnnotatedLine line,
        int baselineY,
        int contentX,
        int contentWidth
    ) {
        int totalWidth = line.tokens().stream().mapToInt(token -> annotatedTokenWidth(graphics, token)).sum();
        // 业务上每行在原文安全区内居中，利用统一字元列宽形成参考图式的整齐节奏。
        int x = contentX + Math.max(0, (contentWidth - totalWidth) / 2);
        for (AnnotatedToken token : line.tokens()) {
            int tokenWidth = annotatedTokenWidth(graphics, token);
            // 业务上拼音使用拉丁字体和较小字号，空拼音标点不绘制占位字符。
            graphics.setFont(PINYIN_FONT);
            graphics.setColor(MUTED_INK);
            drawCenteredAt(graphics, token.pinyin(), x, tokenWidth, baselineY);
            // 业务上汉字直接使用核定字符，位于同一字元列的拼音下方。
            graphics.setFont(HANZI_FONT);
            graphics.setColor(INK);
            drawCenteredAt(graphics, token.text(), x, tokenWidth, baselineY + 39);
            x += tokenWidth;
        }
    }

    /**
     * 计算注音字元列宽。
     *
     * @param graphics 画布
     * @param token 字元
     * @return 能容纳拼音和汉字的宽度
     */
    private static int annotatedTokenWidth(Graphics2D graphics, AnnotatedToken token) {
        // 业务上分别测量拼音和汉字，选择较宽者并增加固定呼吸空间。
        graphics.setFont(PINYIN_FONT);
        int pinyinWidth = graphics.getFontMetrics().stringWidth(token.pinyin());
        graphics.setFont(HANZI_FONT);
        int hanziWidth = graphics.getFontMetrics().stringWidth(token.text());
        return Math.max(42, Math.max(pinyinWidth, hanziWidth) + 14);
    }

    /**
     * 读取经过审校并与篇目绑定的主题插画。
     *
     * @param illustrationPath 插画路径
     * @return 可绘制位图
     */
    private static BufferedImage readIllustration(Path illustrationPath) {
        try {
            // 业务上 ImageIO 必须真实解码素材，仅检查扩展名不足以发现损坏图片。
            BufferedImage illustration = ImageIO.read(illustrationPath.toFile());
            if (illustration == null || illustration.getWidth() <= 0 || illustration.getHeight() <= 0) {
                // 业务上无法解码的插画不能进入正式批量成品。
                throw new IllegalArgumentException("主题插画无法解码: " + illustrationPath);
            }
            return illustration;
        } catch (IOException exception) {
            // 业务上把具体路径保留在异常中，方便批量任务直接定位损坏素材。
            throw new IllegalArgumentException("读取主题插画失败: " + illustrationPath, exception);
        }
    }

    /**
     * 把主题插画裁成淡化边角小景，避免出现后贴矩形照片感。
     */
    private static void drawVignette(
        Graphics2D graphics,
        BufferedImage illustration,
        int x,
        int y,
        int width,
        int height,
        VignettePlacement placement
    ) {
        // 业务上先在透明缓冲区绘制指定景物裁切，每个栏目从同一主题图取得不同视觉片段。
        BufferedImage vignette = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D vignetteGraphics = vignette.createGraphics();
        try {
            configureGraphics(vignetteGraphics);
            int[] crop = placement.crop(illustration.getWidth(), illustration.getHeight());
            vignetteGraphics.drawImage(
                illustration,
                0,
                0,
                width,
                height,
                crop[0],
                crop[1],
                crop[2],
                crop[3],
                null
            );
            // 业务上使用径向透明蒙版让图像四周融入卡片底色，不保留明显矩形边界。
            vignetteGraphics.setComposite(AlphaComposite.DstIn);
            // 业务上带场景底色的主题图使用更强羽化，透明书卷素材保留更完整的物体轮廓。
            boolean strongFeathering = placement.requiresStrongFeathering();
            float radius = Math.max(width, height) * (strongFeathering ? 0.52f : 0.68f);
            vignetteGraphics.setPaint(new RadialGradientPaint(
                new Point(width / 2, height / 2),
                radius,
                strongFeathering
                    ? new float[] {0.0f, 0.42f, 1.0f}
                    : new float[] {0.0f, 0.72f, 1.0f},
                new Color[] {
                    new Color(255, 255, 255, strongFeathering ? 190 : 235),
                    new Color(255, 255, 255, strongFeathering ? 115 : 190),
                    new Color(255, 255, 255, 0)
                }
            ));
            vignetteGraphics.fillRect(0, 0, width, height);
        } finally {
            // 业务上每个栏目绘制后释放临时图形资源，批量生成多篇时不积累系统句柄。
            vignetteGraphics.dispose();
        }
        Composite previousComposite = graphics.getComposite();
        // 业务上整体降低小景浓度，让正文对比度始终高于装饰插画。
        graphics.setComposite(AlphaComposite.getInstance(
            AlphaComposite.SRC_OVER,
            placement.requiresStrongFeathering() ? 0.56f : 0.80f
        ));
        graphics.drawImage(vignette, x, y, null);
        graphics.setComposite(previousComposite);
    }

    /**
     * 绘制故事、解读或要点卡片。
     *
     * @param graphics 画布
     * @param x 左坐标
     * @param y 上坐标
     * @param width 宽度
     * @param height 高度
     * @param label 栏目名
     * @param paragraphs 审校文本
     * @param bullets 是否显示项目符号
     * @param font 正文字体
     * @param illustration 当前篇目主题插画
     * @param placement 小景位置与裁切类型
     */
    private static void drawTextCard(
        Graphics2D graphics,
        int x,
        int y,
        int width,
        int height,
        String label,
        List<String> paragraphs,
        boolean bullets,
        Font font,
        BufferedImage illustration,
        VignettePlacement placement
    ) {
        // 业务上所有内容卡片复用统一边框、圆角和标签，保证多篇批量输出视觉一致。
        drawCard(graphics, x, y, width, height);
        drawLabel(graphics, x + 18, y + 16, label);
        // 业务上先绘制淡色小景再绘制文字，避免透明插画覆盖字形边缘。
        boolean leftIllustration = placement.isLeft();
        int illustrationWidth = leftIllustration ? 165 : 195;
        int illustrationHeight = Math.min(height - 58, leftIllustration ? 118 : 145);
        int illustrationX = leftIllustration ? x + 12 : x + width - illustrationWidth - 12;
        int illustrationY = y + height - illustrationHeight - 8;
        drawVignette(
            graphics,
            illustration,
            illustrationX,
            illustrationY,
            illustrationWidth,
            illustrationHeight,
            placement
        );
        graphics.setFont(font);
        graphics.setColor(INK);
        int lineHeight = font.getSize() + 10;
        // 业务上正文避开小景所在边角，但保留足够宽度以维持参考图的长行阅读节奏。
        int textX = leftIllustration ? x + 180 : x + 28;
        // 正文基线下移到栏目标签底部之后，避免中文上伸部位被标签背景遮挡。
        int textY = y + 82;
        int textWidth = leftIllustration ? width - 205 : width - 245;
        for (String paragraph : paragraphs) {
            // 业务上项目卡使用圆点建立扫描层级，故事卡保持连续叙述。
            String displayText = bullets ? "• " + paragraph : paragraph;
            List<String> lines = wrapText(graphics, displayText, textWidth);
            for (String line : lines) {
                if (textY > y + height - 22) {
                    // 业务上扩展内容超过卡片安全区时失败，禁止静默裁掉末尾文字。
                    throw new IllegalArgumentException("栏目内容超过单图安全高度: " + label);
                }
                graphics.drawString(line, textX, textY);
                textY += lineHeight;
            }
            // 业务上段落间增加轻微留白，故事和解读不会黏成一整块。
            textY += bullets ? 2 : 5;
        }
    }

    /**
     * 栏目小景在卡片中的位置和原图裁切区域。
     */
    private enum VignettePlacement {
        /** 左侧荷叶与水面。 */
        LEFT_LOTUS(true, 0.00, 0.38, 0.48, 1.00),
        /** 右侧昂首白鹅。 */
        RIGHT_GOOSE(false, 0.44, 0.12, 1.00, 0.88),
        /** 右侧完整书卷笔筒小景。 */
        RIGHT_STUDY(false, 0.02, 0.02, 0.98, 0.98),
        /** 左侧书册和展开书页小景。 */
        LEFT_BOOKS(true, 0.00, 0.32, 0.82, 1.00);

        // 业务上左右标记决定正文避让方向，四个比例坐标决定同一审校插画的不同景别。
        private final boolean left;
        private final double sourceLeft;
        private final double sourceTop;
        private final double sourceRight;
        private final double sourceBottom;

        VignettePlacement(
            boolean left,
            double sourceLeft,
            double sourceTop,
            double sourceRight,
            double sourceBottom
        ) {
            // 业务上枚举构造时固定版式元数据，运行中不接受外部坐标修改。
            this.left = left;
            this.sourceLeft = sourceLeft;
            this.sourceTop = sourceTop;
            this.sourceRight = sourceRight;
            this.sourceBottom = sourceBottom;
        }

        /** 返回小景是否位于卡片左侧。 */
        private boolean isLeft() {
            // 业务上调用方据此计算正文起点和可用宽度。
            return left;
        }

        /** 判断当前裁切是否来自带完整场景底色的主题插画。 */
        private boolean requiresStrongFeathering() {
            // 业务上主题图需要消除矩形背景，已经透明的书卷素材不执行过度淡化。
            return this != RIGHT_STUDY && this != LEFT_BOOKS;
        }

        /** 把比例裁切区域转换成当前插画的像素坐标。 */
        private int[] crop(int sourceWidth, int sourceHeight) {
            // 业务上使用比例而非固定像素，允许后续替换不同分辨率的篇目插画。
            return new int[] {
                (int) Math.round(sourceWidth * sourceLeft),
                (int) Math.round(sourceHeight * sourceTop),
                (int) Math.round(sourceWidth * sourceRight),
                (int) Math.round(sourceHeight * sourceBottom)
            };
        }
    }

    /**
     * 按字符宽度换行中文正文。
     *
     * @param graphics 画布
     * @param text 正文
     * @param maximumWidth 最大宽度
     * @return 显示行
     */
    private static List<String> wrapText(Graphics2D graphics, String text, int maximumWidth) {
        List<String> lines = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        FontMetrics metrics = graphics.getFontMetrics();
        // 业务上按 Unicode 码点换行，避免扩展字符被拆坏。
        text.codePoints().forEach(codePoint -> {
            String character = new String(Character.toChars(codePoint));
            if (!current.isEmpty() && metrics.stringWidth(current + character) > maximumWidth) {
                // 业务上达到安全宽度后收取当前行，再从完整字符开始下一行。
                lines.add(current.toString());
                current.setLength(0);
            }
            current.append(character);
        });
        if (!current.isEmpty()) {
            // 业务上收取最后一行，确保段尾文字不会丢失。
            lines.add(current.toString());
        }
        if (lines.size() >= 2) {
            String lastLine = lines.getLast();
            String previousLine = lines.get(lines.size() - 2);
            int lastCodePointCount = lastLine.codePointCount(0, lastLine.length());
            int previousCodePointCount = previousLine.codePointCount(0, previousLine.length());
            if (lastCodePointCount <= 2 && previousCodePointCount >= 10) {
                // 业务上末行只剩孤字或标点时，从上一行回移六个完整字符，避免海报出现悬空句号。
                int movedCodePointCount = Math.min(6, previousCodePointCount / 3);
                int splitIndex = previousLine.offsetByCodePoints(0, previousCodePointCount - movedCodePointCount);
                lines.set(lines.size() - 2, previousLine.substring(0, splitIndex));
                lines.set(lines.size() - 1, previousLine.substring(splitIndex) + lastLine);
            }
        }
        return lines;
    }

    /**
     * 绘制统一内容卡片。
     */
    private static void drawCard(Graphics2D graphics, int x, int y, int width, int height) {
        // 业务上半透明浅色卡片压住背景装饰，保障正文对比度。
        graphics.setColor(CARD);
        graphics.fill(new RoundRectangle2D.Double(x, y, width, height, 24, 24));
        graphics.setColor(new Color(155, 126, 82));
        graphics.setStroke(new BasicStroke(1.6f));
        graphics.draw(new RoundRectangle2D.Double(x, y, width, height, 24, 24));
    }

    /**
     * 绘制栏目标签。
     */
    private static void drawLabel(Graphics2D graphics, int x, int y, String text) {
        graphics.setFont(LABEL_FONT);
        FontMetrics metrics = graphics.getFontMetrics();
        int width = metrics.stringWidth(text) + 38;
        // 业务上棕色标签与参考图一致，但不复制图片中的品牌图形。
        graphics.setColor(BROWN);
        graphics.fillRoundRect(x, y, width, 45, 15, 15);
        graphics.setColor(Color.WHITE);
        graphics.drawString(text, x + 19, y + 32);
    }

    /**
     * 绘制页脚总结。
     */
    private static void drawFooter(Graphics2D graphics, String footer) {
        // 业务上页脚使用独立浅色条，避免和底部山水装饰混在一起。
        graphics.setColor(new Color(255, 251, 239, 235));
        graphics.fillRoundRect(55, 1356, 943, 90, 20, 20);
        graphics.setColor(GOLD);
        graphics.setStroke(new BasicStroke(1.4f));
        graphics.drawRoundRect(55, 1356, 943, 90, 20, 20);
        graphics.setFont(FOOTER_FONT);
        graphics.setColor(BROWN);
        drawCenteredString(graphics, footer, 1412);
    }

    /**
     * 绘制低透明度远山。
     */
    private static void drawMountains(Graphics2D graphics, int x, int y, int width, int height) {
        Path2D path = new Path2D.Double();
        // 业务上山形控制在底部背景层，不穿过原文和故事卡片。
        path.moveTo(x, y + height);
        path.lineTo(x + width * 0.12, y + height * 0.46);
        path.lineTo(x + width * 0.23, y + height * 0.78);
        path.lineTo(x + width * 0.39, y + height * 0.28);
        path.lineTo(x + width * 0.55, y + height * 0.74);
        path.lineTo(x + width * 0.73, y + height * 0.37);
        path.lineTo(x + width * 0.88, y + height * 0.70);
        path.lineTo(x + width, y + height * 0.45);
        path.lineTo(x + width, y + height);
        path.closePath();
        graphics.setColor(MOUNTAIN);
        graphics.fill(path);
        // 业务上用三条水纹提示《咏鹅》的池塘意象，同时保持装饰可复用。
        graphics.setColor(WATER);
        graphics.setStroke(new BasicStroke(3.0f));
        graphics.drawArc(70, 1300, 280, 54, 8, 164);
        graphics.drawArc(325, 1320, 350, 52, 8, 164);
        graphics.drawArc(660, 1295, 300, 58, 8, 164);
    }

    /**
     * 绘制右上竹枝。
     */
    private static void drawBamboo(Graphics2D graphics) {
        // 业务上竹枝使用低饱和绿灰色，不与棕色栏目标签竞争。
        graphics.setColor(new Color(74, 103, 74, 120));
        graphics.setStroke(new BasicStroke(4.0f));
        graphics.drawLine(912, 25, 1004, 193);
        graphics.drawLine(943, 75, 1008, 49);
        graphics.drawLine(961, 111, 1018, 101);
        graphics.drawLine(930, 62, 891, 45);
        // 业务上叶片只用简单椭圆，保证纯 Java2D 可复现且不会携带模型文字伪影。
        graphics.fillOval(986, 35, 37, 12);
        graphics.fillOval(990, 91, 42, 13);
        graphics.fillOval(875, 37, 43, 13);
        graphics.fillOval(914, 92, 40, 13);
    }

    /**
     * 把文字水平居中到整张画布。
     */
    private static void drawCenteredString(Graphics2D graphics, String text, int baselineY) {
        FontMetrics metrics = graphics.getFontMetrics();
        int x = (WIDTH - metrics.stringWidth(text)) / 2;
        graphics.drawString(text, x, baselineY);
    }

    /**
     * 把文字水平居中到指定字元列。
     */
    private static void drawCenteredAt(Graphics2D graphics, String text, int x, int width, int baselineY) {
        if (text == null || text.isEmpty()) {
            // 业务上标点的拼音为空，不绘制任何占位符。
            return;
        }
        FontMetrics metrics = graphics.getFontMetrics();
        graphics.drawString(text, x + (width - metrics.stringWidth(text)) / 2, baselineY);
    }
}
