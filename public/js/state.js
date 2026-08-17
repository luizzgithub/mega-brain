/** Shared application state */
export const STATE = {
  token: localStorage.getItem('mc_token') || null,
  user: JSON.parse(localStorage.getItem('mc_user') || 'null'),
  conversationId: null,
  mediaRecorder: null,
  audioChunks: [],
  recording: false,
  transcriptionHistory: [],
  pendingTranscriptionId: null,
};
