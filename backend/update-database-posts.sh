#!/bin/bash

echo "🚀 Area App - 投稿機能用データベース更新スクリプト"
echo "=================================================="

# 環境変数の確認
if [ -z "$DATABASE_URL" ]; then
    echo "❌ エラー: DATABASE_URLが設定されていません"
    echo "   .envファイルでDATABASE_URLを設定してください"
    exit 1
fi

echo "📊 データベースURL: $DATABASE_URL"

# Prismaクライアントの生成
echo "🔧 Prismaクライアントを生成中..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Prismaクライアントの生成に失敗しました"
    exit 1
fi

echo "✅ Prismaクライアントの生成が完了しました"

# データベーススキーマの更新
echo "📝 データベーススキーマを更新中..."
npx prisma db push

if [ $? -ne 0 ]; then
    echo "❌ データベーススキーマの更新に失敗しました"
    echo "   データベース接続を確認してください"
    exit 1
fi

echo "✅ データベーススキーマの更新が完了しました"

# インデックスの作成（GeoJSON用）
echo "🗺️  GeoJSONインデックスを作成中..."
npx prisma db execute --stdin << EOF
db.posts.createIndex({ "location": "2dsphere" })
EOF

if [ $? -eq 0 ]; then
    echo "✅ GeoJSONインデックスの作成が完了しました"
else
    echo "⚠️  GeoJSONインデックスの作成に失敗しました（手動で作成してください）"
fi

echo ""
echo "🎉 データベース更新が完了しました！"
echo ""
echo "📋 追加された機能:"
echo "   • 投稿機能 (Post model)"
echo "   • コメント機能 (Comment model)"
echo "   • いいね機能 (PostLike model)"
echo "   • GeoJSON位置情報インデックス"
echo ""
echo "🔗 新しいAPIエンドポイント:"
echo "   • POST /api/posts - 投稿作成"
echo "   • GET /api/posts - 投稿一覧取得"
echo "   • GET /api/posts/:id - 投稿詳細取得"
echo "   • PATCH /api/posts/:id - 投稿更新"
echo "   • DELETE /api/posts/:id - 投稿削除"
echo "   • POST /api/posts/:id/like - いいね"
echo "   • POST /api/posts/:id/comments - コメント追加"
echo "   • GET /api/posts/nearby - 近くの投稿取得"
echo "   • POST /api/images/upload-post-image - 投稿画像アップロード"
echo "   • POST /api/images/upload-profile-image - プロフィール画像アップロード"
echo "   • POST /api/images/upload-area-image - エリア画像アップロード"
echo ""
echo "🚀 サーバーを再起動して新しい機能をお試しください！"
