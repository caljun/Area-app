#!/bin/bash

echo "🔄 データベーススキーマを更新しています..."

# Prismaクライアントを再生成
echo "📦 Prismaクライアントを再生成中..."
npx prisma generate

# データベースにスキーマを適用
echo "🗄️ データベースにスキーマを適用中..."
npx prisma db push

echo "✅ データベーススキーマの更新が完了しました！"
echo "🚀 サーバーを再起動してください"
