// offlineVoice.js
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

let transcriber = null;
let isModelReady = false;

// 初始化 Whisper 模型（只加载一次）
export async function initOfflineVoice() {
  if (isModelReady) return;
  console.log('🔄 正在加载离线语音模型...');
  transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny' // 小巧模型，适合离线
  );
  isModelReady = true;
  console.log('✅ 离线语音模型加载完成');
}

// 识别音频 Blob（来自麦克风）
export async function recognizeOffline(audioBlob) {
  if (!isModelReady) await initOfflineVoice();
  try {
    const result = await transcriber(audioBlob);
    return result.text.trim();
  } catch (err) {
    console.error('❌ 语音识别失败', err);
    return '';
  }
}