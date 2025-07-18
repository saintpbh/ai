// 음성 입력 및 출력 시스템
class VoiceSystem {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSpeaking = false;
        this.supported = this.checkSupport();
        
        this.initSpeechRecognition();
        this.initSpeechSynthesis();
    }

    // 브라우저 지원 확인
    checkSupport() {
        const recognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        const synthesisSupported = 'speechSynthesis' in window;
        
        console.log('음성 인식 지원:', recognitionSupported);
        console.log('음성 합성 지원:', synthesisSupported);
        
        return recognitionSupported && synthesisSupported;
    }

    // 음성 인식 초기화
    initSpeechRecognition() {
        if (!this.supported) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // 음성 인식 설정
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'ko-KR';
        this.recognition.maxAlternatives = 1;

        // 이벤트 핸들러
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateVoiceUI();
            console.log('음성 인식 시작');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('음성 인식 결과:', transcript);
            
            // 입력 필드에 텍스트 설정
            this.setInputText(transcript);
            
            // 자동으로 메시지 전송 (챗봇 모드에서만)
            if (window.isChatbotMode) {
                setTimeout(() => {
                    this.sendMessage(transcript);
                }, 500);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('음성 인식 오류:', event.error);
            this.isListening = false;
            this.updateVoiceUI();
            
            let errorMessage = '음성 인식 오류가 발생했습니다.';
            switch (event.error) {
                case 'no-speech':
                    errorMessage = '음성이 감지되지 않았습니다. 다시 시도해주세요.';
                    break;
                case 'audio-capture':
                    errorMessage = '마이크에 접근할 수 없습니다. 권한을 확인해주세요.';
                    break;
                case 'not-allowed':
                    errorMessage = '마이크 사용 권한이 거부되었습니다.';
                    break;
                case 'network':
                    errorMessage = '네트워크 오류가 발생했습니다.';
                    break;
            }
            
            this.showVoiceError(errorMessage);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateVoiceUI();
            console.log('음성 인식 종료');
        };
    }

    // 음성 합성 초기화
    initSpeechSynthesis() {
        if (!this.synthesis) return;

        // 한국어 음성 찾기
        this.voices = this.synthesis.getVoices();
        this.koreanVoice = this.voices.find(voice => 
            voice.lang.includes('ko') || voice.lang.includes('ko-KR')
        ) || this.voices[0];

        // 음성 목록 업데이트 이벤트
        this.synthesis.onvoiceschanged = () => {
            this.voices = this.synthesis.getVoices();
            this.koreanVoice = this.voices.find(voice => 
                voice.lang.includes('ko') || voice.lang.includes('ko-KR')
            ) || this.voices[0];
        };
    }

    // 음성 인식 시작/중지
    toggleSpeechRecognition() {
        if (!this.supported) {
            this.showVoiceError('이 브라우저는 음성 기능을 지원하지 않습니다.');
            return;
        }

        if (this.isListening) {
            this.stopSpeechRecognition();
        } else {
            this.startSpeechRecognition();
        }
    }

    // 음성 인식 시작
    startSpeechRecognition() {
        if (!this.recognition) return;
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('음성 인식 시작 실패:', error);
            this.showVoiceError('음성 인식을 시작할 수 없습니다.');
        }
    }

    // 음성 인식 중지
    stopSpeechRecognition() {
        if (!this.recognition) return;
        
        try {
            this.recognition.stop();
        } catch (error) {
            console.error('음성 인식 중지 실패:', error);
        }
    }

    // 음성 합성 (TTS)
    speak(text, options = {}) {
        if (!this.synthesis || !this.koreanVoice) {
            console.warn('음성 합성을 사용할 수 없습니다.');
            return;
        }

        // 이전 음성 중지
        this.stopSpeaking();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // 음성 설정
        utterance.voice = this.koreanVoice;
        utterance.rate = options.rate || 1.0; // 속도 (0.1 ~ 10)
        utterance.pitch = options.pitch || 1.0; // 음조 (0 ~ 2)
        utterance.volume = options.volume || 1.0; // 볼륨 (0 ~ 1)
        utterance.lang = 'ko-KR';

        // 이벤트 핸들러
        utterance.onstart = () => {
            this.isSpeaking = true;
            this.updateVoiceUI();
            console.log('음성 출력 시작:', text.substring(0, 50) + '...');
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.updateVoiceUI();
            console.log('음성 출력 종료');
        };

        utterance.onerror = (event) => {
            console.error('음성 출력 오류:', event.error);
            this.isSpeaking = false;
            this.updateVoiceUI();
        };

        this.synthesis.speak(utterance);
    }

    // 음성 출력 중지
    stopSpeaking() {
        if (this.synthesis && this.isSpeaking) {
            this.synthesis.cancel();
            this.isSpeaking = false;
            this.updateVoiceUI();
        }
    }

    // 입력 필드에 텍스트 설정
    setInputText(text) {
        const searchInput = document.getElementById('search-input');
        const chatbotInput = document.getElementById('chatbot-input');
        
        if (searchInput && searchInput.style.display !== 'none') {
            searchInput.value = text;
            searchInput.focus();
        } else if (chatbotInput) {
            chatbotInput.value = text;
            chatbotInput.focus();
        }
    }

    // 메시지 전송 (챗봇 모드)
    sendMessage(text) {
        const chatbotSendBtn = document.getElementById('chatbot-send-btn');
        if (chatbotSendBtn) {
            // 입력 필드에 텍스트 설정
            const chatbotInput = document.getElementById('chatbot-input');
            if (chatbotInput) {
                chatbotInput.value = text;
            }
            
            // 전송 버튼 클릭
            chatbotSendBtn.click();
        }
    }

    // 음성 UI 업데이트
    updateVoiceUI() {
        const voiceBtn = document.getElementById('voice-btn');
        const voiceStatus = document.getElementById('voice-status');
        
        if (voiceBtn) {
            if (this.isListening) {
                voiceBtn.innerHTML = '🎤';
                voiceBtn.classList.add('listening');
                voiceBtn.title = '음성 인식 중지';
            } else if (this.isSpeaking) {
                voiceBtn.innerHTML = '🔊';
                voiceBtn.classList.add('speaking');
                voiceBtn.title = '음성 출력 중지';
            } else {
                voiceBtn.innerHTML = '🎤';
                voiceBtn.classList.remove('listening', 'speaking');
                voiceBtn.title = '음성 입력 시작';
            }
        }

        if (voiceStatus) {
            if (this.isListening) {
                voiceStatus.textContent = '듣는 중...';
                voiceStatus.style.color = '#4CAF50';
            } else if (this.isSpeaking) {
                voiceStatus.textContent = '말하는 중...';
                voiceStatus.style.color = '#2196F3';
            } else {
                voiceStatus.textContent = '';
            }
        }
    }

    // 음성 오류 메시지 표시
    showVoiceError(message) {
        // 토스트 메시지 표시
        const toast = document.createElement('div');
        toast.className = 'voice-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        // 3초 후 제거
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 음성 설정 가져오기
    getVoiceSettings() {
        return {
            enabled: localStorage.getItem('voiceEnabled') === 'true',
            autoSpeak: localStorage.getItem('autoSpeak') === 'true',
            rate: parseFloat(localStorage.getItem('voiceRate')) || 1.0,
            pitch: parseFloat(localStorage.getItem('voicePitch')) || 1.0,
            volume: parseFloat(localStorage.getItem('voiceVolume')) || 1.0
        };
    }

    // 음성 설정 저장
    saveVoiceSettings(settings) {
        localStorage.setItem('voiceEnabled', settings.enabled);
        localStorage.setItem('autoSpeak', settings.autoSpeak);
        localStorage.setItem('voiceRate', settings.rate);
        localStorage.setItem('voicePitch', settings.pitch);
        localStorage.setItem('voiceVolume', settings.volume);
    }

    // 자동 음성 출력 (AI 응답 시)
    autoSpeakResponse(response) {
        const settings = this.getVoiceSettings();
        if (settings.enabled && settings.autoSpeak) {
            this.speak(response, {
                rate: settings.rate,
                pitch: settings.pitch,
                volume: settings.volume
            });
        }
    }
}

// 전역 음성 시스템 인스턴스
window.voiceSystem = new VoiceSystem(); 