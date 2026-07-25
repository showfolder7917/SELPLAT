package com.sp.selplat.ruleengine.fujitsu.sql;

/** 既存の CPMAB081 実行名を汎用 JSON 駆動生成器へ接続する互換入口。 */
public final class CPMAB081SQL仕様書生成ツール {

  /** 互換入口のインスタンス化を禁止する。 */
  private CPMAB081SQL仕様書生成ツール() {
  }

  /** 既存の起動方法を維持しながら、全生成処理を汎用ツールへ委譲する。 */
  public static void main(String[] args) throws Exception {
    // 引数なしなら CPMAB081 の標準 JSON、引数ありなら指定 JSON をそのまま利用する。
    SQL仕様書生成ツール.main(args);
  }
}
