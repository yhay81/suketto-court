# 助っ人コート

フットサルの一開催について、FP/GKの不足枠を公開し、匿名応募の採否と参加案内まで完了するWebサービスです。

## Product boundary

- 一開催ごとの未来の募集だけを扱い、古い募集は自動終了する
- 応募者の氏名、メール、電話番号、外部プロフィールを集めない
- 主催者と応募者は推測困難な管理URL・確認URLを使う
- 参加案内は採用された応募者だけに表示する
- 決済、本人確認、恒久プロフィール、画像投稿、公開連絡先は持たない
- 匿名の操作イベントをD1に45日保存する

## Development

Node.js 24 と npm 11 を使用します。

```powershell
npm install
npm run check
npm test
npm run build
```

ローカル実行は `npm run dev`、Cloudflareへの公開は `npm run deploy` です。

## Public URL

<https://suketto-court.yhay81.com>
