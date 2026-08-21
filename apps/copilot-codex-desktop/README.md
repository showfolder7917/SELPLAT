# Copilot Local Desktop / 本地 Copilot 桌面应用

独立的 Windows Electron 桌面应用。界面按 `OPTION/copilot` 中的参考截图实现，消息通过 Electron 安全 IPC 直接交给本机 Codex TypeScript SDK，不启动 HTTP/HTTPS 服务。

Windows の独立 Electron デスクトップアプリです。`OPTION/copilot` の参照画像に合わせた UI から、安全な IPC 経由でローカル Codex TypeScript SDK を呼び出します。HTTP/HTTPS サーバーは使用しません。

## 启动 / 起動

双击 / ダブルクリック：

```text
启动本地Copilot.bat
```

首次启动会安装依赖并编译。左下角齿轮菜单的“设置/設定”可以切换简体中文、日本語以及只读/工作区写入模式。

初回起動時に依存関係をインストールしてビルドします。左下の歯車メニューにある「设置/設定」から、簡体字中国語、日本語、読み取り専用、ワークスペース書き込みを切り替えられます。

应用 UI 使用 Copilot 作为视觉参考，但本地安装包、发布者和签名不会声明为 Microsoft 官方产品。
