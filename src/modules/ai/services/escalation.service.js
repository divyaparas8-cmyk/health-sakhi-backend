const prisma = require('../../../config/database');
const logger = require('../../../utils/logger');
const openaiService = require('./openai.service');

/**
 * Analyze user message using OpenAI to detect depression, self-harm, abuse, or severe anxiety.
 */
const detectEscalationNeeded = async (userId, messageText) => {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are a professional crisis and wellness screening agent. Analyze the user's message for any of the following indicators:
1. Deep depression: expressing hopelessness, worthlessness, or extreme despair.
2. Self-harm / Suicide: active or passive thoughts of hurting oneself or ending life.
3. Abuse indicators: signs of physical, sexual, or emotional domestic abuse or dangerous environments.
4. Severe anxiety: panic attacks, intense fear, extreme distress.

Output MUST be a valid JSON object. Do NOT wrap output in markdown code blocks or add any text/comments outside the JSON structure.

The JSON object must contain these fields:
- detected: Boolean (true if any of the above indicators are present)
- riskLevel: String (must be one of: 'low', 'moderate', 'high', 'imminent', or 'none')
- intent: String (must be one of: 'Relationship', 'Mental Health', 'Finance', 'Medical', 'General Chat', 'Self-Harm', 'Violence', 'Productivity', 'Women\'s Health')
- reason: String (brief summary explaining the indicator found, or empty if none)

Guidelines for riskLevel:
- low: general sadness, mild anxiety or mild hopelessness.
- moderate: passive self-harm or suicidal thoughts without explicit plans, or general relationship conflicts.
- high: active thoughts of self-harm, suicide, or severe ongoing abuse.
- imminent: active plans to self-harm, immediate danger of suicide, or active attack.

Example Output (positive):
{"detected": true, "riskLevel": "high", "intent": "Self-Harm", "reason": "Self-harm ideation detected"}

Example Output (negative):
{"detected": false, "riskLevel": "none", "intent": "General Chat", "reason": ""}`
      },
      {
        role: 'user',
        content: `Screen this message: "${messageText}"`
      }
    ];

    const result = await openaiService.generateChatCompletion(messages, userId, {
      action: 'CRISIS_SCREENING',
      temperature: 0.1,
      max_tokens: 200
    });

    let cleanedReply = result.reply.trim();
    if (cleanedReply.startsWith('```json')) {
      cleanedReply = cleanedReply.substring(7, cleanedReply.length - 3).trim();
    } else if (cleanedReply.startsWith('```')) {
      cleanedReply = cleanedReply.substring(3, cleanedReply.length - 3).trim();
    }

    const assessment = JSON.parse(cleanedReply);
    return {
      detected: !!assessment.detected,
      riskLevel: assessment.riskLevel || 'none',
      intent: assessment.intent || 'General Chat',
      reason: assessment.reason || ''
    };
  } catch (error) {
    logger.error(`Error screening message for escalation: ${error.message}`);
    return { detected: false, riskLevel: 'none', intent: 'General Chat', reason: '' };
  }
};

/**
 * Handle creation of escalation records and advisor recommendation.
 */
const handleEscalation = async (userId, screeningResult) => {
  const { riskLevel, intent, reason } = screeningResult;

  try {
    // 1. Find a suitable approved advisor (e.g. specialized in counseling, wellness or general advisor)
    const activeAdvisor = await prisma.advisor.findFirst({
      where: {
        status: 'approved',
        specializations: {
          some: {
            specializationName: {
              in: ['Mental Health', 'Counseling', 'Psychology', 'Wellness Coaching']
            }
          }
        }
      },
      include: {
        user: { include: { profile: true } }
      }
    }) || await prisma.advisor.findFirst({
      where: { status: 'approved' },
      include: { user: { include: { profile: true } } }
    });

    // 2. Create the escalation entry
    const escalation = await prisma.aIEscalation.create({
      data: {
        userId,
        advisorId: activeAdvisor ? activeAdvisor.id : null,
        severity: riskLevel,
        reason: `[Intent: ${intent}] ${reason}`,
        status: 'open'
      }
    });

    logger.warn(`Intelligent Escalation Triggered for User ${userId}. Escalation ID: ${escalation.id}. Severity/RiskLevel: ${riskLevel}`);

    return {
      escalation,
      riskLevel,
      intent,
      recommendedAdvisor: activeAdvisor ? {
        id: activeAdvisor.id,
        fullName: activeAdvisor.user?.profile?.fullName || 'Wellness Counselor',
        photoUrl: activeAdvisor.photoUrl,
        specializations: activeAdvisor.specializations || []
      } : null
    };
  } catch (error) {
    logger.error(`Error generating escalation entry: ${error.message}`);
    return null;
  }
};

/**
 * High-level orchestration for escalation screening.
 */
const checkAndEscalate = async (userId, messageText) => {
  const screening = await detectEscalationNeeded(userId, messageText);
  if (screening.detected) {
    return await handleEscalation(userId, screening);
  }
  return null;
};

module.exports = {
  detectEscalationNeeded,
  handleEscalation,
  checkAndEscalate
};
