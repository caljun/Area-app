#!/bin/bash

echo "🚀 Area App バックエンド起動スクリプト"
echo "======================================"

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install

# Prismaクライアントの生成
echo "🔧 Prismaクライアントを生成中..."
npm run db:generate

# データベーススキーマの同期
echo "🔄 データベーススキーマを同期中..."
npm run db:push

# 開発サーバーの起動
echo "🚀 開発サーバーを起動中..."
npm run dev
