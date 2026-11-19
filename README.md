# 校了さん Firebase対応版 v5 — 導入手順

GitHub Pagesで動く既存の「校了さん」5画面を維持し、Firebase Authentication（メール＋パスワード）による3人限定ログインと、Realtime Databaseによる共有編集へ移行するバージョンです。

**注意：このZIPはFirebaseにまだ接続していません。** `firebase-config.js` にFirebase Consoleで発行された正しいWebアプリ設定を入力して公開後、3人それぞれで動作を確認してください。現在の端末内データを自動的にFirebaseへアップロードすることはありません。

## 導入前の確認（必須）

- Realtime Databaseに既に初期JSONを **`/bands/koryosan`** へインポート済みであること。`songs`（8曲）と`songSections`（ヒートストア15区間）、`songNotes`、`practiceSlots`、`setlistSlots`、`practicePresets`、`setlistExtras`が存在すること。
- Authentication → Sign-in methodで**メール/パスワード**を有効化し、3人をUsersに作成済みであること。
- `members`配下に3人のAuth UIDをそれぞれ Boolean値 `true` で登録済みであること。
- Realtime Database → Rulesに、3人以外の`/bands/koryosan`へのアクセスを拒否し、読み取り専用の曲・歌詞と編集可能なタスク・メモ・スロットを分離したルールを**公開済み**であること。
- **アップロード前に、現在のv4アプリからJSONバックアップを取得すること。** v5はローカルデータを自動移行・自動上書きしません。Firebaseに登録していない古いタスク・スロット・追記メモは別途整理・移行が必要です。

## STEP 1. FirebaseのWebアプリを登録

