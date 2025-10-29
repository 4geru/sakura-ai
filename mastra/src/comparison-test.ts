// Import from built version
const { mastra } = await import('../.mastra/output/index.mjs');
import { writeFileSync } from 'fs';

// 100個のテスト質問
const testQuestions = [
  // 基本的な情報検索
  "さくらインターネットの会社概要について教えてください",
  "さくらのクラウドサービスの料金体系はどうなっていますか",
  "VPSとクラウドの違いは何ですか",
  "さくらのレンタルサーバーの特徴を教えてください",
  "データセンターの場所はどこにありますか",
  
  // 技術的な質問
  "APIの認証方法について説明してください",
  "負荷分散の設定方法を教えてください",
  "バックアップの取得方法はどうすればよいですか",
  "SSL証明書の設定手順を教えてください",
  "データベースの接続方法について",
  
  // トラブルシューティング
  "サーバーが重い時の対処法は",
  "接続エラーが発生した場合の確認ポイント",
  "メール送信ができない時の原因と対策",
  "ドメイン設定がうまくいかない場合",
  "FTPアクセスできない時の対処法",
  
  // セキュリティ関連
  "セキュリティ対策にはどのようなものがありますか",
  "ファイアウォールの設定方法",
  "アクセス制限の方法について",
  "脆弱性対策について教えてください",
  "不正アクセスを防ぐ方法",
  
  // 運用・監視
  "サーバーの監視方法について",
  "ログの確認方法を教えてください",
  "リソース使用量の確認方法",
  "アラート設定の方法",
  "パフォーマンス最適化のコツ",
  
  // 料金・契約関連
  "料金の支払い方法について",
  "プラン変更は可能ですか",
  "解約手続きの方法",
  "追加料金が発生する場合",
  "無料期間はありますか",
  
  // サポート関連
  "技術サポートの連絡方法",
  "サポート対応時間について",
  "よくある質問の確認方法",
  "障害情報の確認方法",
  "アップデート情報の入手方法",
  
  // 具体的な設定
  "WordPressのインストール方法",
  "PHPのバージョン変更方法",
  "データベースの作成手順",
  "独自ドメインの設定方法",
  "メールアカウントの作成方法",
  
  // 移行関連
  "他社からの移行方法",
  "データ移行の手順",
  "DNS切り替えのタイミング",
  "移行時の注意点",
  "移行後の確認項目",
  
  // 高度な機能
  "CDNの利用方法について",
  "オートスケールの設定",
  "コンテナサービスの使い方",
  "Kubernetesの導入方法",
  "CI/CDパイプラインの構築",
  
  // AI・機械学習関連
  "AI Engine APIの使い方",
  "機械学習モデルのデプロイ方法",
  "GPU利用の方法",
  "データ分析環境の構築",
  "Jupyter Notebookの利用方法",
  
  // ストレージ関連
  "オブジェクトストレージの使い方",
  "ブロックストレージの設定",
  "バックアップストレージについて",
  "ストレージ容量の拡張方法",
  "データ復旧の手順",
  
  // ネットワーク関連
  "VPCの設定方法",
  "ロードバランサーの構築",
  "VPN接続の設定",
  "ネットワークセキュリティグループ",
  "プライベートネットワークの構築",
  
  // 開発環境
  "開発環境の構築方法",
  "ステージング環境の作成",
  "テスト環境の設定",
  "本番環境への反映方法",
  "環境間のデータ同期",
  
  // 比較・選択
  "どのプランを選べばよいですか",
  "他社との違いは何ですか",
  "クラウドとVPSどちらがよいか",
  "スペック選択の指針",
  "コスト最適化の方法",
  
  // 具体的なエラー対応
  "500エラーの対処法",
  "404エラーが出る場合",
  "データベース接続エラー",
  "メモリ不足エラーの対応",
  "ディスク容量不足の解決",
  
  // 新機能・アップデート
  "新機能の使い方",
  "アップデート手順",
  "バージョンアップの注意点",
  "新サービスの利用方法",
  "ベータ版機能について",
  
  // コンプライアンス
  "GDPR対応について",
  "個人情報保護対策",
  "データの保存期間",
  "ログの保持期間",
  "セキュリティ監査対応",
  
  // パフォーマンス
  "表示速度の改善方法",
  "データベース最適化",
  "キャッシュの設定",
  "画像最適化の方法",
  "レスポンス改善のコツ",
  
  // 自動化
  "自動バックアップの設定",
  "自動スケーリング",
  "定期メンテナンスの自動化",
  "ログローテーションの設定",
  "アラート通知の自動化"
];

interface ComparisonResult {
  question: string;
  docsQueryResult: any;
  docsChatResult: any;
  docsQueryTime: number;
  docsChatTime: number;
  timestamp: string;
}

