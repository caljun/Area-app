#!/bin/bash

echo "🚀 Area App バックエンド - データベース更新スクリプト"
echo "=================================================="

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install

# Prismaクライアントの生成
echo "🔧 Prismaクライアントを生成中..."
npm run db:generate

# データベーススキーマの同期
echo "🔄 データベーススキーマを同期中..."
npm run db:push

echo "✅ データベースの更新が完了しました！"
echo ""
echo "次のステップ:"
echo "1. サーバーを起動: npm run dev"
echo "2. 通知システムのテスト"
echo "3. iOSアプリとの連携テスト"
echo ""
echo "何か問題が発生した場合は、ログを確認してください。"
