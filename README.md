# funhou

**funhou** は分報を簡単に記録できるツールです。

## 概要

分報は日報よりも粒度細かく、作業内容や進捗、感想などをリアルタイムに記録します。このツールを使うことで、日々の活動を効率的に追跡し、振り返りに活用できます。

## 機能

- **リアルタイム記録**: 作業中に思いついたことをすぐに記録
- **タイムスタンプ**: 自動的に時刻を記録
- **振り返り機能**: 過去の分報を検索・閲覧
- **日報生成**: 分報から日報を自動生成
- **音声入力**: マイクから音声で入力可能
- **AI テキスト整形**: Ollama + Gemma 3 を使ってローカルで音声認識結果を整形（句読点・改行の自動追加）

## インストール

```bash
git clone https://github.com/FScoward/funhou.git
cd funhou
```

## 使い方

```bash
# 使用例を追加予定
```

## 必要な環境

- macOS / Windows / Linux
- Node.js 18+
- Rust（Tauri ビルド用）

## 音声入力のテキスト整形機能（Ollama + Gemma 3）

音声認識結果に句読点や改行を自動で追加する機能です。ローカルの LLM（Ollama）を使用するため、API コストがかからず、完全オフラインで動作します。

### セットアップ

#### 1. Ollama のインストール

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
[公式サイト](https://ollama.ai/download) からインストーラーをダウンロードしてください。

#### 2. Ollama サーバーの起動

```bash
ollama serve
```

#### 3. Gemma 3 4B モデルのダウンロード

```bash
ollama pull gemma3:4b
```

初回ダウンロードには数分〜十数分かかります（モデルサイズ: 約3GB）。

#### 4. 動作確認

```bash
# モデル一覧を確認
ollama list

# テスト実行
ollama run gemma3:4b "こんにちは"
```

### funhou での設定

1. アプリ右下の歯車アイコン（⚙️）をクリック
2. 「音声入力のテキスト整形」のスイッチをオンにする
3. モデルを選択（デフォルト: gemma3:4b）

### トラブルシューティング

**「Ollamaサーバー未起動」と表示される場合:**
```bash
# Ollama が起動しているか確認
curl http://localhost:11434/api/tags

# 起動していなければ
ollama serve
```

**モデルが見つからない場合:**
```bash
ollama pull gemma3:4b
```

## ライセンス

MIT License

## 作者

FScoward
