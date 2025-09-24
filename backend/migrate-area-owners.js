#!/usr/bin/env node

/**
 * エリア所有者をAreaMemberテーブルに登録するマイグレーションスクリプト
 * 
 * 使用方法:
 * node migrate-area-owners.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateAreaOwners() {
  console.log('🚀 エリア所有者のAreaMember登録マイグレーションを開始...');
  
  try {
    // すべてのエリアを取得
    const areas = await prisma.area.findMany({
      select: {
        id: true,
        userId: true,
        name: true
      }
    });

    console.log(`📊 ${areas.length}個のエリアが見つかりました`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const area of areas) {
      try {
        // 所有者が既にAreaMemberに登録されているかチェック
        const existingMember = await prisma.areaMember.findFirst({
          where: {
            areaId: area.id,
            userId: area.userId
          }
        });

        if (existingMember) {
          console.log(`⏭️  エリア「${area.name}」の所有者は既にAreaMemberに登録済み`);
          skippedCount++;
          continue;
        }

        // 所有者をAreaMemberに登録
        await prisma.areaMember.create({
          data: {
            areaId: area.id,
            userId: area.userId,
            addedBy: area.userId // 自分自身が追加者
          }
        });

        console.log(`✅ エリア「${area.name}」の所有者をAreaMemberに登録しました`);
        processedCount++;

      } catch (error) {
        console.error(`❌ エリア「${area.name}」の処理中にエラー:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📈 マイグレーション完了:');
    console.log(`   ✅ 処理済み: ${processedCount}件`);
    console.log(`   ⏭️  スキップ: ${skippedCount}件`);
    console.log(`   ❌ エラー: ${errorCount}件`);

  } catch (error) {
    console.error('❌ マイグレーション中にエラーが発生:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプト実行
migrateAreaOwners();
