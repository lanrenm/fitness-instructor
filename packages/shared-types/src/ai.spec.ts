import {
  AI_EVENT,
  AI_MESSAGE_ROLE,
  AI_RAG_OWNER_TYPE,
  MODEL_CAPABILITY,
  MODEL_PROTOCOL,
} from './ai';

describe('ai shared types', () => {
  it('AI_EVENT keys are stable', () => {
    expect(Object.values(AI_EVENT)).toEqual(
      expect.arrayContaining(['meta', 'reasoning', 'content', 'citations', 'usage', 'done', 'error'])
    );
  });

  it('AI_RAG_OWNER_TYPE includes all owner types', () => {
    expect(AI_RAG_OWNER_TYPE.TRAINING_SESSION).toBe('training_session');
    expect(AI_RAG_OWNER_TYPE.WORKOUT).toBe('workout');
    expect(AI_RAG_OWNER_TYPE.EXCERCISE).toBe('excercise');
    expect(AI_RAG_OWNER_TYPE.MUSCLE_GROUP).toBe('muscle_group');
    expect(AI_RAG_OWNER_TYPE.MESSAGE).toBe('message');
  });

  it('MODEL_PROTOCOL exposes anthropic + openai-compatible', () => {
    expect(MODEL_PROTOCOL.ANTHROPIC).toBe('anthropic');
    expect(MODEL_PROTOCOL.OPENAI_COMPATIBLE).toBe('openai-compatible');
  });

  it('MODEL_CAPABILITY exposes streamChat / summarize / embed', () => {
    expect(MODEL_CAPABILITY.STREAM_CHAT).toBe('streamChat');
    expect(MODEL_CAPABILITY.SUMMARIZE).toBe('summarize');
    expect(MODEL_CAPABILITY.EMBED).toBe('embed');
  });

  it('AI_MESSAGE_ROLE exposes user/assistant/system', () => {
    expect(AI_MESSAGE_ROLE.USER).toBe('user');
    expect(AI_MESSAGE_ROLE.ASSISTANT).toBe('assistant');
    expect(AI_MESSAGE_ROLE.SYSTEM).toBe('system');
  });
});