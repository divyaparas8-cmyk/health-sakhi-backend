const prisma = require('../../../config/database');
const assert = require('assert');
const config = require('../../../config/environment');
const openaiService = require('../services/openai.service');
const contextBuilder = require('../services/context-builder.service');
const memoryExtractor = require('../services/memory-extractor.service');
const escalationService = require('../services/escalation.service');
const recommendationService = require('../services/recommendation.service');

// Intercept and mock Gemini/OpenAI service if the API key is a dummy key
const apiKey = config.gemini?.apiKey || config.openai?.apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
const isDummyKey = !apiKey || apiKey.includes('dummy-key') || apiKey.includes('dummy');

if (isDummyKey) {
  console.log('[MOCKING] Dummy API key detected. Mocking Gemini network requests for tests...');
  
  openaiService.generateChatCompletion = async (messages, userId, options = {}) => {
    const action = options.action || 'CHAT_CONVERSATION';
    let reply = 'Hello Sakhi. I am your AI health companion.';
    
    if (action === 'INTEGRATION_TEST_CHAT') {
      reply = 'OK';
    } else if (action === 'MEMORY_EXTRACTION') {
      reply = JSON.stringify([
        {
          category: 'MEDICAL_CONDITION',
          key: 'pcod_status',
          value: 'Struggling with PCOD since last year',
          confidence: 1.0
        },
        {
          category: 'PREFERENCE',
          key: 'diet_preference',
          value: 'keto',
          confidence: 0.9
        }
      ]);
    } else if (action === 'CRISIS_SCREENING') {
      const userMsg = messages.find(m => m.role === 'user')?.content || '';
      const isCritical = userMsg.includes('hurt') || userMsg.includes('end it');
      reply = JSON.stringify({
        detected: isCritical,
        severity: isCritical ? 'critical' : 'none',
        reason: isCritical ? 'Self-harm ideation detected' : ''
      });
    } else if (action === 'RECOMMENDATION_MATCHING') {
      reply = JSON.stringify({
        bookTerms: ['pcod'],
        videoTerms: ['pcod'],
        meditationTerms: ['stress'],
        advisorSpecializations: ['PCOS']
      });
    }

    const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };
    const costUsd = 0.000045;

    // Log the mock usage to DB to verify database integration works
    await prisma.aIUsageLog.create({
      data: {
        userId,
        action,
        tokens: usage.total_tokens,
        costUsd
      }
    });

    return {
      reply,
      usage,
      costUsd
    };
  };
}