1. [Firebase Console](https://console.firebase.google.com/) → `koryosan`プロジェクト。
2. 歯車の **プロジェクトの設定** → **全般** → **マイアプリ**。
3. Webアプリ（`</>`）がまだなければ「アプリを追加」から登録。ニックネームは `koryosan-web` などでOK。**Firebase Hostingは使わない**ので、Hosting設定は不要。
4. 「SDK の設定と構成」に表示される`firebaseConfig`を確認します。
5. `Koryosan_PWA_Firebase_v5/firebase-config.js` をテキストエディタで開き、次の項目を実際の値に置き換えて保存します。
   - `apiKey` （`PASTE_YOUR_API_KEY`の部分）
   - `authDomain`（Firebaseに表示された値）
   - `projectId`（このファイルには `koryosan-222c8` を仮入力済み。必ずConsoleで確認）
   - `appId` （`PASTE_YOUR_APP_ID`の部分）
   - `databaseURL`（既に入力してあるURLが実際のRealtime Databaseと一致するか確認）

記入後の形（*以下は例。実際の値ではありません*）：

```js
window.KORYO_FIREBASE_CONFIG = {
  apiKey: 'AIz...実際の値',
  authDomain: '実際のプロジェクトID.firebaseapp.com',
  databaseURL: 'https://koryosan-222c8-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: '実際のプロジェクトID',
  appId: '1:123456789:web:xxxxxxx'
};
```

これはWebクライアント設定であり、**パスワードやサービスアカウントの秘密鍵ではありません**。Firebaseの認証・Security Rulesがデータを守ります。**パスワードはソースやGitHubに記載しないでください。**

## STEP 2. Firebase Authenticationの設定を確認

- Authentication → **Sign-in method** → メール/パスワードが有効であることを確認。
- Authentication → **Users**：メンバー3人分のアカウントとUIDがあることを確認。
- Authentication → Settings → **Authorized domains**：公開ドメインを求められるフローを使う場合に備え、`kaiutsunomiya-jpg.github.io`を登録します。**`https://` や `/koryosan/` は付けません**。通常のメール/パスワードログインではOAuth型のリダイレクト設定は使いません。
- 3人がそれぞれ異なる強力なパスワードを使用してください。初回入力後はFirebase Authの`browserLocalPersistence`で、通常の利用では次回以降のログイン状態を保持できます。端末側のサイトデータ消去や明示ログアウト後は再入力が必要です。

## STEP 3. GitHub Pagesへ公開

**おすすめ：最初は新規リポジトリ `koryosan-firebase-test` で試験公開し、正常に3人で使えることを確認してから既存の`koryosan`を更新してください。** テスト用でも実データにアクセスできるため、URLの秘密性には頼らずSecurity Rulesで保護してください。

1. このZIPを解凍し、`firebase-config.js`の設定を終える。
2. GitHubのリポジトリ → Code → Add file → Upload filesから、解凍フォルダの**中身**をすべてアップロード。
3. `index.html`がリポジトリ直下にあることを確認し、Commit changes。
4. Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save。
5. Actionsで公開が成功したら、Safari/ChromeからURLを開く。
6. ログイン画面から、登録した3人のうち1人のメールアドレスとパスワードを入力する。

**設定されていない場合**、ログイン画面は「FirebaseのWebアプリ設定が未入力」と表示し、曲・歌詞を読み込みません。権限がない場合もアプリ本体は起動しません。エラーが出たら`firebase-config.js`、`members`、Security Rules、インポート先の順に確認してください。

## STEP 4. 2人以上で同期確認

1. 端末Aで🐧のアカウント、端末Bで🦉のアカウントでログイン。
2. Aで「タスク」を追加し、B側でも表示されることを確認。
3. Bでそのタスクのステータスを「レビュー依頼」にすると、Aの画面にも反映されることを確認。
4. Aで曲リスト → ヒートストアの詳細 → 追記メモを変更し、B側でも同じ値が表示されることを確認。
5. 練習タイテのスロット1の名称、時間、備考を変更して、他の端末に反映されることを確認。
6. セトリのスロット1で曲を追加・移動し、B側でも同じ順番になることを確認。
7. 第3のメンバーにもログインしてもらう。
8. Firebaseのメンバーリストにないアカウントと未ログイン状態では、曲と歌詞を表示できないことを確認。

変更時は`onValue`でFirebaseの更新を受け取り、変更したタスク・列・セル・スロット内項目に対するフィールド単位の書き込みを行います。ただし、**同一セルや同じスロットの曲順を同時編集した場合は最終更新により競合する場合があります**。運用開始時は同一項目の同時編集を避けるのがおすすめです。

## 重要なセキュリティ・運用上の注意

- **過去に公開したv4の`details.js`や`songs.js`には曲・歌詞が含まれます。** このv5では公開ソースから削除しましたが、**GitHubの旧コミット履歴、過去の公開URL、第三者が取得済みのコピーは消えません。** 非公開化が必要ならGit履歴の整理を別途検討してください。履歴を書き換えても公開済み情報の完全な回収はできません。
- Realtime Databaseの読み取りは、**ログイン済み・許可済みの3 UIDだけ**をSecurity Rulesで許可します。UIを隠すだけの設計ではありません。
- Webアプリは現在、**オンライン前提**です。Firebase Web SDKはログアウト/再起動後までの共有データのオフライン永続化を保証しないため、通信がない場合は共有情報を取得できません。旧版のような完全オフライン運用ではありません。
- Cloud版への移行時にローカル保存`koryosan.app.v1`を**勝手に削除しません**。バックアップ後、アプリの「曲リスト」→保管箱→「旧版データ削除」で削除できます。
- 曲・歌詞の公開JSに埋め込みをやめ、`songs.js`／`details.js`は公開しても中身を持たない空の受け皿にしました。曲・構成・歌詞はFirebaseからのみ読み込みます。
- 共有データをローカルストレージに保存せず、並び順・選択中のスロット・完了タスク表示など**個人の画面設定のみ**を`koryosan.preferences.v5`に保存します。メトロノームの設定は従来どおり端末内です。
- データはRealtime Databaseのロック済み権限のもとで読み書きします。Realtime Databaseの`.validate`ルールなど、データ形式検証を本番運用前に追加してください。
- 認証トークンを自身で保存したり、他人のアカウントを共有したりしないでください。Firebase設定のクライアント値は秘密鍵ではありませんが、サービスアカウントJSONなどの管理者秘密鍵はGitHubへ絶対アップロードしないでください。
- Firebaseの利用枠・料金はFirebase Consoleで確認してください。使用量に応じて無料枠の上限に達する可能性があります。
- **検証範囲**：PC/スマホのブラウザ模擬環境で画面構成、8曲とヒートストア15区間のFirebase JSON変換、タスク・歌詞メモ・練習タイテ・セトリの差分生成をテストしました。**実際のFirebase資格情報によるログインと複数端末での同期は、設定情報がないため未検証**です。

## ファイル一覧

```text
Koryosan_PWA_Firebase_v5/
├── index.html                 # 認証ゲートとPWA
├── firebase-config.js         # ★ここにFirebase Web設定を貼り付ける
├── firebase-client.js         # Firebase Auth / Realtime DB通信
├── cloud-model.js             # JSON ⇄ 画面データの変換・差分抽出
├── firebase-auth.css          # ログイン画面
├── app.js                     # 5画面・共有編集UI
├── styles.css                 # PC/スマホ対応
├── songs.js                   # 公開の曲データなし
├── details.js                 # 公開の歌詞データなし
├── metronome.js               # 個人用メトロノーム
├── sw.js                      # v5オフラインキャッシュ（公開コードのみ）
├── manifest.webmanifest
└── icons/                     # 添付アイコン
```

関連公式資料：
- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/database/web/read-and-write
- https://firebase.google.com/docs/database/security
