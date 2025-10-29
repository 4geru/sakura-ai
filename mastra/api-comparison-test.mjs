// API-based comparison test
import { writeFileSync, readFileSync } from 'fs';

const API_BASE = 'http://localhost:4111/api';

// Load quiz questions from CSV
function loadQuizQuestions() {
  try {
    const csvContent = readFileSync('../quiz.csv', 'utf-8');
    const lines = csvContent.split('\n').slice(1); // Skip header
    const questions = [];
    
    for (const line of lines) {
      if (line.trim()) {
        // Proper CSV parsing for quoted fields
        const match = line.match(/^\d+,"([^"]+)"/);
        if (match && match[1]) {
          questions.push(match[1]);
        }
      }
    }
    
    console.log(`Loaded ${questions.length} quiz questions from CSV`);
    return questions.slice(0, 3); // Use first 3 questions for testing
  } catch (error) {
    console.error('Failed to load quiz.csv, using fallback questions:', error.message);
    return [
      "日本酒について教えてください",
      // "純米酒の特徴は何ですか",
      // "吟醸酒の製造方法について"
    ];
  }
}

// Get quiz questions
const testQuestions = loadQuizQuestions();

async function callAPI(endpoint, body) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    throw error;
  }
}

async function testAgent(agentName, message) {
  return await callAPI(`/agents/${agentName}/generate`, {
    messages: [{ role: 'user', content: message }]
  });
}

async function runComparisonTest() {
  console.log('Starting API-based comparison test...');
  
  // First, check available agents
  try {
    const agentsResponse = await fetch(`${API_BASE}/agents`);
    
    if (agentsResponse.ok) {
      const agents = await agentsResponse.json();
      console.log('Available agents:', Object.keys(agents));
      
      // Check if our Sakura agents are available
      if (!agents.sakuraDocsAgent) {
        console.warn('sakuraDocsAgent not found');
      }
      if (!agents.sakuraChatAgent) {
        console.warn('sakuraChatAgent not found');
      }
    }
  } catch (error) {
    console.error('Failed to fetch agents:', error.message);
  }
  
  const results = [];
  
  console.log(`Running comparison test with ${testQuestions.length} quiz questions...`);
  
  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    console.log(`Testing question ${i + 1}/${testQuestions.length}: ${question.slice(0, 60)}...`);
    
    let docsQueryResult = null;
    let docsChatResult = null;
    let docsQueryTime = 0;
    let docsChatTime = 0;
    
    try {
      // Test sakuraDocsAgent (uses documents_query tool)
      const queryStart = Date.now();
      try {
        docsQueryResult = await testAgent('sakuraDocsAgent', question);
        docsQueryTime = Date.now() - queryStart;
      } catch (error) {
        docsQueryResult = { error: error.message };
        docsQueryTime = Date.now() - queryStart;
      }
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test sakuraChatAgent (uses documents_chat tool)  
      const chatStart = Date.now();
      try {
        docsChatResult = await testAgent('sakuraChatAgent', question);
        docsChatTime = Date.now() - chatStart;
      } catch (error) {
        docsChatResult = { error: error.message };
        docsChatTime = Date.now() - chatStart;
      }
      
      results.push({
        question,
        docsQueryResult,
        docsChatResult,
        docsQueryTime,
        docsChatTime,
        timestamp: new Date().toISOString()
      });
      
      // Wait between questions
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`Error processing question ${i + 1}:`, error);
      results.push({
        question,
        docsQueryResult: { error: error.message },
        docsChatResult: { error: error.message },
        docsQueryTime: 0,
        docsChatTime: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log progress after each question (since we only have 3)
    console.log(`Completed ${i + 1}/${testQuestions.length} questions`);
  }
  
  return results;
}

function analyzeResults(results) {
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
  
  let validQueryTimes = [];
  let validChatTimes = [];
  
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

// Run the test
try {
  const results = await runComparisonTest();
  
  console.log('\\n=== Comparison Test Completed ===');
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = `api-comparison-results-${timestamp}.json`;
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${resultsFile}`);
  
  // Generate analysis
  const analysis = analyzeResults(results);
  const analysisFile = `api-comparison-analysis-${timestamp}.json`;
  writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
  console.log(`Analysis saved to: ${analysisFile}`);
  
  // Print summary
  console.log('\\n=== Summary ===');
  console.log(`Total questions: ${analysis.totalQuestions}`);
  console.log(`Docs Query - Success: ${analysis.docsQueryStats.successCount}, Errors: ${analysis.docsQueryStats.errorCount}, Avg time: ${analysis.docsQueryStats.averageTime.toFixed(2)}ms`);
  console.log(`Docs Chat - Success: ${analysis.docsChatStats.successCount}, Errors: ${analysis.docsChatStats.errorCount}, Avg time: ${analysis.docsChatStats.averageTime.toFixed(2)}ms`);
  console.log(`Speed comparison - Query faster: ${analysis.comparison.queryFaster}, Chat faster: ${analysis.comparison.chatFaster}`);
  console.log(`Average time difference: ${analysis.comparison.timeDifference.toFixed(2)}ms`);
  
} catch (error) {
  console.error('Test failed:', error);
  process.exit(1);
}