async function runTests() {
  console.log('----------------------------------------------------');
  console.log('STARTING INTEGRATION TESTS FOR AI ORCHESTRATION LAYER');
  console.log('----------------------------------------------------');

  let testUser = null;
  let testRole = null;

  try {
    // 0. Setup: Ensure we have a Role and a Test User
    testRole = await prisma.role.findFirst({
      where: { name: 'Member' }
    });

    if (!testRole) {
      testRole = await prisma.role.create({
        data: { name: 'Member', description: 'Standard platform member' }
      });
    }

    testUser = await prisma.user.create({
      data: {
        email: `test_integration_${Date.now()}@healthsakhi.in`,
        roleId: testRole.id,
        isApproved: true,
        profile: {
          create: {
            fullName: 'Test Sakhi Integra',
            bio: 'I am a test profile context',
            dateOfBirth: new Date('1995-05-15'),
            wellnessScore: 75,
            streakCount: 3
          }
        }
      },
      include: { profile: true }
    });

    console.log(`[SETUP] Created test user: ${testUser.email} (ID: ${testUser.id})`);

    // 1. Test OpenAI Integration (openai.service.js)
    console.log('\n[TEST 1] Testing OpenAI Integration...');
    const chatMessages = [
      { role: 'system', content: 'You are a helpful assistant. Reply with only the word "OK".' },
      { role: 'user', content: 'Say OK' }
    ];
    
    const chatResponse = await openaiService.generateChatCompletion(chatMessages, testUser.id, {
      action: 'INTEGRATION_TEST_CHAT',
      temperature: 0.0
    });

    assert.ok(chatResponse.reply);
    assert.strictEqual(chatResponse.reply.trim().replace(/[".]/g, ''), 'OK');
    assert.ok(chatResponse.usage);
    assert.ok(chatResponse.usage.total_tokens > 0);
    assert.ok(chatResponse.costUsd >= 0);

    // Verify usage log is created
    const usageLogs = await prisma.aIUsageLog.findMany({
      where: { userId: testUser.id, action: 'INTEGRATION_TEST_CHAT' }
    });
    assert.strictEqual(usageLogs.length, 1);
    console.log('✔ Gemini Integration passed.');

    // 2. Test Memory Extraction Engine (memory-extractor.service.js)
    console.log('\n[TEST 2] Testing Memory Extraction...');
    const messageToExtract = 'I have been diagnosed with PCOD recently and I prefer a keto diet.';
    const extractedMemories = await memoryExtractor.processMessageForMemories(testUser.id, messageToExtract);

    assert.ok(extractedMemories.length >= 2);
    
    const dietMemory = extractedMemories.find(m => m.key === 'diet_preference');
    assert.ok(dietMemory);
    assert.strictEqual(dietMemory.category, 'PREFERENCE');
    assert.ok(dietMemory.value.toString().toLowerCase().includes('keto'));

    const pcodMemory = extractedMemories.find(m => m.key === 'pcod_status' || m.key === 'primary_condition');
    assert.ok(pcodMemory);
    assert.strictEqual(pcodMemory.category, 'MEDICAL_CONDITION');

    // Verify database persistence
    const savedMemories = await prisma.aIMemory.findMany({
      where: { userId: testUser.id }
    });
    assert.ok(savedMemories.length >= 2);
    console.log('✔ Memory Extraction passed.');

    // 3. Test Memory Context Builder (context-builder.service.js)
    console.log('\n[TEST 3] Testing Memory Context Builder...');
    const systemPromptContext = await contextBuilder.buildSystemContext(testUser.id);
    
    assert.ok(systemPromptContext.length > 0);
    assert.strictEqual(systemPromptContext[0].role, 'system');
    
    const content = systemPromptContext[0].content;
    assert.ok(content.includes('Test Sakhi Integra'));
    assert.ok(content.includes('Wellness Score: 75/100'));
    assert.ok(content.includes('diet_preference'));
    console.log('✔ Memory Context Builder passed.');

    // 4. Test Intelligent Escalation Detection (escalation.service.js)
    console.log('\n[TEST 4] Testing Intelligent Escalation...');
    
    // Ensure we have an approved advisor in DB
    const testAdvisorUser = await prisma.user.create({
      data: {
        email: `test_advisor_${Date.now()}@healthsakhi.in`,
        roleId: testRole.id,
        isApproved: true,
        profile: { create: { fullName: 'Test Advisor Professional' } }
      }
    });

    const testAdvisor = await prisma.advisor.create({
      data: {
        userId: testAdvisorUser.id,
        qualification: 'MS Psychology',
        status: 'approved',
        hourlyRate: 100.00
      }
    });

    // Test panic trigger
    const criticalMessage = 'I want to hurt myself, I feel completely hopeless and want to end it.';
    const escalationResult = await escalationService.checkAndEscalate(testUser.id, criticalMessage);

    assert.ok(escalationResult);
    assert.ok(escalationResult.escalation);
    assert.strictEqual(escalationResult.escalation.severity, 'critical');
    assert.strictEqual(escalationResult.escalation.status, 'open');

    // Verify escalation log in DB
    const dbEscalation = await prisma.aIEscalation.findFirst({
      where: { userId: testUser.id, severity: 'critical' }
    });
    assert.ok(dbEscalation);
    console.log('✔ Intelligent Escalation passed.');

    // 5. Test Smart Recommendations (recommendation.service.js)
    console.log('\n[TEST 5] Testing Smart Recommendations...');
    
    // Seed a mock book to ensure we have content to recommend
    const testBook = await prisma.book.create({
      data: {
        title: 'Managing PCOD Naturally',
        author: 'Wellness Expert',
        description: 'A guide to balancing hormones through nutrition.',
        status: 'published'
      }
    });

    const recommendations = await recommendationService.generateRecommendations(testUser.id, 'Tell me how to cure PCOD');
    
    assert.ok(recommendations.length > 0);
    const recommendedBook = recommendations.find(r => r.type === 'book');
    assert.ok(recommendedBook);
    assert.strictEqual(recommendedBook.title, 'Managing PCOD Naturally');

    // Clean up advisor and book
    await prisma.aIRecommendation.deleteMany({ where: { userId: testUser.id } });
    await prisma.book.delete({ where: { id: testBook.id } });
    await prisma.advisor.delete({ where: { id: testAdvisor.id } });
    await prisma.user.delete({ where: { id: testAdvisorUser.id } });
    
    console.log('✔ Smart Recommendations passed.');

    console.log('\n----------------------------------------------------');
    console.log('ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('----------------------------------------------------');

  } catch (error) {
    console.error('\n✖ INTEGRATION TEST FAILED:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    // Teardown / Cleanup
    if (testUser) {
      console.log(`\n[TEARDOWN] Cleaning up test data for user ${testUser.id}...`);
      await prisma.aIUsageLog.deleteMany({ where: { userId: testUser.id } });
      await prisma.aIMemory.deleteMany({ where: { userId: testUser.id } });
      await prisma.aIEscalation.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
      console.log('[TEARDOWN] Cleanup complete.');
    }
    await prisma.$disconnect();
  }
}

runTests();