export async function runComparisonTest(): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = [];
  
  console.log('Starting comparison test with 100 questions...');
  
  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    console.log(`Processing question ${i + 1}/100: ${question.slice(0, 50)}...`);
    
    try {
      // Test documents_query (using agent)
      const queryStart = Date.now();
      const docsQueryResult = await mastra.agents.sakuraDocsAgent.generate([
        { role: 'user', content: question }
      ]);
      const docsQueryTime = Date.now() - queryStart;
      
      // Wait a bit to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test documents_chat (using agent)
      const chatStart = Date.now();
      const docsChatResult = await mastra.agents.sakuraChatAgent.generate([
        { role: 'user', content: question }
      ]);
      const docsChatTime = Date.now() - chatStart;
      
      results.push({
        question,
        docsQueryResult,
        docsChatResult,
        docsQueryTime,
        docsChatTime,
        timestamp: new Date().toISOString()
      });
      
      // Wait between questions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`Error processing question ${i + 1}:`, error);
      results.push({
        question,
        docsQueryResult: { error: error instanceof Error ? error.message : 'Unknown error' },
        docsChatResult: { error: error instanceof Error ? error.message : 'Unknown error' },
        docsQueryTime: 0,
        docsChatTime: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log progress every 10 questions
    if ((i + 1) % 10 === 0) {
      console.log(`Completed ${i + 1}/100 questions`);
    }
  }
  
  return results;
}

export function analyzeResults(results: ComparisonResult[]) {
  const analysis = {
    totalQuestions: results.length,
    docsQueryStats: {
      averageTime: 0,
      successCount: 0,
      errorCount: 0,
      totalTime: 0
    },
    docsChatStats: {
      averageTime: 0,
      successCount: 0,
      errorCount: 0,
      totalTime: 0
    },
    comparison: {
      queryFaster: 0,
      chatFaster: 0,
      timeDifference: 0
    }
  };
  
  let validQueryTimes: number[] = [];
  let validChatTimes: number[] = [];
  
  results.forEach(result => {
    // Docs Query stats
    if (result.docsQueryResult.error) {
      analysis.docsQueryStats.errorCount++;
    } else {
      analysis.docsQueryStats.successCount++;
      analysis.docsQueryStats.totalTime += result.docsQueryTime;
      validQueryTimes.push(result.docsQueryTime);
    }
    
    // Docs Chat stats  
    if (result.docsChatResult.error) {
      analysis.docsChatStats.errorCount++;
    } else {
      analysis.docsChatStats.successCount++;
      analysis.docsChatStats.totalTime += result.docsChatTime;
      validChatTimes.push(result.docsChatTime);
    }
    
    // Speed comparison
    if (!result.docsQueryResult.error && !result.docsChatResult.error) {
      if (result.docsQueryTime < result.docsChatTime) {
        analysis.comparison.queryFaster++;
      } else {
        analysis.comparison.chatFaster++;
      }
      analysis.comparison.timeDifference += Math.abs(result.docsQueryTime - result.docsChatTime);
    }
  });
  
  // Calculate averages
  if (validQueryTimes.length > 0) {
    analysis.docsQueryStats.averageTime = analysis.docsQueryStats.totalTime / validQueryTimes.length;
  }
  
  if (validChatTimes.length > 0) {
    analysis.docsChatStats.averageTime = analysis.docsChatStats.totalTime / validChatTimes.length;
  }
  
  if (analysis.comparison.queryFaster + analysis.comparison.chatFaster > 0) {
    analysis.comparison.timeDifference = analysis.comparison.timeDifference / (analysis.comparison.queryFaster + analysis.comparison.chatFaster);
  }
  
  return analysis;
}

// Run the test automatically when this module is imported

// Auto-run the comparison test
(async () => {
  try {
    console.log('Starting comparison test...');
    console.log('Available agents:', Object.keys(mastra.agents || {}));
    console.log('Available tools:', Object.keys(mastra.tools || {}));
    
    if (!mastra.agents?.sakuraDocsAgent) {
      throw new Error('sakuraDocsAgent is not available in mastra.agents');
    }
    if (!mastra.agents?.sakuraChatAgent) {
      throw new Error('sakuraChatAgent is not available in mastra.agents');
    }
    
    const results = await runComparisonTest();
    
    console.log('\n=== Comparison Test Completed ===');
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `comparison-results-${timestamp}.json`;
    writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${resultsFile}`);
    
    // Generate analysis
    const analysis = analyzeResults(results);
    const analysisFile = `comparison-analysis-${timestamp}.json`;
    writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
    console.log(`Analysis saved to: ${analysisFile}`);
    
    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Total questions: ${analysis.totalQuestions}`);
    console.log(`Docs Query - Success: ${analysis.docsQueryStats.successCount}, Errors: ${analysis.docsQueryStats.errorCount}, Avg time: ${analysis.docsQueryStats.averageTime.toFixed(2)}ms`);
    console.log(`Docs Chat - Success: ${analysis.docsChatStats.successCount}, Errors: ${analysis.docsChatStats.errorCount}, Avg time: ${analysis.docsChatStats.averageTime.toFixed(2)}ms`);
    console.log(`Speed comparison - Query faster: ${analysis.comparison.queryFaster}, Chat faster: ${analysis.comparison.chatFaster}`);
    console.log(`Average time difference: ${analysis.comparison.timeDifference.toFixed(2)}ms`);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
})();