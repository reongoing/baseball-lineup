# LINEUP CARD - 少年野球スタメン作成アプリ

少年野球チームの監督・コーチ向けに作られた、スタメン・守備配置・交代予定を管理するWebアプリです。
スマートフォンを中心に設計されており、試合ごとのデータをクラウドに保存・共有できます。

---

## 機能一覧

### 🗂 試合履歴
- 試合ごとにスタメンを保存・管理
- 日付・対戦相手・メモ（大会名など）の記録
- 過去のスタメンの呼び出し・編集・削除
- 既存試合をコピーして新規作成

### 📋 打順・守備管理
- ドラッグ＆ドロップ（PC）とタップ選択（スマホ）で打順を組み立て
- 打順は任意の順番から自由に設定可能（例：4番から先に設定）
- 打順内での並べ替えは入れ替え（スワップ）方式
- 守備ポジションの割り当て（P / C / 1B / 2B / 3B / SS / LF / CF / RF / DH）
- DH制・全員打ちモードの切り替え
- 控え選手・休み選手の管理

### 🏟 フィールド表示
- SVGベースのフィールド図で守備配置をビジュアル確認
- 打順番号バッジ表示
- フィールド図上で選手をタップして守備ポジションを変更（2選手の入れ替えにも対応）

### 🔄 交代・守備変更管理
- 「1回目の交代」「2回目の交代」のようなグループ単位で交代を管理
- 1グループに複数の交代・守備変更をまとめて登録可能
- 種別：選手交代（OUT/IN）・守備変更のみ（2選手入れ替え or 単独変更）
- 各ステップの守備配置図をリアルタイムでプレビュー
- 配置図上でタップして守備変更 → そのグループに自動記録
- グループ・変更の順番を↑↓で並べ替え可能

### 👥 選手管理
- 背番号・学年・投げる手・打つ手の登録・編集
- 学年フィルター（1〜6年）
- 選手一覧のCSVエクスポート・インポート（Excelで編集可能）

### 📤 共有機能
- 打順テキストをLINEで送る・クリップボードコピー
- 守備配置画像（PNG）を生成・共有・ダウンロード
- 打順＋守備を1枚にまとめた合成画像の生成・共有

### 🔐 認証・アカウント管理
- Firebase Authentication（メール/パスワード）
- メールアドレス・パスワード・チーム名の変更
- パスワードリセットメール送信

---

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フロントエンド | React 18 |
| 認証 | Firebase Authentication |
| データベース | Cloud Firestore |
| ホスティング | Firebase Hosting |
| 画像生成 | SVG → Canvas → PNG（外部ライブラリ不使用） |
| アナリティクス | Google Analytics 4 |

---

## ディレクトリ構成

```
├── public/
│   ├── index.html         # エントリーポイント（キャッシュ制御・GA4タグ設定済み）
│   ├── favicon.svg        # ファビコン（SVG）
│   └── robots.txt         # クローラーブロック設定
├── src/
│   ├── index.js           # Reactエントリー・ServiceWorker無効化
│   ├── App.jsx            # 認証ラッパー（ログイン・新規登録・パスワードリセット・アカウント設定）
│   ├── LineupApp.jsx      # メインアプリ（Firestore連携）
│   └── firebase.js        # Firebase初期化（環境変数から読み込み）
├── .env                   # 環境変数（GitHubにはpushしない）
├── .env.example           # 環境変数テンプレート
├── .gitignore
├── firebase.json          # Firebase Hostingキャッシュ設定
└── package.json
```

---

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/your-name/baseball-lineup.git
cd baseball-lineup
```

### 2. 依存パッケージをインストール

```bash
npm install
```

### 3. 環境変数を設定

`.env.example` をコピーして `.env` を作成し、Firebaseコンソールから取得した値を入力します。

```bash
cp .env.example .env
```

```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### 4. ローカルで起動

```bash
npm start
```

---

## Firebase セットアップ

1. [Firebase Console](https://console.firebase.google.com) でプロジェクトを作成
2. **Authentication** → メール/パスワードを有効化
3. **Firestore Database** → データベースを作成（リージョン: `asia-northeast1`）
4. セキュリティルールを設定

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /teams/{teamId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == teamId;
    }
  }
}
```

---

## デプロイ

```bash
npm run build
firebase deploy
```

---

## PWAとして使う

スマートフォンのブラウザで開き「ホーム画面に追加」するとアプリのように使えます。

- **iPhone (Safari)** : 共有ボタン →「ホーム画面に追加」
- **Android (Chrome)** : メニュー →「ホーム画面に追加」

デプロイのたびに自動で最新版に更新されます（Service Worker無効化・キャッシュ制御設定済み）。

---

## 選手データのCSVフォーマット

インポート・エクスポートに使用するCSVのフォーマットは以下の通りです。

```
背番号,名前,学年,投げる手,打つ手
1,山田 太郎,6年,右投,左打
2,鈴木 一郎,5年,右投,右打
```

- 1行目はヘッダー行（スキップされます）
- 学年・投打は省略可能
- インポート時、名前が一致する選手は上書き更新、新規選手は追加

---

## 注意事項

- `.env` ファイルは絶対に GitHub に push しないでください
- Firebase の無料枠（Sparkプラン）で運用可能です
- 複数のコーチで同じデータを共有する場合は、チーム共有アカウントを1つ作成してください

---

## ライセンス

© 2026 Reo Matayoshi. All rights reserved.
